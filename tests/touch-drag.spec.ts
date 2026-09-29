import { expect, test, type Locator, type Page } from './fixtures';

/**
 * ПЕРЕТЯГУВАННЯ ПАЛЬЦЕМ У «ЩО ЇМО?» (прохання автора 2026-09-29: «Drag and Drop працює в „Кого
 * більше?“ і не працює в „Що їмо?“»).
 *
 * HTML5 drag-and-drop на сенсорному екрані не спрацьовує зовсім, тож «Що їмо?» на телефоні
 * вміло лише «торкнись страви — торкнись зони». Тепер страву можна й перетягнути
 * (`utils/touchDrag.ts`). Перевіряється справжніми подіями дотику (CDP `Input.dispatchTouchEvent`)
 * на контексті з сенсорним екраном, а не мишею: саме мишею воно працювало й доти.
 *
 * Зворотні експерименти: зняти `use:touchDrag` зі страви на столі — червоніють обидві перевірки
 * перетягування; зі страви в зоні — «перекласти»; зняти `data-drop-zone` із зони тварини —
 * обидві. Два інші дефекти тут НЕ видно, і це заміряно: не гасити клік після перетягування (Chrome
 * після руху за межу торкання кліку й так не дає) і кидати без перетягування (зона під пальцем
 * перемальовується, і клік падає не туди). Їх тримає юніт `src/lib/utils/touchDrag.test.ts`.
 */
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

/**
 * Провести пальцем від середини одного елемента до середини іншого. `during` — що зробити,
 * поки палець ще на екрані (копія під пальцем існує лише тоді).
 */
async function drag(
	page: Page,
	from: Locator,
	to: Locator | { x: number; y: number },
	during?: () => Promise<void>
) {
	const start = await from.boundingBox();
	const end = 'boundingBox' in to ? await to.boundingBox() : { ...to, width: 0, height: 0 };
	if (!start || !end) throw new Error('немає розміру в того, що тягнуть, чи там, куди');
	const a = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
	const b = { x: end.x + end.width / 2, y: end.y + end.height / 2 };

	const cdp = await page.context().newCDPSession(page);
	const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
		cdp.send('Input.dispatchTouchEvent', {
			type,
			touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }]
		});
	await touch('touchStart', a.x, a.y);
	for (let step = 1; step <= 12; step += 1) {
		await touch('touchMove', a.x + ((b.x - a.x) * step) / 12, a.y + ((b.y - a.y) * step) / 12);
	}
	await during?.();
	await touch('touchEnd', b.x, b.y);
	await cdp.detach();
}

async function openFeeding(page: Page) {
	await page.goto('/VetCrewGames/game-feeding/');
	await expect(page.locator('[data-testid^="feeding-dish-btn-"]').first()).toBeVisible();
	await page.evaluate(() => document.fonts?.ready);
	// Масштаб сторінки гри лягає з відкладенням (`fitToViewport`): рамки міряти після нього.
	await page.waitForTimeout(400);
}

/** Перша страва на столі й її ідентифікатор. */
async function firstDish(page: Page) {
	const dish = page.locator('[data-testid^="feeding-dish-btn-"]').first();
	const id = (await dish.getAttribute('data-testid'))!.replace('feeding-dish-btn-', '');
	return { dish, id };
}

