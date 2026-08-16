import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, type Language } from '$lib/i18n/routing';

/**
 * Мова або є цілком, або її немає.
 *
 * Увімкнути мову — це два кроки: дописати код у `LANGUAGES` і покласти повний
 * словник. Зробити лише перший легко й нічим не карається: `td()` бере рядок і
 * повертає рядок, тож відсутній переклад дає на екрані КЛЮЧ — `animal.otter`
 * замість назви. Ані TypeScript, ані збірка цього не бачать; бачить відвідувач.
 *
 * Тому перевірки нижче йдуть від `LANGUAGES` до файлів, а не навпаки: питання
 * не «чи є зайвий словник», а «чи все є в тієї мови, яку ми ОБІЦЯЛИ віддавати».
 */

const DICTIONARIES = 'src/lib/i18n/translations';
const FLAGS = 'static/images/flags';
const read = (file: string) => readFileSync(file, 'utf8');

/** Ключі словника: рядки виду `'game.key': '…'` у файлах мовної теки. */
function keysOf(lang: Language): Set<string> {
	const dir = `${DICTIONARIES}/${lang}`;
	if (!existsSync(dir)) return new Set();
	const keys = new Set<string>();
	for (const file of readdirSync(dir)) {
		for (const [, key] of read(`${dir}/${file}`).matchAll(/^\t'([^']+)':/gm)) keys.add(key);
	}
	return keys;
}

describe('повнота мов', () => {
	it('перевірка жива: мови оголошено', () => {
		expect(LANGUAGES.length).toBeGreaterThan(1);
	});

	it('у кожної оголошеної мови є тека словника', () => {
		const missing = LANGUAGES.filter((lang) => !existsSync(`${DICTIONARIES}/${lang}`));
		expect(
			missing,
			`мова оголошена, а словника немає — на екрані будуть ключі: ${missing.join(', ')}`
		).toEqual([]);
	});

	it('усі мови мають однаковий набір ключів', () => {
		const [reference, ...rest] = LANGUAGES;
		const expected = keysOf(reference);
		const problems: string[] = [];

		for (const lang of rest) {
			const actual = keysOf(lang);
			for (const key of expected) if (!actual.has(key)) problems.push(`${lang}: немає ${key}`);
			for (const key of actual) if (!expected.has(key)) problems.push(`${lang}: зайвий ${key}`);
		}

		expect(problems.slice(0, 20), problems.join('\n')).toEqual([]);
	});

	it('у кожної мови є підпис, прапор і файл прапора', async () => {
		// Імпорт тут, а не вгорі: модуль тягне `$app/paths`, і для решти перевірок
		// він не потрібен.
		const { LANGUAGE_META } = await import('$lib/i18n/languages');

		const covered = new Set(LANGUAGE_META.map((meta) => meta.code));
		const uncovered = LANGUAGES.filter((lang) => !covered.has(lang));
		expect(uncovered, `немає підпису в таблиці мов: ${uncovered.join(', ')}`).toEqual([]);

		const noFlag = LANGUAGES.filter((lang) => !existsSync(`${FLAGS}/${lang}.svg`));
		expect(noFlag, `немає файлу прапора: ${noFlag.join(', ')}`).toEqual([]);
	});

	/**
	 * Прапор мусить масштабуватися: той самий файл стоїть і кнопкою в шапці, і
	 * в переліку. Без `viewBox` він приходить у своєму натуральному розмірі й
	 * ігнорує ширину, яку йому задали.
	 */
	it('кожен прапор має viewBox', () => {
		const bad = readdirSync(FLAGS)
			.filter((file) => file.endsWith('.svg'))
			.filter((file) => !read(`${FLAGS}/${file}`).includes('viewBox='));
		expect(bad, `без viewBox: ${bad.join(', ')}`).toEqual([]);
	});
});
