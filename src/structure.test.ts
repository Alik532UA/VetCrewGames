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
 */
const OVERSIZED_ALLOWLIST: Record<string, number> = {
	// Три екрани, у яких логіка живе просто в маршруті. Розбирати їх треба
	// винесенням стану в контролери `.svelte.ts` — це окрема робота, не правка.
	'src/routes/game-population/+page.svelte': 1358,
	// 520 → 437 після винесення логіки партії в `controllers/mythGame.svelte.ts`.
	// Далі число має лише спадати.
	'src/routes/game-mythbusters/+page.svelte': 437,
	'src/lib/components/GameHeader.svelte': 396
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
				.filter(({ file, lines }) => file in OVERSIZED_ALLOWLIST && lines > OVERSIZED_ALLOWLIST[file])
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
