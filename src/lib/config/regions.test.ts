import { describe, expect, it } from 'vitest';
import { FLAG_COUNTRIES } from './countries.generated';
import { COUNTRY_REGION, REGION_ORDER, type RegionId } from './regions.generated';
import { REGION_KEY, countriesByRegion, filterRegions, foldForSearch } from './regions';
import { account as uk } from '$lib/i18n/account/uk';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * КОЖНА КРАЇНА В РІВНО ОДНІЙ ГРУПІ — і це стереже саме тест, а не лише скрипт.
 *
 * `scripts/sync-regions.mjs` перевіряє те саме в момент генерації, і цього
 * НЕ ДОСИТЬ: набір прапорів міняють руками (`npm run sync:flags` плюс
 * `EXCLUDED` у тому ж файлі), а `sync:regions` після цього запускати нікому не
 * обов'язково. Тобто без цього файлу розходження жило б до того, як хтось
 * відкриє панель і не знайде в ній своєї країни.
 *
 * Дефект, від якого це захищає, тихий у найгіршому сенсі: країна не зникає з
 * `FLAG_COUNTRIES`, прапор лежить у `static/flags/`, `isCountry` каже «є» — і
 * лише вибірник її не показує, бо групи, у яку її покласти, немає.
 */
describe('регіони країн', () => {
	it('перевірка жива: країни й регіони знайдено', () => {
		expect(FLAG_COUNTRIES.length).toBeGreaterThan(100);
		expect(REGION_ORDER.length).toBeGreaterThan(3);
	});

	it('у кожної країни з набору прапорів є регіон', () => {
		const orphans = FLAG_COUNTRIES.filter((code) => !(code in COUNTRY_REGION));
		expect(
			orphans,
			`країни без регіону — не потраплять у вибірник. Дописати в scripts/sync-regions.mjs і ` +
				`перезапустити \`npm run sync:regions\`:\n${orphans.join(', ')}`
		).toEqual([]);
	});

	it('у таблиці немає країн, яких уже немає в наборі прапорів', () => {
		const known = new Set<string>(FLAG_COUNTRIES);
		const stale = Object.keys(COUNTRY_REGION).filter((code) => !known.has(code));
		expect(
			stale,
			`прапор прибрали, а рядок лишився — перезапустити \`npm run sync:regions\`:\n${stale.join(', ')}`
		).toEqual([]);
	});

	it('кожен регіон із таблиці оголошений у REGION_ORDER', () => {
		const declared = new Set<string>(REGION_ORDER);
		const unknown = [...new Set(Object.values(COUNTRY_REGION))].filter((id) => !declared.has(id));
		expect(unknown, `регіон поза порядком показу: ${unknown.join(', ')}`).toEqual([]);
	});

	/**
	 * Порожній регіон — це заголовок, під яким нічого немає.
	 *
	 * Він не падіння, а гірше: `countriesByRegion` порожні групи й так викидає,
	 * тож на екрані нічого не видно, а в порядку показу лишається рядок, який
	 * нічого не означає. Наступний читач вважатиме, що регіон просто спорожнів
	 * тимчасово.
	 */
	it('у кожного оголошеного регіону є хоч одна країна', () => {
		const used = new Set(Object.values(COUNTRY_REGION));
		const empty = REGION_ORDER.filter((id) => !used.has(id));
		expect(empty, `регіон без жодної країни: ${empty.join(', ')}`).toEqual([]);
	});

	it('у кожного регіону є ключ словника, і він є в українському словнику', () => {
		const missingKey = REGION_ORDER.filter((id) => !REGION_KEY[id]);
		expect(missingKey, `регіон без ключа в REGION_KEY: ${missingKey.join(', ')}`).toEqual([]);

		const missingText = REGION_ORDER.map((id) => REGION_KEY[id]).filter((key) => !uk[key]);
		expect(
			missingText,
			`ключ регіону без рядка в i18n/account/uk.ts: ${missingText.join(', ')}`
		).toEqual([]);
	});
});

describe('групування для вибірника', () => {
	/** Замість словника — сам ключ: тест перевіряє склад, а не переклад. */
	const asKey = (key: string) => key;
	const groups = countriesByRegion('uk', asKey as (key: TranslationKey) => string, asKey);

	it('жодна країна не втрачена й не подвоєна', () => {
		const shown = groups.flatMap((group) => group.countries.map((c) => c.code));
		expect(shown).toHaveLength(FLAG_COUNTRIES.length);
		expect(new Set(shown).size).toBe(FLAG_COUNTRIES.length);
	});

	it('групи йдуть у порядку REGION_ORDER', () => {
		const shown = groups.map((group) => group.id);
		const expected = REGION_ORDER.filter((id: RegionId) => shown.includes(id));
		expect(shown).toEqual(expected);
	});

	it('країни в групі впорядковані за назвою мовою інтерфейсу', () => {
		const collator = new Intl.Collator('uk');
		for (const group of groups) {
			const names = group.countries.map((c) => c.name);
			expect([...names].sort(collator.compare), `${group.id}: порядок`).toEqual(names);
		}
	});
});

describe('пошук у вибірнику', () => {
	const asKey = (key: string) => key;
	const groups = countriesByRegion('uk', asKey as (key: TranslationKey) => string, asKey);

	it('порожній запит лишає все', () => {
		expect(filterRegions(groups, '   ', 'uk')).toHaveLength(groups.length);
	});

	it('порожні групи не лишаються заголовками', () => {
		const found = filterRegions(groups, 'ua', 'uk');
		expect(found.every((group) => group.countries.length > 0)).toBe(true);
	});

	it('знаходить за кодом країни', () => {
		const codes = filterRegions(groups, 'ua', 'uk').flatMap((g) => g.countries.map((c) => c.code));
		expect(codes).toContain('ua');
	});

	it('знаходить за назвою', () => {
		const codes = filterRegions(groups, 'Україна', 'uk').flatMap((g) =>
			g.countries.map((c) => c.code)
		);
		expect(codes).toContain('ua');
	});

	/**
	 * Діакритика знімається з ОБОХ сторін порівняння.
	 *
	 * Це не оздоба: без цього набране латинкою без умлаутів («Osterreich») не
	 * знаходить «Österreich» — тобто найзвичніший спосіб набрати назву не
	 * працює саме там, де він найпотрібніший.
	 */
	it('набране без діакритики знаходить назву з нею', () => {
		expect(foldForSearch('Österreich', 'de')).toBe('osterreich');
		expect(foldForSearch("Côte d'Ivoire", 'fr')).toBe("cote d'ivoire");
	});

	it('нічого не знайшлося — жодної групи, а не порожні заголовки', () => {
		expect(filterRegions(groups, 'zzzzz', 'uk')).toEqual([]);
	});
});
