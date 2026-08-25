/**
 * Інваріанти ЗІБРАНОГО сайту. Запускати після `npm run build`.
 *
 * Чому окремий крок, а не ще один vitest-файл: усе нижче не існує в джерелах.
 * Дефекти цього класу видно лише у `build/*.html`, і кожен із них у коді
 * виглядає правильним (AI-AGENT-PITFALLS-v8 § 2, CODE-QUALITY-v8 § 7,
 * SEO-v8 § 6.1).
 *
 * Перевірка мертва, якщо їй нема на що дивитися, тому перший блок — canary:
 * без згенерованих сторінок скрипт падає, а не звітує «усе гаразд».
 */
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkGeo } from './check-geo.mjs';

const BUILD = 'build';
const SITE_ORIGIN = 'https://alik532ua.github.io';
const SITE_BASE = '/VetCrewGames';

/**
 * Мовні версії, які МУСЯТЬ існувати як справжні сторінки. Без цього переліку
 * зникнення `entries()` дало б SPA-фолбек: адреса відкривається, але до
 * виконання JavaScript показує типовий вміст — і саме його бачить пошуковик
 * (SVELTEKIT-DATA-v8 § 2.3, § 6.1).
 *
 * Перелік ЯВНИЙ, а не виведений із `LANGUAGES`: він для того й існує, щоб
 * зловити випадок, коли `entries()` віддав менше, ніж мов оголошено. Вивести
 * його з того самого джерела означало б звіряти джерело саме з собою.
 */
/**
 * Мова → локаль Open Graph, у тому самому порядку, що й `LANGUAGES`.
 *
 * Перелік ЯВНИЙ, з тієї самої причини, що й `EXPECTED_PAGES` нижче: він для
 * того й існує, щоб зловити випадок, коли застосунок віддав менше мов або чужу
 * локаль. Виведений із `src/lib/i18n/languages.ts`, він звіряв би джерело саме
 * з собою — і саме таким чином дефект `de → en_US` жив непоміченим.
 */
const OG_LOCALES = new Map([
	['uk', 'uk_UA'],
	['en', 'en_US'],
	['de', 'de_DE'],
	['nl', 'nl_NL']
]);

