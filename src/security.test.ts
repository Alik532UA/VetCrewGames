// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Інваріанти безпеки по джерелах (SECURITY-v8 § 16).
 *
 * Головний тут — другий. `{@html}` у цьому проєкті неминучий: `formatFont()`
 * повертає розмітку зі `<span>`, бо шрифт inglobal не має українських «ї», «є»
 * і «ґ», і замінити їх треба саме в розмітці. Питання не в тому, чи є
 * `{@html}`, а в тому, ЩО в нього потрапляє.
 *
 * Доти це трималося списком файлів у `eslint.config.js`. Список гірший за
 * перевірку двома способами: він росте на кожен новий компонент (і саме тому
 * його забувають поповнити), і він дозволяє в дозволеному файлі БУДЬ-ЯКИЙ
 * `{@html}` — зокрема з даними, які колись прийдуть ззовні. Ця перевірка
 * дивиться не на файл, а на вираз.
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

const sources = walk('src').filter((f) => /\.(ts|svelte)$/.test(f));
const read = (f: string) => readFileSync(f, 'utf8');

/**
 * Функції, чий результат дозволено віддавати в `{@html}`.
 *
 * Обидві беруть рядок зі СТАТИЧНОГО словника (`t()` / `td()`) і повертають
 * той самий текст із доданими `<span>` для окремих літер. Зовнішнього вводу в
 * проєкті немає взагалі: жодного текстового поля, жодного `fetch`, жодного
 * читання `searchParams` у вміст сторінки.
 *
 * Розширювати цей список можна лише разом із доказом, що нове джерело так
 * само не може містити введення відвідувача (SECURITY-v8 § 5.3).
 */
const SAFE_HTML_SOURCES = ['formatFont(', 'formatPlain(', 'formatPopulation('];

describe('безпека', () => {
	it('перевірка жива: джерела знайдено', () => {
		expect(sources.length).toBeGreaterThan(20);
	});

	it('немає eval і подібного (§ 13)', () => {
		const bad = sources.filter((f) =>
			/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(read(f))
		);
		expect(bad, `конструкції, яких CSP не дозволяє: ${bad.join(', ')}`).toEqual([]);
	});

	it('у {@html} потрапляє лише результат форматерів словника (§ 5.3)', () => {
		const bad: string[] = [];
		for (const file of sources.filter((f) => f.endsWith('.svelte'))) {
			const markup = read(file).replace(/<!--[\s\S]*?-->/g, '');
			for (const match of markup.matchAll(/\{@html\s+([\s\S]*?)\}\s*(?:<|\{|$)/g)) {
				const expression = match[1].trim();
				if (!SAFE_HTML_SOURCES.some((safe) => expression.startsWith(safe))) {
					bad.push(`${file}: {@html ${expression.slice(0, 60)}}`);
				}
			}
		}
		expect(
			bad,
			`{@html} з джерела, яке не є форматером словника:\n${bad.join('\n')}`
		).toEqual([]);
	});

	it('усі форматери зі списку справді існують', () => {
		// Прострочений дозвіл гірший за його відсутність: він мовчки перестає
		// щось означати після перейменування функції.
		const i18n = read('src/lib/i18n/index.ts');
		const missing = SAFE_HTML_SOURCES.map((entry) => entry.replace('(', '')).filter(
			(name) => !new RegExp(`export const ${name}\\b`).test(i18n)
		);
		expect(missing, `функції немає в $lib/i18n: ${missing.join(', ')}`).toEqual([]);
	});
});
