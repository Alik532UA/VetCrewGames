import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReserveController, TICK_MS } from './reserve.svelte';
import { TICKS_PER_DAY } from '$lib/reserve/constants';

/**
 * Контролер партії заповідника.
 *
 * Перевіряється саме те, чого немає в чистій симуляції: переклад реального
 * часу в тіки. Час ведеться прямо через `advance()`, без підробленого
 * `requestAnimationFrame` — метод, підмінений у тесті, нічого про гру не
 * доводив би.
 */

const DAY_MS = TICKS_PER_DAY * TICK_MS;
/** Ключ ділянки, у якій ведуться ці тести: сховище розділене по біомах. */
/** Ключ фонду: один документ на всі чотири ділянки. */
const KEY = 'vetcrewgames_reserve.fund';

/** Сховище підставляється явно: jsdom тут `localStorage` не дає. */
function makeStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear()
	} as Storage;
}

let store: Storage;

beforeEach(() => {
	store = makeStorage();
	vi.stubGlobal('localStorage', store);
});

function fresh(): ReserveController {
	const controller = new ReserveController();
	controller.reset(42);
	return controller;
}

/** Що саме лежить у сховищі просто зараз. */
const written = () => JSON.parse(store.getItem(KEY) ?? '{}');

/**
 * Прожити `ms` реального часу кадрами по 16мс — так, як це робить справжній
 * цикл. Одним викликом день не мине: надолуження обмежене чвертю секунди, і
 * саме це обмеження тут перевіряється окремо.
 */
function runFor(controller: ReserveController, ms: number): void {
	for (let elapsed = 0; elapsed < ms; elapsed += 16) controller.advance(16);
}

describe('годинник партії', () => {
	it('перевірка жива: час справді рухає партію', () => {
		const controller = fresh();
		controller.advance(TICK_MS);
		expect(controller.state.ticks).toBe(1);
	});

	it('мілісекунди перекладаються в тіки, а не в кадри', () => {
		const controller = fresh();
		// Один виклик на 200мс і два по 100мс мають дати те саме.
		controller.advance(200);
		expect(controller.state.ticks).toBe(2);
	});

	/**
	 * Залишок від неповного тіку не губиться.
	 *
	 * Кадр триває близько 16мс — жоден не дотягує до 100мс. Якби залишок
	 * відкидався, кожен тік коштував би не 100мс, а цілих сім кадрів, тобто
	 * 112мс, і гра йшла б на 12% повільніше за обіцяне. На екрані це не видно
	 * ніяк: усе рухається, просто трохи не так.
	 *
	 * Дивитися треба на ДРУГИЙ тік і далі. Перший настає в обох випадках
	 * однаково — саме на цьому перша версія цієї перевірки й помилилася,
	 * пропустивши зворотний експеримент із відкинутим залишком.
	 */
	it('недокручені мілісекунди накопичуються, а не зникають', () => {
		const controller = fresh();
		for (let i = 0; i < 6; i++) controller.advance(16);
		expect(controller.state.ticks, '96мс — ще не тік').toBe(0);

		controller.advance(16);
		expect(controller.state.ticks, '112мс — уже тік, 12мс лишилося').toBe(1);

		// Ще 1488мс кадрами по 16мс: разом 1600мс — рівно 16 тіків, ні на один
		// менше. Із відкинутим залишком їх було б 14.
		for (let i = 0; i < 93; i++) controller.advance(16);
		expect(controller.state.ticks, 'тіки в’язнуть — залишок десь губиться').toBe(16);
	});

	it('швидкість множить кількість тіків, а не довжину дня', () => {
		const fast = fresh();
		fast.speed = 5;
		fast.advance(100);
		expect(fast.state.ticks).toBe(5);
		// Партія досі в першому дні: швидкість множить тіки, а не коротшає добу.
		expect(fast.day, 'день так само 300 тіків').toBe(1);
	});

	it('пауза спиняє час, але не втрачає партію', () => {
		const controller = fresh();
		runFor(controller, DAY_MS);
		const stopped = controller.state.ticks;

		controller.speed = 0;
		controller.advance(10_000);
		expect(controller.state.ticks).toBe(stopped);

		controller.speed = 1;
		controller.advance(TICK_MS);
		expect(controller.state.ticks).toBe(stopped + 1);
	});

	/**
	 * Вкладка у фоні не отримує кадрів.
	 *
	 * Без межі повернення через десять хвилин дало б 6 000 тіків одним махом —
	 * двадцять ігрових днів, за які заповідник міг би збанкрутувати, поки на
	 * нього ніхто не дивився. Це не симуляція, це звіт про помилку.
	 */
	it('повернення з фону не прокручує партію на десять хвилин', () => {
		const controller = fresh();
		controller.advance(10 * 60 * 1000);
		expect(controller.state.ticks, 'надолужено більше за чверть секунди').toBeLessThanOrEqual(3);
	});

	it('після кінця гри час стоїть сам', () => {
		const controller = fresh();
		controller.state.gameOver = true;
		runFor(controller, DAY_MS);
		expect(controller.state.ticks).toBe(0);
	});
});

