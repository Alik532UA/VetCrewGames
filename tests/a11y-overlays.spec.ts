import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { APP_PAGES } from './support/pages';
import { reduceMotion, settlePage } from './support/settle';

/**
 * axe НА ВІДКРИТИХ НАКЛАДКАХ (ACCESSIBILITY-v8 § 10.2).
 *
 * ## Чому окремим файлом, а не рядком у `a11y.spec.ts`
 *
 * Межа методу названа в докблоці того файлу дослівно: «`analyze()` бачить лише
 * той стан, що є одразу після `goto()`. Модалки, відкриті меню й тости в нього
 * не потрапляють НІКОЛИ». Канон каже те саме й додає, що робити: критичні
 * оверлеї перевіряються окремо — з відкриттям.
 *
 * Це не дрібниця саме тут. Накладок у проєкті п'ять родин, і чотири з них —
 * саморобні (`src/overlays.test.ts` тримає їхній перелік як борг, що лише
 * коротшає). Саморобна накладка — це рівно те місце, де губляться роль, підпис і
 * зв'язок «кнопка → панель»: браузер їх не проставляє, бо панель для нього
 * звичайний `div`.
 *
 * ## НАКЛАДКИ ЗНАХОДЯТЬСЯ САМІ, А НЕ ПЕРЕЛІЧЕНІ РУКОЮ
 *
 * Перелік накладок старіє тихо: нова панель просто не потрапляє в прогін, і
 * зелений результат означає «перевірено те, що вписали». Тому тут шукається
 * ОЗНАКА, а не назва — кнопка, яка оголошує, що щось відкриває:
 *
 *   `aria-haspopup="menu"`     — меню шапки (тема, мова);
 *   `aria-haspopup="listbox"`  — вибір країни;
 *   `popovertarget`            — накладка на платформі (`InfoPopover`).
 *
 * Кнопка без жодної з трьох ознак накладкою не є ні для скрінрідера, ні для
 * браузера — тобто пропустити щось справжнє цей спосіб може лише тоді, коли воно
 * вже зламане іншим способом, і про це скаже axe на самій сторінці.
 *
 * ## Чому кожна накладка міряється ОДИН раз
 *
 * Меню теми стоїть на всіх чотирнадцяти сторінках однаковою розміткою. Міряти
 * його чотирнадцять разів означало б платити за чотирнадцять однакових відповідей
 * — тому ключем стоїть локатор кнопки, і кожен ключ береться на першій сторінці,
 * де трапився. Повнота від цього не страждає: перевірка нижче стверджує, що
 * ключів побачено рівно стільки, скільки записано.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'];

/**
 * Кнопки, які щось відкривають. Атрибут, а не список імен — див. докблок вище.
 */
const TRIGGERS = [
	'button[aria-haspopup="menu"][data-testid]',
	'button[aria-haspopup="listbox"][data-testid]',
	'button[popovertarget][data-testid]'
].join(', ');

/**
 * Порушення на ВІДКРИТИХ накладках. Ключ — локатор кнопки, що відкриває.
 *
 * Та сама пара, що в `a11y-baseline.ts`: перелік id ловить новий ТИП порушення,
 * число — кількість вузлів. Обидва лише спадають.
 *
 * Заміряно 2026-08-27.
 */
const OVERLAY_KNOWN: Record<string, readonly string[]> = {
	'header-theme-btn': [],
	'header-locale-btn': [],
	'auth-info-btn': [],
	/*
	 * ЗНАЙДЕНО ЦИМ ГЕЙТОМ, 2026-08-27 — і це той рідкісний випадок, коли запис у
	 * базі означає «axe не бачить механізму», а не «борг».
	 *
	 * `scrollable-region-focusable` вимагає, щоб область, яку можна прокрутити,
	 * або сама була фокусованою, або містила фокусований вміст — інакше без миші
	 * до нижньої частини списку не дістатися. Тут не виконано ні того, ні того, і
	 * НАВМИСНО: вибір країни зроблено за взірцем combobox — фокус лишається в полі
	 * пошуку, опції мають `tabindex="-1"`, а поточну називає `aria-activedescendant`
	 * (докблок `CountryMenu.svelte` пояснює: без цього Tab ішов би по 262 кнопках).
	 * Прокрутку рухають стрілки через `scrollIntoView`.
	 *
	 * Тобто рівноцінний механізм є, і він ПЕРЕВІРЕНИЙ — не словом, а прогоном:
	 * `tests/country-menu.spec.ts` веде клавіатурою і сіткою прапорів, і в межах
	 * колонки, і після набору.
	 *
	 * ЩО ТУТ НЕ ТРЕБА РОБИТИ: додавати `tabindex="0"` на `.menu__scroll`. Це
	 * прибрало б рядок зі звіту й додало зайву зупинку Tab усередині накладки,
	 * тобто зробило б гірше рівно тим, задля кого правило існує.
	 */
	'pairs-country-select': ['scrollable-region-focusable']
};

