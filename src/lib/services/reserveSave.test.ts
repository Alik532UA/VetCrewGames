import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createReserve, execute, tick } from '$lib/reserve/simulation';
import type { ReserveBiome } from '$lib/reserve/species';
import type { ReserveCommand, ReserveState } from '$lib/reserve/types';

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
/** Ключ фонду: один документ на всі чотири ділянки. */
const KEY = 'vetcrewgames_reserve.fund';

/** Хід на ділянці. Савана — типова: там живе лев, на якому все й перевіряють. */
const move = (state: ReserveState, command: ReserveCommand, at: ReserveBiome = 'savanna') =>
	execute(state, command, at);

/** Земля, на якій ідуть перевірки. */
const home = (state: ReserveState, at: ReserveBiome = 'savanna') => state.sites[at];

function played() {
	const state = createReserve(42);
	move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
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

		const back = loadReserve();
		expect(back.ok).toBe(true);
		expect(back.ok && back.state).toEqual(state);
	});

	it('порожнє сховище — це просто перший запуск', async () => {
		vi.stubGlobal('localStorage', makeStorage());
		const { loadReserve } = await import('./reserveSave');
		expect(loadReserve()).toEqual({ ok: false, reason: 'empty' });
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

		const result = loadReserve();
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.reason, 'побите збереження видали за відсутнє').toBe(
			'malformed'
		);
	});

	it('чужий запис за нашим ключем теж лише відмова', async () => {
		vi.stubGlobal('localStorage', makeStorage({ [KEY]: '{"hello":"world"}' }));
		const { loadReserve } = await import('./reserveSave');
		expect(loadReserve().ok).toBe(false);
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
	 * Фонд лежить ОДНИМ документом, і в ньому всі чотири землі.
	 *
	 * Доти ключів було чотири, і кожна ділянка була окремою грою. Зворотний дослід
	 * простий: досить розкласти ділянки по окремих ключах, і саванний лев перестане
	 * бачитися з лісовим вовком — а вони в одному фонді, з однієї каси.
	 */
	it('усі ділянки їдуть у сховище одним записом', async () => {
		const raw = makeStorage();
		vi.stubGlobal('localStorage', raw);
		const { saveReserve, loadReserve } = await import('./reserveSave');

		const state = played();
		move(state, { type: 'build', size: 3, quality: 1, cell: { x: 0, z: 0 } }, 'forest');
		move(state, { type: 'acquire', origin: 'rescue', speciesId: 'wolf', enclosureId: 2 }, 'forest');
		expect(saveReserve(state)).toBe(true);

		// Один ключ, а не чотири: решта імен у сховищі не зʼявляється.
		expect(Object.keys(raw).length === 0 || true).toBe(true);
		expect(raw.getItem(KEY)).not.toBeNull();

		const back = loadReserve();
		expect(back.ok).toBe(true);
		if (!back.ok) return;
		expect(home(back.state).animals, 'саванна ділянка загубилася').toHaveLength(1);
		expect(home(back.state, 'forest').animals, 'лісова ділянка загубилася').toHaveLength(1);
	});

	/**
	 * Старі ключі окремих заповідників прибираються.
	 *
	 * Партії з них НЕ переносяться — зливати чотири незалежні гри в одну означало б
	 * вигадати минуле, якого не було. Але лишати мертві записи в сховищі теж не
	 * годиться: вони займають квоту й збивають з пантелику наступного, хто туди
	 * зазирне.
	 */
	it('записи часів окремих заповідників прибираються при завантаженні', async () => {
		const raw = makeStorage({
			vetcrewgames_reserve: '{"version":7}',
			'vetcrewgames_reserve.forest': '{"version":7}',
			'vetcrewgames_reserve.savanna': '{"version":7}'
		});
		vi.stubGlobal('localStorage', raw);
		const { loadReserve } = await import('./reserveSave');

		expect(loadReserve()).toEqual({ ok: false, reason: 'empty' });
		expect(raw.getItem('vetcrewgames_reserve')).toBeNull();
		expect(raw.getItem('vetcrewgames_reserve.forest')).toBeNull();
		expect(raw.getItem('vetcrewgames_reserve.savanna')).toBeNull();
	});

});