describe('партія і сховище', () => {
	it('нова партія одразу лягає у сховище', () => {
		fresh();
		expect(store.getItem(KEY)).not.toBeNull();
	});

	/**
	 * Зберігаємося на межі доби, а не щокадру: сховище синхронне, і запис
	 * шістдесят разів на секунду підвісив би саме той кадр, який малює гру.
	 */
	it('доба, що скінчилася, потрапляє у сховище; півдня — ні', () => {
		const controller = fresh();

		runFor(controller, DAY_MS / 2);
		expect(written().state.ticks, 'збереглося посеред доби').toBe(0);

		runFor(controller, DAY_MS / 2);
		expect(written().state.ticks).toBe(TICKS_PER_DAY);
	});

	it('хід зберігається одразу, не чекаючи кінця доби', () => {
		const controller = fresh();
		controller.run({ type: 'hire', role: 'vet' }, 'forest');
		expect(written().state.sites.forest.staff.vet).toBe(1);
	});

	it('відхилений хід нічого не зберігає', () => {
		const controller = fresh();
		// Вольєр є, тож відмова буде саме через гроші, а не через відсутнє місце.
		controller.run({ type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } }, 'forest');
		controller.state.budget = 0;
		const before = store.getItem(KEY);

		const result = controller.run(
			{
				type: 'acquire',
				origin: 'official',
				speciesId: 'wolf',
				enclosureId: 1
			},
			'forest'
		);
		expect(result).toEqual({ ok: false, reason: 'no-money' });
		expect(store.getItem(KEY)).toBe(before);
	});

	it('початок піднімає збережену партію, а не починає нову', () => {
		const first = fresh();
		first.run({ type: 'hire', role: 'keeper' }, 'forest');
		runFor(first, DAY_MS * 2);

		const second = new ReserveController();
		second.start();
		expect(second.state.sites.forest.staff.keeper).toBe(1);
		// Дві доби прожито — іде третя.
		expect(second.day).toBe(3);
		expect(second.restoreProblem).toBeNull();
	});

	it('порожнє сховище — це новий заповідник, а не помилка', () => {
		const controller = new ReserveController();
		controller.start();
		expect(controller.restoreProblem).toBeNull();
		expect(controller.state.ticks).toBe(0);
	});

	/**
	 * Побитий сейв не мовчить. Новий заповідник усе одно починається — грати
	 * людина прийшла, — але екран має що їй сказати.
	 */
	it('побитий сейв дає нову партію І причину для екрана', () => {
		store.setItem(KEY, '{"version":1,"state":{"ticks":');
		const controller = new ReserveController();
		controller.start();

		expect(controller.restoreProblem?.reason).toBe('malformed');
		expect(controller.state.ticks).toBe(0);
	});

	it('дві нові партії різняться зерном', () => {
		const seeds = new Set<number>();
		for (const time of [1_000_000, 2_000_000]) {
			vi.spyOn(Date, 'now').mockReturnValue(time);
			const controller = new ReserveController();
			controller.reset();
			seeds.add(controller.state.seed);
		}
		vi.restoreAllMocks();
		expect(seeds.size).toBe(2);
	});
});

describe('вибрана тварина', () => {
	it('картка йде за тваринкою, а не за копією її стану', () => {
		const controller = fresh();
		controller.run({ type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } }, 'forest');
		controller.run(
			{ type: 'acquire', origin: 'rescue', speciesId: 'wolf', enclosureId: 1 },
			'forest'
		);
		controller.selectedId = 1;

		expect(controller.selected?.stage).toBe('recovering');
		controller.state.sites.forest.animals[0].stage = 'healthy';
		expect(controller.selected?.stage, 'картка показує застиглий знімок').toBe('healthy');
	});

	it('нікого не вибрано — картки немає', () => {
		expect(fresh().selected).toBeNull();
	});
});

describe('вибір на карті', () => {
	/** Партія з одним вольєром і вовком у ньому. */
	const withWolf = () => {
		const controller = fresh();
		controller.run({ type: 'build', size: 5, quality: 2, cell: { x: 0, z: 0 } }, 'forest');
		controller.run(
			{ type: 'acquire', origin: 'rescue', speciesId: 'wolf', enclosureId: 1 },
			'forest'
		);
		return controller;
	};

	it('вольєр вибирається сам по собі, без мешканця', () => {
		// Саме це й було зламано: порожній вольєр на карті бачили, а взяти не могли.
		const controller = fresh();
		controller.run({ type: 'build', size: 2, quality: 1, cell: { x: 3, z: 3 } }, 'forest');
		controller.selectEnclosure(1);

		expect(controller.selectedEnclosure?.size).toBe(2);
		expect(controller.selected, 'тварини немає — і картки тварини теж').toBeNull();
	});

	it('одне вікно за раз: тварина знімає вольєр і навпаки', () => {
		/*
		 * Обидві картки спливають над тим самим кутом карти. Два відкритих вікна
		 * означали б одне під іншим — рівно той дефект, через який мінікарта
		 * накривала картку мешканця й закрити її було нічим.
		 */
		const controller = withWolf();

		controller.selectEnclosure(1);
		expect(controller.selectedEnclosureId).toBe(1);

		controller.selectAnimal(1);
		expect(controller.selectedId).toBe(1);
		expect(controller.selectedEnclosureId).toBeNull();

		controller.selectEnclosure(1);
		expect(controller.selectedId).toBeNull();
	});

	it('закриття прибирає обидві мітки', () => {
		const controller = withWolf();
		controller.selectAnimal(1);
		controller.clearSelection();

		expect(controller.selected).toBeNull();
		expect(controller.selectedEnclosure).toBeNull();
	});

	it('знесений вольєр не лишає по собі відкритої картки', () => {
		// Картка читає стан, а не знімок: після знесення показувати нічого.
		const controller = fresh();
		controller.run({ type: 'build', size: 2, quality: 1, cell: { x: 6, z: 6 } }, 'forest');
		controller.selectEnclosure(1);
		controller.run({ type: 'demolish', enclosureId: 1 }, 'forest');

		expect(controller.selectedEnclosure).toBeNull();
	});
});
