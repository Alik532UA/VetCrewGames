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

/**
 * Джерела, яких у виразі під `{@html}` не буває — навіть усередині форматера.
 *
 * **Навіщо друга умова, якщо є список форматерів.** Бо перша умова дивилася
 * лише на те, чим вираз ПОЧИНАЄТЬСЯ, і `formatFont(page.error?.message)` їй
 * відповідав повністю: починається з `formatFont(`, отже «результат форматера
 * словника». Насправді форматер бере рядок і повертає той самий рядок із
 * доданими `span` для окремих літер — тобто чужий текст проходить крізь нього
 * наскрізь. Саме так `+error.svelte` віддавав у `{@html}` `page.error.message`,
 * значення, яке складає або фреймворк, або виклик `error(status, message)`.
 *
 * Перелік іменує КЛАС джерела: усе, що приходить не зі словника, — адреса,
 * помилка, браузер, сховище, поле вводу. Він навмисно не намагається довести,
 * що аргумент — саме ключ словника: таких форм тут десятки (`t()`, `td()`,
 * шаблон із них, проп із ключем), і список дозволених виразів був би довшим за
 * список заборонених джерел, а росло б у ньому все, крім дефектів.
 *
 * Умова слабша за «лише словник» — і це записано свідомо. Те, що вона ловить
 * напевно, доводить таблиця нижче: половина її випадків мусить проходити,
 * половина — падати.
 */
const OUTSIDE_DATA = [
	'page.error',
	'page.url',
	'page.params',
	'searchParams',
	'location.',
	'navigator.',
	'document.',
	'localStorage',
	'sessionStorage',
	'.textContent',
	'.innerHTML'
];

/** Чи можна віддати цей вираз у `{@html}`. Обидві умови разом. */
function isSafeHtmlExpression(expression: string): boolean {
	if (!SAFE_HTML_SOURCES.some((safe) => expression.startsWith(safe))) return false;
	return !OUTSIDE_DATA.some((source) => expression.includes(source));
}

/**
 * Перевірка самої перевірки: половина випадків мусить пройти, половина — впасти.
 *
 * Без цієї таблиці інваріант нижче лишався б зеленим і тоді, коли перестав би
 * щось означати: сьогодні в `src/` жодного `{@html page.error…}` немає, тож
 * прогін по джерелах не відрізнити від прогону по порожньому списку. Той самий
 * прийом, що в гейті правил бази: зелений результат неможливий випадково.
 */
const HTML_EXPRESSION_CASES: Array<{ expression: string; safe: boolean; why: string }> = [
	{ expression: "formatFont(t('menu.play'))", safe: true, why: 'ключ словника' },
	{ expression: 'formatFont(td(animal.nameKey))', safe: true, why: 'динамічний ключ словника' },
	{ expression: 'formatPopulation(animal.population)', safe: true, why: 'число через форматер' },
	{
		expression: "formatFont(t('reserve.resident') + (species ? `: ${td(species)}` : ''))",
		safe: true,
		why: 'склейка двох ключів словника'
	},
	{
		expression: "formatFont(page.error?.message ?? t('error.message'))",
		safe: false,
		why: 'текст помилки складає фреймворк або error() у load — це НЕ словник'
	},
	{
		expression: 'formatFont(page.url.searchParams.get("name"))',
		safe: false,
		why: 'адреса: те, що відвідувач може написати сам'
	},
	{
		expression: 'formatFont(navigator.userAgent)',
		safe: false,
		why: 'браузер: рядок, який задає клієнт'
	},
	{
		expression: 'formatFont(document.title)',
		safe: false,
		why: 'DOM: значення, яке могло прийти звідки завгодно'
	},
	{
		expression: 'match.actor?.name',
		safe: false,
		why: "ім'я гравця з бази — і взагалі повз форматер"
	}
];

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

	describe('{@html} (§ 5.3)', () => {
		/*
		 * Спершу перевіряється САМА перевірка, і лише потім — джерела. Порядок не
		 * випадковий: якщо `isSafeHtmlExpression` перестане розрізняти випадки,
		 * прогін по джерелах усе одно буде зеленим, і читатиметься він як доказ.
		 */
		it.each(HTML_EXPRESSION_CASES)(
			'розрізняє випадки: «$expression» — $why',
			({ expression, safe }) => {
				expect(isSafeHtmlExpression(expression)).toBe(safe);
			}
		);

		it('половина випадків позитивна, половина негативна', () => {
			// Таблиця з самих лише «мусить пройти» доводила б рівно нічого.
			expect(HTML_EXPRESSION_CASES.some((c) => c.safe)).toBe(true);
			expect(HTML_EXPRESSION_CASES.some((c) => !c.safe)).toBe(true);
		});

		it('у джерелах немає жодного {@html} поза цими умовами', () => {
			const bad: string[] = [];
			let seen = 0;
			for (const file of sources.filter((f) => f.endsWith('.svelte'))) {
				const markup = read(file).replace(/<!--[\s\S]*?-->/g, '');
				for (const match of markup.matchAll(/\{@html\s+([\s\S]*?)\}\s*(?:<|\{|$)/g)) {
					const expression = match[1].trim();
					seen++;
					if (!isSafeHtmlExpression(expression)) {
						bad.push(`${file}: {@html ${expression.slice(0, 70)}}`);
					}
				}
			}
			// Canary: зламаний обхід або змінена розмітка дали б нуль знахідок і зелений тест.
			expect(seen, 'у джерелах не знайдено жодного {@html} — шукали не там').toBeGreaterThan(50);
			expect(bad, `{@html} із джерела, яке не є словником:\n${bad.join('\n')}`).toEqual([]);
		});
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
