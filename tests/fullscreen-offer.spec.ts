import { expect, test, type Page } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * КНОПКА «НА ВЕСЬ ЕКРАН» І ВІКНО «У ЦЬОМУ БРАУЗЕРІ / ВСТАНОВИТИ» (прохання автора
 * 2026-09-29).
 *
 * Тут — те, чого юніт-тест не бачить: справжній `<dialog>` у верхньому шарі, справжній
 * Fullscreen API Chromium, `Escape` браузера, фокус після закриття і скрипт першого кадру,
 * який ховає кнопку ще до гідрації.
 *
 * iPhone емулюється так само, як його бачить застосунок: рядок браузера й ВІДСУТНІЙ
 * Fullscreen API (`fullscreenEnabled === false`). Підміна ставиться ДО першого кадру
 * (`addInitScript`), бо саме його скрипт вирішує, чи є кнопка.
 *
 * Сторінка — головна, а не «Грати онлайн»: там кожен прогін анонімно входив би в бойову
 * базу, а шапка на всіх сторінках та сама.
 *
 * Зворотні експерименти описано над кожним тестом.
 */

const PAGE = '/VetCrewGames/';
const BUTTON = 'header-fullscreen-btn';
const MODAL = 'fullscreen-offer-modal';

const IPHONE_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function open(page: Page) {
	await reduceMotion(page);
	await page.goto(PAGE);
	await settlePage(page);
}

const inFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

/**
 * Власне вікно Chrome «Встановити?» тут не потрібне: тест, який його чекає, підробляє
 * подію сам. Справжня подія прийшла б лише коли їй заманеться, і тест кроків падав би
 * через раз — тому її перехоплюють ще до застосунку.
 */
async function withoutBrowserPrompt(page: Page) {
	await page.addInitScript(() => {
		window.addEventListener('beforeinstallprompt', (event) => event.stopImmediatePropagation(), {
			capture: true
		});
	});
}

/**
 * Зворотні експерименти: вікно й у встановленому застосунку (`installed` не важить) — тест
 * лишається зеленим тут, але червоніє юніт `buttonAction`; «у цьому браузері» без
 * `fullscreen.toggle()` — червоніє «повний екран увімкнено»; вихід через вікно — червоніє
 * «вихід — одразу».
 */
test('браузер уміє: вікно з двома пунктами, перший — справжній повний екран, вихід — одразу', async ({
	page
}) => {
	await withoutBrowserPrompt(page);
	await open(page);
	const button = page.getByTestId(BUTTON);
	await expect(button).toHaveAttribute('aria-haspopup', 'dialog');

	await button.click();
	const modal = page.getByTestId(MODAL);
	await expect(modal).toBeVisible();
	await expect(button).toHaveAttribute('aria-expanded', 'true');
	expect(await modal.evaluate((node) => node.matches(':modal')), 'вікно модальне').toBe(true);
	await expect(page.getByTestId('fullscreen-offer-browser-btn')).toBeFocused();
	await expect(page.getByTestId('fullscreen-offer-install-btn')).toBeVisible();

	await page.getByTestId('fullscreen-offer-browser-btn').click();
	await expect(modal).toHaveCount(0);
	await expect.poll(() => inFullscreen(page), 'повний екран увімкнено').toBe(true);
	await expect(button).not.toHaveAttribute('aria-haspopup', 'dialog');

	await button.click();
	await expect.poll(() => inFullscreen(page), 'вихід — одразу').toBe(false);
	await expect(page.getByTestId(MODAL)).toHaveCount(0);
});

/**
 * НАТИСК — ЯК У SAFARI: без фокуса на кнопці. Chromium ставить фокус на кнопку, по якій
 * клікнули, і `<dialog>` після закриття сам вертає його туди. Тоді тест не бачив би нашого
 * `trigger.focus()` зовсім, і це заміряно: без нього перша редакція тесту лишалася зеленою.
 * Safari ж кнопку кліком не фокусує, і вертати фокус там нікому, крім нас.
 *
 * Зворотний експеримент: не вертати фокус (`trigger.focus()` у `fullscreenOffer.ts`) —
 * червоніє «фокус — на кнопці».
 */
test('закрити: хрестик, Escape і клік по тлу — вікно зникає, фокус — на кнопці', async ({
	page
}) => {
	await withoutBrowserPrompt(page);
	await open(page);
	const button = page.getByTestId(BUTTON);

	for (const how of ['хрестик', 'Escape', 'тло'] as const) {
		await page.evaluate((testid) => {
			(document.activeElement as HTMLElement | null)?.blur();
			document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!.click();
		}, BUTTON);
		await expect(page.getByTestId(MODAL), how).toBeVisible();
		if (how === 'хрестик') await page.getByTestId('fullscreen-offer-close-btn').click();
		if (how === 'Escape') await page.keyboard.press('Escape');
		// Кут екрана — поза вікном посередині, тобто тло.
		if (how === 'тло') await page.mouse.click(4, 4);

		await expect(page.getByTestId(MODAL), `${how}: вікно зникає`).toHaveCount(0);
		await expect(button, `${how}: фокус — на кнопці`).toBeFocused();
		await expect(button).toHaveAttribute('aria-expanded', 'false');
	}
});

