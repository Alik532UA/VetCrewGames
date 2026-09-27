import { expect, test, type Page } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * PWA НА ЗІБРАНОМУ САЙТІ: воркер, офлайн і маніфест.
 *
 * Логіку воркера тримає `src/lib/pwa/cache.test.ts` без браузера. Тут — те, що існує лише в
 * справжньому браузері: реєстрація в межах `/VetCrewGames/`, керування сторінкою, кеш,
 * який переживає обрив мережі, і маніфест, який браузер справді прочитає.
 *
 * Офлайн перевіряє сам себе: сторінка, де ще не були, мусить відкрити ГОЛОВНУ. Якби
 * емуляція обриву не доходила до воркера, та сторінка відкрилася б мережею — і тест упав би,
 * замість того щоб зеленіти на справжній мережі.
 */

const HOME = '/VetCrewGames/';

/** Воркер активний (встановлення з кешем стартових сторінок скінчене) і керує сторінкою. */
async function workerReady(page: Page) {
	await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
	await expect
		.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''))
		.toMatch(/\/VetCrewGames\/service-worker\.js$/);
}

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
});

test('воркер реєструється в межах /VetCrewGames/ і бере сторінку під керування', async ({
	page
}) => {
	await page.goto(HOME);
	await settlePage(page);
	await workerReady(page);
	const state = await page.evaluate(async () => ({
		scope: (await navigator.serviceWorker.ready).scope,
		caches: await caches.keys()
	}));
	expect(new URL(state.scope).pathname).toBe(HOME);
	expect(state.caches.length).toBeGreaterThan(0);
	for (const name of state.caches) expect(name).toMatch(/^vetcrewgames_sw_/);
});

test('без мережі відкривається головна й сторінка, де вже були, а нова — веде на головну', async ({
	page,
	context
}) => {
	await page.goto(HOME);
	await settlePage(page);
	await workerReady(page);
	// Під керуванням воркера — отже й у кеш.
	await page.goto('/VetCrewGames/play/');
	await settlePage(page);

	await context.setOffline(true);
	try {
		await page.goto(HOME);
		await expect(page.locator('main')).toBeVisible();
		await page.goto('/VetCrewGames/play/');
		await expect(page.locator('main')).toBeVisible();
		expect(new URL(page.url()).pathname).toBe('/VetCrewGames/play/');

		await page.goto('/VetCrewGames/game-family/');
		await expect(page.locator('main')).toBeVisible();
		expect(new URL(page.url()).pathname, 'сторінку без копії мусить вести на головну').toBe(HOME);

		// Файли версії — повз кеш: без мережі їх немає, а не «та сама версія».
		const version = await page.evaluate(() =>
			fetch('/VetCrewGames/_app/version.json').then(
				() => 'відповідь',
				() => 'обрив'
			)
		);
		expect(version).toBe('обрив');
	} finally {
		await context.setOffline(false);
	}
});

test('маніфест: той самий застосунок після кожного деплою, значки на місці', async ({ page }) => {
	await page.goto(HOME);
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	const url = new URL(href!, page.url());
	expect(url.pathname).toBe('/VetCrewGames/manifest.webmanifest');

	const response = await page.request.get(url.href);
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	const start = new URL(manifest.start_url, url);
	expect(start.pathname).toBe(HOME);
	expect(new URL(manifest.scope, url).pathname).toBe(HOME);
	expect(new URL(manifest.id, start).pathname).toBe(HOME);

	for (const icon of manifest.icons as { src: string }[]) {
		const image = await page.request.get(new URL(icon.src, url).href);
		expect(image.ok(), icon.src).toBe(true);
		expect(image.headers()['content-type'], icon.src).toContain('image/png');
	}
});