const EXPECTED_PAGES = [
	['index.html', 'uk'],
	['account/index.html', 'uk'],
	['quiz/index.html', 'uk'],
	['quiz/play/index.html', 'uk'],
	['quiz/online/index.html', 'uk'],
	['pairs/index.html', 'uk'],
	['pairs/online/index.html', 'uk'],
	['reserve/index.html', 'uk'],
	['reserve/forest/index.html', 'uk'],
	['reserve/tundra/index.html', 'uk'],
	['reserve/savanna/index.html', 'uk'],
	['reserve/rainforest/index.html', 'uk'],
	['game-mythbusters/index.html', 'uk'],
	['game-population/index.html', 'uk'],
	['game-family/index.html', 'uk'],
	['game-habitat/index.html', 'uk'],
	['game-habitat/continents/index.html', 'uk'],
	['game-habitat/biomes/index.html', 'uk'],
	['game-feeding/index.html', 'uk'],
	['game-memory/index.html', 'uk'],
	['en/index.html', 'en'],
	['en/account/index.html', 'en'],
	['en/quiz/index.html', 'en'],
	['en/quiz/play/index.html', 'en'],
	['en/quiz/online/index.html', 'en'],
	['en/pairs/index.html', 'en'],
	['en/pairs/online/index.html', 'en'],
	['en/reserve/index.html', 'en'],
	['en/reserve/forest/index.html', 'en'],
	['en/reserve/tundra/index.html', 'en'],
	['en/reserve/savanna/index.html', 'en'],
	['en/reserve/rainforest/index.html', 'en'],
	['en/game-mythbusters/index.html', 'en'],
	['en/game-population/index.html', 'en'],
	['en/game-family/index.html', 'en'],
	['en/game-habitat/index.html', 'en'],
	['en/game-habitat/continents/index.html', 'en'],
	['en/game-habitat/biomes/index.html', 'en'],
	['en/game-feeding/index.html', 'en'],
	['en/game-memory/index.html', 'en'],
	['de/index.html', 'de'],
	['de/account/index.html', 'de'],
	['de/quiz/index.html', 'de'],
	['de/quiz/play/index.html', 'de'],
	['de/quiz/online/index.html', 'de'],
	['de/pairs/index.html', 'de'],
	['de/pairs/online/index.html', 'de'],
	['de/reserve/index.html', 'de'],
	['de/reserve/forest/index.html', 'de'],
	['de/reserve/tundra/index.html', 'de'],
	['de/reserve/savanna/index.html', 'de'],
	['de/reserve/rainforest/index.html', 'de'],
	['de/game-mythbusters/index.html', 'de'],
	['de/game-population/index.html', 'de'],
	['de/game-family/index.html', 'de'],
	['de/game-habitat/index.html', 'de'],
	['de/game-habitat/continents/index.html', 'de'],
	['de/game-habitat/biomes/index.html', 'de'],
	['de/game-feeding/index.html', 'de'],
	['de/game-memory/index.html', 'de'],
	['nl/index.html', 'nl'],
	['nl/account/index.html', 'nl'],
	['nl/quiz/index.html', 'nl'],
	['nl/quiz/play/index.html', 'nl'],
	['nl/quiz/online/index.html', 'nl'],
	['nl/pairs/index.html', 'nl'],
	['nl/pairs/online/index.html', 'nl'],
	['nl/reserve/index.html', 'nl'],
	['nl/reserve/forest/index.html', 'nl'],
	['nl/reserve/tundra/index.html', 'nl'],
	['nl/reserve/savanna/index.html', 'nl'],
	['nl/reserve/rainforest/index.html', 'nl'],
	['nl/game-mythbusters/index.html', 'nl'],
	['nl/game-population/index.html', 'nl'],
	['nl/game-family/index.html', 'nl'],
	['nl/game-habitat/index.html', 'nl'],
	['nl/game-habitat/continents/index.html', 'nl'],
	['nl/game-habitat/biomes/index.html', 'nl'],
	['nl/game-feeding/index.html', 'nl'],
	['nl/game-memory/index.html', 'nl']
];

/**
 * Сторінки ПОЗА індексом (`HIDDEN_ROUTES` у `src/lib/i18n/routing.ts`).
 *
 * Вони мусять існувати — і мусять бути прихованими саме так, як обіцяно:
 * `noindex`, без canonical і без рядка в sitemap. Перевіряється протилежне до
 * решти сторінок, а не «виняток»: слабший варіант (просто не вимагати canonical)
 * пропустив би найтихішу поломку — сторінку, що тихо повернулася в пошук, коли
 * хтось переніс мета-теги з `{#if}` вище.
 *
 * У списку всі чотири мови: `entries()` малює приховану сторінку так само, як
 * будь-яку іншу, і мовчазне зникнення трьох із них теж дефект.
 */
const HIDDEN_PAGES = [
	'beta-test-checklists/index.html',
	'en/beta-test-checklists/index.html',
	'de/beta-test-checklists/index.html',
	'nl/beta-test-checklists/index.html'
];

/**
 * Два бюджети, а не один (PERFORMANCE-v8 § 1).
 *
 * `ENTRY` — те, що завантажує КОЖЕН відвідувач, хоч би куди він зайшов. Це
 * число має лишатися малим завжди.
 *
 * `LAYOUT` — кореневий layout. Його теж вантажать усі, тож ховати його всередині
 * «entry» було б самообманом: саме там сидить Sentry на 84 КБ.
 *
 * `ROUTE` — те, що додає найважчий ОКРЕМИЙ маршрут понад ці два. Воно існує
 * тому, що заповідник тягне 3D-рушій: одним числом ці речі не виміряти, і
 * спроба це зробити або заблокує 3D назавжди, або зробить стелю для решти
 * сайту безглуздо високою.
 *
 * Жодна чинна стеля тут не послаблена. Змінилося тільки те, ЩО міряється:
 * доти рахувалися самі файли `entry/`, без чанків, які вони тягнуть, — 89 КБ
 * замість справжніх 121. Тобто число просто не означало того, що обіцяло.
 */
