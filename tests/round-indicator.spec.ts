import { expect, test } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * СМУЖКА ПОСТУПУ НЕ ЗСУВАЄ ДОШКУ (2026-09-26).
 *
 * У соло-грі відповідані сегменти — кнопки з полем дотику 44px (перегляд минулих
 * питань), а до першої відповіді кнопок у ряду немає. Доти смужка мала там 6px і після
 * першої відповіді виростала до 44px: дошка під нею стрибала вниз на ~38px саме тоді,
 * коли людина тягнулася до «Далі». Заміряно в браузері: верх дошки 226 → 264px.
 *
 * Міряється «Хто з іншої родини?»: відповідь там — один дотик по тварині.
 *
 * Зворотний експеримент: прибрати `min-height` у `.segments-wrapper--review` — червоніє.
 */
test('перша відповідь не зсуває дошку під смужкою поступу', async ({ page }) => {
	await reduceMotion(page);
	await page.goto('/VetCrewGames/game-family/');
	await settlePage(page);

	const bar = page.getByTestId('round-indicator-container');
	const animals = page.locator('[data-testid^="family-animal-btn-"]');
	// Міряється НЕ та тварина, яку натиснуть: вибрана може змінити власний вигляд.
	const witness = animals.nth(1);
	const measure = async () => ({
		bar: Math.round((await bar.boundingBox())?.height ?? -1),
		board: Math.round((await witness.boundingBox())?.y ?? -1)
	});

	const before = await measure();
	await animals.first().click();
	await expect(page.getByTestId('round-review-1-btn')).toBeVisible();
	const after = await measure();

	expect(before.bar, 'смужка з першого питання — висоти кнопки').toBeGreaterThanOrEqual(44);
	expect(after, 'після першої відповіді нічого не зсунулося').toEqual(before);
});
