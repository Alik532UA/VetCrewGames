// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/**
 * Досяжність модуля доводиться ГРАФОМ, а не пошуком імені
 * (PROJECT-STRUCTURE-v9 § 4.3.1, `PS-REACHABILITY`, HIGH).
 *
 * Тут уже була перевірка на сиріт — у `structure.test.ts`, «немає осиротілих
 * компонентів». Вона шукала базове ім'я файлу в тексті інших джерел, і саме цей
 * спосіб канон називає непридатним. Три речі, яких вона не бачила:
 *
 *  1. **Ланцюжок сиріт.** `A.svelte` імпортує `B.svelte`, обох не імпортує
 *     ніхто — і `B` виглядає використаним, бо його ім'я справді згадане.
 *  2. **`.ts`-модулі взагалі.** Перелік звужувався до `/lib/**\/*.svelte`, тобто
 *     сервіси, контролери й утиліти з нього випадали цілком.
 *  3. **Згадку в коментарі.** Назва файлу в докблоці поруч робила сироту
 *     «використаною» без жодного імпорту.
 *
 * Чому це дорого, а не косметика: файл, що існує, читається як зроблена
 * робота, і наступний читач (зокрема наступний агент) будує на ньому висновки.
 * У `Slovko` це заміряно — після ручного прибирання семи сиріт аудит за два дні
 * знайшов ще чотири, серед них опис схеми бази, від якої база вже переїхала.
 * Осиротілий файл не просто лежав: він розповідав неправду.
 *
 * ЗВОРОТНИЙ ЕКСПЕРИМЕНТ (AI-AGENT-PITFALLS-v9 § 1.1) — результат у повідомленні
 * коміта. На чистому дереві перевірка теж не була зеленою від народження:
 * першим прогоном вона знайшла `src/lib/index.ts` — рядок-заготовку від
 * `sv create`, якої не імпортує ніщо. Його прибрано тим самим комітом.
 *
 * ЧОГО ЦЯ ПЕРЕВІРКА НЕ ДИВИТЬСЯ, і це названо, а не пропущено мовчки:
 *
 *   - `.css`. Теми підключаються шаблонним рядком, а їхній перелік уже стоїть
 *     під `css-variables.test.ts` і `theme-specificity.test.ts` — обидві ходять
 *     по `styles/themes/` списком.
 *   - `import.meta.glob`. У проєкті його немає жодного (`sync-flags.mjs`
 *     згадує його в коментарі як відкинутий варіант). Щойно з'явиться —
 *     `resolveImport` треба розширювати разом із цим рядком.
 *   - `./$types`. Віртуальний модуль SvelteKit, на диску його немає ніколи.
 */

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');

/**
 * Точки входу — те, що виконує сам фреймворк або раннер, а не інший модуль.
 *
 * `params/` тут не випадково: матчер маршруту не імпортує ніхто, його кличе
 * SvelteKit за іменем файлу. Без цього рядка `params/lang.ts` — сирота, і гейт
 * вимагав би видалити рівно те, на чому тримається мова в адресі.
 */
const ENTRY_FILES = new Set([
	'src/app.d.ts',
	'src/hooks.client.ts',
	'src/hooks.server.ts',
	'src/hooks.ts',
	'src/service-worker.ts',
	'src/service-worker.js'
]);

/** Корені поза `src/`: їх виконує vite, vitest або playwright, а не імпорт. */
const EXTERNAL_ROOTS = ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'];

/**
 * Файли перевірок — теж корені (канон перелічує їх серед точок входу).
 *
 * Інакше в сиротах опиниться `net/localRoom.ts`: підставний транспорт спільної
 * партії існує рівно для тестів, і це рішення, записане в AGENTS.md.
 */
const isCheck = (f: string) => /\.(test|spec|setup)\.(ts|js)$/.test(f);