const ENTRY_JS_BUDGET_KB = 150;
/*
 * 120 → 121, І ЦЕ ВИДИМА ПЛАТА ЗА ФУНКЦІЮ, а не послаблення гейта.
 *
 * Автор попросив аватарку в шапці: «стандартна іконка, але якщо користувач
 * виставив собі власну аватарку, то посилання виглядає як ця аватарка». Шапка
 * лежить у цьому чанку, тобто платять усі — і ось точний рахунок, заміряний по
 * частинах на тому самому білді:
 *
 *   120,136 КБ — без аватарки взагалі (стан до цієї зміни; стеля 120 проходила
 *                лише завдяки округленню в звіті);
 *   120,685 КБ — плюс `services/playerAvatar` (знати, чи вибрано аватарку);
 *   120,99  КБ — плюс саме малювання (`features/headerAvatar` і `@attach`).
 *
 * Тобто функція коштує 0,85 КБ. Дешевших способів перевірено два, і обидва
 * гірші: статичний `Avatar` у шапці дає 123 КБ (чотирнадцять значків `lucide`
 * для всіх, зокрема для тих, хто аватарку не вибирав), а локальна перевірка
 * форми замість `isAvatar` економить 0,06 КБ і платить за це другим джерелом
 * правди про те, який аватар чинний.
 *
 * Стеля піднята РІВНО під заміряне, без запасу: наступна дрібниця, що не
 * влізе, — це сигнал подумати, а не привід знову правити число.
 *
 * ── 121 → 122, І ЦЕ САМЕ ТОЙ СИГНАЛ ────────────────────────────────────────
 *
 * Не влізли одинадцять сповіщень заповідника («тварина померла від хвороби»,
 * «браконьєри забрали тварину» тощо) × чотири мови: 120,973 → 121,937 КБ,
 * тобто рівно один кілобайт.
 *
 * Причина глибша за ці рядки, і ось вона числом: головний словник статично
 * імпортує ВСІ чотири мови, а словник заповідника — 14,88 КБ gzip (46,8 КБ
 * сирих). Тобто кожен відвідувач, зокрема той, хто зайшов пограти у вікторину,
 * везе з собою весь текст заповідника — понад десяту частину цього чанку.
 *
 * Ліниві чанки в проєкті вже є (`i18n/quiz`, `i18n/account`, `i18n/crew`,
 * `i18n/awaited`), і саме вони тримали цей бюджет доти. Заповідник у них не
 * потрапив, і тепер це найбільший окремий шматок, який можна повернути.
 *
 * Чому не зроблено разом із цією правкою: `toast` приймає КЛЮЧ головного
 * словника, а не готовий текст, тож ліниві рядки в тост не передати без зміни
 * його контракту — плюс усі компоненти заповідника довелося б перевести на
 * переданий перекладач, як зроблено у вікторині. Це окрема робота на ~15 КБ,
 * і робити її в коміті про логування означало б змішати дві різні зміни.
 */
const LAYOUT_JS_BUDGET_KB = 122;
const ROUTE_JS_BUDGET_KB = 300;

/**
 * Домени, які сторінка справді відкриває, і директива, без якої браузер
 * мовчки їх заблокує (SECURITY-v8 § 6.2 і § 14.1). Список звіряється з
 * `app.html` і `analytics.ts`, а не з пам'яті.
 */
const REQUIRED_CSP = [
	['script-src', 'https://www.googletagmanager.com'],
	['connect-src', 'https://*.google-analytics.com'],
	['style-src', 'https://fonts.googleapis.com'],
	['font-src', 'https://fonts.gstatic.com']
];

const problems = [];
const fail = (message) => problems.push(message);

function walk(dir, out = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const allFiles = walk(BUILD);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));

