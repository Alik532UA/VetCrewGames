// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Контраст тексту й тла в КОЖНІЙ із чотирьох тем — і в спокої, і на наведенні
 * (ACCESSIBILITY-v8 § 3, WCAG 1.4.3).
 *
 * ## Чому цієї перевірки не було й чому вона потрібна саме тут
 *
 * У PROJECT-CONTEXT.md вона стояла боргом із планом «перенести `contrast.test.ts`
 * із teatralo4ka». Причина боргу — Playwright тут не стоїть, тобто axe немає, і
 * контраст не міряв ніхто. Але axe цього й не покриває: він міряє лише той стан,
 * що намальований у момент прогону, а `:hover` не розкриває принципово. У
 * teatralo4ka саме так і знайшлася кнопка, яка на наведенні у світлій темі давала
 * 1.25:1 — темний текст на темному тлі.
 *
 * Тем тут ЧОТИРИ, і дві з них світлі. Це множник, якого немає у проєкті з однією
 * темою: той самий `--color-text-muted` на тому самому тлі — це чотири різні
 * пари, і достатньо однієї, щоб текст зник. Проєкт уже має закріплений випадок
 * цього класу: до 2026-08-16 три елементи інтерфейсу читали чужий словник
 * токенів (`--bg-surface` замість `--color-bg-surface`) і були фіксованого
 * кольору в усіх темах, включно з двома світлими. Знайшлося оком, не гейтом.
 *
 * ## Чому по джерелах, а не в браузері
 *
 * Не через відсутність Playwright, а тому, що рантайм тут дає ХИБНІ дефекти:
 * напівпрозорі шари склеюються в порядку, якого статично не видно, і замір
 * «знаходить» кольори, яких у темах немає. Тут же беруться пари «тло+текст», у
 * яких обидва боки — токени тем, і граф `var()` розв'язується арифметично.
 *
 * ## Що ця перевірка НЕ покриває — свідомо і з числом у звіті
 *
 * `color-mix()`, напівпрозоре тло (`rgba` з альфою), градієнти,
 * тло-зображення, а також текст, що успадковує колір від батька або лежить на
 * тлі, заданому в іншому компоненті. Для них потрібен рантайм. Кількість таких
 * випадків друкується як НЕПОКРИТО в повідомленні про падіння, щоб її не можна
 * було прийняти за покриття.
 *
 * У цьому проєкті непокритих багато й з конкретної причини: тло застосунку — це
 * ФОТОГРАФІЯ (чотири шари на псевдоелементах у `global.css`, кожен зі власним
 * `url()`; токена палітри для неї немає), а панелі поверх неї — `color-mix(... transparent
 * 25%)`. Саме тому в проєкті є окремий інваріант `src/backdrop.test.ts`: він
 * стереже те, що ця перевірка не може, — щоб у тексту взагалі була підкладка.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): підмінити
 * `--color-text-muted` у `winter.css` на `#e6f2ff` (тло тієї ж теми) — перевірка
 * мусить впасти й назвати тему, селектор і виміряне число. Виконано.
 */

const STYLES = 'src/lib/styles';
const WCAG_AA_NORMAL = 4.5;
const WCAG_AA_LARGE = 3;

/** Порядок = порядок `@import` у global.css. Пізніший переважує за однакової ваги. */
const THEMES = ['dark', 'light-green', 'winter', 'orange-purple'] as const;
type Theme = (typeof THEMES)[number];

/**
 * Селектор, який задає токени теми. Для `dark` він подвійний (`:root,
 * [data-theme='dark']`), бо темна тут типова, — і саме тому селектор описується
 * явно, а не збирається з назви файлу.
 */
