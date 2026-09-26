import { expect, test } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ПОЛЕ «ЗНАЙДИ ПАРУ» ВЛАЗИТЬ У ЕКРАН ЦІЛКОМ (прохання автора 2026-09-26).
 *
 * На знімку автора з iPhone пʼятий ряд карток стояв за краєм, і гратися можна було
 * лише гортаючи, — а гра саме про те, щоб памʼятати, де що лежить. Розмір карток
 * тепер рахує `MemoryDeck` від коробки дошки, і ширина, і висота.
 *
 * Міряється соло-сторінка: онлайн-дошка стоїть за кімнатою, до якої e2e не доходить,
 * але малює її той самий компонент.
 *
 * Зворотний експеримент: повернути дошці ширину без висотної межі — червоніють
 * телефонні розміри.
 */

const FITS = [
	{ width: 390, height: 664, why: 'iPhone із панелями Safari — розмір зі знімка автора' },
	{ width: 375, height: 667, why: 'iPhone SE' },
	{ width: 844, height: 390, why: 'телефон боком' },
	{ width: 768, height: 1024, why: 'планшет' },
	{ width: 1366, height: 657, why: 'ноутбук із панелями браузера' },
	{ width: 1920, height: 950, why: 'монітор' }
];

/** Нижня межа картки: менша тварину вже не показує (`MemoryDeck`). */
const CARD_FLOOR = 56;

async function measure(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const cards = [...document.querySelectorAll('[data-testid^="memory-card-btn-"]')].map((card) =>
			card.getBoundingClientRect()
		);
		const scroller = document.querySelector('.page-transition-wrapper');
		return {
			count: cards.length,
			narrowest: Math.min(...cards.map((box) => box.width)),
			lowest: Math.max(...cards.map((box) => box.bottom)),
			viewport: window.innerHeight,
			scroll: scroller ? scroller.scrollHeight - scroller.clientHeight : -1
		};
	});
}

test.describe('поле «Знайди пару» на екрані цілком', () => {
	for (const { width, height, why } of FITS) {
		test.describe(`${width}×${height} — ${why}`, () => {
			test.use({ viewport: { width, height } });

			test('усі картки видно без прокрутки', async ({ page }) => {
				await reduceMotion(page);
				await page.goto('/VetCrewGames/game-memory/');
				await settlePage(page);

				const measured = await measure(page);
				expect(measured.count, 'перевірка жива: картки на дошці є').toBeGreaterThan(0);
				expect(
					measured.lowest,
					`нижній ряд закінчується на ${Math.round(measured.lowest)}px при вікні ${measured.viewport}px`
				).toBeLessThanOrEqual(measured.viewport);
				expect(measured.scroll, 'сторінка прокручується').toBeLessThanOrEqual(0);
				expect(measured.narrowest, 'картка менша за межу впізнавання').toBeGreaterThanOrEqual(
					CARD_FLOOR - 0.5
				);
			});
		});
	}

	/**
	 * НАЙМЕНШИЙ ТЕЛЕФОН — ДНО, А НЕ ДРІБНІШЕ. На 320×568 поле з картками на межі
	 * впізнавання вже не влазить, і тоді чесна прокрутка краща за картку, на якій
	 * тварину не видно (від 50px проєкт відмовився, коміт 4f6fc89).
	 */
	test.describe('320×568 — найменший iPhone', () => {
		test.use({ viewport: { width: 320, height: 568 } });

		test('картка не меншає за межу впізнавання', async ({ page }) => {
			await reduceMotion(page);
			await page.goto('/VetCrewGames/game-memory/');
			await settlePage(page);

			const measured = await measure(page);
			expect(measured.count, 'перевірка жива: картки на дошці є').toBeGreaterThan(0);
			expect(measured.narrowest).toBeGreaterThanOrEqual(CARD_FLOOR - 0.5);
		});
	});
});
