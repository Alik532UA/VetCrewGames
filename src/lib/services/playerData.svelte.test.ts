import { describe, expect, it, vi } from 'vitest';

/**
 * МІСЦЕВА половина рахунку: сховище, рекорди й очищення при виході.
 *
 * Мережі тут немає ЖОДНОЇ, і це видно з самої форми тесту: модуль піднімається
 * без єдиного мока `net/*`. Якби в ньому знову з'явився статичний імпорт бази,
 * побачив би це не цей файл, а `npm run check:build` — бюджет кореневого layout.
 * Синхронізацію судить `playerSync.test.ts`.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати `storage.remove`
 * із `clearLocal()` — червоніє «вихід стирає рахунок і рекорди»; прибрати
 * `Math.max` із `finishGame` — червоніє «гірша партія рекорду не псує».
 */

/** Системна тема має бути детермінованою: `Settings` читає її в конструкторі. */
function stubMatchMedia() {
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
	);
}

function makeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map<string, string>(Object.entries(seed));
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

async function load(seed: Record<string, string> = {}) {
	vi.resetModules();
	const raw = makeStorage(seed);
	vi.stubGlobal('localStorage', raw);
	stubMatchMedia();
	const { playerData } = await import('./playerData.svelte');
	return { playerData, raw };
}

describe('дані гравця', () => {
	it('рахунок і рекорди піднімаються зі сховища', async () => {
		const { playerData } = await load({
			vetcrewgames_score: '140',
			vetcrewgames_records: '{"memory":{"best":9,"plays":4}}'
		});

		expect(playerData.score).toBe(140);
		expect(playerData.recordOf('memory')).toEqual({ best: 9, plays: 4 });
		expect(playerData.recordOf('feeding'), 'у цю гру ще не грали').toBeNull();
	});

	it('зіпсований рекорд не перетворює рекорд на NaN', async () => {
		const { playerData } = await load({
			vetcrewgames_records: '{"memory":{"best":"багато","plays":null}}'
		});

		expect(playerData.recordOf('memory')).toEqual({ best: 0, plays: 0 });
	});

	it('очки лягають у сховище тим самим ключем, що й доти', async () => {
		const { playerData, raw } = await load();

		playerData.addScore(3);
		playerData.addScore(4);

		expect(playerData.score).toBe(7);
		expect(raw.getItem('vetcrewgames_score')).toBe('7');
	});

	it('кінець партії піднімає рекорд і рахує партію', async () => {
		const { playerData } = await load();

		playerData.finishGame('population', 12);
		playerData.finishGame('population', 5);

		// Гірша партія рекорду не псує, але партією рахується.
		expect(playerData.recordOf('population')).toEqual({ best: 12, plays: 2 });
	});

	it('зміна повідомляє того, хто підписався — і нікого більше', async () => {
		const { playerData } = await load();
		const onChange = vi.fn();

		playerData.addScore(1);
		expect(onChange, 'доки ніхто не підписався — повідомляти нікого').not.toHaveBeenCalled();

		playerData.onChange = onChange;
		playerData.addScore(1);
		playerData.finishGame('memory', 2);

		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it('прапорець акаунта переживає перезавантаження', async () => {
		const { playerData, raw } = await load();

		playerData.markLinked();

		expect(playerData.linked).toBe(true);
		expect(raw.getItem('vetcrewgames_linked')).toBe('1');
	});

	it('apply() приймає злиті дані й одразу їх зберігає', async () => {
		const { playerData, raw } = await load();

		playerData.apply({ score: 77, games: { family: { best: 5, plays: 2 } } });

		expect(playerData.score).toBe(77);
		expect(playerData.recordOf('family')).toEqual({ best: 5, plays: 2 });
		expect(raw.getItem('vetcrewgames_score')).toBe('77');
	});

	it('вихід стирає рахунок, рекорди й сам прапорець акаунта', async () => {
		const { playerData, raw } = await load({
			vetcrewgames_score: '99',
			vetcrewgames_records: '{"memory":{"best":9,"plays":4}}',
			vetcrewgames_linked: '1'
		});

		playerData.clearLocal();

		expect(playerData.score).toBe(0);
		expect(playerData.recordOf('memory')).toBeNull();
		expect(playerData.linked).toBe(false);
		expect(raw.getItem('vetcrewgames_score'), 'рахунок влився б у наступний акаунт').toBeNull();
		expect(raw.getItem('vetcrewgames_records')).toBeNull();
		expect(raw.getItem('vetcrewgames_linked')).toBeNull();
	});

	it('знімок — копія, а не сам стан', async () => {
		const { playerData } = await load();
		playerData.finishGame('habitat', 4);

		const snapshot = playerData.snapshot();
		snapshot.games.habitat.best = 999;

		expect(playerData.recordOf('habitat')?.best, 'знімок правив би сам стан').toBe(4);
	});

	/*
	 * ОНЛАЙН-ПАРТІЯ: локальна шкала на паузі, а в кінці — один переказ.
	 *
	 * Онлайн-раунди грають ті самі контролери, що соло, тож без паузи одна спільна
	 * вікторина доливала б дванадцять порцій соло-балів і дванадцять «зіграно
	 * партію» — тобто ламала б ту саму шкалу, яку курс і вирівнює.
	 */
	it('під час онлайн-партії локальні очки не пишуться', async () => {
		const { playerData } = await load();
		playerData.addScore(3);
		playerData.beginOnline();
		playerData.addScore(3);
		playerData.finishGame('mythbusters', 12);
		expect(playerData.score).toBe(3);
		expect(playerData.records.mythbusters).toBeUndefined();
	});

	it('після кімнати локальні очки пишуться знову', async () => {
		const { playerData } = await load();
		playerData.beginOnline();
		playerData.addScore(3);
		playerData.endOnline();
		playerData.addScore(4);
		expect(playerData.score).toBe(4);
	});

	it('підсумок вікторини переводиться за курсом, а не додається як є', async () => {
		const { playerData } = await load();
		playerData.beginOnline();
		playerData.awardQuizMatch(980);
		// 980 / 50 = 19.6 → 20: округлення, а не відкидання, інакше остача згорала б.
		expect(playerData.score).toBe(20);
	});

	it('нуль не пишеться зовсім — ні очок, ні події', async () => {
		const { playerData } = await load();
		let told = 0;
		playerData.onChange = () => (told += 1);
		playerData.awardQuizMatch(10);
		playerData.awardOnline(0);
		expect(playerData.score).toBe(0);
		expect(told).toBe(0);
	});

	it('перемога в «Знайди пару» — плоскі бали, без курсу', async () => {
		const { playerData } = await load();
		playerData.beginOnline();
		playerData.awardOnline(10);
		expect(playerData.score).toBe(10);
	});
});