const THEME_SOURCES: Record<Theme, RegExp> = {
	dark: /:root,\s*\[data-theme='dark'\]\s*\{/,
	'light-green': /\[data-theme='light-green'\]\s*\{/,
	winter: /\[data-theme='winter'\]\s*\{/,
	'orange-purple': /\[data-theme='orange-purple'\]\s*\{/
};

/**
 * Схема, за якою браузер обирає аргумент `light-dark()` у кожній темі.
 *
 * З 2026-08-23 пара `light-green`/`dark` описана `light-dark()` в одному блоці
 * (UI-UX-v8 § 1.5.1), тож `themes/light-green.css` оголошень більше не має —
 * значення приходять із `dark.css` разом із вибором аргументу.
 *
 * Розподіл НЕ виводиться з назви теми, а списаний із `app.html`, де скрипт
 * першого кадру рахує `isDark = theme === 'dark' || theme === 'orange-purple'`, і
 * з `global.css`, де рівно так звужено `color-scheme`. Тримається окремою картою
 * саме тому, що зв'язок «winter → світла схема» неочевидний і мусить бути
 * видимим у diff, а не вгаданим.
 */
const THEME_SCHEME: Record<Theme, 'light' | 'dark'> = {
	dark: 'dark',
	'light-green': 'light',
	winter: 'light',
	'orange-purple': 'dark'
};

/**
 * `light-dark(A, B)` → `A` для світлої схеми, `B` для темної.
 *
 * Кома тут НЕ розділювач: аргументом буває `rgba(255, 179, 39, 0.4)` або
 * `0 4px 16px rgba(0, 0, 0, 0.1)`, тобто самі містять коми. Тому ділиться
 * підрахунком дужок, а не `split(',')` — інакше перший аргумент обривався б на
 * `rgba(255`, не розбирався як колір, і перевірка МОВЧКИ рахувала б пару
 * непокритою, тобто «проблем немає» (AI-AGENT-PITFALLS-v8 § 1).
 */
function pickLightDark(value: string, theme: Theme): string {
	const v = value.trim();
	if (v.toLowerCase().indexOf('light-dark(') !== 0) return v;

	let depth = 0;
	const args: string[] = [];
	let current = '';
	for (let i = 'light-dark('.length - 1; i < v.length; i += 1) {
		const ch = v[i];
		if (ch === '(') {
			depth += 1;
			if (depth === 1) continue;
		} else if (ch === ')') {
			depth -= 1;
			if (depth === 0) {
				args.push(current);
				break;
			}
		} else if (ch === ',' && depth === 1) {
			args.push(current);
			current = '';
			continue;
		}
		current += ch;
	}
	if (args.length !== 2) return v;
	return (THEME_SCHEME[theme] === 'light' ? args[0] : args[1]).trim();
}

type Rgb = [number, number, number];

/**
 * `transparent` тут НЕ колір і не чорний.
 *
 * У teatralo4ka перша версія резолвера мала його як `[0,0,0]`, і перевірка видала
 * близько двадцяти хибних дефектів: `background: transparent` читалося як «чорне
 * тло». `transparent` означає «те, що під ним», а це статично невідомо — отже
 * НЕПОКРИТО, а не дефект.
 */
const NAMED: Record<string, Rgb> = { white: [255, 255, 255], black: [0, 0, 0] };

function parseColor(value: string): Rgb | null {
	const v = value.trim().toLowerCase();
	if (v in NAMED) return NAMED[v];
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v);
	if (hex) {
		const h = hex[1];
		const full =
			h.length === 3
				? h
						.split('')
						.map((c) => c + c)
						.join('')
				: h;
		return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
	}
	const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
	if (rgb) {
		const parts = rgb[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.map(Number);
		// Напівпрозоре не розв'язується без знання того, що під ним.
		if (parts.length >= 4 && parts[3] < 0.999) return null;
		if (parts.slice(0, 3).some(Number.isNaN)) return null;
		return parts.slice(0, 3) as Rgb;
	}
	return null;
}

/**
 * Читає файл стилів БЕЗ коментарів.
 *
 * Не косметика. Коментарі в темах цього проєкту описують токени, тобто містять
 * рядки виду `--color-text:`. Без цього кроку регулярка оголошень бачить такий
 * коментар як справжнє оголошення, тягне значення до наступної `;` — і токен
 * стає нерозв'язним. Наслідок найгіршого штибу: перевірка МОВЧКИ рахує саме ту
 * пару, яку шукала, як «непокриту».
 */
const read = (rel: string) =>
	readFileSync(join(STYLES, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Оголошення `--name: value;` з першого блоку після заданого селектора. */
function declarationsIn(css: string, selector: RegExp): Map<string, string> {
	const out = new Map<string, string>();
	const m = selector.exec(css);
	if (!m) return out;
	// Блок закінчується першою `}` на початку рядка — теми пласкі, вкладень немає.
	const body = css.slice(m.index + m[0].length).split(/^\}/m)[0];
	for (const d of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1], d[2].trim());
	return out;
}

/** Базові токени з `global.css` і `animations.css`: усі блоки `:root`. */
function baseDeclarations(): Map<string, string> {
	const out = new Map<string, string>();
	for (const file of ['global.css', 'animations.css']) {
		for (const block of read(file).matchAll(/:root\s*\{([\s\S]*?)^\}/gm)) {
			for (const d of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.set(d[1], d[2].trim());
		}
	}
	return out;
}

class TokenResolver {
	private readonly base = baseDeclarations();
	private readonly perTheme = new Map<Theme, Map<string, string>>();

	constructor() {
		for (const theme of THEMES) {
			// Темна тема лежить у dark.css і заразом дає токени для `:root`, тож
			// кожна тема читається зі свого файлу поверх бази.
			this.perTheme.set(theme, declarationsIn(read(`themes/${theme}.css`), THEME_SOURCES[theme]));
		}
	}

	/** Сире значення токена в темі: спершу тема, далі темна як типова, далі база. */
	raw(name: string, theme: Theme): string | undefined {
		return (
			this.perTheme.get(theme)!.get(name) ??
			this.perTheme.get('dark')!.get(name) ??
			this.base.get(name)
		);
	}

	/** `null` = «не колір або не розв'язується»: `color-mix`, прозоре, градієнт. */
	resolve(name: string, theme: Theme, depth = 0): Rgb | null {
		if (depth > 10) return null;
		const value = this.raw(name, theme);
		return value === undefined ? null : this.resolveValue(value, theme, depth);
	}

	resolveValue(value: string, theme: Theme, depth = 0): Rgb | null {
		if (depth > 10) return null;
		// `light-dark()` знімається ПЕРЕД усім іншим: усередині нього стоїть і
		// літерал, і `var()`, тобто те, що розбирає решта методу.
		const v = pickLightDark(value, theme);
		const direct = parseColor(v);
		if (direct) return direct;
		// Рівно один var() і нічого крім нього: `var(--a)` або `var(--a, fallback)`.
		const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(v);
		if (!m) return null;
		return (
			this.resolve(m[1], theme, depth + 1) ??
			(m[2] ? this.resolveValue(m[2], theme, depth + 1) : null)
		);
	}
}

/** Відносна яскравість за WCAG 2.x. */
function luminance([r, g, b]: Rgb): number {
	const f = (v: number) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

type Decl = { color?: string; background?: string; fontSize?: string; fontWeight?: string };

/**
 * Дві константи, а не одна: регулярка з прапорцем `g` зберігає `lastIndex` між
 * викликами `.test()`, тож одна й та сама на перевірку і на заміну давала то
 * true, то false на однакових селекторах — і базовий стан збирався з правил
 * `:hover`.
 */
const IS_STATE = /:hover|:focus-visible|:focus|:active/;
const STRIP_STATE = /:hover|:focus-visible|:focus|:active/g;

function walk(dir: string, out: string[] = []): string[] {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name).replace(/\\/g, '/');
		if (e.isDirectory()) walk(p, out);
		else if (e.name.endsWith('.svelte')) out.push(p);
	}
	return out;
}

const styleBlock = (source: string) => source.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
const value = (raw: string) => raw.replace(/!important/g, '').trim();

/** Пласкі правила `селектор { … }`. Медіазапити не розгортаються: нам потрібні ПАРИ. */
function rules(css: string): { selector: string; decl: Decl }[] {
	const out: { selector: string; decl: Decl }[] = [];
	// Коментарі геть ДО розбору: інакше вони приклеюються до селектора, і `prop:
	// value` всередині коментаря читається як справжнє оголошення.
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
	for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = m[1].trim().replace(/\s+/g, ' ');
		if (!selector || selector.startsWith('@') || selector.startsWith('%')) continue;
		const decl: Decl = {};
		for (const d of m[2].matchAll(/([a-z-]+)\s*:\s*([^;]+);?/g)) {
			if (d[1] === 'color') decl.color = value(d[2]);
			else if (d[1] === 'background' || d[1] === 'background-color') decl.background = value(d[2]);
			else if (d[1] === 'font-size') decl.fontSize = value(d[2]);
			else if (d[1] === 'font-weight') decl.fontWeight = value(d[2]);
		}
		if (decl.color || decl.background) out.push({ selector, decl });
	}
	return out;
}

/** Великий текст за WCAG: ≥24px, або ≥18.66px і жирний. */
function isLarge(decl: Decl, resolver: TokenResolver): boolean {
	const raw = decl.fontSize;
	if (!raw) return false;
	// Розміри тут — теж токени (`var(--font-size-lg)`), тож спершу розгортання.
	const token = /^var\(\s*(--[\w-]+)/.exec(raw);
	const literal = token ? resolver.raw(token[1], 'dark') : raw;
	if (!literal) return false;
	const clamp = /clamp\([^,]+,\s*([^,]+),/.exec(literal);
	const text = (clamp ? clamp[1] : literal).trim();
	const rem = /^([\d.]+)rem$/.exec(text);
	const px = /^([\d.]+)px$/.exec(text);
	const size = rem ? parseFloat(rem[1]) * 16 : px ? parseFloat(px[1]) : NaN;
	if (Number.isNaN(size)) return false;
	const weightToken = /^var\(\s*(--[\w-]+)/.exec(decl.fontWeight ?? '');
	const weightRaw = weightToken ? resolver.raw(weightToken[1], 'dark') : decl.fontWeight;
	const bold = (parseInt(weightRaw ?? '400', 10) || 400) >= 700;
	return size >= 24 || (size >= 18.66 && bold);
}

/**
 * Свідомі відхилення. Кожне — з виміряним числом і причиною, а не «щоб зелений»:
 * список без чисел за пів року стає винятком, якого ніхто не читає.
 *
 * Тут їх рівно один клас, і межа проведена по ОДНІЙ ознаці: чи можна елемент
 * натиснути. WCAG 1.4.3 звільняє від вимоги контрасту текст НЕАКТИВНИХ
 * елементів керування — приглушений вигляд там сам є сигналом недоступності. На
 * елемент, який виглядає неактивним і при цьому натискається, звільнення не
 * діє: `.card__release--off` у `AnimalCard.svelte` мав рівно ті самі числа, і
 * саме тому він не в цьому списку, а виправлений.
 */
const EXCEPTIONS: { selector: string; theme: Theme | '*'; ratio: string; why: string }[] = [
	{
		selector: ':disabled',
		theme: '*',
		ratio: '1.77 (світлі теми), 2.20 (dark), 2.78 (orange-purple)',
		why: 'Справжній атрибут `disabled`: `.btn-primary:disabled` у global.css і `.btn-check:disabled` у game-population. Пара `--color-disabled-text` на `--color-disabled` за побудовою приглушена, і WCAG 1.4.3 текст неактивних елементів керування прямо не вимагає. Умикати їх контрастними означало б стерти єдину візуальну ознаку того, що кнопка не працює'
	}
];

type Finding = {
	file: string;
	selector: string;
	state: string;
	theme: Theme;
	ratio: number;
	need: number;
	fg: Rgb;
	bg: Rgb;
};

describe('контраст тексту й тла в чотирьох темах', () => {
	const resolver = new TokenResolver();
	const files = [...walk('src'), `${STYLES}/global.css`];

	let pairsChecked = 0;
	let uncovered = 0;
	const findings: Finding[] = [];
	/** Пари, які провалили межу й були прощені винятком. Потрібні, щоб побачити прострочений виняток. */
	const suppressed: string[] = [];

	for (const file of files) {
		const source = readFileSync(file, 'utf8');
		const css = file.endsWith('.css') ? source : styleBlock(source);
		if (!css) continue;

		const parsed = rules(css);
		// Базовий стан селектора: те саме без :hover/:focus/:active.
		const base = new Map<string, Decl>();
		for (const { selector, decl } of parsed) {
			if (IS_STATE.test(selector)) continue;
			base.set(selector, { ...(base.get(selector) ?? {}), ...decl });
		}

		for (const { selector, decl } of parsed) {
			const isState = IS_STATE.test(selector);
			const root = selector.replace(STRIP_STATE, '').trim();
			const effective: Decl = { ...(base.get(root) ?? {}), ...decl };

			// Пара має сенс лише якщо ВІДОМІ обидва боки. Текст без тла — це
			// успадкування, і статично воно не розв'язується.
			if (!effective.color || !effective.background) {
				uncovered++;
				continue;
			}

			const need = isLarge(effective, resolver) ? WCAG_AA_LARGE : WCAG_AA_NORMAL;
			for (const theme of THEMES) {
				const fg = resolver.resolveValue(effective.color, theme);
				const bg = resolver.resolveValue(effective.background, theme);
				if (!fg || !bg) {
					uncovered++;
					continue;
				}
				pairsChecked++;
				const ratio = contrast(fg, bg);
				if (ratio >= need) continue;
				const excused = EXCEPTIONS.find(
					(e) => selector.includes(e.selector) && (e.theme === '*' || e.theme === theme)
				);
				if (excused) {
					suppressed.push(excused.selector);
					continue;
				}
				findings.push({
					file,
					selector,
					state: isState ? 'наведення/фокус' : 'спокій',
					theme,
					ratio,
					need,
					fg,
					bg
				});
			}
		}
	}

	it('знаходить пари для перевірки — вона жива', () => {
		expect(files.length).toBeGreaterThan(50);
		// Число не з голови: стільки пар «тло+текст» розв'язується в токени. Без
		// цього рядка зламаний резолвер дав би нуль пар і зелену перевірку.
		expect(pairsChecked).toBeGreaterThan(100);
	});

	it("граф токенів розв'язується в кожній темі", () => {
		// Канарка на сам резолвер. Якщо селектори тем зміняться, він почне
		// повертати null на всьому — і перевірка вище стане зеленою на нулі.
		for (const theme of THEMES) {
			for (const token of ['--color-bg-surface', '--color-text', '--color-text-muted']) {
				expect(resolver.resolve(token, theme), `${theme} ${token}`).not.toBeNull();
			}
		}
		// Різні теми мусять давати РІЗНІ кольори: однакові означали б, що всі
		// читаються з одного блоку.
		const backgrounds = THEMES.map((t) => String(resolver.resolve('--color-bg', t)));
		expect(new Set(backgrounds).size, `--color-bg однаковий у темах: ${backgrounds}`).toBe(
			THEMES.length
		);
	});

	/**
	 * Виняток, який більше нічого не прощає, — гірший за його відсутність: він
	 * читається як «тут була причина» й живе далі, а разом із ним лишається
	 * дозволеною ціла родина селекторів. Тому кожен мусить ловити хоч одну
	 * реальну пару.
	 *
	 * Дивиться на `suppressed`, а не на `findings`: прощена пара до `findings` не
	 * доходить за побудовою, і перевірка по ньому оголошувала б простроченим саме
	 * той виняток, що працює.
	 */
	it('немає прострочених винятків', () => {
		const used = new Set(suppressed);
		const stale = EXCEPTIONS.filter((e) => !used.has(e.selector)).map(
			(e) => `${e.selector} (${e.theme}) — не прощає жодної пари, виняток описує минуле`
		);
		expect(stale, stale.join('\n')).toEqual([]);
	});

	it('кожна пара «тло+текст» проходить WCAG AA', () => {
		const hex = (c: Rgb) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
		const report = findings
			.sort((a, b) => a.ratio - b.ratio)
			.map(
				(f) =>
					`${f.ratio.toFixed(2)}:1 (треба ${f.need})  ${f.theme}/${f.state}  ${f.file}\n      ${f.selector}  текст ${hex(f.fg)} на ${hex(f.bg)}`
			)
			.join('\n');

		expect(
			findings.map((f) => `${f.theme} ${f.selector}`),
			`\nПар перевірено: ${pairsChecked}. НЕПОКРИТО (color-mix, прозоре, успадкування): ${uncovered}.\n\n${report}\n`
		).toEqual([]);
	});
});

/**
 * ПРОЗОРІСТЬ ВІДСУТНЬОГО ГРАВЦЯ: скільки коштує «весь рядок на 50%».
 *
 * Автор попросив саме це: не гасити колір окремим елементам, а зробити весь рядок
 * прозорим на 50%, «щоб і імʼя, і рахунок, і прапор, і аватарка — усе разом».
 * Рішення свідоме, а ця перевірка не забороняє його: вона НАЗИВАЄ ЦІНУ й тримає її
 * від тихого погіршення.
 *
 * Числа рахуються так, як їх бачить око: колір тексту змішується з тлом панелі в
 * пропорції прозорості, і результат порівнюється з тим самим тлом. Тло панелі
 * (`.text-panel`) саме напівпрозоре над фотографією — тому за підкладку беремо
 * `--color-bg`, тобто найтемніше з можливого в темі: це найгірший випадок, а не
 * середній.
 */
describe('прозорість відсутнього', () => {
	const OPACITY = 0.5;
	const resolver = new TokenResolver();

	/** Змішати колір із підкладкою в пропорції прозорості. */
	const fade = (color: Rgb, under: Rgb, alpha: number): Rgb =>
		[0, 1, 2].map((i) => Math.round(color[i] * alpha + under[i] * (1 - alpha))) as Rgb;

	it('перевірка жива: клас із прозорістю існує', () => {
		const css = readFileSync('src/lib/styles/global.css', 'utf8');
		expect(css).toContain('.player-away');
		expect(css).toContain(`opacity: ${OPACITY}`);
	});

	it('контраст імені під прозорістю заміряний у всіх темах', () => {
		const measured: Record<string, number> = {};

		for (const theme of THEMES) {
			const text = resolver.resolve('--color-text-on-panel', theme);
			const under = resolver.resolve('--color-bg', theme);
			expect(text, `${theme}: немає --color-text-on-panel`).not.toBeNull();
			expect(under, `${theme}: немає --color-bg`).not.toBeNull();

			measured[theme] = +contrast(fade(text as Rgb, under as Rgb, OPACITY), under as Rgb).toFixed(
				2
			);
		}

		/*
		 * Межа тут НЕ 4.5: рядок відсутнього гравця свідомо притишений, і саме це
		 * автор і просив. Перевірка стежить за іншим — щоб він не став НЕВИДИМИМ:
		 * 2:1 це вже «здогадайся, що написано».
		 *
		 * Заміряні числа лишаються в повідомленні: вони й є та ціна, яку названо в
		 * `global.css`, і якщо чиясь правка теми їх зіпсує, це буде видно тут.
		 */
		for (const [theme, ratio] of Object.entries(measured)) {
			expect(
				ratio,
				`${theme}: рядок відсутнього став нечитним (${JSON.stringify(measured)})`
			).toBeGreaterThan(2);
		}

		// Довідка у виводі — щоб число було видно, а не лише його межа.
		expect(Object.keys(measured).sort()).toEqual([...THEMES].sort());
	});
});
