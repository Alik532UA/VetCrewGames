import { asset } from '$app/paths';
import { LANGUAGES, type Language } from './routing';

/**
 * Атрибути мови: підпис, прапор і локаль для Open Graph. Одна таблиця на весь
 * проєкт.
 *
 * Політика адрес лежить окремо, у `routing.ts`: її читає й генератор sitemap,
 * що виконується в Node без застосунку, а `asset()` там недоступний. Тут —
 * тільки те, що потрібне самій сторінці: те, що вона малює, і те, що вона
 * оголошує в `<head>`.
 *
 * **Що робити, щоб додати мову.** Рівно три кроки: дописати код у `LANGUAGES`,
 * покласти сюди рядок із підписом, прапором і локаллю, додати словник у
 * `translations/`. Усе інше виводиться: матчер сегмента, `entries()` для
 * prerender, hreflang, sitemap, `og:locale` й перелік у перемикачі. Інваріант
 * `src/i18n-completeness.test.ts` падає, якщо котрийсь із трьох кроків
 * забули, — саме тому їх видно як три, а не як «десь у восьми місцях».
 *
 * Підпис — рідною мовою й без перекладу: людина шукає в списку СВОЮ мову, а не
 * її назву чужою (I18N-v8 § 6.1).
 */
export interface LanguageMeta {
	code: Language;
	/** Назва мови нею самою: «Українська», а не «Ukrainian». */
	label: string;
	/** Файл прапора. SVG, бо той самий значок стоїть і в шапці, і в меню. */
	flag: string;
	/**
	 * Локаль для `og:locale` — у форматі `мова_КРАЇНА` з підкресленням
	 * (SEO-v8 § 4). Це НЕ те саме, що код у `hreflang`: там `de`, тут `de_DE`.
	 *
	 * Лежить у таблиці, а не рахується з коду мови, бо однозначного правила
	 * немає: `nl` — це `nl_NL`, але з тим самим успіхом мав би бути `nl_BE`, а
	 * `en` тут `en_US`, а не `en_GB`. Вибір за проєктом, і його видно.
	 */
	ogLocale: string;
}

const META: Record<Language, Omit<LanguageMeta, 'code'>> = {
	uk: { label: 'Українська', flag: 'uk', ogLocale: 'uk_UA' },
	en: { label: 'English', flag: 'en', ogLocale: 'en_US' },
	de: { label: 'Deutsch', flag: 'de', ogLocale: 'de_DE' },
	nl: { label: 'Nederlands', flag: 'nl', ogLocale: 'nl_NL' }
};

/** Порядок у перемикачі — той самий, що й у `LANGUAGES`. */
export const LANGUAGE_META: readonly LanguageMeta[] = LANGUAGES.map((code) => ({
	code,
	...META[code]
}));

export const flagSrc = (code: Language): string => asset(`/images/flags/${META[code].flag}.svg`);

export const languageLabel = (code: Language): string => META[code].label;

/** Локаль сторінки для `og:locale`. Решта мов ідуть як `og:locale:alternate`. */
export const ogLocale = (code: Language): string => META[code].ogLocale;