test.describe('перетягування пальцем у «Що їмо?»', () => {
	test('страву зі столу перетягують пальцем до тварини', async ({ page }) => {
		await openFeeding(page);
		const { dish, id } = await firstDish(page);
		const zone = page.getByTestId('feeding-zone-animal-0');

		await drag(page, dish, zone);

		await expect(zone.getByTestId(`feeding-zone-animal-0-plated-btn-${id}`)).toBeVisible();
		await expect(page.getByTestId(`feeding-dish-btn-${id}`), 'страва пішла зі столу').toHaveCount(
			0
		);
		await expect(page.locator('.touch-drag-clone'), 'копія під пальцем прибрана').toHaveCount(0);
	});

	test('покладену страву пальцем перекладають в іншу зону', async ({ page }) => {
		await openFeeding(page);
		const { dish, id } = await firstDish(page);
		await drag(page, dish, page.getByTestId('feeding-zone-animal-0'));
		const plated = page.getByTestId(`feeding-zone-animal-0-plated-btn-${id}`);
		await expect(plated).toBeVisible();

		const other = page.getByTestId('feeding-zone-animal-1');
		await drag(page, plated, other);

		await expect(other.getByTestId(`feeding-zone-animal-1-plated-btn-${id}`)).toBeVisible();
		await expect(plated, 'у першій зоні страви більше немає').toHaveCount(0);
	});

	test('торкання лишається торканням: торкнутися страви, потім зони', async ({ page }) => {
		await openFeeding(page);
		const { dish, id } = await firstDish(page);
		await dish.tap();
		await page.getByTestId('feeding-zone-animal-1').tap();

		await expect(page.getByTestId(`feeding-zone-animal-1-plated-btn-${id}`)).toBeVisible();
	});

	test('відпустити поза зонами — нічого не кладеться, страва лишається на столі', async ({
		page
	}) => {
		await openFeeding(page);
		const { dish, id } = await firstDish(page);
		const header = await page.locator('.game-header').boundingBox();
		if (!header) throw new Error('немає шапки');

		await drag(page, dish, { x: header.x + header.width / 2, y: header.y + header.height + 4 });

		await expect(page.getByTestId(`feeding-dish-btn-${id}`)).toBeVisible();
		await expect(page.locator(`[data-testid$="-plated-btn-${id}"]`)).toHaveCount(0);
	});

	/**
	 * Торкання страви в зоні, коли в руках інша, кладе ту, що в руках, — і нічого не бере.
	 * Кидок без перетягування (зону натиснуто й на простому торканні) спершу поклав би страву
	 * з рук, а потім клік узяв би ту, якої торкнулися.
	 */
	test('торкання страви в зоні зі стравою в руках — кладе ту, що в руках', async ({ page }) => {
		await openFeeding(page);
		const first = await firstDish(page);
		await drag(page, first.dish, page.getByTestId('feeding-zone-animal-0'));
		const plated = page.getByTestId(`feeding-zone-animal-0-plated-btn-${first.id}`);
		await expect(plated).toBeVisible();

		const second = await firstDish(page);
		await second.dish.tap();
		await plated.tap();

		await expect(page.getByTestId(`feeding-zone-animal-0-plated-btn-${second.id}`)).toBeVisible();
		await expect(page.locator('.dish--picked, .plated--picked'), 'нічого не в руках').toHaveCount(
			0
		);
	});
});

/**
 * «КОГО БІЛЬШЕ?» — ТЕ, ЩО ВЖЕ ПРАЦЮВАЛО, НЕ ЗЛАМАНО. Стиль копії під пальцем (`.touch-drag-clone`)
 * переїхав зі стилів `PopulationBoard` у `global.css`, щоб його бачив і «Що їмо?». Копія мусить
 * лишитися фіксованою над сторінкою, а картка — лягти в слот.
 *
 * Зворотний експеримент: прибрати правило з `global.css` — червоніє «копія фіксована».
 */
test.describe('перетягування пальцем у «Кого більше?»', () => {
	test('картку перетягують пальцем у слот, і копія під пальцем фіксована', async ({ page }) => {
		await page.goto('/VetCrewGames/game-population/');
		const card = page.locator('[data-source-index="0"] [data-drag-animal]');
		await expect(card).toBeVisible();
		await page.evaluate(() => document.fonts?.ready);
		await page.waitForTimeout(400);
		const id = await card.getAttribute('data-drag-animal');
		const slot = page.locator('[data-slot-index="0"]');

		let position = '';
		await drag(page, card, slot, async () => {
			position = await page.evaluate(() => {
				const clone = document.querySelector('.touch-drag-clone');
				return clone ? getComputedStyle(clone).position : 'копії немає';
			});
		});

		expect(position, 'копія фіксована').toBe('fixed');
		await expect(slot.locator(`[data-drag-animal="${id}"]`)).toBeVisible();
	});
});
