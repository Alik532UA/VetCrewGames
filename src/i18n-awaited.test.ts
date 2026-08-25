// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { awaited as uk } from '$lib/i18n/awaited/uk';
import { awaited as en } from '$lib/i18n/awaited/en';
import { awaited as de } from '$lib/i18n/awaited/de';
import { awaited as nl } from '$lib/i18n/awaited/nl';

/**
 * Паритет ЛІНИВОГО словника «вас чекають у грі».
 *
 * `check:i18n` звіряє зібрані словники, а цей довантажується окремо — тобто без
 * цієї перевірки нова мова або новий ключ розійшлися б непомітно, і на екрані
 * стояв би сам ключ. Та сама причина й та сама форма, що в `i18n-quiz.test.ts`.
 */
describe('словник «вас чекають у грі»', () => {
	const dicts = { uk, en, de, nl };

	it('перевірка жива: ключі є', () => {
		expect(Object.keys(uk).length).toBeGreaterThan(0);
	});

	it('однаковий набір ключів у всіх мовах', () => {
		const keys = Object.keys(uk).sort();
		for (const [lang, dict] of Object.entries(dicts)) {
			expect(Object.keys(dict).sort(), `${lang}: набір ключів розійшовся`).toEqual(keys);
		}
	});

	it('жодного порожнього рядка', () => {
		for (const [lang, dict] of Object.entries(dicts)) {
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
