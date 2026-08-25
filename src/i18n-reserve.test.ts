import { describe, expect, it } from 'vitest';
import { reserve as uk } from '$lib/i18n/reserve/uk';
import { reserve as en } from '$lib/i18n/reserve/en';
import { reserve as de } from '$lib/i18n/reserve/de';
import { reserve as nl } from '$lib/i18n/reserve/nl';

/**
 * ПАРИТЕТ СЛОВНИКА ЗАПОВІДНИКА — бо `check:i18n` його більше не бачить.
 *
 * Двісті з лишком рядків заповідника поїхали в ЛІНИВИЙ чанк (`i18n/reserve`), і
 * причина заміряна: у головному словнику вони коштували 14,88 КБ gzip на чотири
 * мови — понад десяту частину чанку, який везе КОЖЕН відвідувач, зокрема той,
 * хто зайшов пограти у вікторину й до заповідника не дійде ніколи.
 *
 * `check:i18n` звіряє ЗІБРАНІ словники, тобто після виносу він про ці ключі не
 * знає нічого. Ось перевірка, яка покриває названу ціну: вона імпортує всі
 * чотири файли й падає і на бракуючому рядку, і на зайвому.
 *
 * Той самий файл, що `src/i18n-quiz.test.ts` і `src/i18n-reserve-care.test.ts`,
 * і з тієї самої причини.
 */

const DICTS: Array<[string, Record<string, string>]> = [
	['uk', uk],
	['en', en],
	['de', de],
	['nl', nl]
];

describe('словник заповідника', () => {
	const keys = Object.keys(uk);

	it('перевірка жива: ключі й мови знайдено', () => {
		expect(keys.length).toBeGreaterThanOrEqual(100);
		expect(DICTS).toHaveLength(4);
	});

	it('усі ключі — з простору заповідника', () => {
		const wrong = keys.filter((key) => !key.startsWith('reserve.'));
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