/**
 * Аліаси, яких резолвер файлів не знає.
 *
 * `$app/paths` і `$app/environment` під тестами підмінені на `lib/mocks/`
 * (`resolve.alias` у `vitest.config.ts`), і єдиний шлях до цих двох файлів іде
 * через аліас. Без цих двох рядків вони — сироти, а видалити їх означало б
 * зламати кожен тест, що торкається `base` або `browser`.
 */
const ALIASES: Record<string, string> = {
	'$app/paths': 'src/lib/mocks/app-paths.ts',
	'$app/environment': 'src/lib/mocks/app-environment.ts'
};

const posix = (p: string) => p.split('\\').join('/');
const rel = (p: string) => posix(relative(ROOT, p));

/**
 * `keep` — які файли брати. Типово це модулі; для `static/` перевірка нижче
 * передає `/./`, тобто «усе», разом із двійковими.
 */
function walk(dir: string, out: string[] = [], keep = /\.(ts|js|svelte)$/): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out, keep);
		else if (keep.test(entry)) out.push(posix(full));
	}
	return out;
}

const CANDIDATE_SUFFIXES = [
	'',
	'.ts',
	'.js',
	'.svelte',
	'.svelte.ts',
	'/index.ts',
	'/index.js',
	'/index.svelte.ts'
];

/**
 * Специфікатор → файл на диску, або `null` для зовнішнього пакета.
 *
 * `posix()` на виході обов'язковий: `walk()` і цей резолвер мусять давати
 * ОДНАКОВИЙ рядок на той самий файл, інакше на Windows `…/net\play.ts` і
 * `…/net/play.ts` — два різні ключі, і модуль виглядає недосяжним.
 */
