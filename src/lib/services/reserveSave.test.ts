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

const KEY = 'vetcrewgames_reserve';

function played() {
	const state = createReserve(42);
	execute(state, { type: 'acquire', origin: 'rescue' });
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

	it('видалення прибирає збереження', async () => {
		const raw = makeStorage();
		vi.stubGlobal('localStorage', raw);
		const { saveReserve, dropReserve, loadReserve } = await import('./reserveSave');

		saveReserve(played());
		dropReserve();
		expect(loadReserve()).toEqual({ ok: false, reason: 'empty' });
	});
});
