// @vitest-environment node
// Перевірка лише читає джерела — DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Ім'я кнопки-іконки шукається СТАТИЧНО, по кожному `.svelte`
 * (ACCESSIBILITY-v9 § 10.6, `A11Y-STATIC-ICON-LABEL`, HIGH).
 *
 * ЧОМУ ЦЬОГО НЕ РОБИТЬ `a11y.spec.ts`. axe бачить те, що на екрані після
 * `page.goto()`. Кнопка-іконка в модалці, у гілці `{#if}`, у стані помилки або
 * в панелі, яку відкриває інша кнопка, у його результат не потрапляє НІКОЛИ —
 * а саме там такі кнопки і живуть. `a11y-overlays.spec.ts` відкриває накладки
 * поіменно, тобто покриває ті, про які згадали; статичний скан покриває всі.
 *
 * Це не заміна axe, а друга половина того самого гейта: axe міряє складений
 * результат на головному шляху, скан — повноту по всіх гілках розмітки.
 *
 * ДРУГА ПОЛОВИНА ПРАВИЛА — звідки ім'я береться. Канон: «Ім'я береться зі
 * словника локалі, а не з атрибута-літерала: інакше в другій мові кнопка знову
 * без імені, а гейт цього не бачить». Тут це знайшло справжній дефект —
 * `aria-label="source cards"` у `PopulationBoard.svelte`, англійський літерал у
 * застосунку на чотирьох мовах. Виправлено `aria-labelledby` на видимий
 * заголовок групи.
 *
 * ЗВОРОТНИЙ ЕКСПЕРИМЕНТ — у повідомленні коміта, який цей файл приніс.
 */

const ROOT = 'src';
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function svelteFiles(dir: string, acc: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name).split('\\').join('/');
		if (statSync(full).isDirectory()) svelteFiles(full, acc);
		else if (full.endsWith('.svelte')) acc.push(full);
	}
	return acc;
}

/**
 * Коментарі ГАСЯТЬСЯ ПРОБІЛАМИ, а не вирізаються.
 *
 * Вирізати їх означало б збити зсуви, а по зсуву рахується номер рядка у звіті.
 * Гасити обов'язково: у цьому дереві `<button>` двічі згадано саме в
 * коментарях — в HTML-коментарі `ReserveMinimap.svelte` («клікабельний SVG, а
 * не `<button>` з картинкою») і в докблоці `SegmentedChoice.svelte` («у Slovko
 * це `<button class:active>` без жодного ARIA»). Перша редакція цієї перевірки
 * дала на них дві хибні знахідки — тобто рівно ті, що вчать не читати вивід.
 */
