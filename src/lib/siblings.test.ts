import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveSiblingLocale, SIBLINGS, siblingUrl } from './siblings';
import { DEFAULT_LANGUAGE, LANGUAGES, SITE_BASE, SITE_ORIGIN } from './i18n/routing';

/**
 * `siblings.ts` — ОДНА таблиця, скопійована у вісім репозиторіїв, і кожен із них
 * знає правду лише про свій рядок.
 *
 * Сусідні сайти будують посилання сюди з рядка `vetcrewgames`: чотири мови,
 * українська на голій адресі, решта сегментом. Додана тут мова робить сім чужих
 * копій застарілими МОВЧКИ; прибрана — веде чужі посилання на адресу, якої вже
 * немає. Симптом зʼявляється на ЧУЖОМУ сайті й через місяці, тож перевірка
 * стоїть тут: розходження червоніє в тому репозиторії й на тому коміті, що його
 * спричинив. Це і є ціна рішення тримати таблицю копією, а не пакетом.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати `nl` з
 * `LANGUAGES` — червоніє звірка мов; поміняти `DEFAULT_LANGUAGE` на `'en'` —
 * червоніє мова голої адреси й, окремо, форма адрес; перевернути
 * `trailingSlash` у рядку — червоніють усі звірки адрес.
 */

const ROW = SIBLINGS.vetcrewgames;

describe('рядок цього сайту в таблиці сусідів', () => {
	it('перелічує ті самі мови, що сайт справді віддає', () => {
		expect([...ROW.locales].sort()).toEqual([...LANGUAGES].sort());
	});

	it('називає ту саму мову на голій адресі', () => {
		expect(ROW.defaultLocale).toBe(DEFAULT_LANGUAGE);
	});

	it('несе той самий origin і базу, що й модуль адрес', () => {
		expect(ROW.origin).toBe(SITE_ORIGIN);
		expect(ROW.base).toBe(SITE_BASE);
	});

	it('узгоджений із макетом щодо кінцевого слеша', () => {
		const layout = readFileSync('src/routes/+layout.ts', 'utf8');
		const declared = /trailingSlash = '(\w+)'/.exec(layout)?.[1];
		expect(declared, 'макет більше не оголошує trailingSlash').toBeTruthy();
		expect(ROW.trailingSlash).toBe(declared === 'always');
	});

	it('каже «шляхом», бо мова тут живе в адресі', () => {
		expect(ROW.transport).toBe('path');
	});

	/*
	 * Найдорожча звірка з усіх: адреса, яку СУСІД побудує на цей сайт, мусить
	 * збігатися з тією, яку цей сайт будує сам. Розійшовшись, вони дають чуже
	 * посилання на 404 — і побачити це можна лише перейшовши за ним із чужого
	 * сайту, тобто ніколи під час роботи над цим.
	 */
	it('будує ті самі адреси, що й langUrl цього сайту', async () => {
		const { langUrl } = await import('./i18n/routing');
		for (const language of LANGUAGES) {
			expect(siblingUrl('vetcrewgames', language).split('?')[0], `мова ${language}`).toBe(
				langUrl(language)
			);
		}
	});
});

/**
 * ПРИЙМАЧ `?lang=` — і чому він тут ОБОВʼЯЗКОВИЙ.
 *
 * Перший варіант цієї перевірки стверджував протилежне: «мова приходить лише з
 * адреси, збереженої не існує, тож читати параметр нема кому». Вона впала на
 * `rememberLocale()` — і добре, бо це неправда. Голий шлях тут застосовує
 * ЗБЕРЕЖЕНИЙ вибір (`+layout.svelte`, I18N-v8 § 3.3), а це рівно той випадок,
 * заради якого `?lang=` і потрібен: відвідувач, який колись обрав тут
 * англійську, приходив би з української сторінки сусіда — і його перекидало б
 * на англійську.
 *
 * Українську сусід може назвати ЛИШЕ параметром, бо `/VetCrewGames/uk/` тут
 * свідомо не існує. Тому параметр мусить стояти вище за збережений вибір, і
 * нижче перевіряється саме порядок.
 *
 * Джерело читається як текст: розкладка `+layout.svelte` — це `onMount` із
 * `goto`, і відтворити її в юніт-раннері означало б мокати пів SvelteKit.
 */
describe('голий шлях читає ?lang= раніше за збережений вибір', () => {
	const layout = readFileSync('src/routes/+layout.svelte', 'utf8');

	it('параметр стоїть перед збереженим вибором, а не після', () => {
		expect(
			layout,
			'порядок джерел мови змінився — збережений вибір знову перекриває перехід'
		).toMatch(/isLanguage\(asked\) \? asked : null\) \?\? settings\.savedLocale\(\)/);
	});

	it('читається лише на голому шляху', () => {
		// На мовній адресі нічого не робиться: інакше збережений вибір викидав би
		// відвідувача зі сторінки, яку він щойно відкрив за посиланням.
		expect(layout).toMatch(/if \(!page\.params\.lang\) \{/);
	});

	it('не пише параметр у сховище', () => {
		// `rememberLocale` лишається справою перемикача в шапці: параметр каже про
		// ЦЕЙ перехід, а не про вибір на цьому сайті.
		const guarded = layout.slice(layout.indexOf('if (!page.params.lang) {'));
		expect(guarded.slice(0, 400)).not.toMatch(/rememberLocale/);
	});

	it('адреса, яку шлють сусіди, має саме ту форму, яку читає приймач', () => {
		expect(siblingUrl('vetcrewgames', 'uk')).toBe(
			'https://alik532ua.github.io/VetCrewGames/?lang=uk'
		);
		expect(siblingUrl('vetcrewgames', 'de')).toBe('https://alik532ua.github.io/VetCrewGames/de/');
	});
});

describe('«замовити сайт» веде в DigitalWorkshop мовою, якою читають тут', () => {
	it('кладе мову в шлях, коли в сусіда вона не типова', () => {
		expect(siblingUrl('digitalworkshop', 'en')).toBe(
			'https://alik532ua.github.io/DigitalWorkshop/en/'
		);
		expect(siblingUrl('digitalworkshop', 'de')).toBe(
			'https://alik532ua.github.io/DigitalWorkshop/de/'
		);
	});

	it('називає українську параметром, бо в сусіда вона на голій адресі', () => {
		expect(siblingUrl('digitalworkshop', 'uk')).toBe(
			'https://alik532ua.github.io/DigitalWorkshop/?lang=uk'
		);
	});

	it('не лишає жодної тутешньої мови без адреси в сусіда', () => {
		for (const language of LANGUAGES) {
			const url = new URL(siblingUrl('digitalworkshop', language));
			const named = url.searchParams.get('lang') ?? url.pathname.split('/')[2];
			expect(named, `DigitalWorkshop не відкривається мовою ${language}`).toBe(language);
		}
	});

	it('зводить en-US до en, а не вважає невідомим', () => {
		expect(resolveSiblingLocale('digitalworkshop', 'en-US')).toBe('en');
	});
});
