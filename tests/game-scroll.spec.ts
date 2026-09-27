import { expect, test, type Page } from './fixtures';

/**
 * ПІД ЧАС ГРИ ЕКРАН ПРИТИСНУТИЙ ДОНИЗУ (`pinToBottom`, прохання автора 2026-09-28: «якщо є
 * скрол — завжди скролити донизу, бо зверху елементи, які менш важливі, ніж ті, що знизу»).
 *
 * Юніт-тест дії (`src/lib/utils/pinToBottom.test.ts`) тримає її логіку на підробленому
 * спостерігачі. Тут — те, чого він не бачить: що на СПРАВЖНІЙ сторінці дія знаходить
 * прокрутник і що сторінка вмикає її саме на раунд без відповіді.
 *
 * Вікно 360×520: дев'ять природних зон «Де живем?» не вміщаються там навіть на дні масштабу,
 * тобто прокрутка справжня, а не підставлена. Рух у конфігу вимкнений (`reducedMotion`), тож
 * прокрутка миттєва. Натиски — з `evaluate`, а не `click()`: Playwright перед натиском сам
 * докручує до кнопки, і перевірка «новий раунд відкривається низом» проходила б через нього.
 */
test.use({ viewport: { width: 360, height: 520 } });

const scroller = (page: Page) => page.locator('.page-transition-wrapper');

/** Скільки пікселів лишилося до низу прокрутки. */
const fromBottom = (page: Page) =>
	scroller(page).evaluate((s) => Math.round(s.scrollHeight - s.clientHeight - s.scrollTop));

/** Той самий запас, що в дії (`BOTTOM_SLACK_PX`): дробові пікселі масштабу — не прокрутка. */
const SLACK_PX = 8;

async function press(page: Page, testid: string) {
	await page.evaluate((id) => {
		(document.querySelector(`[data-testid^="${id}"]`) as HTMLElement).click();
	}, testid);
}

test.describe('екран гри притиснутий донизу', () => {
	test('раунд відкривається низом; прокрутка вгору відпускає; наступний раунд — знову низом', async ({
		page
	}) => {
		await page.goto('/VetCrewGames/game-habitat/biomes/');
		await expect(page.getByTestId('habitat-check-btn')).toBeAttached();

		const overflow = await scroller(page).evaluate((s) => s.scrollHeight - s.clientHeight);
		expect(overflow, 'екран уміщається — перевіряти нічого').toBeGreaterThan(SLACK_PX * 2);
		await expect.poll(() => fromBottom(page), { timeout: 5000 }).toBeLessThanOrEqual(SLACK_PX);

		// Людина крутнула вгору — дія не тягне назад, навіть коли розкладка ворушиться.
		await scroller(page).hover();
		await page.mouse.wheel(0, -2000);
		await expect.poll(() => scroller(page).evaluate((s) => s.scrollTop)).toBe(0);
		await page.evaluate(() => window.dispatchEvent(new Event('resize')));
		await page.waitForTimeout(1500);
		expect(await scroller(page).evaluate((s) => s.scrollTop), 'дія перебила людину').toBe(0);

		/*
		 * Відповідь, розбір, і з самого верху — «Далі»: новий раунд мусить відкритися низом.
		 *
		 * Угору — коліщатком, а не присвоєнням `scrollTop`, і це не косметика. Перша редакція
		 * присвоювала, і тест проходив навіть із ключем, що не мінявся зовсім: присвоєння
		 * влучало в першу секунду після власної прокрутки дії й читалося як її власне, тож дія
		 * лишалася притиснутою й сама тягла сторінку донизу. Ввід людини це вікно закриває —
		 * саме це й перевіряється.
		 */
		await press(page, 'habitat-option-btn-');
		await press(page, 'habitat-check-btn');
		await expect(page.getByTestId('habitat-next-btn')).toBeAttached();
		await page.mouse.wheel(0, -2000);
		await expect.poll(() => scroller(page).evaluate((s) => s.scrollTop)).toBe(0);
		await page.waitForTimeout(1200);
		await press(page, 'habitat-next-btn');
		await expect(page.getByTestId('habitat-check-btn')).toBeAttached();
		await expect.poll(() => fromBottom(page), { timeout: 5000 }).toBeLessThanOrEqual(SLACK_PX);
	});
});
