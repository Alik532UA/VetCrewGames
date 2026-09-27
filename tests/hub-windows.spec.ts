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

/**
 * ВЛАСНА ЦИФРОВА КЛАВІАТУРА (прохання автора 2026-09-27): мишею на компʼютері, без системної
 * клавіатури на телефоні. Клік мишею фокуса з поля не забирає — інакше той, хто клацає й
 * друкує впереміш, мусив би щоразу вертатися в поле.
 *
 * Зворотний експеримент (прогнано): прибрати `keepFocus` із клавіш — червоніє «фокус
 * лишається в полі».
 */
test('join: мишею по клавіатурі вікна набирається код, і фокус лишається в полі', async ({
	page
}) => {
	await press(page, 'online-join-open-btn');
	const input = page.getByTestId('online-code-input');
	await expect(input, 'системна клавіатура на телефоні не вилазить').toHaveAttribute(
		'inputmode',
		'none'
	);
	for (const key of ['4', '2', '7']) await page.getByTestId(`online-key-${key}-btn`).click();
	await page.getByTestId('online-key-erase-btn').click();
	await expect(input).toHaveValue('42');
	expect(await focused(page), 'фокус лишається в полі').toBe(
		'INPUT|online-code-input|online-join-panel'
	);
	await page.keyboard.type('5');
	await expect(input, 'фізична клавіатура працює й далі').toHaveValue('425');
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

/**
 * «СТВОРИТИ КІМНАТУ» — ПЛИТКАМИ, А НЕ РЯДКАМИ В ПОРОЖНЬОМУ ВІКНІ (скарга автора 2026-09-27:
 * «великі відступи і не великі кнопки»). Доти кнопки були заввишки 56px, а вікно, яке
 * `.fill-window` тримає на половину екрана, центрувало їх — і над заголовком та під «Назад»
 * стояло по сотні пікселів порожнечі. Тепер вибір — плитки меню «Грати».
 *
 * Зворотний експеримент (прогнано): повернути рядки `create__choice` — червоніють обидві
 * межі, і висота плитки, і поля вікна.
 */
test('створення: вибір — великими плитками меню «Грати», без порожніх полів у вікні', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await press(page, 'online-create-open-btn');
	const panel = (await page.getByTestId('online-create-panel').boundingBox())!;
	const title = (await page.getByTestId('online-create-panel').locator('h2').boundingBox())!;
	const back = (await page.getByTestId('online-create-back-btn').boundingBox())!;

	for (const id of ['online-create-quiz-btn', 'online-create-pairs-btn']) {
		const tile = (await page.getByTestId(id).boundingBox())!;
		expect(tile.height, `${id} — плитка зі значком, а не рядок`).toBeGreaterThan(150);
	}
	expect(title.y - panel.y, 'над заголовком — поле вікна, а не порожнеча').toBeLessThan(48);
	expect(panel.y + panel.height - (back.y + back.height), 'під «Назад» — теж').toBeLessThan(48);
});

/**
 * ВИБІР АВАТАРКИ — ОКРЕМИМ ВІКНОМ (скарга автора 2026-09-27: вибір розгортався рядком під
 * іменем, нижче краю телефона, і його доводилося шукати прокруткою).
 *
 * Тут те, чого немає в jsdom: справжній `<dialog>` — `Escape` від браузера, верхній шар,
 * повернення фокуса, і розкладка, у якій вікно або видно цілком, або ні.
 */
test('аватарка: вікно посередині екрана, увесь вибір видно без прокрутки, Escape закриває', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await press(page, 'pairs-avatar-toggle-btn');
	await expect(page.getByTestId('pairs-avatar-icon-grape-radio')).toBeAttached();
	await expect(page.getByTestId('pairs-avatar-panel')).toBeInViewport({ ratio: 1 });
	await expect(page.getByTestId('pairs-avatar-done-btn')).toBeInViewport({ ratio: 1 });
	expect(await focused(page), 'фокус — на заголовку вікна').toBe('H2||pairs-avatar-panel');
	await noViolations(page, 'вікно аватарки');

	await page.keyboard.press('Escape');
	await expect(page.getByTestId('pairs-avatar-panel')).toBeHidden();
	expect(await focused(page), 'Escape — фокус вертається на плитку').toBe(
		'BUTTON|pairs-avatar-toggle-btn|'
	);
});

test('аватарка: вибір лишає вікно відкритим і міняє плитку, клік по тлу закриває', async ({
	page
}) => {
	await press(page, 'pairs-avatar-toggle-btn');
	await page.getByTestId('pairs-avatar-icon-cat-radio').check({ force: true });
	await expect(page.getByTestId('pairs-avatar-panel'), 'вибір — не закриття').toBeVisible();
	await expect(
		page.locator('[data-testid="pairs-avatar-toggle-btn"] svg.lucide-cat')
	).toBeAttached();

	await page.mouse.click(5, 5);
	await expect(page.getByTestId('pairs-avatar-panel')).toBeHidden();
	expect(await focused(page)).toBe('BUTTON|pairs-avatar-toggle-btn|');
});

/*
 * ШИРОКИЙ ЕКРАН (скарга автора 2026-09-27: «відрізаний верх та низ вікна»). Хаб тут
 * збільшено `zoom` (`fitToViewport`, «лише вгору»), і вікно в його дереві росло разом із
 * ним. Зворотний експеримент (прогнано): лишити `<dialog>` на місці, без `toBody`, —
 * вікно виходить за екран, і червоніє саме ця перевірка.
 */
test('аватарка: на широкому екрані вікно цілком у межах екрана', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 800 });
	await page.goto(PAGE);
	await settlePage(page);
	await press(page, 'pairs-avatar-toggle-btn');
	await expect(page.getByTestId('pairs-avatar-icon-grape-radio')).toBeAttached();
	await expect(page.getByTestId('pairs-avatar-panel')).toBeInViewport({ ratio: 1 });
	await expect(page.getByTestId('pairs-avatar-done-btn')).toBeInViewport({ ratio: 1 });
});
