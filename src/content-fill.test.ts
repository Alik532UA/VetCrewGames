// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_ZOOM } from '$lib/utils/fitZoom';

/**
 * ВМІСТ ЗАЙМАЄ ЕКРАН, І РОСТЕ ВСЕ ОДНИМ МАСШТАБОМ (прохання автора 2026-09-27).
 *
 * Спершу: «чому у нас 95% порожнє, а ми мілким елементом пишемо інформацію?». Потім, уже
 * після першої спроби: «масштабування не пропорційне, маленький хедар, частина кнопок
 * великі, в яких текст займає всього 10%». Перша спроба розтягувала коробки, а шапка
 * лишалася на пікселях.
 *
 * Росте тепер одне число, і в застосунку воно живе у двох місцях. Для шапки, меню й вікон
 * це одиниця `--fill-u` у global.css. Для ігор, хабу й лобі — `zoom` із `fitToViewport`.
 * Тут перевіряється те, що тримає їх разом і в межах канону. Сам «понад 30% екрана»
 * міряється в браузері (`tests/content-fill.spec.ts`): у джерелах видно лише числа.
 *
 * Зворотні експерименти (AI-AGENT-PITFALLS-v8 § 1.1), кожен дає червоне:
 *  - прибрати `rem` з середини `clamp` одиниці — червоніє перевірка канону;
 *  - повернути `z-index: 7000` підкладці очікування — червоніє перевірка шапки;
 *  - стеля масштабу 1,6 замість стелі одиниці — червоніє перевірка пропорції;
 *  - прибрати `--font-size-3xl` з `.fill` — червоніє перевірка токенів.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8').replace(/\r\n/g, '\n');

const GLOBAL = read('src/lib/styles/global.css');

/** Тіло першого правила з рівно таким селектором (без вкладених блоків усередині). */
function ruleBody(css: string, selector: string): string {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const match = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
	if (!match) throw new Error(`правило «${selector}» не знайдено — перевірка дивиться не туди`);
	return match[1];
}

/** Аргументи `clamp(…)` верхнього рівня: коми всередині дужок їх не ділять. */
function clampArgs(value: string): string[] {
	const inner = /^clamp\((.*)\)$/.exec(value.trim())?.[1];
	if (!inner) throw new Error(`не clamp(): ${value}`);
	const args: string[] = [];
	let depth = 0;
	let current = '';
	for (const char of inner) {
		if (char === '(') depth++;
		if (char === ')') depth--;
		if (char === ',' && depth === 0) {
			args.push(current.trim());
			current = '';
		} else current += char;
	}
	args.push(current.trim());
	return args;
}

const remOf = (length: string) => {
	const match = /^([\d.]+)rem$/.exec(length);
	if (!match) throw new Error(`межа не в rem: ${length}`);
	return Number(match[1]);
};

const unitDeclarations = [...GLOBAL.matchAll(/--fill-u:\s*([^;]+);/g)];
const unit = unitDeclarations[0]?.[1] ?? '';
const [floor, middle, ceiling] = unit ? clampArgs(unit) : ['', '', ''];

describe('одиниця, що росте з екраном (`--fill-u`)', () => {
	it('оголошена рівно раз і на `:root`: її бачить кожен компонент, а не лише нащадки `.fill`', () => {
		expect(unitDeclarations).toHaveLength(1);
		expect(ruleBody(GLOBAL, ':root')).toBeDefined();
		const roots = [...GLOBAL.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/g)].map((m) => m[1]);
		expect(roots.some((body) => body.includes('--fill-u:'))).toBe(true);
	});

	/*
	 * FLUID-SIZING-v10 § 2.1 (FS-FLUID-TYPE-ZOOM). Масштаб браузера збільшує CSS-піксель, а
	 * в'юпорт у CSS-пікселях на стільки ж зменшується: чиста одиниця в'юпорта на 200% дає
	 * той самий фізичний розмір. Тому `rem` у сумі, і стеля не вища за 2,5 дна: тоді масштаб
	 * браузера (до 500%) ще подвоює найбільший кегель через дно (WCAG 1.4.4).
	 */
	it('за каноном шрифту від екрана: дно й стеля в rem, в’юпорт лише в сумі з rem', () => {
		expect(remOf(floor)).toBe(1);
		expect(remOf(ceiling)).toBeGreaterThan(1);
		expect(middle, 'одиниця в’юпорта без rem-складової').toMatch(/\d(\.\d+)?rem/);
		expect(middle, 'в’юпорта в середині немає — тоді це не одиниця, що росте').toMatch(
			/\d(\.\d+)?(vw|svh|dvh|lvh|vh|vmin|vmax)/
		);
	});

	it('стеля не вища за 2,5 дна (там само, § 2.1)', () => {
		expect(remOf(ceiling) / remOf(floor)).toBeLessThanOrEqual(2.5);
	});

	/*
	 * Дно — рівно 1rem, тобто 16px: саме на ньому стоять телефонні розкладки й гейти reflow
	 * на 320 і 280 CSS px. Вище дна одиниця на телефоні не піднімається, бо складова
	 * в'юпорта там менша за нього (390×844 дає 14,8px).
	 */
	it('на телефоні одиниця стоїть на дні: 390×844 дає менше за 16px', () => {
		const px = (expr: string, width: number, height: number) =>
			[...expr.matchAll(/([\d.]+)(rem|vw|svh)/g)].reduce((sum, [, n, u]) => {
				const k = u === 'rem' ? 16 : u === 'vw' ? width / 100 : height / 100;
				return sum + Number(n) * k;
			}, 0);
		expect(px(middle, 390, 844)).toBeLessThan(16);
		expect(px(middle, 1600, 800)).toBeGreaterThan(20);
	});
});

