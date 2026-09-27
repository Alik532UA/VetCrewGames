import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ВІКНА ХАБУ «ГРАТИ ОНЛАЙН» — ФОКУС І ДОСТУПНІСТЬ (рішення автора 2026-09-27, 6-A і 7-A).
 *
 * Кожна з трьох доріг хабу відкриває своє вікно НА МІСЦІ хабу. Кнопка, на якій стояв
 * фокус, зникає разом із хабом, і без переїзду він падає на `body`: читалка не каже
 * нічого, а наступний Tab починається з шапки. Тому тут перевіряється те, чого не бачить
 * ні axe (він міряє знімок), ні юніт-тест (у jsdom немає розкладки): куди фокус СПРАВДІ
 * поїхав після відкриття, після кроку всередині вікна й після «Назад».
 *
 * Мережі тут не торкається ніщо: вікна відкриваються й закриваються на пристрої, а
 * «Шукати» й «Підключитися» не натискаються — пошук і вхід писали б у справжню базу.
 *
 * Зворотні експерименти (прогнано): прибрати `focusTitle` зі сторінки — червоніє «фокус
 * переїжджає у вікно»; не передати `returnFocus` у хаб — «„Назад“ вертає фокус»; прибрати
 * `{#key game}` у `CreateWindow` — «крок усередині вікна».
 */

const PAGE = '/VetCrewGames/online/';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag22aa'];

/** Опис того, де фокус: `activeElement` через межу браузера не передати. */
const focused = (page: Page) =>
	page.evaluate(() => {
		const active = document.activeElement as HTMLElement | null;
		const panel = active?.closest('[data-testid$="-panel"]')?.getAttribute('data-testid');
		return `${active?.tagName ?? '(none)'}|${active?.dataset.testid ?? ''}|${panel ?? ''}`;
	});

/** Натиснути кнопку КЛАВІАТУРОЮ: шлях людини, для якої фокус і важить. */
async function press(page: Page, testid: string) {
	await page.getByTestId(testid).focus();
	await page.keyboard.press('Enter');
}

async function noViolations(page: Page, where: string) {
	const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
	const inspected = results.passes.reduce((sum, rule) => sum + rule.nodes.length, 0);
	expect(inspected, `axe оглянув ${inspected} вузлів (${where})`).toBeGreaterThan(20);
	expect(
		results.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 120)}`)),
		`порушення у вікні (${where})`
	).toEqual([]);
}

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
	await page.goto(PAGE);
	await settlePage(page);
});

test('на першому показі хабу фокус лишається там, де його поставив браузер', async ({ page }) => {
	expect(await focused(page)).toBe('BODY||');
});

for (const road of ['search', 'create'] as const) {
	test(`${road}: фокус переїжджає у вікно, а «Назад» вертає його на кнопку`, async ({ page }) => {
		await press(page, `online-${road}-open-btn`);
		await expect(page.getByTestId(`online-${road}-panel`)).toBeVisible();
		expect(await focused(page), 'фокус переїжджає у вікно — на його заголовок').toBe(
			`H2||online-${road}-panel`
		);
		await noViolations(page, `вікно ${road}`);

		await press(page, `online-${road}-back-btn`);
		await expect(page.getByTestId(`online-${road}-panel`)).toHaveCount(0);
		expect(await focused(page), '«Назад» вертає фокус на кнопку, що відкрила вікно').toBe(
			`BUTTON|online-${road}-open-btn|`
		);
	});
}

test('join: фокус — одразу в поле коду, а «Назад» вертає його на кнопку', async ({ page }) => {
	await press(page, 'online-join-open-btn');
	await expect(page.getByTestId('online-join-panel')).toBeVisible();
	expect(await focused(page), 'вікно відкрили, щоб набрати код').toBe(
		'INPUT|online-code-input|online-join-panel'
	);
	await noViolations(page, 'вікно join');

	await press(page, 'online-join-back-btn');
	expect(await focused(page)).toBe('BUTTON|online-join-open-btn|');
});

test('створення: крок усередині вікна теж переносить фокус', async ({ page }) => {
	await press(page, 'online-create-open-btn');
	await press(page, 'online-create-quiz-btn');
	await expect(page.getByTestId('online-create-game-value')).toBeVisible();
	expect(await focused(page), 'кнопка гри зникла — фокус на заголовку другого екрана').toBe(
		'H2||online-create-panel'
	);
	await noViolations(page, 'вікно create, «хто зможе зайти»');

	await press(page, 'online-create-back-btn');
	await expect(page.getByTestId('online-create-quiz-btn')).toBeVisible();
	expect(await focused(page), '«Назад» — на перший екран, а не на хаб').toBe(
		'H2||online-create-panel'
	);
});

test('вибір ігор пошуку переживає перезавантаження', async ({ page }) => {
	await press(page, 'online-search-open-btn');
	await page.getByTestId('online-search-pairs-toggle').click();
	await expect(page.getByTestId('online-search-pairs-toggle')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await page.reload();
	await settlePage(page);
	await press(page, 'online-search-open-btn');
	await expect(page.getByTestId('online-search-pairs-toggle')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(page.getByTestId('online-search-quiz-toggle')).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
