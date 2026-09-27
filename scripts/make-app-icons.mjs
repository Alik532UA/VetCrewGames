/**
 * ЗНАЧКИ ЗАСТОСУНКУ (PWA) з `static/favicon.svg` — запуск руками після зміни значка:
 *
 *     node scripts/make-app-icons.mjs
 *
 * Малює Chromium із Playwright, що вже стоїть для e2e: окремої залежності для растру не
 * треба. PNG кладуться в `static/icons/` і комітяться — збірка їх не генерує.
 *
 * Чому чотири й такі:
 *  * 192 і 512 `any` — те, що Android і Chrome беруть для встановленого застосунку;
 *  * 512 `maskable` — Android обрізає значок своєю формою (коло, «сквіркл»), і все
 *    важливе мусить лежати в безпечному колі на 80 % сторони. Звідси менший масштаб;
 *  * 180 `apple-touch-icon` — iPhone читає лише його. Непрозорий: прозорість iOS
 *    заливає чорним, і мордочка лягла б на чорне.
 * Тло світле, бо значок коричневий: на темному тлі темної теми він зникав би.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BACKGROUND = '#f2f5ec';
const ICONS = [
	{ file: 'icon-192.png', size: 192, scale: 0.86 },
	{ file: 'icon-512.png', size: 512, scale: 0.86 },
	{ file: 'icon-maskable-512.png', size: 512, scale: 0.7 },
	{ file: 'apple-touch-icon.png', size: 180, scale: 0.8 }
];

const svg = readFileSync('static/favicon.svg', 'utf8');
mkdirSync('static/icons', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const { file, size, scale } of ICONS) {
	const inner = Math.round(size * scale);
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<!doctype html><body style="margin:0;width:${size}px;height:${size}px;display:grid;` +
			`place-items:center;background:${BACKGROUND}">` +
			svg.replace('<svg ', `<svg style="width:${inner}px;height:${inner}px" `) +
			'</body>'
	);
	await page.screenshot({
		path: `static/icons/${file}`,
		clip: { x: 0, y: 0, width: size, height: size }
	});
}
await browser.close();