describe('`.fill` — токени від одиниці', () => {
	const fill = ruleBody(GLOBAL, '.fill');
	const tokensBody = [...GLOBAL.matchAll(/(?:^|\n):root\s*\{([^}]*)\}/g)]
		.map((m) => m[1])
		.find((body) => body.includes('--font-size-md:'));

	it('знаходить токени — перевірка жива', () => {
		expect(tokensBody).toBeDefined();
	});

	/*
	 * Токен, якого `.fill` не перевизначив, лишається телефонним посеред блоку, що вирос:
	 * рівно той «мілкий елемент», на який скаржився автор, тільки тихий — ні збірка, ні
	 * `svelte-check` цього не бачать. `--radius-full` — не розмір, а «кругле», тож не рахується.
	 */
	it('перевизначає КОЖЕН токен кегля, відступу й радіуса з `:root`', () => {
		const names = [...(tokensBody ?? '').matchAll(/(--(?:font-size|space|radius)-[\w-]+):/g)]
			.map((m) => m[1])
			.filter((name) => name !== '--radius-full');
		expect(names.length).toBeGreaterThan(10);
		const missing = names.filter(
			(name) => !new RegExp(`${name}:\\s*[^;]*var\\(--fill-u\\)`).test(fill)
		);
		expect(missing, `не ростуть у .fill: ${missing.join(', ')}`).toEqual([]);
	});

	it('кегель самого блоку — одиниця: від неї рахуються `em` усередині й контейнерні запити', () => {
		expect(fill).toMatch(/font-size:\s*var\(--fill-u\);/);
	});
});

describe('усе росте однією пропорцією', () => {
	/*
	 * «Масштабування не пропорційне» було саме про це: шапка росла одним механізмом, гра —
	 * іншим, і на 1920×1080 шапка виходила вдвічі більшою, а вибір режиму «Де живем?» — у
	 * 1,6 раза (стеля масштабу стояла окремо) і займав 20% екрана.
	 */
	it('стеля масштабу ігор — та сама, що в одиниці', () => {
		expect(MAX_ZOOM).toBe(remOf(ceiling) / remOf(floor));
	});

	it('шапка на одиниці: кнопки ряду — від `--fill-u`, сама шапка — `.fill`', () => {
		const button = ruleBody(GLOBAL, '.header-btn');
		expect(button).toMatch(/\bwidth:\s*calc\(var\(--fill-u\)/);
		expect(button).toMatch(/\bheight:\s*calc\(var\(--fill-u\)/);
		expect(read('src/lib/components/GameHeader.svelte')).toMatch(
			/<header class="game-header fill">/
		);
	});
});

describe('підкладка очікування у вікторині', () => {
	/*
	 * Прохання автора 2026-09-27: «під час очікування гравців хедар не видно і той, хто
	 * чекає, заблокований». Підкладка стояла на 7000 і накривала шапку разом із «назад» і
	 * «додому»: з кімнати не можна було ні вийти, ні піти в меню, лише чекати.
	 */
	it('лежить під шапкою: «назад» і «додому» лишаються досяжними', () => {
		const zOf = (css: string, selector: string) => {
			const z = /z-index:\s*(\d+)/.exec(ruleBody(css, selector))?.[1];
			if (z === undefined) throw new Error(`у «${selector}» немає z-index`);
			return Number(z);
		};
		const scrim = zOf(read('src/lib/components/quiz/QuizAway.svelte'), '.away-scrim');
		const header = zOf(read('src/lib/components/GameHeader.svelte'), '.game-header');
		expect(scrim).toBeLessThan(header);
	});
});
