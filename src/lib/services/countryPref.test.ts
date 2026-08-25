// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ЯКИЙ ПРАПОР ПОКАЗУВАТИ, поки людина не вибрала свій.
 *
 * Три правила, і кожне тут перевіряється окремо, бо кожне вже було або порушене,
 * або втрачене:
 *
 *  1. ВИБІР ГОЛОВНІШИЙ ЗА ПІДКАЗКУ — і «без прапора» це вибір, а не відсутність
 *     його. Інакше служба перепитувала б у того, хто прапор навмисно зняв.
 *  2. СЛУЖБА ПИТАЄТЬСЯ РАЗ: у запиті їде IP відвідувача, і кожне зайве
 *     відкриття сторінки — ще одна згадка про дитину в чужому журналі.
 *  3. ВІДПОВІДЬ ПАМʼЯТАЄТЬСЯ — тим самим ключем, що читає лобі. Саме тому
 *     сторінка акаунта тепер показує той прапор, що й кімната: скарга автора
 *     була рівно про це розходження.
 */

const store = new Map<string, string>();
const detectCountry = vi.fn<() => Promise<string | null>>(async () => null);

vi.mock('./storage', () => ({
	storage: {
		get: (key: string) => store.get(key) ?? null,
		set: (key: string, value: string) => void store.set(key, value),
		remove: (key: string) => void store.delete(key)
	}
}));
vi.mock('$lib/net/country', () => ({ detectCountry }));

const { COUNTRY_KEY } = await import('$lib/config/playerName');
const { preferredCountry, rememberCountry } = await import('./countryPref');

describe('прапор за замовчуванням', () => {
	beforeEach(() => {
		store.clear();
		detectCountry.mockReset().mockResolvedValue(null);
	});

	it('свій вибір головніший за підказку служби', async () => {
		store.set(COUNTRY_KEY, 'ua');

		expect(await preferredCountry()).toBe('ua');
		expect(detectCountry, 'IP поїхав у чужу службу, хоч вибір уже був').not.toHaveBeenCalled();
	});

	/** «Без прапора» — ВІДПОВІДЬ. Перепитувати її означає не почути людину. */
	it('порожній вибір не перепитується', async () => {
		store.set(COUNTRY_KEY, '');

		expect(await preferredCountry()).toBe('');
		expect(detectCountry).not.toHaveBeenCalled();
	});

	it('зіпсоване значення читається як «без прапора», а не як код', async () => {
		store.set(COUNTRY_KEY, 'zz');

		expect(await preferredCountry()).toBe('');
	});

	/**
	 * Зворотний експеримент (§ 1.1): прибрати `storage.set(COUNTRY_KEY, guess)` —
	 * червоніє друга половина цього випадку, а служба питалася б на кожному
	 * відкритті сторінки.
	 */
	it('підказка запамʼятовується, тож служба питається раз', async () => {
		detectCountry.mockResolvedValue('de');

		expect(await preferredCountry()).toBe('de');
		expect(store.get(COUNTRY_KEY)).toBe('de');

		expect(await preferredCountry()).toBe('de');
		expect(detectCountry, 'другого запиту з IP бути не мусить').toHaveBeenCalledTimes(1);
	});

	it('служба не відповіла — прапора просто немає', async () => {
		detectCountry.mockResolvedValue(null);

		expect(await preferredCountry()).toBe('');
		// Нічого не записано: наступного разу спитаємо, бо відповіді ще не було.
		expect(store.has(COUNTRY_KEY)).toBe(false);
	});

	it('вибір людини записується, зокрема «без прапора»', () => {
		rememberCountry('nl');
		expect(store.get(COUNTRY_KEY)).toBe('nl');

		rememberCountry('');
		expect(store.get(COUNTRY_KEY), 'знятий прапор мусить доїхати й у кімнату').toBe('');
	});
});