const blankComments = (src: string) =>
	src.replace(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

interface ParsedButton {
	attrs: string;
	body: string;
	index: number;
}

/**
 * Розбір `<button …>` символ за символом, а не регуляркою.
 *
 * `<button\b([^>]*)>` зупиняється на ПЕРШОМУ `>`, а найчастіший атрибут кнопки
 * у Svelte — `onclick={() => …}`, і стрілка містить `>`. Тобто розбір різав
 * атрибути посеред обробника, і все далі потрапляло у «вміст кнопки»:
 * `data-testid`, `class:active={…}`, назви функцій. Літери там є завжди — отже
 * кнопка вважалася підписаною. У `MindStep` це заміряно: 58 кнопок зі 110 мали
 * `>` в атрибутах, гейт звітував нуль порушень, а точний розбір знайшов 16.
 *
 * Закриття шукається як `</button` БЕЗ `>`: у цьому дереві кінцевий тег часто
 * розірваний — `…</button\n>` (Prettier так переносить, коли атрибути довгі).
 * Регулярка `<\/button\s*>` тут теж працює, а `indexOf('</button>')` — ні, і
 * саме на цьому перша редакція дала три хибні знахідки з порожнім вмістом.
 */
function parseButtons(src: string): ParsedButton[] {
	const out: ParsedButton[] = [];
	for (let i = 0; i < src.length; i++) {
		if (!/^<button[\s>]/.test(src.slice(i, i + 8))) continue;
		let j = i + 7;
		let depth = 0;
		let quote: string | null = null;
		for (; j < src.length; j++) {
			const c = src[j];
			if (quote) {
				if (c === quote) quote = null;
				continue;
			}
			if (c === '"' || c === "'") quote = c;
			else if (c === '{') depth++;
			else if (c === '}') depth--;
			else if (c === '>' && depth === 0) break;
		}
		const close = src.indexOf('</button', j);
		if (close === -1) continue;
		out.push({ attrs: src.slice(i + 7, j), body: src.slice(j + 1, close), index: i });
	}
	return out;
}

/** Чи має кнопка ім'я — з атрибута або з власного вмісту. */
function named(attrs: string, body: string): boolean {
	// `aria-labelledby` — теж ім'я, і в цьому проєкті саме він правильний для
	// групи з видимим заголовком. `{...spread}` може принести будь-що, тож
	// судити про такий тег статично не можна — він виводиться з розгляду.
	if (/\baria-label(ledby)?\b/.test(attrs) || /\{\.\.\./.test(attrs)) return true;

	// Нащадок-`<img>` із непорожнім `alt` дає кнопці ім'я. Пропустити це
	// означало б вимагати `aria-label` там, де підпис уже є (картка тварини в
	// `FamilyBoard.svelte` — саме такий випадок).
	if (/<img\b[^>]*\balt=(["'][^"']+["']|\{)/.test(body)) return true;

	/*
	 * БЛОКОВІ ТЕГИ — РОЗМІТКА, А НЕ ТЕКСТ, і це знайдено зворотним експериментом,
	 * а не міркуванням.
	 *
	 * Перша редакція (і зразок, з якого вона взята) знімала теги й вважала
	 * підписом будь-який `{…}`, що лишився. Кнопка вигляду
	 *
	 *     {#if on}<Keyboard size={20} />{:else}<KeyboardOff size={20} />{/if}
	 *
	 * після зняття тегів лишає `{#if on}` — і перевірка читала це як текст. Тобто
	 * КОЖНА кнопка-іконка з двома станами проходила повз гейт: прибирання
	 * `aria-label` у `HeaderControls.svelte` не дало жодної знахідки.
	 *
	 * Тому блокові теги гасяться окремо. `{@html …}` лишається текстом — він
	 * саме текст і малює.
	 */
	const withoutTags = body
		.replace(/<[^>]*>/g, '')
		.replace(/\{[#/:]\s*[^}]*\}/g, '')
		.replace(/\{@(const|debug)[^}]*\}/g, '');
	// Вираз, що повертає текст, — це підпис: `{@html formatFont(t('…'))}`,
	// `{label}`. Обробника у ВМІСТІ кнопки не буває, тож розрізняти не треба.
	if (/\{[^{}]+\}/.test(withoutTags)) return true;
	return LETTER_OR_DIGIT.test(withoutTags.replace(/\{[^{}]*\}/g, ''));
}

const files = svelteFiles(ROOT);

describe('перевірка жива', () => {
	it('компоненти знайдено', () => {
		expect(files.length, 'жодного .svelte — скан завжди зелений').toBeGreaterThan(50);
	});

	it('кнопки в переліку взагалі є', () => {
		const total = files
			.map((f) => blankComments(readFileSync(f, 'utf8')).match(/<button[\s>]/g)?.length ?? 0)
			.reduce((a, b) => a + b, 0);
		expect(total, 'жодного <button> — розбір перестав збігатися').toBeGreaterThan(50);
	});

	/**
	 * Канарки на САМ РОЗБІР, а не на його результат.
	 *
	 * Помітити зламаний розбір по результату не можна ніяк: гейт лишається
	 * зеленим, бо все, що після хибного зрізу, вважається текстом кнопки.
	 */
	it('розбір не спотикається на стрілці в onclick', () => {
		const parsed = parseButtons('<button onclick={() => go()} class="x">×</button>');
		expect(parsed.length, 'кнопку не знайдено зовсім').toBe(1);
		expect(parsed[0].attrs).toContain('onclick={() => go()}');
		expect(parsed[0].body.trim(), 'у вміст кнопки затекли атрибути').toBe('×');
	});

	it('розбір бачить розірваний кінцевий тег', () => {
		const parsed = parseButtons('<button data-testid="a">{@html x}</button\n>');
		expect(parsed.length).toBe(1);
		expect(parsed[0].body.trim(), 'вміст утрачено на переносі в </button').toBe('{@html x}');
	});

	it('коментар не читається як розмітка', () => {
		const src = '<!-- <button>без імені</button> -->\n<button aria-label={a}><Icon /></button>';
		const parsed = parseButtons(blankComments(src));
		expect(parsed.length, 'кнопку з коментаря взято за справжню').toBe(1);
	});

	it('гілка {#if} у вмісті не вважається підписом', () => {
		// Саме на цьому перша редакція пропускала кожну кнопку-іконку з двома
		// станами: після зняття тегів лишалося `{#if on}`, і воно читалося як текст.
		const body = '{#if on}<Keyboard size={20} />{:else}<KeyboardOff size={20} />{/if}';
		expect(named('type="button"', body)).toBe(false);
		expect(named("aria-label={t('x')}", body)).toBe(true);
	});

	it('символ замість підпису не вважається іменем', () => {
		// `×` читалка озвучує як «знак множення», а компонент-іконку — як ніщо.
		expect(named('class="close"', '×')).toBe(false);
		expect(named('class="close"', '<X size={16} aria-hidden="true" />')).toBe(false);
	});
});

describe('кнопки-іконки мають ім\u02bcя (ACCESSIBILITY-v9 § 10.6)', () => {
	it('жодна кнопка без тексту не лишилася без aria-label', () => {
		const offenders: string[] = [];
		for (const file of files) {
			const src = blankComments(readFileSync(file, 'utf8'));
			for (const { attrs, body, index } of parseButtons(src)) {
				if (named(attrs, body)) continue;
				const line = src.slice(0, index).split('\n').length;
				offenders.push(`${file}:${line} → «${body.replace(/\s+/g, ' ').trim().slice(0, 70)}»`);
			}
		}
		expect(
			offenders,
			`кнопка без видимого тексту й без aria-label — читалка озвучить її як ніщо:\n${offenders.join('\n')}`
		).toEqual([]);
	});
});

describe('ім\u02bcя приходить зі словника, а не літералом (I18N-v9 § 2)', () => {
	/**
	 * `aria-label="Закрити"` працює рівно в одній мові.
	 *
	 * Літерал без жодної інтерполяції — це підпис, який не перекладається: у
	 * трьох інших мовах кнопка знову без зрозумілого імені, а axe і статичний
	 * скан вище лишаються зеленими, бо ім'я формально є.
	 *
	 * Значення З інтерполяцією (`aria-label="{t('pairs.enter')}: {room.code}"`)
	 * законне: словникова частина в ньому є, а решта — код кімнати або число,
	 * які не перекладаються за побудовою.
	 */
	it('жодного aria-label з чистого літерала', () => {
		const literals: string[] = [];
		let seen = 0;
		for (const file of files) {
			const src = blankComments(readFileSync(file, 'utf8'));
			for (const m of src.matchAll(/\baria-label="([^"]*)"/g)) {
				seen++;
				if (!m[1].includes('{')) literals.push(`${file}: aria-label="${m[1]}"`);
			}
		}
		// Канарка: `aria-label="…"` у проєкті вживається, тобто шукали там, де є.
		expect(seen, 'жодного aria-label у лапках — перевірка дивиться не туди').toBeGreaterThan(3);
		expect(
			literals,
			`підпис для читалки не перекладається — узяти з i18n:\n${literals.join('\n')}`
		).toEqual([]);
	});
});
