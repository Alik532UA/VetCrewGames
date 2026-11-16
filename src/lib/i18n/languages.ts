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
export const LANGUAGE_GROUP_ORDER = [
	'slavic',
	'romance',
	'germanic',
	'celtic',
	'baltic',
	'uralic',
	'balkan',
	'turkic',
	'caucasus',
	'east_asian',
	'semitic',
	'micronesian'
] as const;

export type LanguageGroup = (typeof LANGUAGE_GROUP_ORDER)[number];

export const LANGUAGE_GROUP_LABELS: Record<LanguageGroup, string> = {
	slavic: 'Slavic',
	romance: 'Romance',
	germanic: 'Germanic & Nordic',
	celtic: 'Celtic',
	baltic: 'Baltic',
	uralic: 'Uralic',
	balkan: 'Balkan',
	turkic: 'Turkic',
	caucasus: 'Caucasus',
	east_asian: 'East Asian',
	semitic: 'Semitic',
	micronesian: 'Micronesian'
};

export function languageBadge(code: Language): string {
	return code.slice(code.indexOf('-') + 1).toUpperCase();
}

export interface LanguageMeta {
	code: Language;
	/** Назва мови нею самою: «Українська», а не «Ukrainian». */
	label: string;
	/** Файл прапора. SVG, бо той самий значок стоїть і в шапці, і в меню. */
	flag: string;
	/** Група мови для категоризації у меню вибору. */
	group: LanguageGroup;
	/**
	 * Локаль для `og:locale` — у форматі `мова_КРАЇНА` з підкресленням
	 * (SEO-v8 § 4). Це НЕ те саме, що код у `hreflang`: там `de`, тут `de_DE`.
	 */
	ogLocale: string;
}

const META: Record<Language, Omit<LanguageMeta, 'code'>> = {
	// Slavic
	uk: { label: 'Українська', flag: 'uk', ogLocale: 'uk_UA', group: 'slavic' },
	be: { label: 'Беларуская', flag: 'be', ogLocale: 'be_BY', group: 'slavic' },
	pl: { label: 'Polski', flag: 'pl', ogLocale: 'pl_PL', group: 'slavic' },
	cs: { label: 'Čeština', flag: 'cs', ogLocale: 'cs_CZ', group: 'slavic' },
	sk: { label: 'Slovenčina', flag: 'sk', ogLocale: 'sk_SK', group: 'slavic' },
	bg: { label: 'Български', flag: 'bg', ogLocale: 'bg_BG', group: 'slavic' },
	hr: { label: 'Hrvatski', flag: 'hr', ogLocale: 'hr_HR', group: 'slavic' },
	sl: { label: 'Slovenščina', flag: 'sl', ogLocale: 'sl_SI', group: 'slavic' },
	mk: { label: 'Македонски', flag: 'mk', ogLocale: 'mk_MK', group: 'slavic' },
	// Romance
	es: { label: 'Español', flag: 'es', ogLocale: 'es_ES', group: 'romance' },
	ca: { label: 'Català', flag: 'ca', ogLocale: 'ca_ES', group: 'romance' },
	fr: { label: 'Français', flag: 'fr', ogLocale: 'fr_FR', group: 'romance' },
	pt: { label: 'Português', flag: 'pt', ogLocale: 'pt_PT', group: 'romance' },
	it: { label: 'Italiano', flag: 'it', ogLocale: 'it_IT', group: 'romance' },
	ro: { label: 'Română', flag: 'ro', ogLocale: 'ro_RO', group: 'romance' },
	// Germanic & Nordic
	en: { label: 'English (UK)', flag: 'en', ogLocale: 'en_GB', group: 'germanic' },
	'en-us': { label: 'English (US)', flag: 'en-us', ogLocale: 'en_US', group: 'germanic' },
	de: { label: 'Deutsch', flag: 'de', ogLocale: 'de_DE', group: 'germanic' },
	nl: { label: 'Nederlands', flag: 'nl', ogLocale: 'nl_NL', group: 'germanic' },
	sv: { label: 'Svenska', flag: 'sv', ogLocale: 'sv_SE', group: 'germanic' },
	no: { label: 'Norsk', flag: 'no', ogLocale: 'no_NO', group: 'germanic' },
	da: { label: 'Dansk', flag: 'da', ogLocale: 'da_DK', group: 'germanic' },
	is: { label: 'Íslenska', flag: 'is', ogLocale: 'is_IS', group: 'germanic' },
	// Celtic
	ga: { label: 'Gaeilge', flag: 'ga', ogLocale: 'ga_IE', group: 'celtic' },
	cy: { label: 'Cymraeg', flag: 'cy', ogLocale: 'cy_GB', group: 'celtic' },
	// Baltic
	et: { label: 'Eesti', flag: 'et', ogLocale: 'et_EE', group: 'baltic' },
	lv: { label: 'Latviešu', flag: 'lv', ogLocale: 'lv_LV', group: 'baltic' },
	lt: { label: 'Lietuvių', flag: 'lt', ogLocale: 'lt_LT', group: 'baltic' },
	// Uralic
	fi: { label: 'Suomi', flag: 'fi', ogLocale: 'fi_FI', group: 'uralic' },
	// Balkan
	el: { label: 'Ελληνικά', flag: 'el', ogLocale: 'el_GR', group: 'balkan' },
	sq: { label: 'Shqip', flag: 'sq', ogLocale: 'sq_AL', group: 'balkan' },
	// Turkic
	crh: { label: 'Qırımtatarca', flag: 'crh', ogLocale: 'crh_UA', group: 'turkic' },
	tr: { label: 'Türkçe', flag: 'tr', ogLocale: 'tr_TR', group: 'turkic' },
	// Caucasus
	ka: { label: 'ქართული', flag: 'ka', ogLocale: 'ka_GE', group: 'caucasus' },
	// East Asian
	ja: { label: '日本語', flag: 'ja', ogLocale: 'ja_JP', group: 'east_asian' },
	ko: { label: '한국어', flag: 'ko', ogLocale: 'ko_KR', group: 'east_asian' },
	// Semitic
	he: { label: 'עברית', flag: 'he', ogLocale: 'he_IL', group: 'semitic' },
	mt: { label: 'Malti', flag: 'mt', ogLocale: 'mt_MT', group: 'semitic' },
	// Micronesian
	chk: { label: 'Chuuk *', flag: 'chk', ogLocale: 'chk_FM', group: 'micronesian' },
	pon: { label: 'Pohnpei *', flag: 'pon', ogLocale: 'pon_FM', group: 'micronesian' },
	kos: { label: 'Kosrae *', flag: 'kos', ogLocale: 'kos_FM', group: 'micronesian' },
	yap: { label: 'Yap *', flag: 'yap', ogLocale: 'yap_FM', group: 'micronesian' }
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
