import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '$lib/i18n/routing';
import { loadQuizText } from '$lib/i18n/quiz';
import { quiz as uk } from '$lib/i18n/quiz/uk';

/**
 * ПАРИТЕТ СЛОВНИКА ВІКТОРИНИ — бо `check:i18n` його більше не бачить.
 */

describe('словник вікторини', () => {
	const keys = Object.keys(uk);

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys.length).toBeGreaterThanOrEqual(10);
		expect(LANGUAGES).toHaveLength(42);
	});

	it('усі ключі починаються з `quiz.`', () => {
		const wrong = keys.filter((key) => !key.startsWith('quiz.'));
		expect(wrong, `не з того простору: ${wrong.join(', ')}`).toEqual([]);
	});

	it('у кожній мові той самий набір ключів', async () => {
		for (const lang of LANGUAGES) {
			const dict = await loadQuizText(lang);
			const missing = keys.filter((key) => !(key in dict));
			const extra = Object.keys(dict).filter((key) => !keys.includes(key));
			expect(missing, `${lang}: немає ключів ${missing.join(', ')}`).toEqual([]);
			expect(extra, `${lang}: зайві ключі ${extra.join(', ')}`).toEqual([]);
		}
	});

	it('порожніх рядків немає ні в одній мові', async () => {
		for (const lang of LANGUAGES) {
			const dict = await loadQuizText(lang);
			const empty = Object.entries(dict)
				.filter(([, value]) => value.trim() === '')
				.map(([key]) => key);
			expect(empty, `${lang}: порожні рядки ${empty.join(', ')}`).toEqual([]);
		}
	});

	/**
	 * Той самий інваріант, що в `i18n-account.test.ts`: у кириличному слові не
	 * буває латинських літер. Змішані алфавіти виглядають однаково й ламають
	 * пошук, а знайти таке око не може.
	 */
	it('в українських рядках немає змішаних алфавітів', () => {
		const mixed: string[] = [];
		for (const [key, value] of Object.entries(uk)) {
			for (const word of value.split(/[^\p{L}]+/u)) {
				if (/\p{Script=Cyrillic}/u.test(word) && /\p{Script=Latin}/u.test(word)) {
					mixed.push(`${key}: ${word}`);
				}
			}
		}
		expect(mixed, `змішані алфавіти: ${mixed.join(', ')}`).toEqual([]);
	});
});
