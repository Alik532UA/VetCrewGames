import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LANGUAGES, type Language } from '$lib/i18n/routing';

/**
 * Мова, якою «розмовляє» `td()`, береться з налаштувань. Тут вона просто
 * змінна: перевірці потрібно проговорити всі мови поспіль, а не одну.
 */
const settingsMock = { locale: 'uk' as string };
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

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

	/**
	 * Третій крок, якого доти не стерегло ніщо: словник треба ще й ПІДКЛЮЧИТИ.
	 *
	 * Перевірки вище дивляться на файли, і обидві були б зелені для мови, у якої
	 * тека є, ключі повні — а в мапі `translations` усередині `i18n/index.ts`
	 * рядка немає. `td()` тоді не знаходить словника й повертає сам ключ, тобто
	 * на екрані стоїть `animal.cat`. TypeScript мовчить: `td()` бере рядок і
	 * повертає рядок.
	 *
	 * Тому перевірка йде не по файлах, а через справжній `td()` — тим самим
	 * шляхом, яким ходить сторінка.
	 */
	it('кожна оголошена мова підключена до перекладача', async () => {
		const { td } = await import('$lib/i18n');
		// Ключ навмисно з даних, а не з інтерфейсу: саме такі йдуть через `td()`.
		const probe = 'animal.cat';

		const unwired = LANGUAGES.filter((lang) => {
			settingsMock.locale = lang;
			return td(probe) === probe;
		});
		settingsMock.locale = 'uk';

		expect(
			unwired,
			`словник є, а в мапі перекладів його немає — на екрані буде ключ: ${unwired.join(', ')}`
		).toEqual([]);
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
	 * Четвертий крок, який доти нічим не стерігся: локаль для `og:locale`.
	 *
	 * Це не дублювання перевірки вище. Підпис і прапор видно на екрані — мову без
	 * них помітно з першого погляду. Локаль читає лише машина: Facebook, Telegram,
	 * пошуковик. Доти вона взагалі не була даними — у layout стояло
	 * `routeLanguage === 'uk' ? 'uk_UA' : 'en_US'`, тобто `de` й `nl` оголошували
	 * себе `en_US`, і жоден гейт проєкту цього не бачив.
	 *
	 * Формат перевіряється теж, і не для краси: `de-DE` з дефісом (тобто у формі
	 * `hreflang`, а не `og:locale`) — найімовірніша описка тут, і вона дає тег,
	 * який споживач просто ігнорує.
	 */
	it('у кожної мови є локаль для og:locale у формі `xx_XX`', async () => {
		const { ogLocale } = await import('$lib/i18n/languages');

		const bad = LANGUAGES.map((lang) => [lang, ogLocale(lang)] as const).filter(
			([, locale]) => !/^[a-z]{2}_[A-Z]{2}$/.test(locale ?? '')
		);
		expect(
			bad.map(([lang, locale]) => `${lang}: ${locale}`),
			'og:locale має форму `мова_КРАЇНА` з підкресленням, а не код hreflang'
		).toEqual([]);

		// Дві мови з однією локаллю означають, що рядок скопіювали й не виправили —
		// рівно те, що сталося з `en_US` для `de` й `nl`.
		const locales = LANGUAGES.map((lang) => ogLocale(lang));
		expect(new Set(locales).size, `локалі повторюються: ${locales.join(', ')}`).toBe(
			LANGUAGES.length
		);
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