const OVERLAY_BASELINE: Record<string, number> = {
	'header-theme-btn': 0,
	'header-locale-btn': 0,
	'auth-info-btn': 0,
	// Один вузол — контейнер прокрутки списку країн. Причина вище.
	'pairs-country-select': 1
};

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
});

async function auditOpen(page: Page, key: string) {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

	const inspected = results.passes.reduce((sum, rule) => sum + rule.nodes.length, 0);
	expect(inspected, `axe оглянув ${inspected} вузлів при відкритій ${key}`).toBeGreaterThan(20);

	const ids = [...new Set(results.violations.map((v) => v.id))].sort();
	expect(ids, `новий тип порушення на відкритій накладці (${key})`).toEqual(
		[...(OVERLAY_KNOWN[key] ?? [])].sort()
	);

	const nodes = results.violations.reduce((sum, v) => sum + v.nodes.length, 0);
	expect(
		nodes,
		`порушень побільшало на відкритій накладці (${key}):\n` +
			results.violations
				.flatMap((v) => v.nodes.map((n) => `  ${v.id}: ${n.html.slice(0, 120)}`))
				.join('\n')
	).toBeLessThanOrEqual(OVERLAY_BASELINE[key] ?? 0);
}

test('накладки не мають машинно-виявних порушень у ВІДКРИТОМУ стані', async ({ page }) => {
	const audited = new Set<string>();

	for (const url of APP_PAGES) {
		await page.goto(url);
		await settlePage(page);

		const ids = await page.evaluate(
			(selector) =>
				Array.from(document.querySelectorAll<HTMLElement>(selector))
					.filter((el) => el.offsetParent !== null)
					.map((el) => el.dataset.testid ?? ''),
			TRIGGERS
		);

		for (const id of ids) {
			if (!id || audited.has(id)) continue;
			const trigger = page.getByTestId(id);
			await trigger.click();

			/*
			 * ВІДКРИТІСТЬ СТВЕРДЖУЄТЬСЯ, А НЕ ПРИПУСКАЄТЬСЯ.
			 *
			 * Без цього рядка клік, який нічого не відкрив, дав би замір ЗАКРИТОЇ
			 * сторінки — тобто зелений результат, що не має стосунку до накладок
			 * (AI-AGENT-PITFALLS-v8 § 1). `aria-expanded` тут спільний для всіх трьох
			 * родин: і меню шапки, і вибір країни, і накладка на платформі його
			 * ставлять.
			 */
			await expect(trigger, `клік по ${id} не відкрив накладку — міряти нема чого`).toHaveAttribute(
				'aria-expanded',
				'true'
			);

			await auditOpen(page, id);
			audited.add(id);

			await page.keyboard.press('Escape');
		}
	}

	/*
	 * Повнота — з обох боків, як і в `a11y.spec.ts`. Накладка без рядка бази
	 * пройшла б із типовим нулем; рядок без накладки — прострочений виняток, що
	 * тримає число, якого ніхто не міряє.
	 */
	expect([...audited].sort(), 'знайдені накладки розійшлися з базою').toEqual(
		Object.keys(OVERLAY_BASELINE).sort()
	);
	expect(Object.keys(OVERLAY_KNOWN).sort(), 'OVERLAY_KNOWN розійшовся з OVERLAY_BASELINE').toEqual(
		Object.keys(OVERLAY_BASELINE).sort()
	);
});
