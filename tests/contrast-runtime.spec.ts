import { expect, test, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';

/**
 * КОНТРАСТ У РАНТАЙМІ: чотири теми × усі сторінки, з реальним складанням шарів.
 *
 * ## Навіщо третя перевірка контрасту, коли вже є дві
 *
 * `src/contrast.test.ts` читає ДЖЕРЕЛА і сам, у власному докблоці, перелічує, чого
 * не бачить: «`color-mix()`, напівпрозоре тло (`rgba` з альфою), градієнти,
 * тло-зображення, а також текст, що успадковує колір від батька або лежить на
 * тлі, заданому в іншому компоненті».
 *
 * `tests/a11y.spec.ts` (axe) бачить рантайм, але дивиться на ДВІ сторінки з
 * одинадцяти й на дві теми з чотирьох.
 *
 * Дефект, через який ця перевірка з'явилася, лежав рівно в перетині цих двох
 * прогалин — і його знайшло ОКО АВТОРА, не гейт: `.btn-menu` («Головне меню») у
 * світлих темах — білий текст на світлому тлі. Тло — `rgba(255, 255, 255, 0.1)`,
 * тобто напівпрозоре (для юніт-перевірки НЕПОКРИТО за визначенням), а сторінка —
 * екран підсумку гри, куди axe не заходить.
 *
 * Найгірше в тій історії те, що ПРАВИЛО В ПРОЄКТІ ВЖЕ БУЛО. 2026-08-23 перший
 * прогін axe знайшов той самий клас на головній, і `.game-title` та
 * `.menu-btn--link` тоді ж перевели на `--color-text-on-panel` із коментарями
 * «а не зашитий `#ffffff`». Але виправили рівно там, куди axe дивиться, — і на
 * сторінках ігор той самий зашитий білий прожив далі. Ця перевірка існує, щоб
 * «виправлено там, де подивилися» більше не читалося як «виправлено».
 *
 * ## Як міряється
 *
 * Ефективне тло СКЛАДАЄТЬСЯ вгору по дереву, поки не трапиться непрозорий шар.
 * Конвертація кольору — канвою (`fillStyle` + `getImageData`), а не регуляркою:
 * Chrome обчислює `color-mix()` в `oklab(…)`, і регулярка на `rgba?\(…\)` такий
 * шар МОВЧКИ пропускає. Перша редакція цього заміру саме так і збрехала — вона
 * не побачила панелі під текстом і показала контраст 1.10 там, де насправді 1.80.
 * Канва конвертує будь-який валідний CSS-колір і на невалідному рядку лишає
 * прозоре, тобто «шару немає» — безпечне тлумачення, а не хибний чорний.
 *
 * ## Що ця перевірка НЕ покриває — свідомо, з названою межею
 *
 * 1. **Стани.** Замір бачить сторінку такою, якою вона відкрилася. Наведення,
 *    фокус, відкрите меню, екран підсумку гри — ні. Наведення й фокус звіряє
 *    `src/contrast.test.ts` (він для цього і збирає базовий стан окремо від
 *    `:hover`), екран підсумку — око людини за чеклистом.
 * 2. **Фотографія тла.** `--bg-image` — це знімок, і його місцева яскравість
 *    невідома. Коли найближчий непрозорий шар — той самий елемент, що несе
 *    знімок, у звіті стоїть `фото`, а за тло беруться оголошені `--color-bg`
 *    теми. Що під текстом узагалі є підкладка, стереже `src/backdrop.test.ts`.
 * 3. **Малюнок у SVG.** Міряється `color` (ним лucide малює значки через
 *    `currentColor`), але не `fill`/`stroke`, вписані літералами. Інакше кожна
 *    ілюстрація проєкту давала б хибні дефекти. Наслідок названий: біла обводка
 *    `.circle-fill` у `GameHeader` виправлена тим самим комітом РУКАМИ, і гейт
 *    її не тримає.
 *
 * ## Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1)
 *
 * Повернуто `color: #ffffff` у `.header-btn` (`global.css`) — прогін упав на темі
 * `winter` із 2.68:1 при потрібних трьох, назвавши тему, сторінку, селектор і
 * обидва кольори. Тобто перевірка ловить саме той дефект, задля якого й з'явилася.
 *
 * Побічний висновок того ж прогону, вартий запису: у `light-green` той самий
 * повернутий білий лишився ТРОХИ вище планки. Виправлення `.header-btn` було
 * подвійним — колір тексту плюс тло домішкою кольору теми замість білої, — і
 * друга половина сама піднімає контраст у світлих темах настільно, що першої
 * майже досить. Тобто число 2.41:1 із початкового заміру належало старій парі
 * цілком, і одну з двох правок скасувати не можна, не втративши іншу.
 */

/** Порядок як у `src/contrast.test.ts`, щоб звіти двох перевірок читалися разом. */
const THEMES = ['dark', 'light-green', 'winter', 'orange-purple'] as const;

/**
 * УСІ сторінки застосунку, а не «показові».
 *
 * Саме вибірковість і була причиною дефекту: axe ходить на дві сторінки, і рівно
 * поза ними зашитий білий вижив. Список складено з `src/routes/[[lang=lang]]/`;
 * нова сторінка без рядка тут — це знову «перевірено там, де подивилися», тому
 * повнота списку окремо стверджується тестом нижче.
 */
const PAGES = [
	'/VetCrewGames/',
	'/VetCrewGames/game-family/',
	'/VetCrewGames/game-feeding/',
	'/VetCrewGames/game-habitat/',
	'/VetCrewGames/game-memory/',
	'/VetCrewGames/game-mythbusters/',
	'/VetCrewGames/game-population/',
	'/VetCrewGames/quiz/',
	'/VetCrewGames/reserve/',
	'/VetCrewGames/pairs/',
	'/VetCrewGames/beta-test-checklists/'
] as const;

/** Те, що бачить замір усередині сторінки: про адресу він не знає. */
type PageFinding = {
	theme: string;
	sel: string;
	text: string;
	fg: string;
	bg: string;
	ratio: number;
	need: number;
	photo: boolean;
};

/** Те саме плюс адреса — її дописує тест, який і ходив по сторінках. */
type Finding = PageFinding & { page: string };

type Report = { findings: PageFinding[]; checked: number; skippedDisabled: number };

/**
 * Замір виконується В СТОРІНЦІ: скласти шари можна лише там, де є справжній
 * `getComputedStyle` і справжнє дерево.
 */
async function measure(page: Page, theme: string): Promise<Report> {
	return page.evaluate((activeTheme) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

		/** Будь-який валідний CSS-колір → RGBA. `null` = шару немає. */
		function toRgba(value: string): [number, number, number, number] | null {
			if (!value) return null;
			ctx.clearRect(0, 0, 1, 1);
			// Прозоре як стартове значення: невалідний рядок присвоєння ігнорується,
			// і шар лишається прозорим замість того, щоб стати чорним.
			ctx.fillStyle = 'rgba(0, 0, 0, 0)';
			ctx.fillStyle = value;
			ctx.fillRect(0, 0, 1, 1);
			const d = ctx.getImageData(0, 0, 1, 1).data;
			const alpha = d[3] / 255;
			return alpha === 0 ? null : [d[0], d[1], d[2], alpha];
		}

		const channel = (v: number) => {
			const c = v / 255;
			return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		};
		const luminance = (c: number[]) =>
			0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
		const contrast = (a: number[], b: number[]) => {
			const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		const composite = (top: number[], under: number[]) =>
			[0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));

		/** Складає тло вгору по дереву до першого непрозорого шару. */
		function effectiveBackground(el: Element) {
			const layers: number[][] = [];
			let node: Element | null = el;
			let photo = false;
			while (node) {
				const cs = getComputedStyle(node);
				const colour = toRgba(cs.backgroundColor);
				if (colour) {
					layers.push(colour);
					if (colour[3] >= 0.999) {
						// Знімок лежить ПОВЕРХ кольору того самого елемента, тож саме він і є
						// справжнім тлом — колір теми тут лишається наближенням.
						photo = cs.backgroundImage !== 'none';
						break;
					}
				}
				node = node.parentElement;
			}
			let base = [255, 255, 255];
			for (let i = layers.length - 1; i >= 0; i -= 1) base = composite(layers[i], base);
			return { bg: base, photo };
		}

		/** WCAG 1.4.3 і 1.4.11: 4.5 звичайний текст, 3 великий, 3 значки. */
		function required(cs: CSSStyleDeclaration, isIcon: boolean) {
			if (isIcon) return 3;
			const px = parseFloat(cs.fontSize);
			const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
			return px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
		}

		function describe(el: Element) {
			const parts: string[] = [];
			let node: Element | null = el;
			for (let i = 0; i < 3 && node; i += 1, node = node.parentElement) {
				let s = node.tagName.toLowerCase();
				const cls = typeof node.className === 'string' ? node.className.trim() : '';
				if (cls) {
					const useful = cls
						.split(/\s+/)
						.filter((c) => !/^svelte-/.test(c))
						.slice(0, 2);
					if (useful.length) s += `.${useful.join('.')}`;
				}
				parts.unshift(s);
			}
			return parts.join(' > ');
		}

		const findings: PageFinding[] = [];
		let checked = 0;
		let skippedDisabled = 0;

		for (const el of Array.from(document.querySelectorAll('*'))) {
			const isIcon = el.tagName === 'svg';
			const ownsText = Array.from(el.childNodes).some(
				(n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''
			);
			if (!ownsText && !isIcon) continue;

			const box = el.getBoundingClientRect();
			if (box.width < 2 || box.height < 2) continue;

			const cs = getComputedStyle(el);
			if (cs.visibility === 'hidden' || cs.display === 'none') continue;
			// Напівпрозорий елемент — це приглушений стан, а не пара кольорів: його
			// справжній колір залежить від того, що під ним, і рахувати його як текст
			// означало б вигадувати дефекти.
			if (parseFloat(cs.opacity) < 0.9) continue;

			/*
			 * Неактивні елементи керування — той самий виняток, що в
			 * `src/contrast.test.ts`: WCAG 1.4.3 прямо не вимагає контрасту для тексту
			 * неактивних елементів, а приглушений вигляд там САМ Є сигналом
			 * недоступності. Робити його контрастним означало б стерти цей сигнал.
			 */
			if (el.closest('[disabled], [aria-disabled="true"]')) {
				skippedDisabled += 1;
				continue;
			}

			const ink = toRgba(cs.color);
			// Напівпрозорий текст складати ні з чим: він і є приглушеним станом.
			if (!ink || ink[3] < 0.9) continue;

			const { bg, photo } = effectiveBackground(el);
			checked += 1;

			const ratio = contrast(ink, bg);
			const need = required(cs, isIcon);
			if (ratio >= need) continue;

			findings.push({
				theme: activeTheme,
				sel: describe(el),
				text: (el.textContent ?? '').trim().slice(0, 24),
				fg: cs.color,
				bg: `rgb(${bg.map(Math.round).join(', ')})`,
				ratio: Math.round(ratio * 100) / 100,
				need,
				photo
			});
		}

		return { findings, checked, skippedDisabled };
	}, theme);
}

/**
 * Сторінка відкривається у заданій темі.
 *
 * Тема кладеться у СХОВИЩЕ до завантаження, а не атрибутом після: це справжній
 * шлях справжнього відвідувача — `settings` читає `vetcrewgames_theme` у
 * конструкторі, а інлайн-скрипт `app.html` ставить `data-theme` ще до першого
 * кадру. Атрибут, підкладений тестом після завантаження, перевіряв би стан, у
 * якому застосунок ніколи не буває.
 *
 * `addInitScript` викликається ОДИН раз на тест (не в цьому хелпері): повторні
 * виклики накопичуються, і до останньої сторінки їх було б стільки, скільки
 * сторінок.
 */
async function openIn(page: Page, url: string, theme: string) {
	await page.goto(url);
	await expect(page.locator('h1').first()).toHaveCSS('opacity', '1');
	// Шрифт міняє метрики, а з ними й те, який текст вважається великим.
	await page.evaluate(() => document.fonts.ready);
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/*
 * Кожна тема — САМОДОСТАТНІЙ тест, без спільного стану між ними.
 *
 * `fullyParallel: true` розкидає тести по воркерах, тобто по окремих процесах:
 * змінна на рівні модуля НЕ спільна, і накопичувач у ній читався б порожнім у
 * тому воркері, що не заповнював його. Перша редакція саме так і збирала звіт —
 * тобто «нуль порушень» означало б «нуль у цьому процесі».
 */
for (const theme of THEMES) {
	test(`контраст у рантаймі: тема ${theme}`, async ({ page }) => {
		await page.addInitScript(
			([key, value]) => window.localStorage.setItem(key, value),
			['vetcrewgames_theme', theme] as const
		);

		const findings: Finding[] = [];
		let checked = 0;
		let disabled = 0;

		for (const url of PAGES) {
			await openIn(page, url, theme);
			const report = await measure(page, theme);
			checked += report.checked;
			disabled += report.skippedDisabled;
			findings.push(...report.findings.map((f) => ({ ...f, page: url })));
		}

		/*
		 * Канарка на сам замір. Порожній прохід дав би «нуль порушень» і зелений
		 * результат ні про що (AI-AGENT-PITFALLS-v8 § 1) — саме той обман, від
		 * якого захищається й `a11y.spec.ts` перевіркою `results.passes.length`.
		 */
		expect(checked, `тема ${theme}: замір не оглянув жодного елемента`).toBeGreaterThan(200);

		const report = findings
			.sort((a, b) => a.ratio - b.ratio)
			.map(
				(f) =>
					`${f.ratio.toFixed(2)}:1 (треба ${f.need})  ${f.page}${f.photo ? '  [тло — фото, колір теми взято за наближення]' : ''}\n      ${f.sel}  «${f.text}»\n      текст ${f.fg} на ${f.bg}`
			)
			.join('\n');

		expect(
			findings.map((f) => `${f.page} ${f.sel}`),
			`\nОглянуто елементів: ${checked}. Пропущено неактивних: ${disabled}.\n\n${report}\n`
		).toEqual([]);
	});
}

/**
 * Повнота списку сторінок — окремим твердженням.
 *
 * Без цього перевірка тихо старіє: нова сторінка просто не потрапляє в прогін, і
 * зелений результат означає «перевірено те, що вписали», а не «перевірено все».
 * Рівно цей клас і привів сюди — axe ходив на дві сторінки з одинадцяти.
 */
test('перелік сторінок покриває всі маршрути', () => {
	const routes = readdirSync('src/routes/[[lang=lang]]', { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

	expect(routes.length, 'маршрутів не знайдено — перевірка дивиться не туди').toBeGreaterThan(5);

	const missing = routes.filter((route) => !PAGES.some((p) => p.includes(`/${route}/`)));
	expect(
		missing,
		`маршрути без заміру контрасту: ${missing.join(', ')} — додати в PAGES або назвати причину`
	).toEqual([]);
});
