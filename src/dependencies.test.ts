// @vitest-environment node
// Перевірка лише читає файли — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Інваріанти залежностей за DEPENDENCIES-v8 § 6.
 *
 * Гейт `GATE-DEPS` є в `canon.json` із позначкою `blocking`, а в проєкті його не
 * було: `npm audit` ловить те, що вразливе, `npm ci` — те, що розійшлося з
 * lockfile, і жоден із двох не бачить, ЯК залежності розкладені по розділах.
 *
 * Найдорожче тут — § 2.2 і остання перевірка нижче. `@sentry/sveltekit`
 * імпортується з `hooks.client.ts`, тобто виконується у браузері відвідувача, а
 * лежав у `devDependencies`. Наслідок був не косметичний: `npm audit --omit=dev`
 * друкував `found 0 vulnerabilities` — і цей нуль означав не «прод чистий», а
 * «прод описаний неправильно». Після переїзду той самий рядок каже «2 low», і
 * обидві знахідки їхали у браузер весь цей час.
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

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};
const runtime = Object.keys(pkg.dependencies ?? {});
const tooling = Object.keys(pkg.devDependencies ?? {});

const sources = walk('src').filter((f) => /\.(ts|svelte)$/.test(f));
const isTest = (f: string) => /\.(test|spec)\.ts$/.test(f);

/**
 * Пакети, які імпортує РАНТАЙМ-код і які при цьому законно лежать у
 * `devDependencies`.
 *
 * Обидва — сам фреймворк, а не бібліотека застосунку: їх розвʼязує збирач, і
 * шаблон `create-svelte` кладе їх саме туди. Список явний і в коді тесту, щоб
 * наступне поповнення було видно в diff: «просто дописати сюди» — це рівно той
 * спосіб, яким гейт перестає щось означати.
 */
const FRAMEWORK_IN_DEV = new Set(['svelte', '@sveltejs/kit']);

/**
 * Ім'я пакета зі специфікатора імпорту: `firebase/database` → `firebase`,
 * `@threlte/core` → `@threlte/core`.
 */
function packageOf(specifier: string): string {
	const parts = specifier.split('/');
	return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * Форма справжнього імені пакета npm — включно з областю (`@scope/name`).
 *
 * Без цієї перевірки регулярка нижче ловить не лише імпорти. Слово `from` у
 * лапках зустрічається і в англійському словнику, і в чужих регулярках
 * (`structure.test.ts` шукає ним псевдоніми компонентів) — перша чернетка цього
 * інваріанта оголосила «неоголошеними пакетами» рядки `[^` і `,\n\t`. Помилка
 * такого сорту не робить гейт слабким, вона робить його ЧЕРВОНИМ без порушення,
 * а такий гейт вимикають.
 */
const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * Голі імпорти файлу — статичні й динамічні.
 *
 * Межа слова перед `from`/`import` обовʼязкова: без неї в улов потрапляють
 * власні регулярки інших інваріантів (`/import\s*\(/` у тексті тесту).
 */
function bareImports(text: string): string[] {
	const found: string[] = [];
	for (const m of text.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)) {
		const spec = m[1] ?? m[2];
		// Відносні шляхи, аліаси SvelteKit (`$lib`, `$app`, `$env`) і вбудовані
		// модулі Node пакетами не є.
		if (/^[./$]/.test(spec) || spec.startsWith('node:')) continue;
		const name = packageOf(spec);
		if (PACKAGE_NAME.test(name)) found.push(name);
	}
	return found;
}

describe('залежності (DEPENDENCIES-v8 § 6)', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length).toBeGreaterThan(20);
	});

	it('один менеджер пакетів (§ 2.1)', () => {
		// Два lockfile означають дві різні збірки, і яка з них поїде на хостинг —
		// залежить від того, чим запустили.
		const locks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].filter(
			existsSync
		);
		expect(locks, `знайдено кілька lockfile: ${locks.join(', ')}`).toHaveLength(1);
	});

	it('немає плаваючих версій (§ 2.3)', () => {
		// `latest` і `*` роблять збірку невідтворюваною: той самий коміт збереться
		// по-різному сьогодні й через тиждень.
		const floating = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
			.filter(([, range]) => range === '*' || range === 'latest' || range === '')
			.map(([name]) => name);
		expect(floating, `невідтворювані версії: ${floating.join(', ')}`).toEqual([]);
	});

	it('інструменти збірки не в dependencies (§ 2.2)', () => {
		const buildOnly = runtime.filter((dep) =>
			/^(vite|vitest|typescript|svelte-check|prettier|eslint|husky|jsdom|globals|@types\/|@eslint\/|@sveltejs\/(kit|adapter|vite-plugin)|@testing-library\/|@playwright)/.test(
				dep
			)
		);
		expect(buildOnly, `мають бути у devDependencies: ${buildOnly.join(', ')}`).toEqual([]);
	});

	it('кожен імпортований пакет оголошений у package.json', () => {
		// Транзитивна залежність, що працює «бо її притягнув сусід», зникає при
		// першому ж оновленні цього сусіда — і зникає мовчки.
		const declared = new Set([...runtime, ...tooling]);
		const undeclared = new Set<string>();
		for (const file of sources) {
			for (const name of bareImports(readFileSync(file, 'utf8'))) {
				if (!declared.has(name)) undeclared.add(`${name} (${file})`);
			}
		}
		expect([...undeclared], `імпортується, але не оголошено:\n${[...undeclared].join('\n')}`).toEqual(
			[]
		);
	});

	/**
	 * Головна перевірка файлу — та, заради якої він і з'явився.
	 *
	 * `devDependency`, яку імпортує рантайм-код, дає прод-аудиту неправдиву
	 * картину: `npm audit --omit=dev` обходить саме розділ `dependencies`, тож
	 * бібліотека, підписана не тим розділом, у звіт про поверхню атаки не
	 * потрапляє взагалі. Симптому при цьому немає жодного — збірка ставить усе
	 * однаково, сайт працює, гейти зелені.
	 */
	it('рантайм-код не імпортує devDependencies (§ 2.2)', () => {
		const inDev = new Set(tooling);
		const misplaced = new Map<string, string[]>();
		for (const file of sources) {
			if (isTest(file)) continue; // тестам devDependencies належать за визначенням
			for (const name of bareImports(readFileSync(file, 'utf8'))) {
				if (!inDev.has(name) || FRAMEWORK_IN_DEV.has(name)) continue;
				misplaced.set(name, [...(misplaced.get(name) ?? []), file]);
			}
		}
		const problems = [...misplaced].map(
			([name, files]) => `${name}: ${files.length} імпортів, напр. ${files[0]}`
		);
		expect(
			problems,
			`їде у браузер, а оголошене як інструмент — прод-аудит його не бачить:\n${problems.join('\n')}`
		).toEqual([]);
	});

	it('у списку фреймворкових винятків немає зайвого', () => {
		// Прострочений виняток приховає наступне порушення так само надійно, як
		// його відсутність — той самий висновок, що для OVERSIZED_ALLOWLIST.
		const stale = [...FRAMEWORK_IN_DEV].filter((name) => !tooling.includes(name));
		expect(stale, `більше не в devDependencies — прибрати з FRAMEWORK_IN_DEV: ${stale}`).toEqual(
			[]
		);
	});
});