function resolveImport(fromFile: string, spec: string): string | null {
	if (ALIASES[spec]) return posix(join(ROOT, ALIASES[spec]));

	let base: string | null = null;
	if (spec === '$lib') base = join(SRC, 'lib');
	else if (spec.startsWith('$lib/')) base = join(SRC, 'lib', spec.slice(5));
	else if (spec.startsWith('./') || spec.startsWith('../')) base = resolve(dirname(fromFile), spec);
	if (!base) return null;

	for (const suffix of CANDIDATE_SUFFIXES) {
		const candidate = posix(base + suffix);
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return null;
}

const IMPORT_RE = /(?:from\s*|import\s*\(\s*|export\s+\*\s+from\s*)["'`]([^"'`]+)["'`]/g;

/**
 * Шаблонний динамічний імпорт: `import(`./${locale}.ts`)`.
 *
 * Так вантажаться ліниві словники (`i18n/reserve/index.ts` і три сусіди), і
 * рахувати таке ребро обов'язково. Без нього `i18n/reserve/uk.ts` лишається
 * досяжним лише через свій тест — тобто гейт казав би «файл використано» на
 * підставі перевірки, а не застосунку, і при видаленні тесту вимагав би
 * видалити живий словник.
 *
 * Ребро ставиться до КОЖНОГО сусіда з тим самим розширенням: що саме підставить
 * `${locale}`, статично не відомо, і завищити тут безпечніше, ніж занизити.
 */
const TEMPLATE_IMPORT_RE = /import\s*\(\s*`(\.[^`$]*\/)\$\{[^}]+\}(\.[a-z]+)`\s*\)/g;

/** Коментарі прибираються ДО пошуку імпортів — інакше згадка в докблоці стає ребром. */
const stripComments = (text: string) =>
	text
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1')
		.replace(/<!--[\s\S]*?-->/g, '');

function importsOf(file: string): { edges: string[]; unresolved: string[] } {
	const text = stripComments(readFileSync(file, 'utf8'));
	const edges: string[] = [];
	const unresolved: string[] = [];

	for (const match of text.matchAll(IMPORT_RE)) {
		const spec = match[1];
		// `./$types` — віртуальний модуль SvelteKit; `${` — шаблон, його розбирає
		// TEMPLATE_IMPORT_RE нижче.
		if (spec.endsWith('$types') || spec.includes('${')) continue;
		const resolved = resolveImport(file, spec);
		if (resolved) edges.push(resolved);
		else if (spec.startsWith('.') || spec.startsWith('$lib'))
			unresolved.push(`${rel(file)} → ${spec}`);
	}

	for (const match of text.matchAll(TEMPLATE_IMPORT_RE)) {
		const dir = resolve(dirname(file), match[1]);
		const ext = match[2];
		if (!existsSync(dir)) {
			unresolved.push(`${rel(file)} → ${match[1]}\${…}${ext}`);
			continue;
		}
		for (const entry of readdirSync(dir)) {
			if (entry.endsWith(ext)) edges.push(posix(join(dir, entry)));
		}
	}

	return { edges, unresolved };
}

const allFiles = walk(SRC);
const modules = allFiles.filter((f) => !isCheck(f));
const roots = [
	...allFiles.filter(
		(f) =>
			rel(f).startsWith('src/routes/') ||
			rel(f).startsWith('src/params/') ||
			ENTRY_FILES.has(rel(f)) ||
			isCheck(f)
	),
	...EXTERNAL_ROOTS.map((f) => posix(join(ROOT, f))).filter((f) => existsSync(f)),
	...walk(join(ROOT, 'tests'))
];

const reached = new Set<string>();
const unresolved: string[] = [];
const stack = [...roots];
while (stack.length) {
	const file = stack.pop() as string;
	if (reached.has(file)) continue;
	reached.add(file);
	const { edges, unresolved: bad } = importsOf(file);
	unresolved.push(...bad);
	for (const dep of edges) stack.push(dep);
}

describe('досяжність модулів (PROJECT-STRUCTURE-v9 § 4.3.1)', () => {
	it('перевірка жива: корені й модулі знайдено', () => {
		// Порожній перелік коренів дав би «жодного сироти» на будь-якому коді —
		// зелений результат, який нічого не доводить.
		expect(roots.length, 'коренів не знайдено — граф починається з нічого').toBeGreaterThan(20);
		expect(modules.length, 'модулів не знайдено — шлях змінився').toBeGreaterThan(100);
		expect(reached.size, 'граф не розкрився: досяжних менше за половину').toBeGreaterThan(
			modules.length / 2
		);
	});

	it('кожен модуль досяжний із маршруту, точки входу або перевірки', () => {
		const orphans = modules
			.filter((f) => !reached.has(f))
			.map(rel)
			.sort();
		expect(
			orphans,
			`недосяжні модулі — підключити або видалити, третього немає:\n${orphans.join('\n')}`
		).toEqual([]);
	});

	it('жодне ребро графа не лишилося нерозібраним', () => {
		// Специфікатор, якого резолвер не зрозумів, — це діра в графі: усе, що
		// висить за ним, виглядає сиротою. Тихо пропускати такі не можна
		// (PROJECT-STRUCTURE-v9 § 4.3.1: «шаблони, які інваріант не вміє
		// розібрати, названі явно, а не пропущені мовчки»).
		const list = [...new Set(unresolved)].sort();
		expect(list, `імпорти, яких резолвер не розібрав:\n${list.join('\n')}`).toEqual([]);
	});
});

/**
 * Те саме правило для `static/` (PROJECT-STRUCTURE-v9 § 2.1, `PS-STATIC-ORPHANS`,
 * MEDIUM).
 *
 * `adapter-static` копіює теку на хостинг ЦІЛКОМ і мовчки. Файл, якого не
 * просить ніхто, не ламає нічого й не з'являється в жодному звіті: збірка про
 * нього не скаже, `check:build` дивиться на HTML, бюджет JS рахує скрипти. Його
 * просто роздають назавжди. Граф модулів вище цього не бачить у принципі — у
 * `static/` немає імпортів, там є адреси.
 *
 * ЧОМУ ЦЕ НЕ ДРІБНИЦЯ ПРИ 395 ФАЙЛАХ. Заміряно в `as5.odesa.ua` 2026-08-28:
 * 57 файлів із 86 не згадані ніде — разом 1504 КБ, тобто більша частина ваги
 * сайту нікому не потрібна.
 *
 * НА ЦЬОМУ ДЕРЕВІ БОРГ НУЛЬ, і це заміряно, а не припущено. Єдина сирота, яку
 * знайшов перший прогін, — `svg/VetCrewGames_logo_v1.svg`, вектор логотипа, на
 * який не посилався ніхто; вона перестала бути сиротою в коміті про `og:image`,
 * бо саме з неї тепер збирається картка для соцмереж. Тобто перевірка
 * ратчетна: вона стереже не наявний борг, а наступний.
 */
const STATIC_DIR = 'static';

/**
 * Де можуть згадуватися адреси ресурсів. Двійкові файли не читаються.
 *
 * `.css` тут ОБОВ'ЯЗКОВИЙ, і це не «на всяк випадок»: типова маска `walk()`
 * бере лише модулі, і з нею перевірка дала шість хибних знахідок — три шрифти
 * (`@font-face`) і три тла тем (`background-image: url(…)`). Обидві родини
 * згадані лише в `global.css`, тобто саме там, куди вона не дивилася.
 */
const REFERENCE_KEEP = /\.(ts|js|mjs|svelte|css|html|json|txt)$/;
const REFERENCE_SOURCES = [
	...walk(join(ROOT, 'src'), [], REFERENCE_KEEP),
	...walk(join(ROOT, 'scripts'), [], REFERENCE_KEEP),
	...walk(join(ROOT, 'tests'), [], REFERENCE_KEEP),
	posix(join(ROOT, 'svelte.config.js')),
	posix(join(ROOT, STATIC_DIR, 'llms.txt')),
	posix(join(ROOT, STATIC_DIR, 'robots.txt'))
].filter((f) => existsSync(f));

/**
 * Що дозволено в КОРЕНІ `static/`: лише службові файли, які інструмент або
 * стандарт вимагає саме там. `llms.txt`, як і `robots.txt`, визначений
 * стандартом рівно за адресою `/llms.txt` — підпапка зробила б його
 * недосяжним. Медіафайлу в корені місце в `images/`, `svg/` або `fonts/`.
 */
const ROOT_ALLOWED = [
	/^favicon\.[a-z0-9]+$/i,
	/^robots\.txt$/,
	/^llms\.txt$/,
	/^app-version\.json$/
];

/** Борг сиріт: число, яке може лише СПАДАТИ. Заміряно цією ж перевіркою. */
const STATIC_ORPHAN_DEBT = 0;

describe('сироти в static/ (PROJECT-STRUCTURE-v9 § 2.1)', () => {
	const assets = walk(join(ROOT, STATIC_DIR), [], /./).map((f) =>
		rel(f).replace(`${STATIC_DIR}/`, '')
	);
	const haystack = REFERENCE_SOURCES.map((f) => readFileSync(f, 'utf8')).join('\n');

	/**
	 * Посилання буває трьох видів, і другий — причина, чому наївний пошук тут
	 * дає 297 хибних знахідок із 395 файлів.
	 *
	 *  1. Повний шлях від кореня сайту: `/images/og-cover.png`.
	 *  2. Адреса, СКЛАДЕНА в рантаймі: ``asset(`/flags/${known}.svg`)``. Повного
	 *     шляху в джерелах немає взагалі — є тека, одразу за якою стоїть
	 *     інтерполяція. Тека з інтерполяцією — це посилання на ВЕСЬ її вміст, і
	 *     саме так тут живуть 262 прапорці, 15 наїдків, 9 зон і 7 континентів.
	 *  3. Просто ім'я файлу: так на нього посилаються скрипти й `llms.txt`.
	 *
	 * Форм інтерполяції дві, бо джерела дві: `${` у шаблонному рядку JavaScript
	 * і `{` у розмітці Svelte. Перевіряти лише одну означало б проґавити половину.
	 */
	const referenced = (asset: string) => {
		const name = asset.slice(asset.lastIndexOf('/') + 1);
		const dir = asset.includes('/') ? asset.slice(0, asset.lastIndexOf('/') + 1) : '';
		return (
			haystack.includes(`/${asset}`) ||
			haystack.includes(name) ||
			(dir !== '' && (haystack.includes(`${dir}\${`) || haystack.includes(`${dir}{`)))
		);
	};

	it('перевірка жива: ресурси й джерела посилань прочитано', () => {
		expect(assets.length, 'тека static/ порожня — перевіряти нема що').toBeGreaterThan(50);
		expect(REFERENCE_SOURCES.length, 'джерел посилань не знайдено').toBeGreaterThan(50);
		// Канарки на САМ спосіб пошуку: без них «жодної сироти» означало б лише
		// зламаний пошук. По одній на кожну з трьох форм посилання.
		expect(referenced('images/og-cover.png'), 'повний шлях не розпізнається').toBe(true);
		expect(referenced('flags/ua.svg'), 'інтерпольована адреса не розпізнається').toBe(true);
		expect(referenced('robots.txt'), 'ім\u02bcя файлу не розпізнається').toBe(true);
		/*
		 * НЕГАТИВНА КАНАРКА, і в ній дві пастки, обидві спіймані прогоном.
		 *
		 * Перша: ім'я СКЛАДАЄТЬСЯ, а не пишеться літералом. Цей файл лежить у
		 * `src/`, тобто сам входить у перелік джерел посилань, і літерал
		 * `'fonts/такого-немає.woff2'` знайшовся б у власному тексті перевірки —
		 * канарка доводила б протилежне тому, для чого існує.
		 *
		 * Друга: тека взята `fonts/`, а не `images/`. У `images/` канарка не
		 * працює в принципі, і це МЕЖА МЕТОДУ, названа тут, а не схована:
		 * `config/habitat-game.ts` складає адресу як
		 * ``asset(`/images/${mode === 'continents' ? … }/${option}.webp`)``, тобто
		 * інтерполює САМУ ПІДТЕКУ — і правило «тека з інтерполяцією = посилання на
		 * весь вміст» накриває `images/` цілком. Сирота, покладена туди, лишиться
		 * невидимою; для `flags/`, `fonts/`, `svg/` і кореня перевірка працює.
		 */
		const absent = ['fon' + 'ts', 'no' + '-such-face.woff2'].join('/');
		expect(referenced(absent), 'пошук вважає своїм будь-що').toBe(false);
	});

	it('у корені static/ лежить лише службове', () => {
		const stray = readdirSync(join(ROOT, STATIC_DIR))
			.filter((entry) => statSync(join(ROOT, STATIC_DIR, entry)).isFile())
			.filter((entry) => !ROOT_ALLOWED.some((re) => re.test(entry)));
		expect(
			stray,
			`медіафайл у корені static/ — місце йому в підпапці:\n${stray.join('\n')}`
		).toEqual([]);
	});

	it('борг сиріт лише скорочується', () => {
		const orphans = assets.filter((a) => !referenced(a));
		// Обидва боки: число, що лишилося БІЛЬШИМ за реальність, так само
		// неправдиве, як і перевищене — просто мовчазне (AI-AGENT-PITFALLS-v9 § 5.5).
		expect(
			orphans.length,
			`на ці файли не посилається ніхто, а adapter-static копіює static/ у build/ ` +
				`цілком — тобто вони їдуть на хостинг:\n${orphans.join('\n')}`
		).toBe(STATIC_ORPHAN_DEBT);
	});
});