/**
 * Скарга автора 2026-09-29: «у Slovko в Chrome викликається вікно, а в нас ні». Подію тут
 * кидає сам тест, але ловить її той самий слухач першого кадру, що й справжню.
 *
 * Зворотні експерименти: «Встановити» завжди показує кроки — червоніє «вікно браузера»;
 * слухач не в `app.html`, а в лінивому модулі — червоніє той самий рядок.
 */
test('встановити: є вікно браузера — натиск іде йому, і наших кроків немає', async ({ page }) => {
	await open(page);
	// Слухач стоїть із першого кадру (`app.html`), тож подія, що прийде будь-коли, — його.
	await page.evaluate(() => {
		const calls = window as unknown as { installPrompts?: number };
		const event = new Event('beforeinstallprompt', { cancelable: true });
		Object.assign(event, {
			prompt: () => {
				calls.installPrompts = (calls.installPrompts ?? 0) + 1;
				return Promise.resolve();
			},
			userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' })
		});
		window.dispatchEvent(event);
	});

	await page.getByTestId(BUTTON).click();
	await page.getByTestId('fullscreen-offer-install-btn').click();

	await expect(page.getByTestId(MODAL)).toHaveCount(0);
	const prompts = await page.evaluate(
		() => (window as unknown as { installPrompts?: number }).installPrompts
	);
	expect(prompts, 'вікно браузера показано рівно раз').toBe(1);
});

test('встановити: вікна браузера немає — кроки для компʼютера з приміткою', async ({ page }) => {
	await withoutBrowserPrompt(page);
	await open(page);
	await page.getByTestId(BUTTON).click();
	await page.getByTestId('fullscreen-offer-install-btn').click();

	await expect(page.getByTestId('fullscreen-offer-note-text')).toBeVisible();
	await expect(page.getByTestId('fullscreen-offer-step-item')).toHaveCount(3);
	await expect(page.getByTestId('fullscreen-offer-lead-text')).toHaveCount(0);
	await expect(page.locator('#fullscreen-offer-title')).toBeFocused();
});

test.describe('iPhone', () => {
	test.use({
		userAgent: IPHONE_SAFARI,
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});

	/** Повного екрана немає; `installed` — відкрито з початкового екрана. */
	async function asIphone(page: Page, installed: boolean) {
		await page.addInitScript((standalone) => {
			for (const key of ['fullscreenEnabled', 'webkitFullscreenEnabled']) {
				Object.defineProperty(Document.prototype, key, { get: () => false, configurable: true });
			}
			if (standalone) {
				Object.defineProperty(Navigator.prototype, 'standalone', {
					get: () => true,
					configurable: true
				});
			}
		}, installed);
	}

	/**
	 * Зворотний експеримент: повернути в скрипт першого кадру стару умову (ховати, коли
	 * «не вміє») — червоніє «кнопка є».
	 */
	test('у браузері: кнопка є, і вікно одразу пояснює й показує кроки Safari', async ({ page }) => {
		await asIphone(page, false);
		await open(page);
		await expect(page.locator('html')).not.toHaveClass(/no-fullscreen/);
		const button = page.getByTestId(BUTTON);
		await expect(button, 'кнопка є').toBeVisible();

		await button.click();
		await expect(page.getByTestId('fullscreen-offer-lead-text')).toBeVisible();
		await expect(page.getByTestId('fullscreen-offer-browser-btn')).toHaveCount(0);
		await expect(page.getByTestId('fullscreen-offer-step-item')).toHaveCount(3);

		const box = (await page.getByTestId('fullscreen-offer-panel').boundingBox())!;
		expect(box.x, 'вікно не за лівим краєм').toBeGreaterThanOrEqual(0);
		expect(box.x + box.width, 'вікно не за правим краєм').toBeLessThanOrEqual(390);
		expect(box.y + box.height, 'вікно не за нижнім краєм').toBeLessThanOrEqual(844);
	});

	test('з початкового екрана: кнопки немає — запропонувати більше нічого', async ({ page }) => {
		await asIphone(page, true);
		await open(page);
		await expect(page.locator('html')).toHaveClass(/no-fullscreen/);
		await expect(page.getByTestId(BUTTON)).toBeHidden();
	});
});
