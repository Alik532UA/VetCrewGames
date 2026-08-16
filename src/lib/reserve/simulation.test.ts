// @vitest-environment node
// Симуляція не знає ні про DOM, ні про Svelte — і перевірка теж не має знати.
import { describe, expect, it } from 'vitest';
import { createReserve, dayOf, execute, tick } from './simulation';
import type { ReserveCommand, ReserveState } from './types';
import {
	COLLAPSE_DAYS,
	ORIGINS,
	RELEASE_IMPACT,
	STARTING_BUDGET,
	TICKS_PER_DAY
} from './constants';

const day = (state: ReserveState, days = 1) => tick(state, TICKS_PER_DAY * days);
const snapshot = (state: ReserveState) => JSON.stringify(state);

/** Партія з кількох ходів — щоб детермінізм перевірявся не на порожньому стані. */
function play(seed: number, commands: ReserveCommand[], ticks: number): ReserveState {
	const state = createReserve(seed);
	for (const command of commands) execute(state, command);
	tick(state, ticks);
	return state;
}

const SCRIPT: ReserveCommand[] = [
	{ type: 'hire', role: 'vet' },
	{ type: 'hire', role: 'keeper' },
	{ type: 'acquire', origin: 'rescue' },
	{ type: 'acquire', origin: 'rescue' },
	{ type: 'acquire', origin: 'official' }
];

describe('детермінізм', () => {
	it('перевірка жива: партія справді щось змінює', () => {
		const state = play(1, SCRIPT, 10_000);
		expect(state.ticks).toBe(10_000);
		expect(state.animals.length).toBe(3);
	});

	/**
	 * Головна властивість усього ядра. Без неї спільна партія неможлива: два
	 * браузери з одного зерна розійшлися б у різні світи, і побачити це можна
	 * було б аж тоді, коли гравці почали б сперечатися, що в них на екрані.
	 */
	it('те саме зерно й ті самі ходи дають той самий стан після 10 000 тіків', () => {
		expect(snapshot(play(42, SCRIPT, 10_000))).toBe(snapshot(play(42, SCRIPT, 10_000)));
	});

	/**
	 * Зерно справді доходить до результату, а не лежить у стані декорацією.
	 *
	 * Перевірка йде діапазоном, а не парою зерен: єдиний кидок при надходженні
	 * дає «придатна» з імовірністю 0.9, тож навмання взята пара зерен збіглася б
	 * у чотирьох випадках із пʼяти — і тест доводив би лише вдалий вибір.
	 */
	it('зерно вирішує долю тварини', () => {
		const fates = new Set<boolean>();
		for (let seed = 1; seed <= 50; seed++) {
			fates.add(play(seed, [{ type: 'acquire', origin: 'rescue' }], 0).animals[0].releasable);
		}
		expect(fates).toEqual(new Set([true, false]));
	});

	/**
	 * Нарізка тіків не має значення. Інакше гра на слабкому телефоні
	 * розвивалася б інакше, ніж на швидкому, — і це саме той різновид
	 * розбіжності, який у спільній партії не видно, доки не пізно.
	 */
	it('300 тіків одним викликом і 300 по одному дають однаковий стан', () => {
		const bulk = play(7, SCRIPT, 0);
		tick(bulk, TICKS_PER_DAY);

		const drip = play(7, SCRIPT, 0);
		for (let i = 0; i < TICKS_PER_DAY; i++) tick(drip, 1);

		expect(snapshot(drip)).toBe(snapshot(bulk));
	});

	it('пауза не змінює нічого', () => {
		const state = play(3, SCRIPT, 500);
		const before = snapshot(state);
		tick(state, 0);
		expect(snapshot(state)).toBe(before);
	});
});

describe('економіка надходження', () => {
	it('кожен канал бере свою ціну й свою плату «Користі планеті»', () => {
		for (const [origin, terms] of Object.entries(ORIGINS)) {
			const state = createReserve(1);
			execute(state, { type: 'acquire', origin: origin as keyof typeof ORIGINS });

			expect(state.budget, origin).toBe(STARTING_BUDGET - terms.price - terms.logistics);
			expect(state.impact, origin).toBe(terms.impact);
		}
	});

	it('порятунок плюсує, обидві покупки мінусують', () => {
		expect(ORIGINS.rescue.impact).toBeGreaterThan(0);
		expect(ORIGINS.official.impact).toBeLessThan(0);
		expect(ORIGINS['black-market'].impact).toBeLessThan(ORIGINS.official.impact);
	});

	it('без грошей тварина не зʼявляється', () => {
		const state = createReserve(1);
		state.budget = 100;
		const result = execute(state, { type: 'acquire', origin: 'official' });

		expect(result).toEqual({ ok: false, reason: 'no-money' });
		expect(state.animals).toHaveLength(0);
	});
});

