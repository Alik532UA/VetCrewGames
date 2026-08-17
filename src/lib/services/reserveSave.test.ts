import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReserve, execute, tick } from '$lib/reserve/simulation';

/**
 * Місток «партія ↔ сховище».
 *
 * Перевіряється рівно те, чого не видно в чистому модулі формату: поведінка,
 * коли сховище є, коли його немає і коли в ньому лежить сміття. Найдорожчий
 * випадок — третій: побитий сейв не має ні валити сторінку, ні тихо
 * перетворюватися на «нової партії ще не було».
 */

vi.mock('$app/environment', () => ({ browser: true, dev: true }));

function makeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(seed));
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

/** Ключ саме тієї ділянки, яку будує `played()`. */
const KEY = 'vetcrewgames_reserve.savanna';

function played() {
	const state = createReserve(42, 'savanna');
	execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
	tick(state, 900);
	return state;
}

describe('сейв заповідника у сховищі', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('перевірка жива: партія доїжджає до сховища й назад', async () => {
		vi.stubGlobal('localStorage', makeStorage());
		const { saveReserve, loadReserve } = await import('./reserveSave');

		const state = played();
		expect(saveReserve(state)).toBe(true);

		const back = loadReserve('savanna');
		expect(back.ok).toBe(true);
		expect(back.ok && back.state).toEqual(state);
	});

	it('порожнє сховище — це просто перший запуск', async () => {
		vi.stubGlobal('localStorage', makeStorage());
		const { loadReserve } = await import('./reserveSave');
		expect(loadReserve('savanna')).toEqual({ ok: false, reason: 'empty' });
	});

	/**
	 * Побитий сейв і відсутній сейв — РІЗНІ речі.
	 *
	 * `storage.getJSON` повертає `null` на обидва випадки, і спокуса взяти його
	 * тут велика. Але тоді гра мовчки почала б нову партію на місці заповідника,
	 * який людина будувала годину, — і не сказала б жодного слова. Тому рядок
	 * читається сирим, а розбирається вже тут.
	 */
	it('обрізаний JSON не валить сторінку і не вдає порожнє сховище', async () => {
		vi.stubGlobal('localStorage', makeStorage({ [KEY]: '{"version":1,"state":{"ticks":' }));
		const { loadReserve } = await import('./reserveSave');

		const result = loadReserve('savanna');
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.reason, 'побите збереження видали за відсутнє').toBe(
			'malformed'
		);
	});

	it('чужий запис за нашим ключем теж лише відмова', async () => {
		vi.stubGlobal('localStorage', makeStorage({ [KEY]: '{"hello":"world"}' }));
		const { loadReserve } = await import('./reserveSave');
		expect(loadReserve('savanna').ok).toBe(false);
	});

	/**
	 * Сховища може не бути зовсім: приватний режим, заблоковані cookie, квота.
	 * Фасад у такому разі не кидає, а повертає `false` — і саме цим `false` гра
	 * зможе сказати людині, що партія не збережеться.
	 */
	it('недоступне сховище дає чесну відмову, а не виняток', async () => {
		vi.stubGlobal('localStorage', {
			...makeStorage(),
			setItem: () => {
				throw new DOMException('quota', 'QuotaExceededError');
			}
		} as Storage);
		const { saveReserve } = await import('./reserveSave');

		expect(saveReserve(played())).toBe(false);
	});

	/**
	 * Дві ділянки — дві партії, а не одна поверх іншої.
	 *
	 * Доти ключ був один на всю гру, і зайти в савану означало стерти ліс. Зворотний
	 * дослід простий: досить повернути спільний ключ, і саванна партія приїде з
	 * лісового збереження — перевірка почервоніє на `biome`.
	 */
	it('партії в різних біомах лежать окремо й не перетирають одна одну', async () => {
		vi.stubGlobal('localStorage', makeStorage());
		const { saveReserve, loadReserve } = await import('./reserveSave');

		const savanna = played();
		const forest = createReserve(7, 'forest');
		execute(forest, { type: 'build', size: 2, quality: 1, cell: { x: 3, z: 0 } });

		saveReserve(savanna);
		saveReserve(forest);

		const backSavanna = loadReserve('savanna');
		const backForest = loadReserve('forest');
		expect(backSavanna.ok && backSavanna.state.biome).toBe('savanna');
		expect(backForest.ok && backForest.state.biome).toBe('forest');
		expect(backSavanna.ok && backSavanna.state.animals.length, 'ліс перетер савану').toBe(1);
		expect(backForest.ok && backForest.state.animals.length).toBe(0);

		// Ділянка, у яку ще не заходили, лишається незайманою.
		expect(loadReserve('tundra')).toEqual({ ok: false, reason: 'empty' });
	});

	/**
	 * Оновлення не має коштувати людині заповідника.
	 *
	 * Партії, збережені до поділу сховища, лежать під старим спільним ключем.
	 * Просто перестати його читати означало б тихо почати нову гру на місці
	 * годинної роботи. Зворотний дослід: досить прибрати переїзд, і саванна
	 * ділянка відкриється порожньою, хоч запис лежить поруч.
	 */
	it('партія зі старого спільного ключа переїжджає на свою ділянку', async () => {
		const legacy = makeStorage();
		vi.stubGlobal('localStorage', legacy);
		const { saveReserve, loadReserve } = await import('./reserveSave');

		// Пишемо як писала попередня версія — одним ключем на всю гру.
		const state = played();
		saveReserve(state);
		legacy.setItem('vetcrewgames_reserve', legacy.getItem(KEY)!);
		legacy.removeItem(KEY);

		const back = loadReserve('savanna');
		expect(back.ok && back.state).toEqual(state);
		// Переїзд одноразовий: старого ключа більше немає, новий на місці.
		expect(legacy.getItem('vetcrewgames_reserve')).toBeNull();
		expect(legacy.getItem(KEY)).not.toBeNull();
	});

	it('чужу ділянку старий ключ не займає', async () => {
		const legacy = makeStorage();
		vi.stubGlobal('localStorage', legacy);
		const { saveReserve, loadReserve } = await import('./reserveSave');

		saveReserve(played());
		legacy.setItem('vetcrewgames_reserve', legacy.getItem(KEY)!);
		legacy.removeItem(KEY);

		// Саванна партія в тундрі не оживає — і не зникає, чекаючи на свою ділянку.
		expect(loadReserve('tundra')).toEqual({ ok: false, reason: 'empty' });
		expect(legacy.getItem('vetcrewgames_reserve')).not.toBeNull();
		expect(loadReserve('savanna').ok).toBe(true);
	});

	it('видалення прибирає збереження', async () => {
		const raw = makeStorage();
		vi.stubGlobal('localStorage', raw);
		const { saveReserve, dropReserve, loadReserve } = await import('./reserveSave');

		saveReserve(played());
		dropReserve('savanna');
		expect(loadReserve('savanna')).toEqual({ ok: false, reason: 'empty' });
	});
});
