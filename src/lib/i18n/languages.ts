import { asset } from '$app/paths';
import { LANGUAGES, type Language } from './routing';

/**
 * Як мова ПОКАЗУЄТЬСЯ: підпис і прапор. Одна таблиця на весь проєкт.
 *
 * Політика адрес лежить окремо, у `routing.ts`: її читає й генератор sitemap,
 * що виконується в Node без застосунку, а `asset()` там недоступний. Тут —
 * тільки те, що потрібне інтерфейсу.
 *
 * **Що робити, щоб додати мову.** Рівно три кроки: дописати код у `LANGUAGES`,
 * покласти сюди рядок із підписом і прапором, додати словник у
 * `translations/`. Усе інше виводиться: матчер сегмента, `entries()` для
 * prerender, hreflang, sitemap і перелік у перемикачі. Інваріант
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
}

const META: Record<Language, Omit<LanguageMeta, 'code'>> = {
	uk: { label: 'Українська', flag: 'uk' },
	en: { label: 'English', flag: 'en' },
	de: { label: 'Deutsch', flag: 'de' },
	nl: { label: 'Nederlands', flag: 'nl' }
};

/** Порядок у перемикачі — той самий, що й у `LANGUAGES`. */
export const LANGUAGE_META: readonly LanguageMeta[] = LANGUAGES.map((code) => ({
	code,
	...META[code]
}));

export const flagSrc = (code: Language): string => asset(`/images/flags/${META[code].flag}.svg`);

export const languageLabel = (code: Language): string => META[code].label;
