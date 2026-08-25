// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ТЕМА МУСИТЬ ВИГРАВАТИ В КОМПОНЕНТА ЗАВЖДИ, А НЕ ЯК СКЛАДЕТЬСЯ
 * (SVELTE-UI-v8 § 3.6, `SUI-SCOPE-SPECIFICITY`).
 *
 * ## Що це за клас дефектів
 *
 * Svelte скоупить стилі компонента, дописуючи в селектор власний клас. У
 * джерелі його не видно, а специфічність він піднімає:
 *
 *     .app-shell::before            ->   .app-shell.svelte-1s5geeb::before   (0,2,1)
 *     [data-theme='winter'] .app-shell::before                               (0,2,1)
 *
 * Нічия. А нічию CSS розвʼязує ПОРЯДКОМ — і порядок тут не властивість коду:
 *
 *  * у `vite dev` стилі компонентів інжектяться скриптом ПІСЛЯ `global.css`, і
 *    виграє тема;
 *  * у зібраному сайті компонентний CSS — окремий `link` після глобального
 *    бандла, і виграє компонент.
 *
 * Ті самі файли, та сама специфічність, ПРОТИЛЕЖНИЙ результат. Тобто правило
 * теми працює в розробника й не працює у відвідувача, і жоден інший гейт цього
 * не бачить: розмітка правильна, клас на місці, компілятор мовчить, axe
 * зелений. У сусідньому проєкті (`adoptananimal`) цей дефект уже стався:
 * `[data-style='playful'] .animal-card:hover` крутив картку в dev і не робив
 * нічого на продакшні.
 *
 * ## Чому саме `:root` попереду
 *
 * Це не хак: атрибут `data-theme` і так живе на `html`, тож `:root` описує те,
 * що вже є, і додає рівно один клас специфічності — досить, щоб перемога теми
 * не залежала від бандлера. `!important` тут НЕ рішення: він переносить ту саму
 * гонку на рівень вище, і наступне перекриття доведеться робити другим
 * `!important`.
 *
 * ## Чому перевіряються лише правила, що цілять у клас
 *
 * Канон каже про це прямо. Блок, який оголошує змінні на самому корені
 * (`[data-theme='dark'] { --bg: … }`), ні з чим не змагається: компоненти не
 * стилізують `html`. Додавати `:root` туди немає до чого.
 *
 * Так само поза межею — `body`: компонент не може стилізувати його інакше, ніж
 * через `:global()`, а `:global` класу скоупу не отримує, тож нічиєї не буде.
 * Тому перевірка питає САМЕ про клас, і саме про такий, який справді
 * стилізується в якомусь компоненті. Перевірка, що не розрізняє нічию й
 * навмисний програш, дає більше хибних спрацювань, ніж знахідок, — і її
 * вимикають.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрано `:root` з
 * `[data-theme='winter'] .app-shell::before` — перевірка червоніє й називає
 * саме цей селектор. Зроблено.
 */

const GLOBAL_CSS = ['src/lib/styles/global.css', 'src/lib/styles/animations.css'];

function svelteFiles(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) svelteFiles(full, out);
		else if (entry.endsWith('.svelte')) out.push(full.split(String.fromCharCode(92)).join('/'));
	}
	return out;
}

/** Коментар може містити приклад «як НЕ треба» — його не можна рахувати. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * Класи, які стилізує хоч один компонент — тобто ті, що отримають клас скоупу.
 *
 * `:global(...)` навмисно вирізається: такий селектор скоупу НЕ отримує, отже
 * нічиєї з темою не створює. Без цього вирізання перевірка звинувачувала б
 * правила, які насправді безпечні.
 */
function scopedClasses(): Set<string> {
	const names = new Set<string>();
	for (const path of svelteFiles('src')) {
		const source = readFileSync(path, 'utf8');
		const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source);
		if (!style) continue;
		const css = stripComments(style[1]).replace(/:global\([^)]*\)/g, ' ');
		for (const match of css.matchAll(/\.([a-zA-Z][\w-]*)/g)) names.add(match[1]);
	}
	return names;
}

/** Селектор теми, що цілить у нащадка: `[data-theme='x'] .щось`. */
const THEMED_DESCENDANT = /\[data-[\w-]+=[^\]]*\]\s*[>+~]?\s*[.#a-zA-Z]/;

describe('тема виграє в компонента незалежно від порядку', () => {
	const scoped = scopedClasses();

	it('перевірка жива: класи компонентів зібрано, глобальні правила знайдено', () => {
		/*
		 * Без цього пункту весь файл мовчав би на порожньому місці: помилка в
		 * розборі дала б порожню множину класів, і кожен селектор теми виявився б
		 * «не про клас компонента». Це та сама пастка, через яку гейт гарячих
		 * клавіш спершу шукав імʼя захисту й знаходив його в рядку `import`.
		 */
		expect(scoped.has('app-shell'), 'layout стилізує .app-shell').toBe(true);
		expect(scoped.size).toBeGreaterThan(200);
		const css = GLOBAL_CSS.map((p) => readFileSync(p, 'utf8')).join('\n');
		expect(THEMED_DESCENDANT.test(stripComments(css)), 'правила тем знайдено').toBe(true);
	});

	it('правило теми, що цілить у клас компонента, починається з :root', () => {
		const guilty: string[] = [];

		for (const path of GLOBAL_CSS) {
			const css = stripComments(readFileSync(path, 'utf8'));
			for (const block of css.split('}')) {
				/*
				 * Спершу відрізати тіло ЦЬОГО правила, і лише потім — хвіст
				 * попереднього. У зворотному порядку `lastIndexOf(';')` знаходить
				 * крапку з комою всередині тіла — тобто ПІСЛЯ селектора, — і зрізає
				 * саме те, що шукаємо. Перша редакція так і робила, і перевірка
				 * мовчки проходила на файлі з двома порушеннями.
				 */
				const head = block.split('{')[0];
				const selector = head.slice(head.lastIndexOf(';') + 1).trim();
				if (!selector || selector.startsWith('@')) continue;
				if (!THEMED_DESCENDANT.test(selector)) continue;

				// Про клас компонента, а не про `body` й не про самі змінні на корені.
				const classes = [...selector.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]);
				if (!classes.some((name) => scoped.has(name))) continue;

				if (!/^:root\b|^html\b/.test(selector)) guilty.push(`${path}: ${selector}`);
			}
		}

		expect(guilty, 'нічия віддає вибір бандлеру: в dev і в збірці він різний').toEqual([]);
	});
});