describe('випуск у дику природу', () => {
	/** Доводимо тварину до здоровʼя, не покладаючись на випадковість. */
	const readyToRelease = (releasable: boolean) => {
		const state = createReserve(1);
		execute(state, { type: 'acquire', origin: 'rescue' });
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable });
		return state;
	};

	it('дає найбільшу нагороду в грі', () => {
		const state = readyToRelease(true);
		const before = state.impact;

		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({ ok: true });
		expect(state.impact - before).toBe(RELEASE_IMPACT);
		expect(state.animals[0].stage).toBe('released');
	});

	it('хвору не випустити', () => {
		const state = readyToRelease(true);
		state.animals[0].stage = 'recovering';
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'not-healthy'
		});
	});

	it('народжену в неволі не випустити, хоч би якою здоровою вона була', () => {
		const state = readyToRelease(false);
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'not-releasable'
		});
	});

	it('заляканої не випустити: у природі вона не виживе', () => {
		const state = readyToRelease(true);
		state.animals[0].stress = 1;
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'too-stressed'
		});
	});
});

describe('банкрутство', () => {
	const broke = () => {
		const state = createReserve(1);
		execute(state, { type: 'acquire', origin: 'rescue' });
		state.budget = -1;
		day(state);
		return state;
	};

	it('мінус у бюджеті вмикає субсидію, а не кінець гри', () => {
		const state = broke();
		expect(state.subsidy).toBe(true);
		expect(state.gameOver, 'бідність — не провал').toBe(false);
	});

	it('субсидія глушить розширення', () => {
		const state = broke();
		expect(execute(state, { type: 'acquire', origin: 'rescue' })).toEqual({
			ok: false,
			reason: 'subsidy-mode'
		});
		expect(execute(state, { type: 'hire', role: 'vet' })).toEqual({
			ok: false,
			reason: 'subsidy-mode'
		});
	});

	it('але не глушить виживання: час іде, тварини лікуються', () => {
		const state = broke();
		state.staff.vet = 1;
		const before = state.animals[0].recovery;
		day(state);
		expect(state.animals[0].recovery).toBeGreaterThan(before);
	});

	it('вихід у плюс знімає режим', () => {
		const state = broke();
		state.budget = 10_000;
		day(state);
		expect(state.subsidy).toBe(false);
	});
});

describe('умова програшу', () => {
	/** Тримає «Користь планеті» в мінусі рівно стільки днів, скільки просять. */
	const inTheRed = (days: number) => {
		const state = createReserve(1);
		state.impact = -1;
		day(state, days);
		return state;
	};

	it(`${COLLAPSE_DAYS} днів поспіль у мінусі — кінець гри`, () => {
		expect(inTheRed(COLLAPSE_DAYS).gameOver).toBe(true);
	});

	it(`${COLLAPSE_DAYS - 1} днів поспіль — ще ні`, () => {
		const state = inTheRed(COLLAPSE_DAYS - 1);
		expect(state.gameOver).toBe(false);
		expect(state.collapseDays).toBe(COLLAPSE_DAYS - 1);
	});

	/**
	 * Саме через це лічильник і скидається: гра карає за постійну шкоду, а не
	 * за тридцять поганих днів, розкиданих по партії.
	 */
	it(`${COLLAPSE_DAYS} днів із перервою — не кінець гри`, () => {
		const state = createReserve(1);
		state.impact = -1;
		day(state, COLLAPSE_DAYS - 1);

		state.impact = 1; // один день у плюсі
		day(state);
		expect(state.collapseDays, 'вихід у плюс обнуляє лічильник').toBe(0);

		state.impact = -1;
		day(state, COLLAPSE_DAYS - 1);
		expect(state.gameOver).toBe(false);
	});

	it('після кінця гри ходи не приймаються й час стоїть', () => {
		const state = inTheRed(COLLAPSE_DAYS);
		const before = snapshot(state);

		expect(execute(state, { type: 'hire', role: 'vet' })).toEqual({
			ok: false,
			reason: 'game-over'
		});
		tick(state, 1000);
		expect(snapshot(state)).toBe(before);
	});
});

describe('час', () => {
	it('день настає рівно на межі тіків', () => {
		const state = createReserve(1);
		tick(state, TICKS_PER_DAY - 1);
		expect(dayOf(state)).toBe(0);
		tick(state, 1);
		expect(dayOf(state)).toBe(1);
	});
});
