import { describe, expect, it } from 'vitest';
import { quiz as uk } from '$lib/i18n/quiz/uk';
import { quiz as en } from '$lib/i18n/quiz/en';
import { quiz as de } from '$lib/i18n/quiz/de';
import { quiz as nl } from '$lib/i18n/quiz/nl';

/**
 * ПАРИТЕТ СЛОВНИКА ВІКТОРИНИ — бо `check:i18n` його більше не бачить.
 *
 * Ці рядки лежать у ЛІНИВОМУ чанку (`i18n/quiz`), а `check:i18n` звіряє зібрані
 * словники — тобто після виносу він перестав знати про ці ключі зовсім. Це
 * названа ціна виносу, і ось перевірка, яка її покриває: вона імпортує всі
 * чотири файли й падає і на бракуючому рядку, і на зайвому.
 *
 * Той самий файл, що `src/i18n-account.test.ts`, і з тієї самої причини.
 */

const DICTS: Array<[string, Record<string, string>]> = [
	['uk', uk],
	['en', en],
	['de', de],
	['nl', nl]
];

describe('словник вікторини', () => {
	const keys = Object.keys(uk);

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys.length).toBeGreaterThanOrEqual(10);
		expect(DICTS).toHaveLength(4);
	});

	it('усі ключі починаються з `quiz.`', () => {
		const wrong = keys.filter((key) => !key.startsWith('quiz.'));
		expect(wrong, `не з того простору: ${wrong.join(', ')}`).toEqual([]);
	});

	it('у кожній мові той самий набір ключів', () => {
		for (const [lang, dict] of DICTS) {
			const missing = keys.filter((key) => !(key in dict));
			const extra = Object.keys(dict).filter((key) => !keys.includes(key));
			expect(missing, `${lang}: немає ключів ${missing.join(', ')}`).toEqual([]);
			expect(extra, `${lang}: зайві ключі ${extra.join(', ')}`).toEqual([]);
		}
	});

	it('порожніх рядків немає ні в одній мові', () => {
		for (const [lang, dict] of DICTS) {
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