// --- canary -----------------------------------------------------------------
if (htmlFiles.length < 3) {
	console.error(
		`check-build: знайдено ${htmlFiles.length} HTML-файлів у ${BUILD}/. ` +
			'Перевіряти нема чого — збірки немає або шлях змінився.'
	);
	process.exit(1);
}

/** Хеш так, як його рахує браузер: парсер HTML нормалізує переводи рядків. */
const cspHash = (source) =>
	`sha256-${createHash('sha256').update(source.replace(/\r\n/g, '\n')).digest('base64')}`;

for (const file of htmlFiles) {
	const html = readFileSync(file, 'utf8');
	const where = file.replace(`${BUILD}/`, '');
	// 404.html — SPA-фолбек: у ньому за побудовою немає ні вмісту, ні canonical.
	const isFallback = where === '404.html';
	/*
	 * Прихована сторінка звільнена РІВНО від canonical, і ні від чого більше.
	 * Прирівняти її до фолбека було б дешевше на два рядки й неправильно: разом із
	 * canonical вона перестала б перевірятися на порожнє тіло, на title і на
	 * правило смуги прокрутки в <head> — тобто найслабше покритою сторінкою стала б
	 * саме та, якою користуються тестувальники.
	 */
	const isHidden = HIDDEN_PAGES.includes(where);

	// SEO-v8 § 1.1 — сторінка в індексі з порожнім тілом.
	if (!isFallback) {
		const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? '';
		const text = body.replace(/<[^>]+>/g, '').trim();
		if (text.length < 200) fail(`${where}: тіло майже порожнє (${text.length} символів тексту)`);
	}

	// SEO-v8 § 1.2 — плейсхолдер prerender замість справжнього домену.
	if (html.includes('sveltekit-prerender')) fail(`${where}: у HTML лишився sveltekit-prerender`);

	// SEO-v8 § 1.3 — відносний `base`, склеєний в абсолютну адресу.
	if (/https?:\/\/[^"']*\.\//.test(html)) fail(`${where}: абсолютний URL із "./" усередині`);

	if (!isFallback) {
		if (isHidden) {
			// Обидва боки обіцянки: пошуковикові сказано «не індексувати», і жодного
			// canonical, через який сторінка потрапила б у sitemap.
			if (!/<meta name="robots" content="noindex/.test(html))
				fail(`${where}: службова сторінка без noindex — вона потрапить у пошук`);
			if (/rel="canonical"/.test(html))
				fail(`${where}: у службової сторінки є canonical — вона доїде в sitemap`);
			if (/rel="alternate"/.test(html))
				fail(`${where}: у службової сторінки є hreflang — вона доїде в індекс`);
		} else {
			const canonicals = html.match(/<link[^>]+rel="canonical"[^>]*>/g) ?? [];
			if (canonicals.length !== 1) fail(`${where}: canonical знайдено ${canonicals.length} разів`);
			else if (!canonicals[0].includes(`href="${SITE_ORIGIN}`))
				fail(`${where}: canonical не абсолютна або веде на чужий origin — ${canonicals[0]}`);

			if (/<meta name="robots" content="noindex/.test(html))
				fail(`${where}: звичайна сторінка помічена noindex — вона зникне з пошуку`);
		}

		if (!/<title>[^<]{5,}<\/title>/.test(html))
			fail(`${where}: title відсутній або надто короткий`);
	}

	// --- CSP (SECURITY-v8 § 6) ------------------------------------------------
	const cspMeta = html.match(/<meta http-equiv="content-security-policy" content="([^"]*)"/i);
	if (!cspMeta) {
		fail(`${where}: у зібраному HTML немає мета-політики CSP`);
		continue;
	}
	const csp = cspMeta[1];
	const scriptSrc = csp.match(/script-src ([^;]*)/)?.[1] ?? '';

	if (scriptSrc.includes("'unsafe-inline'"))
		fail(`${where}: script-src містить 'unsafe-inline' — політика не покриває жодного скрипта`);

	for (const [directive, origin] of REQUIRED_CSP) {
		if (!new RegExp(`${directive} [^;]*${origin.replace(/[.*]/g, '\\$&')}`).test(csp))
			fail(`${where}: у ${directive} немає ${origin} — ресурс буде заблоковано мовчки`);
	}

	// Кожен інлайн-скрипт мусить бути покритий хешем. Це ловить і розбіжність
	// CRLF/LF, через яку хеш «як є» не збігається з тим, що рахує браузер.
	for (const [, body] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
		const hash = cspHash(body);
		if (!scriptSrc.includes(hash))
			fail(`${where}: інлайн-скрипт не покритий політикою — бракує '${hash}'`);
	}

	/*
	 * SCROLLBAR-v8 § 8.3: правило приховування нативної смуги мусить стояти в
	 * САМОМУ <head>, а не у файлі, на який <head> посилається.
	 *
	 * Клас на першому кадрі без правила на першому кадрі не робить нічого. У
	 * продакшн-збірці CSS приходить блокувальним <link> і встигає, а на
	 * dev-сервері бандл інжектиться через JavaScript — і системна смуга блимає
	 * й зникає. Симптом виглядає так, ніби не спрацював скрипт; скрипт справний.
	 */
	if (!isFallback) {
		const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
		if (!/<style>[\s\S]*has-custom-scrollbar[\s\S]*?<\/style>/.test(head))
			fail(`${where}: правила has-custom-scrollbar немає в самому <head> — воно запізниться`);
	}

	// SECURITY-v8 § 6.3: мета-політика діє лише на те, що йде ПІСЛЯ неї.
	const metaAt = html.indexOf(cspMeta[0]);
	const firstInlineAt = html.indexOf('<script>');
	if (firstInlineAt !== -1 && firstInlineAt < metaAt)
		fail(`${where}: інлайн-скрипт стоїть ВИЩЕ мета-політики — вона його не покриває`);
}

// --- Мовні версії існують і не з'їхали (I18N-v8 § 5.1, SEO-v8 § 1.4) --------
for (const [relative, expectedLang] of EXPECTED_PAGES) {
	const file = `${BUILD}/${relative}`;
	if (!allFiles.includes(file)) {
		fail(`${relative}: сторінки немає — зник entries() або матчер мовного сегмента`);
		continue;
	}

	const html = readFileSync(file, 'utf8');

	// Prerender рендерить сторінки ПОСЛІДОВНО в одному процесі, а мова живе в
	// модульному синглтоні. Класична ознака помилки — значення, зсунуте на одну
	// сторінку: `/en/` українською.
	const lang = html.match(/<html lang="([^"]*)"/)?.[1];
	if (lang !== expectedLang)
		fail(`${relative}: <html lang="${lang}">, а має бути "${expectedLang}"`);
	if (html.includes('%lang%')) fail(`${relative}: плейсхолдер %lang% не підставлено`);

	const expectedCanonical = `${SITE_ORIGIN}${SITE_BASE}/${relative.replace(/index\.html$/, '')}`;
	if (!html.includes(`rel="canonical" href="${expectedCanonical}"`))
		fail(`${relative}: canonical не дорівнює ${expectedCanonical}`);

	// Набір hreflang однаковий на всіх мовних версіях і взаємний (SEO-v8 § 2.2).
	//
	// Перелік був `['uk', 'en', 'x-default']` і застиг на двох мовах: `de` й `nl`
	// увімкнули 2026-08-16, і з того дня зникнення німецького hreflang не впало б
	// нікуди. Сторінки при цьому перевіряються всі — вони в EXPECTED_PAGES.
	for (const hreflang of [...OG_LOCALES.keys(), 'x-default']) {
		if (!new RegExp(`rel="alternate"[^>]+hreflang="${hreflang}"`).test(html))
			fail(`${relative}: немає hreflang="${hreflang}"`);
	}

	/*
	 * `og:locale` — мова САМОЇ сторінки, решта мов — `og:locale:alternate`
	 * (SEO-v8 § 4).
	 *
	 * Перевіряється тут, а не інваріантом по джерелах, бо дефект був саме цього
	 * класу: у layout стояла умова на дві мови, і в джерелах вона виглядала
	 * нормальною. Побачити, що німецька сторінка оголошує себе `en_US`, можна
	 * лише в `build/de/index.html`.
	 */
	const expectedOg = OG_LOCALES.get(expectedLang);
	if (!expectedOg) {
		fail(`${relative}: мову "${expectedLang}" не описано в OG_LOCALES — перевірка мертва`);
	} else {
		if (!html.includes(`property="og:locale" content="${expectedOg}"`))
			fail(`${relative}: og:locale не дорівнює "${expectedOg}" — сторінка оголошує чужу мову`);

		for (const [lang, locale] of OG_LOCALES) {
			if (lang === expectedLang) continue;
			if (!html.includes(`property="og:locale:alternate" content="${locale}"`))
				fail(`${relative}: немає og:locale:alternate="${locale}"`);
		}
	}
}

// --- приховані сторінки існують у всіх мовах --------------------------------
for (const relative of HIDDEN_PAGES) {
	if (!allFiles.includes(`${BUILD}/${relative}`))
		fail(`${relative}: службової сторінки немає — зник entries() або сам маршрут`);
}

/*
 * --- назви маршрутів лише з ASCII (BETA-CHECKLIST-v8 § 4.2) ------------------
 *
 * Кириличний гомогліф у назві маршруту (`с` U+0441 замість `c`, `е` U+0435
 * замість `e`) дає адресу, яка ВИГЛЯДАЄ правильною й не працює: у шляху вона
 * percent-кодується, посилання, sitemap і `robots.txt` розходяться, а в diff
 * різниці не видно.
 *
 * Інваріант на `static/` у `src/structure.test.ts` цього не ловив — він дивиться
 * на активи, а не на маршрути. Тобто правило виконувалося (усі назви ASCII), і
 * не стерегло його ніщо: рівно той стан, від якого весь цей документ і написаний.
 *
 * Міряється по ЗІБРАНИХ шляхах, а не по `LANGUAGE_ROUTES`: у файл потрапляє те,
 * що справді стане адресою, разом із назвами тек маршрутів, яких у тому переліку
 * немає.
 */
const nonAscii = htmlFiles
	.map((file) => file.replace(`${BUILD}/`, ''))
	// eslint-disable-next-line no-control-regex
	.filter((relative) => /[^\x00-\x7F]/.test(relative));
if (nonAscii.length) {
	fail(
		`не-ASCII у назві маршруту — адреса латиною дасть 404, а оком різниця не видна: ${nonAscii.join(', ')}`
	);
}

// --- sitemap збігається зі згенерованими сторінками (SEO-v8 § 5) ------------
const sitemapPath = `${BUILD}/sitemap.xml`;
if (!allFiles.includes(sitemapPath)) {
	fail('sitemap.xml не згенеровано');
} else {
	const sitemap = readFileSync(sitemapPath, 'utf8');
	const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
	const expected = EXPECTED_PAGES.map(
		([relative]) => `${SITE_ORIGIN}${SITE_BASE}/${relative.replace(/index\.html$/, '')}`
	).sort();

	const missing = expected.filter((url) => !listed.includes(url));
	const extra = listed.filter((url) => !expected.includes(url));
	if (missing.length) fail(`sitemap не містить: ${missing.join(', ')}`);
	if (extra.length) fail(`у sitemap зайві адреси: ${extra.join(', ')}`);
	// Кожен рядок без кінцевого слеша при `trailingSlash: 'always'` — редирект.
	const noSlash = listed.filter((url) => !url.endsWith('/'));
	if (noSlash.length)
		fail(`sitemap: адреси без кінцевого слеша — це редирект: ${noSlash.join(', ')}`);
}

// --- Source maps не публікуються (OBSERVABILITY-v8 § 1.2) --------------------
const maps = allFiles.filter((f) => f.endsWith('.map'));
if (maps.length)
	fail(
		`у ${BUILD}/ лежить ${maps.length} .map — вихідний код поїде на GitHub Pages ` +
			`(перший: ${maps[0]})`
	);

// --- Бюджети JS: entry і маршрути окремо (PERFORMANCE-v8 § 10.1) -------------

/**
 * Вага маршруту — це не його власний файл, а ВСЕ, що він тягне.
 *
 * Збирач виносить спільний код у `chunks/`, і файл маршруту лишається
 * крихітним: найбільший тут важить 12 КБ. Порахувати самі `nodes/*.js`
 * означало б не побачити 3D-рушій узагалі — він осідає в чанку, на який
 * посилається лише заповідник, і бюджет мовчки нічого не міряв би.
 *
 * Тому обхід іде за імпортами — і два їхні різновиди рахуються ПО-РІЗНОМУ.
 *
 * **Статичні** (`from '…'`) — завжди: без них модуль не запуститься.
 *
 * **Динамічні** (`import('…')`) — лише коли важимо МАРШРУТ. Для entry їх
 * рахувати не можна: клієнтський маршрутизатор саме так тягне кожну сторінку
 * сайту, і його замикання накрило б увесь застосунок. Зміряно прямо: з
 * динамічними ребрами entry показував 462 КБ замість 123, а всі інші числа
 * падали в нуль, бо все вже пораховано в entry.
 *
 * Усередині маршруту динамічний імпорт означає інше: сцена заповідника
 * вантажиться одразу після входу, тож для відвідувача це той самий трафік.
 * Рідкісний `import()` в аварійній гілці при цьому теж потрапить у число —
 * і хай: недооцінити тут гірше, ніж переоцінити. Завищене число видно в тому
 * ж рядку звіту, занижене не видно ніколи.
 *
 * Зворотні лапки в класах символів — не про всяк випадок. Збирач пише
 * динамічний імпорт саме шаблонним рядком: <code>import(`../chunks/X.js`)</code>.
 * Без них перевірка не бачила 3D-рушія зовсім: 732 КБ проходили повз бюджет, а
 * звіт друкував «найважчий маршрут 12 КБ». Помилка не могла виявитися доти,
 * доки в проєкті не з'явилося щось справді велике, — тобто рівно тоді, коли
 * бюджет уперше знадобився.
 */
const STATIC_IMPORT_RE = /from\s*["'`]([^"'`]+)["'`]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/**
 * Усі файли, досяжні за імпортами із заданих. Шляхи — від кореня збірки.
 *
 * `followDynamic` вмикає ребра `import()`. Див. докблок вище — це не
 * налаштування «на смак», а різниця між «що завантажить кожен відвідувач» і
 * «що додатково завантажить той, хто зайшов саме сюди».
 */
function closure(startFiles, followDynamic = false) {
	const seen = new Set();
	const queue = [...startFiles];

	while (queue.length) {
		const file = queue.pop();
		if (seen.has(file) || !allFiles.includes(file)) continue;
		seen.add(file);

		const dir = file.slice(0, file.lastIndexOf('/'));
		const text = readFileSync(file, 'utf8');
		const matches = followDynamic
			? [...text.matchAll(STATIC_IMPORT_RE), ...text.matchAll(DYNAMIC_IMPORT_RE)]
			: [...text.matchAll(STATIC_IMPORT_RE)];

		for (const [, spec] of matches) {
			if (!spec.startsWith('.')) continue; // зовнішнє — у збірці його немає
			// Своя нормалізація, а не `path.resolve`: шляхи тут завжди зі скісною
			// рискою вперед, а `resolve` на Windows підмішав би зворотні.
			const parts = `${dir}/${spec}`.split('/');
			const out = [];
			for (const part of parts) {
				if (part === '.' || part === '') continue;
				if (part === '..') out.pop();
				else out.push(part);
			}
			queue.push(out.join('/'));
		}
	}
	return seen;
}

const weigh = (files) =>
	Math.round([...files].reduce((sum, f) => sum + gzipSync(readFileSync(f)).length, 0) / 1024);

const immutable = `${BUILD}/_app/immutable`;
const entryFiles = allFiles.filter((f) => f.startsWith(`${immutable}/entry/`) && f.endsWith('.js'));
const nodeFiles = allFiles.filter((f) => f.startsWith(`${immutable}/nodes/`) && f.endsWith('.js'));

if (!entryFiles.length || !nodeFiles.length) {
	fail(`${immutable}: не знайдено entry або nodes — шлях змінився, і бюджети більше не міряються`);
} else {
	const entryClosure = closure(entryFiles);
	const entryKb = weigh(entryClosure);
	console.log(`check-build: entry JS ${entryKb} КБ gzip (бюджет ${ENTRY_JS_BUDGET_KB})`);
	if (entryKb > ENTRY_JS_BUDGET_KB) {
		fail(`бюджет entry перевищено: ${entryKb} КБ > ${ENTRY_JS_BUDGET_KB}`);
	}

	/*
	 * Кореневий layout — це `nodes/0.*`: SvelteKit нумерує вузли з layout'ів, і
	 * нульовий завжди кореневий. Якщо це колись зміниться, перевірка не почне
	 * мовчки міряти не те — вона не знайде файла й скаже про це.
	 */
	const layoutFile = nodeFiles.find((f) => /\/nodes\/0\./.test(f));
	if (!layoutFile) {
		fail(`${immutable}/nodes: немає вузла 0 — кореневий layout більше не міряється`);
	}

	const shared = new Set([...entryClosure, ...closure([layoutFile])]);
	const layoutKb = weigh([...shared].filter((f) => !entryClosure.has(f)));
	console.log(
		`check-build: кореневий layout ${layoutKb} КБ gzip понад entry ` +
			`(бюджет ${LAYOUT_JS_BUDGET_KB}); разом на кожного відвідувача ${entryKb + layoutKb} КБ`
	);
	if (layoutKb > LAYOUT_JS_BUDGET_KB) {
		fail(`бюджет кореневого layout перевищено: ${layoutKb} КБ > ${LAYOUT_JS_BUDGET_KB}`);
	}

	// Найважчий маршрут — понад те, що вже дали entry й layout.
	let worst = { file: '(жодного)', kb: 0 };
	for (const node of nodeFiles) {
		if (node === layoutFile) continue;
		// `true` — саме тут: маршрут відповідає за все, що САМ довантажує.
		const kb = weigh([...closure([node], true)].filter((f) => !shared.has(f)));
		if (kb > worst.kb) worst = { file: node.slice(immutable.length + 1), kb };
	}

	console.log(
		`check-build: найважчий маршрут ${worst.file} — ${worst.kb} КБ gzip понад спільне ` +
			`(бюджет ${ROUTE_JS_BUDGET_KB})`
	);
	if (worst.kb > ROUTE_JS_BUDGET_KB) {
		fail(`бюджет маршруту перевищено: ${worst.file} важить ${worst.kb} КБ > ${ROUTE_JS_BUDGET_KB}`);
	}
}

// --- Секретів у бандлі немає (SECURITY-v8 § 16) -----------------------------
const SECRET_NAMES = /API_SECRET|PRIVATE_KEY|SERVICE_ACCOUNT|SENTRY_AUTH_TOKEN/;
const leaked = allFiles
	.filter((f) => /\.(js|html|json|css)$/.test(f))
	.filter((f) => SECRET_NAMES.test(readFileSync(f, 'utf8')));
if (leaked.length) fail(`схоже на секрет у бандлі: ${leaked.join(', ')}`);

// ----------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SEO-v8 § 7.5 — артефакти AI-пошуку (llms.txt і групи robots.txt).
//
// Розбір живе в `check-geo`, бо він робить власний парсер `robots.txt`:
// краулер, що збігся з іменованою групою, ігнорує `User-agent: *` цілком, тож
// пропущений там `Disallow` не «наслідується», а ВІДКРИВАЄ шлях саме цьому
// боту. У кількох майже однакових блоках очима така дірка не видно.
for (const msg of checkGeo(BUILD)) fail(msg);

if (problems.length) {
	console.error(`check-build: перевірка не пройдена (${problems.length}):`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}
console.log(`check-build: ${htmlFiles.length} сторінок, усе гаразд`);
