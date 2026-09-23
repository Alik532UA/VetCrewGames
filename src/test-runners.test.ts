// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Кожен файл перевірки належить раннеру, який у проєкті справді є
 * (AI-AGENT-PITFALLS-v8 § 1.3).
 *
 * Клас дефекту: файл виглядає як перевірка, рахується в переліку «що в нас
 * тестується» — і не запускається ніде. Три способи, якими це стається:
 *
 *   1. Раннера немає в залежностях узагалі (файл під Playwright у проєкті,
 *      де Playwright не встановлений).
 *   2. Раннер є, конфігу немає.
 *   3. Раннер і конфіг є, але файл лежить поза `testDir` — Playwright його
 *      просто не бачить, і жодного слова про це не буде.
 *
 * Мовчазне зникнення перевірки гірше за порожню заглушку: заглушка хоч
 * виконується. Окремо ловиться `@ts-nocheck` — він вимикає останній гейт,
 * який міг би помітити мертвий імпорт.
 *
 * Зворотний експеримент (§ 1.1): тимчасово прибрати `vitest` із
 * `devDependencies` — перевірка має перелічити всі файли перевірок проєкту.
 */

/** Корінь проєкту: vitest завжди стартує звідти, на відміну від `__dirname` в ESM. */
const ROOT = process.cwd().replace(/\\/g, '/');

/** Каталоги, у яких взагалі можуть лежати файли перевірок. */
const SEARCH_DIRS = ['src', 'tests', 'e2e'];

/**
 * `.setup.` — теж файл перевірки, і саме він найлегше стає сиротою.
 *
 * Типовий `testMatch` Playwright бере лише `*.spec` і `*.test`, тобто `*.setup.ts`
 * він НЕ виконує, поки той не названий окремим проєктом у конфігу. Доти сканер
 * сюди не дивився зовсім, і `tests/identity.setup.ts` — перевірка, що стереже
 * всі інші браузерні гейти, — сама лишалася поза інваріантом, який існує рівно
 * для цього класу.
 */
const SPEC_FILE = /\.(spec|test|setup)\.(ts|js)$/;

/** Що Playwright бере без окремого `testMatch`. */
const PLAYWRIGHT_DEFAULT_MATCH = /\.(spec|test)\.(ts|js)$/;

const RUNNERS = [
	{ imports: '@playwright/test', dep: '@playwright/test', config: /^playwright\.config\./ },
	{ imports: 'vitest', dep: 'vitest', config: /^vitest\.config\.|^vite\.config\./ }
];

/**
 * Чи називає файл хоч один `testMatch` у конфігу Playwright.
 *
 * Звіряється БАЗОВЕ ІМʼЯ проти тексту конфігу, а не виконується справжній
 * `testMatch`: імпортувати конфіг сюди означало б затягти в vitest увесь
 * Playwright разом із його плагінами. Груба перевірка тут доречна — вона ловить
 * саме той випадок, коли файл перейменували, а рядок у конфігу лишився старим.
 *
 * Крапки в імені пропускаються через `\\.?` — у конфігу вони стоять у регулярці
 * екранованими (`/identity\\.setup\\.ts$/`), тобто буквального збігу з іменем
 * файлу там немає ніколи.
 */
function namedByTestMatch(file: string): boolean {
	const config = readdirSync(ROOT).find((f) => /^playwright\.config\./.test(f));
	if (!config) return false;
	const source = readFileSync(join(ROOT, config), 'utf8');
	const base = (file.split('/').pop() ?? file).replace(/\./g, '\\\\?\\.');
	const declarations = source.match(/testMatch\s*:\s*[^,\n]+/g) ?? [];
	return declarations.some((entry) => new RegExp(base).test(entry));
}

/**
 * Чи названо файл у `setupFiles` конфігу Vitest.
 *
 * Той самий клас, що й `testMatch` у Playwright: `*.setup.ts` під Vitest не
 * виконується, поки його не перелічено в `setupFiles`, і мовчить про це. Для
 * `src/no-network.setup.ts` це означало б тихе повернення до тестів, що
 * реєструють акаунти в живому Firebase.
 */
