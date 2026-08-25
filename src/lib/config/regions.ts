import { countriesByName } from './countries';
import { COUNTRY_REGION, REGION_ORDER, type RegionId } from './regions.generated';
import type { TranslationKey } from '$lib/i18n/translations/uk';

export { COUNTRY_REGION, REGION_ORDER, type RegionId };

/**
 * Країни, згруповані за регіоном, — те, з чого малюється вибір прапора.
 *
 * ## Навіщо групи взагалі
 *
 * Двісті шістдесят дві країни одним списком не читаються: на екрані телефона
 * це дев'ятнадцять пунктів із двохсот шістдесяти двох, і жодного орієнтира, де
 * ти зараз. Заголовок регіону дає той орієнтир за нуль зусиль з боку людини —
 * вона й так знає, на якому континенті її країна.
 *
 * ## Де живе склад регіонів і чому не тут
 *
 * У `regions.generated.ts`, а джерело з перевіркою — у
 * `scripts/sync-regions.mjs`. Причина розділення названа там: `Intl` називає
 * макрорегіони, але про їхній СКЛАД не знає жодним викликом, тож таблиця
 * неминуча — і мусить бути ОДНА, зі гейтом, який ловить прапор без регіону.
 *
 * ## Назви регіонів — зі СЛОВНИКА, а не з `Intl`
 *
 * Це відхід від того, як тут зроблено назви країн, і він виміряний.
 * `Intl.DisplayNames` макрорегіони називає, і в усіх чотирьох мовах, але
 * називає їх формами, розрахованими на те, щоб не збігтися з назвою країни:
 * `of('019')` → «Американський регіон», `of('021')` → «Північноамериканський
 * регіон», `of('057')` → «Мікронезійський регіон». Заголовком у списку це
 * читається як канцелярит. Дев'ять рядків на мову — дешевша ціна за «Північна
 * Америка».
 */
export interface RegionGroup {
	id: RegionId;
	/** Назва регіону мовою інтерфейсу. */
	name: string;
	countries: Array<{ code: string; name: string }>;
}

/**
 * Ключ словника для назви регіону.
 *
 * Ключі лежать у ЛІНИВОМУ чанку (`i18n/account/`), а не в головному словнику:
 * той стоїть рівно на межі бюджету (121 КБ gzip зі стелі 121), і сім назв ×
 * чотири мови поїхали б у перший payload кожного відвідувача — заради панелі,
 * яку більшість не відкриє жодного разу. Тому тип значення тут `string`, а не
 * `TranslationKey`: `t()` цих ключів не знає в принципі.
 *
 * Ключі виписані, а не зібрані з `id` («account.region» + великі літери):
 * складене ім'я не знайти пошуком по проєкту, тобто на питання «де оголошено
 * `account.regionNorthAmerica`» відповіді б не було. `Record<RegionId, …>`
 * заразом робить забутий регіон помилкою компіляції, а не порожнім заголовком.
 */
export const REGION_KEY: Readonly<Record<RegionId, string>> = {
	europe: 'account.regionEurope',
	asia: 'account.regionAsia',
	africa: 'account.regionAfrica',
	'north-america': 'account.regionNorthAmerica',
	'south-america': 'account.regionSouthAmerica',
	oceania: 'account.regionOceania',
	antarctic: 'account.regionAntarctic'
};

/**
 * Рядок, зведений до вигляду, у якому його порівнюють із набраним.
 *
 * Розкладання NFD зі зняттям знаків наголосу — не оздоба: без нього «Osterreich»
 * не знаходить «Österreich», а «Cote» не знаходить «Côte d'Ivoire», тобто
 * найпростіший спосіб набрати назву латинкою без діакритики не працює.
 *
 * НА КИРИЛИЦІ ЦЕ ТЕЖ ДІЄ, і побічно: «й» розкладається на «и» з бревісом, «ї»
 * на «і» з двома точками. Тобто пошук стає нечутливим до і/ї/й — і це радше
 * добре («украіна» знаходить «Україна»), бо обидві сторони порівняння зведені
 * однаково.
 */
export function foldForSearch(value: string, locale: string): string {
	return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(locale);
}

/**
 * Групи в порядку `REGION_ORDER`; країни в кожній — за назвою мовою інтерфейсу.
 *
 * Сортування й власні назви (`xr`) лишаються в `countriesByName`: розділяти їх
 * означало б мати два місця, які знають, як зветься країна.
 *
 * КОД БЕЗ РЕГІОНУ НЕ ГУБИТЬСЯ. Такого не буває — `scripts/sync-regions.mjs` і
 * `regions.test.ts` цього не пускають, — але якби таблиця розійшлася з набором
 * прапорів, країна пішла б в останню групу з ключем замість назви. Видимий
 * дефект дешевший за зникнення країни зі списку: перше побачить перший, хто
 * відкриє панель, друге не побачить ніхто.
 */
export function countriesByRegion(
	locale: string,
	translate: (key: TranslationKey) => string,
	regionName: (key: string) => string
): RegionGroup[] {
	const byRegion = new Map<RegionId, Array<{ code: string; name: string }>>();

	for (const country of countriesByName(locale, translate)) {
		const id = COUNTRY_REGION[country.code];
		const list = byRegion.get(id);
		if (list) list.push(country);
		else byRegion.set(id, [country]);
	}

	const rank = (id: RegionId) => {
		const at = REGION_ORDER.indexOf(id);
		return at === -1 ? REGION_ORDER.length : at;
	};

	return [...byRegion.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([id, countries]) => ({
			id,
			// Невідомий регіон дає невідомий ключ, а завантажувач словника віддає
			// сам ключ — тобто заголовок «account.region…» на екрані. Див. вище.
			name: regionName(REGION_KEY[id] ?? `account.region.${id}`),
			countries
		}));
}

/**
 * Ті самі групи, але лишається тільки те, що підходить під набране.
 *
 * Порожні групи ВИКИДАЮТЬСЯ: заголовок без жодного пункту під ним читається як
 * збій, а не як «тут нічого не знайшлося».
 *
 * Код країни теж шукається («ua», «de»): двобуквений код — найкоротший спосіб
 * назвати країну, і той, хто його знає, набирає саме його.
 */
export function filterRegions(groups: RegionGroup[], query: string, locale: string): RegionGroup[] {
	const needle = foldForSearch(query.trim(), locale);
	if (needle === '') return groups;

	return groups
		.map((group) => ({
			...group,
			countries: group.countries.filter(
				(country) =>
					foldForSearch(country.name, locale).includes(needle) || country.code.includes(needle)
			)
		}))
		.filter((group) => group.countries.length > 0);
}
