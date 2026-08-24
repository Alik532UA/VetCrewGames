import { FLAG_COUNTRIES } from './countries.generated';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Країна гравця: код, назва мовою інтерфейсу й перевірка на чинність.
 *
 * ## Чому назви НЕ лежать у словнику проєкту
 *
 * Двісті шістдесят пʼять назв × чотири мови — це понад тисяча рядків, які нічим
 * не відрізняються від того, що вже є в браузері. `Intl.DisplayNames` віддає
 * localised назву регіону з даних ICU, тобто правильну, відмінювану за нормами
 * мови й таку, що не потребує ні перекладу, ні перевірки паритету.
 *
 * Ціна названа: у дуже старому браузері `Intl.DisplayNames` немає, і тоді
 * лишається код країни великими літерами. Це не поломка — «UA» поруч із прапором
 * читається, — а межа, і вона обробляється явно, а не падінням.
 *
 * ## Чому код — це РЯДОК, а не перелічуваний тип
 *
 * Перелік генерується з набору прапорів (`countries.generated.ts`), і
 * перетворити його в `type` означало б або тисячу літералів у типі, або ручну
 * копію, яка розійдеться з набором. Чинність перевіряє `isCountry` — вона
 * дивиться в той самий згенерований перелік, тобто в джерело правди.
 */

export { FLAG_COUNTRIES };

/** Скільки символів у коді країни. ISO 3166-1 alpha-2 — рівно два. */
export const COUNTRY_CODE_LENGTH = 2;

const KNOWN = new Set(FLAG_COUNTRIES);

/**
 * Чи є такий прапор. Порожній рядок і `null` — законна відповідь «країни немає».
 *
 * Перевірка потрібна на ОБОХ кінцях: чуже значення з бази могло прийти від
 * новішої збірки (де набір прапорів більший) або від чужих рук, а `<img>` на
 * неіснуючий файл дає порожню рамку й запис у консолі — тобто дефект, який видно
 * лише розробнику.
 */
export function isCountry(value: unknown): value is string {
	return typeof value === 'string' && KNOWN.has(value.toLowerCase());
}

/**
 * Назва країни мовою інтерфейсу. Невідомий код віддається великими літерами.
 *
 * `try` тут не про параною: `Intl.DisplayNames` кидає на невідомій мові, а
 * `settings.locale` приходить із налаштувань, тобто ззовні цього модуля.
 */
export function countryName(code: string, locale: string): string {
	try {
		const names = new Intl.DisplayNames([locale], { type: 'region' });
		return names.of(code.toUpperCase()) ?? code.toUpperCase();
	} catch {
		return code.toUpperCase();
	}
}

/**
 * КОДИ, ЯКИХ `Intl.DisplayNames` НЕ ЗНАЄ, — назва зі словника проєкту.
 *
 * Такий код тут один: `xr` — Російський добровольчий корпус. ISO його не має, і
 * взятий він із діапазону вільного призначення (`XA`–`XZ`), який стандарт прямо
 * лишає застосункам; той самий діапазон використовує й пакет прапорів — `XK`
 * для Косова, `XO` для Південної Осетії, `XC` для Північного Кіпру.
 *
 * Без цього переліку список показував би сирий «XR» — і показував би його
 * ПОСЕРЕД абетки, бо сортування йде за назвою. Причина, чому це не в
 * `Intl.DisplayNames`, названа прямо: цієї сутності в ICU немає й не буде.
 *
 * Ключ типізований, а не `string`: приведення `as TranslationKey` тут уже
 * ховало помилку в сусідньому модулі — ключ існував, але не той.
 */
export const OWN_COUNTRY_NAMES: Readonly<Record<string, TranslationKey>> = {
	xr: 'country.xr'
};

/**
 * Назва однієї країни — з урахуванням власних кодів.
 *
 * Відрізняється від `countryName` рівно на `OWN_COUNTRY_NAMES`, і саме тому
 * існує окремо: для ОДНОГО коду (напис на кнопці вибору) будувати весь перелік
 * із 262 назв не треба, а забути про власний код — означає показати «XR».
 */
export function countryLabel(
	code: string,
	locale: string,
	translate: (key: TranslationKey) => string
): string {
	const own = OWN_COUNTRY_NAMES[code];
	return own ? translate(own) : countryName(code, locale);
}

/**
 * Країни, впорядковані за назвою МОВОЮ ІНТЕРФЕЙСУ.
 *
 * Сортування через `Intl.Collator`, а не `localeCompare` за замовчуванням: у
 * списку є «Ірландія» й «Ізраїль», і порядок «і» після «з» правильний лише за
 * правилами української, а не за кодами символів.
 *
 * Список рахується на вимогу, а не тримається готовим: він потрібен рівно тоді,
 * коли людина відкрила вибір країни, і залежить від мови.
 */
export function countriesByName(
	locale: string,
	translate: (key: TranslationKey) => string
): Array<{ code: string; name: string }> {
	const collator = new Intl.Collator(locale);
	return FLAG_COUNTRIES.map((code) => ({
		code,
		name: countryLabel(code, locale, translate)
	})).sort((a, b) => collator.compare(a.name, b.name));
}