function namedBySetupFiles(file: string): boolean {
	const config = readdirSync(ROOT).find((f) => /^vitest\.config\./.test(f));
	if (!config) return false;
	const source = withoutComments(readFileSync(join(ROOT, config), 'utf8'));
	const list = source.match(/setupFiles\s*:\s*\[([^\]]*)\]/)?.[1] ?? '';
	return [...list.matchAll(/['"`]\.?\/?([^'"`]+)['"`]/g)].some((m) => m[1] === file);
}

function playwrightTestDir(): string | null {
	const config = readdirSync(ROOT).find((f) => /^playwright\.config\./.test(f));
	if (!config) return null;
	const source = readFileSync(join(ROOT, config), 'utf8');
	const match = source.match(/testDir\s*:\s*['"`]\.?\/?([^'"`]+)['"`]/);
	return match ? match[1].replace(/\/$/, '') : null;
}

/**
 * Коментарі відрізаються перед пошуком імпорту, інакше перевірка оголосить
 * сиротою сама себе: у докблоці вище процитовано назви раннерів.
 */
function withoutComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
	if (!existsSync(dir)) return out;
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (SPEC_FILE.test(entry)) out.push(full.replace(/\\/g, '/'));
	}
	return out;
}

const specFiles = SEARCH_DIRS.flatMap((dir) => walk(join(ROOT, dir))).map((f) =>
	f.slice(ROOT.length + 1)
);

const importsRunner = (source: string, runner: { imports: string }) =>
	new RegExp(`from\\s*['"]${runner.imports.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}['"]`).test(
		source
	);

/**
 * Раннер файлу — за його імпортами, ЗА ПОСИЛАННЯМИ на локальні модулі.
 *
 * Пряме порівняння рядка тут більше не годиться, і це не послаблення, а
 * виправлення. Специфікації Playwright беруть `test` не з `@playwright/test`,
 * а з власного модуля фікстур (ANALYTICS-v9 § 5.2, `AN-E2E-BLOCK`): глушилка
 * аналітики мусить діяти на КОЖНУ сторінку, а не лише там, де її згадали.
 * Після того переходу пряме порівняння оголосило б сиротами всі специфікації
 * одразу — тобто гейт червонів би на цілком правильному коді, а справжню
 * сироту в тій купі вже ніхто б не побачив.
 *
 * Гарантія лишається та сама: файл мусить ДОСЯГАТИ раннера. Обхід іде лише по
 * відносних шляхах і пам'ятає відвідане, тож цикл імпортів його не зациклює.
 */
function runnerOf(file: string, seen = new Set<string>()): (typeof RUNNERS)[number] | undefined {
	const abs = join(ROOT, file);
	if (seen.has(abs) || !existsSync(abs) || statSync(abs).isDirectory()) return undefined;
	seen.add(abs);

	const source = withoutComments(readFileSync(abs, 'utf8'));
	const direct = RUNNERS.find((r) => importsRunner(source, r));
	if (direct) return direct;

	for (const [, spec] of source.matchAll(/from\s*['"](\.[^'"]*)['"]/g)) {
		const base = join(file, '..', spec).replace(/\\/g, '/');
		// `./fixtures`, `./fixtures.ts` і `../lib/config/site.js` (TS-імпорт із розширенням JS).
		for (const candidate of [base, `${base}.ts`, `${base}.js`, base.replace(/\.js$/, '.ts')]) {
			const found = runnerOf(candidate, seen);
			if (found) return found;
		}
	}
	return undefined;
}

describe('файли перевірок', () => {
	it('перевірка жива: файли перевірок узагалі знайдено', () => {
		expect(specFiles.length, 'жодного файлу перевірки — сканер шукає не там').toBeGreaterThan(2);
	});

	it('кожен файл перевірки належить раннеру, який у проєкті є', () => {
		const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
		const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };
		const rootEntries = readdirSync(ROOT);

		const orphans: string[] = [];
		for (const file of specFiles) {
			const runner = runnerOf(file);

			if (!runner) {
				orphans.push(`${file}: не досягає жодного раннера — ні прямо, ні через локальні імпорти`);
				continue;
			}
			if (!deps[runner.dep]) {
				orphans.push(`${file}: імпортує ${runner.dep}, якого немає в package.json`);
				continue;
			}
			if (!rootEntries.some((entry) => runner.config.test(entry))) {
				orphans.push(`${file}: імпортує ${runner.dep}, але конфігу для нього в корені немає`);
				continue;
			}
			if (runner.dep === '@playwright/test') {
				const dir = playwrightTestDir();
				if (dir && !file.startsWith(`${dir}/`)) {
					orphans.push(
						`${file}: під Playwright, але поза testDir «${dir}» — раннер його не бачить`
					);
				}
				/*
				 * ЧЕТВЕРТИЙ спосіб зникнути, якого не було в переліку вгорі: файл лежить
				 * усередині `testDir`, раннер і конфіг на місці — а типовий `testMatch`
				 * його не бере. Так поводиться будь-який `*.setup.ts`: доки його не
				 * назве окремий проєкт, він не виконується жодного разу й мовчить про це.
				 */
				if (!PLAYWRIGHT_DEFAULT_MATCH.test(file) && !namedByTestMatch(file)) {
					orphans.push(
						`${file}: під Playwright і в testDir, але типовий testMatch бере лише ` +
							'*.spec / *.test, і жоден проєкт у конфігу цього файлу не називає'
					);
				}
			}
			if (runner.dep === 'vitest' && /\.setup\.(ts|js)$/.test(file) && !namedBySetupFiles(file)) {
				orphans.push(
					`${file}: під Vitest, але в setupFiles конфігу не названий — не виконується жодного разу`
				);
			}
		}

		expect(orphans, `перевірки, яких не запускає ніхто:\n${orphans.join('\n')}`).toEqual([]);
	});

	it('жоден файл перевірки не вимикає типи через @ts-nocheck', () => {
		const silenced = specFiles.filter((file) =>
			/^\s*\/\/\s*@ts-nocheck/m.test(readFileSync(join(ROOT, file), 'utf8'))
		);
		expect(
			silenced,
			`@ts-nocheck вимикає останній гейт, який міг би помітити мертвий імпорт:\n${silenced.join('\n')}`
		).toEqual([]);
	});
});
