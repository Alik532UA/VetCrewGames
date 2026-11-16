// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '$lib/i18n/routing';
import { loadAwaitedText } from '$lib/i18n/awaited';
import { awaited as uk } from '$lib/i18n/awaited/uk';

/**
 * Паритет ЛІНИВОГО словника «вас чекають у грі».
 */
describe('словник «вас чекають у грі»', () => {
	it('перевірка жива: ключі є', () => {
		expect(Object.keys(uk).length).toBeGreaterThan(0);
		expect(LANGUAGES).toHaveLength(42);
	});

	it('однаковий набір ключів у всіх мовах', async () => {
		const keys = Object.keys(uk).sort();
		for (const lang of LANGUAGES) {
			const dict = await loadAwaitedText(lang);
			expect(Object.keys(dict).sort(), `${lang}: набір ключів розійшовся`).toEqual(keys);
		}
	});

	it('жодного порожнього рядка', async () => {
		for (const lang of LANGUAGES) {
			const dict = await loadAwaitedText(lang);
			const empty = Object.entries(dict)
				.filter(([, value]) => value.trim() === '')
				.map(([key]) => key);
			expect(empty, `${lang}: порожні рядки`).toEqual([]);
		}
	});

	it('усі ключі починаються з awaited.', () => {
		const wrong = Object.keys(uk).filter((key) => !key.startsWith('awaited.'));
		expect(wrong).toEqual([]);
	});
});
