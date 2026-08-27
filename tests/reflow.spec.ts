import { expect, test } from '@playwright/test';
import { APP_PAGES, expectAllRoutesListed } from './support/pages';
import { reduceMotion, settlePage } from './support/settle';

/**
 * WCAG 2.2 AA, критерій 1.4.10 Reflow: НЕМАЄ ГОРИЗОНТАЛЬНОЇ ПРОКРУТКИ НА 320 CSS PX.
 *
 * ## Що знайшлося, коли перевірку писали
 *
 * Заміряно на зібраному сайті 2026-08-28. На 320 — вимозі самого критерію —
 * сторінка проходить, і саме тому важливо, з яким запасом: рівно 16px, і весь
 * він у середній колонці шапки (`76px 16px 196px` при 304 доступних). На 280
 * запасу немає, і тринадцять сторінок із чотирнадцяти дають 16px
 * горизонтальної прокрутки — остання кнопка шапки виїжджає за екран.
 *
 * Причина — `FLUID-SIZING-v8` § 7 у чистому вигляді: сім кнопок по 36px у ряд,
 * дві флекс-групи без переносу, колонки `auto` в сітці шапки. Поступитися не було
 * кому, і рядок віддав горизонтальну прокрутку всій сторінці.
 *
 * Тобто перевірка ставиться не «щоб полагодити 320», а щоб 320 лишалося
 * пройденим: із запасом у 16px його забирає перший довший заголовок, перша нова
 * кнопка або більший системний шрифт.
 *
 * ## Чому цього не бачив жоден із чинних гейтів
 *
 * `touch-targets.spec.ts` ходить на 390×844 — там шапка вміщується з запасом.
 * `a11y.spec.ts` (axe) працює у типовому вікні Playwright і, головне, порушення
 * такого роду взагалі не бачить: axe перевіряє DOM і кольори, а не те, чи вміст
 * вилазить за viewport. Решта гейтів читає джерела, де видно лише числа.
 *
 * Тобто це рівно те, про що § 9 канону FLUID-SIZING: «Правило перевіряється в
 * браузері, бо в коді видно лише числа».
 *
 * ## Чому 320, а не 375
 *
 * 320 CSS px — число з самого критерію 1.4.10, і воно не про рідкісний телефон.
 * Ту саму ширину дає збільшення шрифту на звичайному екрані: 1280px під 400%
 * зумом — це 320 CSS px. Тобто перевірка стосується не лише iPhone SE першого
 * покоління й обкладинки Galaxy Fold.
 *
 * 280 у переліку — не вимога критерію, а запас: він показує, чи розкладка
 * ЛАМАЄТЬСЯ поступово, чи має жорстку підлогу трохи нижче 320. Різниця між цими
 * двома станами і є різниця між «вузько» й «зламано». Тут вона й знайшлася:
 * на 320 було пройдено, на 280 — ні.
 *
 * ## Межа перевірки
 *
 * Міряється стан ОДРАЗУ після переходу: відкриті меню, модалки й екрани підсумку
 * сюди не входять — та сама межа, що названа в `testid.spec.ts`. Накладки має
 * `a11y-overlays.spec.ts`, і додати їх сюди — окрема робота, а не дописаний
 * рядок.
 */

/** Ширини, на яких критерій вимагається, і одна нижча — для форми поломки. */
const NARROW = [
	{ width: 320, height: 640, why: 'ширина з критерію 1.4.10' },
	{ width: 280, height: 600, why: 'обкладинка Galaxy Fold — запас, а не вимога' }
];

test.describe('вміст переливається без горизонтальної прокрутки (WCAG 1.4.10)', () => {
	test('перелік сторінок покриває всі маршрути', () => {
		expectAllRoutesListed();
	});

	for (const { width, height, why } of NARROW) {
		test.describe(`${width}px — ${why}`, () => {
			test.use({ viewport: { width, height } });

			for (const url of APP_PAGES) {
				test(`${url}`, async ({ page }) => {
					await reduceMotion(page);
					await page.goto(url);
					/*
					 * Та сама умова спокою, що в решти браузерних перевірок. Тут вона
					 * потрібна не для кольорів: переходи `in:fly` у кореневому layout
					 * зсувають сторінку на 300px убік і дають ЧЕСНУ горизонтальну
					 * прокрутку в проміжному кадрі. Замір під анімацією червонів би на
					 * правильному коді.
					 */
					await settlePage(page);

					const measured = await page.evaluate(() => {
						const root = document.documentElement;
						const limit = root.clientWidth;
						const wide: string[] = [];
						for (const element of document.querySelectorAll('body *')) {
							// SVG всередині іконки міряти нема сенсу: він їде за
							// батьком, і його координати лише дублюють винуватця.
							if (element.closest('svg')) continue;
							const box = element.getBoundingClientRect();
							if (box.width === 0 && box.height === 0) continue;
							if (box.right > limit + 0.5 || box.left < -0.5) {
								const name = element.className
									? `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]}`
									: element.tagName.toLowerCase();
								wide.push(`${name} [${Math.round(box.left)}..${Math.round(box.right)}]`);
							}
						}
						return {
							overflow: root.scrollWidth - limit,
							clientWidth: limit,
							elements: [...new Set(wide)].slice(0, 6)
						};
					});

					// Канарка на сам замір: емуляція вікна могла не доїхати, і тоді
					// «прокрутки немає» означало б «міряли десктоп»
					// (AI-AGENT-PITFALLS-v8 § 1).
					expect(
						measured.clientWidth,
						`вікно не звузилося: міряли ${measured.clientWidth}px замість ${width}`
					).toBeLessThanOrEqual(width);

					expect(
						measured.overflow,
						`сторінка їде вбік на ${measured.overflow}px; за межами вікна:\n${measured.elements.join('\n')}`
					).toBeLessThanOrEqual(0);
				});
			}
		});
	}
});
