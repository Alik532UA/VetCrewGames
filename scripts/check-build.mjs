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
const EXPECTED_PAGES = [
	['index.html', 'uk'],
	['quiz/index.html', 'uk'],
	['quiz/play/index.html', 'uk'],
	['pairs/index.html', 'uk'],
	['reserve/index.html', 'uk'],
	['game-mythbusters/index.html', 'uk'],
	['game-population/index.html', 'uk'],
	['game-family/index.html', 'uk'],
	['game-habitat/index.html', 'uk'],
	['game-habitat/continents/index.html', 'uk'],
	['game-habitat/biomes/index.html', 'uk'],
	['game-feeding/index.html', 'uk'],
	['game-memory/index.html', 'uk'],
	['en/index.html', 'en'],
	['en/quiz/index.html', 'en'],
	['en/quiz/play/index.html', 'en'],
	['en/pairs/index.html', 'en'],
	['en/reserve/index.html', 'en'],
	['en/game-mythbusters/index.html', 'en'],
	['en/game-population/index.html', 'en'],
	['en/game-family/index.html', 'en'],
	['en/game-habitat/index.html', 'en'],
	['en/game-habitat/continents/index.html', 'en'],
	['en/game-habitat/biomes/index.html', 'en'],
	['en/game-feeding/index.html', 'en'],
	['en/game-memory/index.html', 'en'],
	['de/index.html', 'de'],
	['de/quiz/index.html', 'de'],
	['de/quiz/play/index.html', 'de'],
	['de/pairs/index.html', 'de'],
	['de/reserve/index.html', 'de'],
	['de/game-mythbusters/index.html', 'de'],
	['de/game-population/index.html', 'de'],
	['de/game-family/index.html', 'de'],
	['de/game-habitat/index.html', 'de'],
	['de/game-habitat/continents/index.html', 'de'],
	['de/game-habitat/biomes/index.html', 'de'],
	['de/game-feeding/index.html', 'de'],
	['de/game-memory/index.html', 'de'],
	['nl/index.html', 'nl'],
	['nl/quiz/index.html', 'nl'],
	['nl/quiz/play/index.html', 'nl'],
	['nl/pairs/index.html', 'nl'],
	['nl/reserve/index.html', 'nl'],
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
const LAYOUT_JS_BUDGET_KB = 120;
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
		const canonicals = html.match(/<link[^>]+rel="canonical"[^>]*>/g) ?? [];
		if (canonicals.length !== 1) fail(`${where}: canonical знайдено ${canonicals.length} разів`);
		else if (!canonicals[0].includes(`href="${SITE_ORIGIN}`))
			fail(`${where}: canonical не абсолютна або веде на чужий origin — ${canonicals[0]}`);

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
	for (const hreflang of ['uk', 'en', 'x-default']) {
		if (!new RegExp(`rel="alternate"[^>]+hreflang="${hreflang}"`).test(html))
			fail(`${relative}: немає hreflang="${hreflang}"`);
	}
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
if (problems.length) {
	console.error(`check-build: перевірка не пройдена (${problems.length}):`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}
console.log(`check-build: ${htmlFiles.length} сторінок, усе гаразд`);
