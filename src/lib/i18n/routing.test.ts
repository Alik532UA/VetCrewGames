import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LANGUAGE,
	INDEXED_LANGUAGES,
	LANGUAGES,
	LANGUAGE_ROUTES,
	PREFIXED_LANGUAGES,
	isLanguage,
	langPath,
	langUrl,
	languageFromParam,
	languageSegment,
	routeRestFromId
} from './routing';

/**
 * Політику мовних адрес читають чотири місця: матчер сегмента, кореневий
 * layout, перемикач у шапці й генератор sitemap. Розійшовшись, вони дають
 * сайт, де адреса каже одне, а сторінка показує інше — і побачити це можна
 * лише у `build/`. Тому вона й винесена в один модуль, і тому в неї є тест.
 */
describe('мовні адреси', () => {
	it('типова мова живе на голому шляху, решта — з сегментом', () => {
		expect(languageSegment(DEFAULT_LANGUAGE), 'сегмента для типової бути не має').toBeUndefined();
		expect(languageSegment('en')).toBe('en');
		expect(PREFIXED_LANGUAGES).toEqual(LANGUAGES.filter((lang) => lang !== DEFAULT_LANGUAGE));
		expect(PREFIXED_LANGUAGES).not.toContain(DEFAULT_LANGUAGE);
	});

	/**
	 * Зразком «не нашої мови» тут стоїть `zz` — код, зарезервований ISO 639 під
	 * приватне вживання, тож мовою сайту він не стане ніколи. Доти тут була
	 * `de`, і коли німецьку ввімкнули насправді, тест почав перевіряти, що
	 * справжня мова НЕ працює.
	 */
	it('невідоме значення сегмента дає типову мову, а не порожнечу', () => {
		expect(languageFromParam(undefined)).toBe('uk');
		expect(languageFromParam('en')).toBe('en');
		expect(languageFromParam('zz'), 'чужа мова не має ставати поточною').toBe('uk');
	});

	it('isLanguage відсіює все, що не мова', () => {
		for (const lang of LANGUAGES) expect(isLanguage(lang), lang).toBe(true);
		expect(isLanguage('zz')).toBe(false);
		expect(isLanguage(undefined)).toBe(false);
		expect(isLanguage(42)).toBe(false);
	});

	it('внутрішні шляхи мають кінцевий слеш і мовний сегмент', () => {
		// `trailingSlash: 'always'`: адреса без слеша — це зайвий редирект, і
		// вона розійдеться з canonical (SVELTEKIT-DATA-v8 § 2.4).
		expect(langPath('uk')).toBe('/');
		expect(langPath('en')).toBe('/en/');
		expect(langPath('uk', 'game-population')).toBe('/game-population/');
		expect(langPath('en', 'game-population')).toBe('/en/game-population/');
	});

	it('абсолютні адреси будуються з констант, а не з поточного URL', () => {
		// Під час prerender `page.url.origin` — це `sveltekit-prerender`, а `base`
		// відносний. Обидва в canonical потрапляти не мають (SEO-v8 § 1.2–1.3).
		expect(langUrl('uk')).toBe('https://alik532ua.github.io/VetCrewGames/');
		expect(langUrl('en', 'game-mythbusters')).toBe(
			'https://alik532ua.github.io/VetCrewGames/en/game-mythbusters/'
		);
		for (const lang of LANGUAGES) {
			expect(langUrl(lang), 'жодного «./» усередині абсолютної адреси').not.toMatch(/\w\.\//);
			expect(langUrl(lang)).not.toContain('sveltekit-prerender');
		}
	});

	it('«хвіст» береться з ID маршруту, бо pathname містить відносний base', () => {
		expect(routeRestFromId('/[[lang=lang]]')).toBe('');
		expect(routeRestFromId('/[[lang=lang]]/game-population')).toBe('game-population');
		expect(routeRestFromId('/[[lang=lang]]/game-mythbusters')).toBe('game-mythbusters');
		// 404-фолбек не має ID — і не має ламати canonical.
		expect(routeRestFromId(null)).toBe('');
		expect(routeRestFromId('/казна-що')).toBe('');
	});

	it('кожна мовна версія кожного маршруту має власну адресу', () => {
		const urls = INDEXED_LANGUAGES.flatMap((lang) =>
			(Object.keys(LANGUAGE_ROUTES) as (keyof typeof LANGUAGE_ROUTES)[]).map((rest) =>
				langUrl(lang, rest)
			)
		);
		expect(urls.length).toBe(INDEXED_LANGUAGES.length * Object.keys(LANGUAGE_ROUTES).length);
		expect(new Set(urls).size, `дублікати адрес: ${urls.join(', ')}`).toBe(urls.length);
	});
});
