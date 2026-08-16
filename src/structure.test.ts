// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Інваріанти структури за PROJECT-STRUCTURE-v8 § 8.
 *
 * Найдорожче тут — § 4.3, осиротілі файли: файл, що існує, читається як
 * зроблена робота. Наступний читач (зокрема наступний агент) вважає функцію
 * реалізованою і будує на ній висновки. Цей проєкт уже мав два такі місця —
 * `src/lib/errors/` і половину експортів `i18n/index.ts`, — і жоден гейт їх не
 * бачив.
 */

const IGNORED_DIRS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (IGNORED_DIRS.has(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const all = walk('src');
const sources = all.filter((f) => /\.(ts|svelte)$/.test(f));
const isTest = (f: string) => /\.(test|spec)\.ts$/.test(f);
const read = (f: string) => readFileSync(f, 'utf8');

/**
 * Межа § 7 умикається після того, як чинні перевищення розібрані; доти вони
 * тримаються тут явним списком, який може тільки СКОРОЧУВАТИСЯ. Список у коді
 * тесту, а не в конфігу, — щоб він потрапляв у кожен diff.
 *
 * Числа виміряні цим-таки тестом у цій сесії, а не взяті з пам'яті
 * (AI-AGENT-PITFALLS-v8 § 5.5). Міряються `split('\n').length`, тобто на
 * одиницю більше за `wc -l` — важливо, щоб порівнювали ту саму величину.
 *
 * Міряти треба ПІСЛЯ правки, заради якої борг гасили, а не одразу після
 * гасіння. Зрізане під нуль число не лишає місця навіть на рядок імпорту, і
 * наступний крок доводиться або підганяти під лічильник, або зрізати ще раз —
 * борг від цього не меншає, а робота дробиться. Тут це вже сталося: стеля,
 * поставлена рівно на виміряну висоту, за хвилину завалила той самий імпорт,
 * заради якого висоту й знижували.
 */
const OVERSIZED_ALLOWLIST: Record<string, number> = {
	// Три екрани, у яких логіка живе просто в маршруті. Розбирати їх треба
	// винесенням стану в контролери `.svelte.ts` — це окрема робота, не правка.
	// 1086 → 1016 після винесення `createCrossfade` у `utils/transitions.ts`,
	// → 987 після винесення `parkDraggedCard`, → 986 після зняття обгортки без
	// жодного правила, +2 на підключення `fitToViewport` (число міряється ПІСЛЯ
	// правки, заради якої борг гасили, — див. докблок вище).
	'src/routes/[[lang=lang]]/game-population/+page.svelte': 998,
	// 520 → 438 після винесення логіки партії в `controllers/mythGame.svelte.ts`,
	// 438 → 409 після винесення `flyAndSlide`, +1 на імпорт `revealScroll`.
	'src/routes/[[lang=lang]]/game-mythbusters/+page.svelte': 418
};

/**
 * Словники й ігрові конфіги — це ДАНІ, а не код: 85 тварин, сотні міфів.
 * Ділити їх за розміром означає ділити за алфавітом, і жодної відповідальності
 * це не розділяє. § 7 називає такий випадок прямо («великий статичний шаблон
 * без логіки»), тому вони виведені за межу як категорія, а не поіменно —
 * інакше список довелося б правити на кожну нову тварину.
 */
const DATA_FILE = /^src\/lib\/(i18n\/translations|config)\//;

describe('структура проєкту', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length).toBeGreaterThan(20);
	});

	it('руни лише у .svelte та .svelte.ts (§ анти-патерни, CRITICAL)', () => {
		// Компілятор не обробляє руни поза цими розширеннями: код виглядає
		// правильним і мовчки не реагує ні на що.
		const bad = all
			.filter((f) => f.endsWith('.ts') && !f.endsWith('.svelte.ts') && !isTest(f))
			.filter((f) => /\$state[({<]|\$derived[({<]|\$effect[({.]/.test(read(f)));
		expect(bad, `руни у звичайному .ts: ${bad.join(', ')}`).toEqual([]);
	});

	it('немає осиротілих компонентів (§ 4.3)', () => {
		const components = all.filter((f) => f.includes('/lib/') && f.endsWith('.svelte'));
		expect(components.length, 'компонентів не знайдено — перевірка мертва').toBeGreaterThan(0);

		const orphans = components.filter((file) => {
			const name = basename(file);
			return !sources.filter((s) => s !== file).some((s) => read(s).includes(name));
		});
		expect(
			orphans,
			`ніде не імпортовані — підключити або видалити:\n${orphans.join('\n')}`
		).toEqual([]);
	});

	it('псевдонім імпорту збігається з іменем файлу (§ 5.2)', () => {
		// Розбіжність виникає після перейменувань і тихо руйнує зв'язок
		// «testid ↔ компонент ↔ файл», на якому тримається пошук за назвою.
		const re = /import\s+([A-Z][A-Za-z0-9]*)\s+from\s+["'][^"']*\/([A-Z][A-Za-z0-9]*)\.svelte["']/g;
		const bad: string[] = [];
		for (const file of sources) {
			for (const m of read(file).matchAll(re)) {
				if (m[1] !== m[2]) bad.push(`${file}: ${m[1]} → ${m[2]}.svelte`);
			}
		}
		expect(bad, `розбіжність псевдоніма й файлу:\n${bad.join('\n')}`).toEqual([]);
	});

	/**
	 * Клас, оголошений у `style` компонента, справді вживається в його розмітці
	 * (SVELTE-UI-v8 § 3.4).
	 *
	 * Здавалося б, це вже робить компілятор — `Unused CSS selector`. Але він
	 * мовчить принаймні у двох випадках, і обидва трапилися тут:
	 *
	 *  1. **Клас у групі.** `.btn-play-again, .btn-menu { … }` — перший
	 *     використовується, і правило лишається «вжитим» цілком, хоч другого
	 *     елемента в компоненті немає.
	 *  2. **Клас, зіпсований підстановкою.** `class="slots-row"` перетворився на
	 *     `class="game.slots-row"` під час рефакторингу — ряд утратив
	 *     горизонтальну розкладку, а `svelte-check` дав 0 попереджень.
	 *     Перевірено прямо: повернути дефект — і він мовчить.
	 *
	 * Другий випадок — це рівно той клас із § 3.5, про який компілятор не
	 * попереджає в принципі: «розмітка є, правила немає» законне саме по собі.
	 * Побачив це користувач на екрані, а не гейт.
	 */
	it('кожен клас зі style компонента вживається в його розмітці (§ 3.4)', () => {
		const components = sources.filter((f) => f.endsWith('.svelte'));
		expect(components.length, 'компонентів не знайдено — перевірка мертва').toBeGreaterThan(0);

		const problems: string[] = [];
		for (const file of components) {
			const source = read(file);
			const style = source.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
			if (!style) continue;

			const markup = source
				.slice(source.indexOf('</script>'))
				.replace(/<style[\s\S]*<\/style>/, '');

			// `:global(...)` цілиться в чужу розмітку за визначенням — не наша справа.
			// Коментарі теж геть: назва файлу `structure.test.ts` у поясненні
			// інакше читається як два селектори, `.test` і `.ts`.
			const declared = new Set(
				[
					...style
						.replace(/\/\*[\s\S]*?\*\//g, '')
						.replace(/:global\([^)]*\)/g, '')
						.matchAll(/\.([a-zA-Z][\w-]*)/g)
				].map((m) => m[1])
			);

			const used = new Set<string>();
			for (const m of markup.matchAll(/class="([^"]*)"/g)) {
				// Інтерполяція всередині атрибута прибирається: `anim-stagger-{i}`
				// дає токен `anim-stagger-`, і зіставляти його марно.
				m[1].split(/\s+/).forEach((token) => token && used.add(token.replace(/\{[^}]*\}/g, '')));
			}
			for (const m of markup.matchAll(/class:([\w-]+)/g)) used.add(m[1]);
			for (const m of markup.matchAll(/classList\.(?:add|remove|toggle)\('([\w-]+)'/g))
				used.add(m[1]);

			/*
			 * Модифікатор, зібраний інтерполяцією, лишає в розмітці лише корінь:
			 * `class="toast toast--{message.type}"` дає токен `toast--`. Чотири
			 * оголошені `.toast--success|warn|error|info` при цьому цілком живі —
			 * просто їхні хвости обчислюються в рантаймі.
			 *
			 * Тому клас вважається вжитим і тоді, коли в розмітці є його ПОЧАТОК
			 * із обрізаною інтерполяцією. Це дзеркало правила про базу BEM у
			 * перевірці навпроти: там модифікатор виправдовує базу, тут корінь
			 * виправдовує модифікатор.
			 */
			const stems = [...used].filter((token) => token.endsWith('-'));
			for (const cls of declared) {
				if (used.has(cls)) continue;
				if (stems.some((stem) => cls.startsWith(stem))) continue;
				problems.push(`${file}: .${cls}`);
			}
		}

		expect(
			problems,
			`клас оголошений, але в розмітці його немає — або мертве правило, або зіпсована назва:\n${problems.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Дзеркальна перевірка: клас у розмітці має правила ХОЧ ДЕСЬ.
	 *
	 * Попередній тест іде від CSS до розмітки й ловить мертві правила. Цей іде
	 * назустріч і ловить протилежне — розмітку, яка розраховує на стиль, якого
	 * немає. Пропуску не видно взагалі нічим: компілятор не знає, що рядок у
	 * `class=` мав щось означати, а `svelte-check` тим паче.
	 *
	 * Реальний випадок: `.header-btn` була оголошена у `<style>` компонента
	 * `GameHeader`, а вживав її ще й `LanguageMenu` — окремий компонент у тій
	 * самій шапці. Svelte ЗАКРИВАЄ такий блок у межах компонента, тож перемикач
	 * мови стояв голою кнопкою браузера: 31×22 замість 36×36, рельєфна біла
	 * рамка, нуль заокруглення — і заразом стиснуті сусіди. Усі гейти були
	 * зелені; побачив користувач.
	 *
	 * Правила можуть лежати у трьох законних місцях, і всі три тут враховані:
	 * власний `<style>` компонента, глобальні файли стилів, `:global(...)`
	 * будь-якого компонента (так батько навмисно стилізує дитину).
	 */
	it('кожен клас із розмітки має правила — свої, глобальні або :global (§ 3.5)', () => {
		const styleFiles = all.filter((f) => f.endsWith('.css'));
		expect(styleFiles.length, 'файлів стилів не знайдено — перевірка мертва').toBeGreaterThan(0);

		const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
		const classesIn = (css: string) =>
			[...stripComments(css).matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);

		// Словник, спільний для всіх: глобальні файли плюс усе, на що компоненти
		// ціляться через `:global()`.
		const globalVocabulary = new Set(styleFiles.flatMap((f) => classesIn(read(f))));
		const components = sources.filter((f) => f.endsWith('.svelte'));
		for (const file of components) {
			const style = read(file).match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
			for (const m of stripComments(style).matchAll(/:global\(([^)]*)\)/g))
				classesIn(m[1]).forEach((cls) => globalVocabulary.add(cls));
		}

		const problems: string[] = [];
		for (const file of components) {
			const source = read(file);
			const style = source.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
			const own = new Set(classesIn(style));
			const markup = source
				.slice(source.indexOf('</script>'))
				.replace(/<style[\s\S]*<\/style>/, '');

			for (const m of markup.matchAll(/class="([^"]*)"/g)) {
				// Інтерполяція прибирається ДО розбиття на токени, а не після:
				// `anim-stagger-{i + 1}` містить пробіли, і розбиття першим кроком
				// розсипає його на `anim-stagger-{i`, `+` та `1}` — три вигадані
				// класи, яких у розмітці немає.
				for (const cls of m[1].replace(/\{[^}]*\}/g, '').split(/\s+/)) {
					if (!cls || cls.endsWith('-') || own.has(cls) || globalVocabulary.has(cls)) continue;
					// База BEM, у якої оголошено модифікатор, — не безпритульний клас:
					// `.scoreboard__player--turn` існує саме як «те саме, але інакше»,
					// а базу тримає розкладка предка.
					const hasModifier = [...own, ...globalVocabulary].some((known) =>
						known.startsWith(`${cls}--`)
					);
					if (hasModifier) continue;
					problems.push(`${file}: class="${cls}"`);
				}
			}
		}

		expect(
			problems,
			`клас у розмітці є, а правил для нього немає ніде — елемент малюється типовими стилями браузера:\n${problems.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Шлях не склеюється з `base` вручну (SEO-v8 § 1.5).
	 *
	 * Це не стилістика: під час prerender `base` **відносний**, тож
	 * `${base}/en/` на сторінці `/game-population/` дає
	 * `/VetCrewGames/game-population/en/`. Саме на цьому тут упала перша спроба
	 * мовних маршрутів — і впала на збірці, а не в редакторі.
	 *
	 * Правило `svelte/no-navigation-without-resolve` цього не покриває: у шести
	 * файлах воно вимкнене, бо не бачить `resolve()` крізь `langPath()`. Ця
	 * перевірка дивиться на ВСІ джерела, зокрема на ті шість.
	 */
	it('шлях не склеюється з `base` вручну (§ SEO 1.5)', () => {
		const bad: string[] = [];
		for (const file of sources) {
			if (isTest(file) || file.includes('/mocks/')) continue;
			const text = read(file)
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');
			// `${base}` у шаблонному рядку та `{base}` у атрибуті розмітки.
			for (const m of text.matchAll(/\$\{base\}|href="\{base\}/g)) {
				bad.push(`${file}: ${m[0]}`);
			}
		}
		expect(
			bad,
			`шлях зібраний руками — брати з resolve()/asset()/langPath():\n${bad.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Дитина, що заповнює скругленого батька РІВНО, не сміє рухатися назовні.
	 *
	 * `.game-card` збігається межами з внутрішнім краєм рамки `.game-container`.
	 * Через це підйом на наведенні, `scale` на виборі й тверда тінь «об'ємної
	 * кнопки» виносять кут картки (радіус 14px) за скруглення слота (16px) —
	 * і назовні визирає смужка з ЧУЖИМ радіусом. Помилку двічі повертали
	 * різні правки, обидва рази її знаходили тільки виміром у браузері:
	 * `svelte-check`, eslint і око на скріншоті її не бачать.
	 *
	 * Обрізанням (`overflow: clip`) це НЕ лікується: картка літає між слотами
	 * через `crossfade`, і кліп різав би її в польоті. Тому все, що виходить
	 * за межі, робить БАТЬКО — див. `.container--filled` у грі.
	 *
	 * Виняток — `.touch-drag-clone`: клон летить у <body>, батька зі
	 * скругленням під ним немає, і власна тінь йому потрібна.
	 */
	it('картка не рухається за межі свого слота (game-population)', () => {
		const file = 'src/routes/[[lang=lang]]/game-population/+page.svelte';
		const style = read(file)
			.match(/<style>([\s\S]*)<\/style>/)?.[1]
			// Коментар перед правилом інакше приклеюється до селектора у звіті.
			.replace(/\/\*[\s\S]*?\*\//g, '');
		expect(style, `${file}: не знайдено блок стилів — перевірка осліпла`).toBeTruthy();

		const problems: string[] = [];
		// Сама картка і її стани — але не `.game-card__*`: діти всередині
		// картки позиціонуються окремо (значок відповіді свідомо звисає
		// круглим боком під нижній край, `bottom: -12px`).
		const isCardItself = /\.game-card(?![\w-])|\.card--[\w-]+/;
		for (const [, selector, body] of (style as string).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
			if (!isCardItself.test(selector)) continue;
			if (selector.includes('touch-drag-clone')) continue;

			if (/(^|[\s;])transform\s*:/.test(body))
				problems.push(`${selector.trim()}: transform виносить кут за скруглення слота`);

			const shadow = body.match(/(^|[\s;])box-shadow\s*:([^;]*)/)?.[2] ?? '';
			for (const layer of shadow.split(/,(?![^()]*\))/)) {
				if (!layer.trim() || layer.includes('inset')) continue;
				problems.push(`${selector.trim()}: зовнішня тінь "${layer.trim()}" вилазить із слота`);
			}
		}

		expect(
			problems,
			`ці ефекти належать слоту .game-container, а не картці:\n${problems.join('\n')}`
		).toEqual([]);
	});

	/**
	 * У `static/` немає жодного не-ASCII символу в іменах.
	 *
	 * Каталог зображень континентів приїхав названим із КИРИЛИЧНОЇ «с» (U+0441).
	 * На вигляд це той самий рядок, що й латиною, а в коді шлях пишуть латиною —
	 * і він дає 404 на GitHub Pages. Ані `svelte-check`, ані eslint, ані збірка
	 * цього не бачать: `asset()` шляхів не перевіряє, а локальний dev-сервер
	 * віддає файл за тим самим байтовим ім'ям, під яким той лежить.
	 *
	 * Заразом ловить пробіли й кирилицю в іменах файлів — вони теж переживають
	 * локальну машину й ламаються на хостингу або в URL.
	 */
	it('в іменах у static/ немає не-ASCII (§ SEO 1.5)', () => {
		const bad = walk('static')
			.flatMap((file) => [file, ...file.split('/').slice(0, -1)])
			.filter((name, index, all) => all.indexOf(name) === index)
			// eslint-disable-next-line no-control-regex
			.filter((name) => /[^\x00-\x7F]/.test(name));

		expect(
			bad,
			`шлях латиною до такого файлу дасть 404, а оком різниця не видна:\n${bad.join('\n')}`
		).toEqual([]);
	});

	/**
	 * Ядро заповідника не знає ні про браузер, ні про справжній час.
	 *
	 * Симуляція мусить бути ЧИСТОЮ функцією від зерна й послідовності ходів:
	 * той самий вхід — той самий світ. Один `Date.now()` десь усередині — і два
	 * браузери в спільній партії розійдуться вже на першій хвилині. Найгірше,
	 * що розійдуться вони тихо: обидва працюють, обидва показують правдоподібну
	 * картину, і побачити розлад можна аж тоді, коли гравці почнуть сперечатися,
	 * що в них на екрані.
	 *
	 * Це не ловиться ні `svelte-check`, ні eslint, ні тестом самої симуляції:
	 * тест із фіксованим зерном пройде і на `Math.random()`, якщо той стоїть у
	 * гілці, куди тест не заглянув. Тому перевірка йде по ДЖЕРЕЛАХ.
	 *
	 * Коментарі відрізаються навмисно: докблоки в цій самій теці пояснюють,
	 * чому тут немає `Date.now()`, і без вирізання перевірка ловила б сама себе.
	 */
	it('ядро симуляції не залежить від браузера й годинника', () => {
		const core = sources.filter((f) => f.startsWith('src/lib/reserve/'));
		expect(core.length, 'теки src/lib/reserve/ немає — перевірка осліпла').toBeGreaterThan(0);

		// Кожен — те, що робить два запуски з однакового зерна різними.
		const FORBIDDEN = [
			/\bMath\.random\b/,
			/\bDate\.now\b/,
			/\bnew Date\b/,
			/\bperformance\.now\b/,
			/\bcrypto\.randomUUID\b/,
			/\b(?:window|document|localStorage|navigator)\b/
		];
		// Симуляція не має знати ні про UI, ні про фреймворк.
		const FORBIDDEN_IMPORT =
			/from\s*['"](svelte(?:\/|['"])|\$app\/|\$lib\/(?:components|services|controllers)\/)/;

		const problems: string[] = [];
		for (const file of core) {
			const text = read(file)
				.replace(/\/\*[\s\S]*?\*\//g, '')
				.replace(/^\s*\/\/.*$/gm, '');

			for (const pattern of FORBIDDEN) {
				const found = text.match(pattern);
				if (found) problems.push(`${file}: ${found[0]}`);
			}
			// Раннер у тестах — законний виняток: він не потрапляє у збірку.
			const imports = isTest(file) ? '' : text;
			const badImport = imports.match(FORBIDDEN_IMPORT);
			if (badImport) problems.push(`${file}: імпорт ${badImport[1]}`);
		}

		expect(
			problems,
			`через це та сама партія розгорнеться в різні світи:\n${problems.join('\n')}`
		).toEqual([]);
	});

	// Правило «E2E не змішані з вихідним кодом» тут навмисно НЕ дублюється:
	// `src/test-runners.test.ts` уже перевіряє сильнішу властивість — що кожен
	// файл перевірки належить раннеру, який у проєкті справді є. Друга,
	// слабша перевірка того самого лише дала б хибне спрацювання на самому
	// тому файлі: він цитує «@playwright/test» у своїй таблиці раннерів.

	describe('розмір файлу (§ 7)', () => {
		const LIMITS: Array<[RegExp, number]> = [
			[/\/routes\/.*\+page\.svelte$/, 400],
			[/\.svelte$/, 300],
			[/\.svelte\.ts$/, 300],
			[/\.ts$/, 250]
		];

		const lines = (f: string) => read(f).split('\n').length;
		const measured = sources
			.filter((f) => !isTest(f) && !DATA_FILE.test(f))
			.map((f) => ({
				file: f,
				lines: lines(f),
				limit: LIMITS.find(([re]) => re.test(f))?.[1] ?? Infinity
			}));

		it('нових перевищень немає', () => {
			const unexpected = measured
				.filter(({ file, lines, limit }) => lines > limit && !(file in OVERSIZED_ALLOWLIST))
				.map(({ file, lines, limit }) => `${file}: ${lines} рядків (межа ${limit})`);
			expect(unexpected, `завеликі файли:\n${unexpected.join('\n')}`).toEqual([]);
		});

		it('список перевищень тільки скорочується', () => {
			const grown = measured
				.filter(
					({ file, lines }) => file in OVERSIZED_ALLOWLIST && lines > OVERSIZED_ALLOWLIST[file]
				)
				.map(({ file, lines }) => `${file}: ${lines} > ${OVERSIZED_ALLOWLIST[file]}`);
			expect(grown, `борг зростає, а мав лише спадати:\n${grown.join('\n')}`).toEqual([]);
		});

		it('у списку немає файлів, які вже вклалися в межу', () => {
			// Прострочений виняток — така сама проблема, як його відсутність: він
			// приховає наступне перевищення того самого файлу.
			const stale = measured
				.filter(({ file, lines, limit }) => file in OVERSIZED_ALLOWLIST && lines <= limit)
				.map(({ file }) => file);
			const missing = Object.keys(OVERSIZED_ALLOWLIST).filter(
				(file) => !measured.some((m) => m.file === file)
			);
			expect(
				[...stale, ...missing],
				'виняток більше не потрібен — прибрати з OVERSIZED_ALLOWLIST'
			).toEqual([]);
		});
	});
});
