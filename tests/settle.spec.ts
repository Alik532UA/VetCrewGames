import { expect, test } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * УМОВА СПОКОЮ ЧЕКАЄ ГІДРАЦІЮ — і тоді, коли модулі JS приходять повільно.
 *
 * `settlePage` — спільна умова для всіх гейтів, що міряють намальоване (axe, замір
 * контрасту, розкладка). Пререндер виглядає осілим: анімацій немає, прозорості стоять,
 * обгортка непрозора. Коли прев'ю-сервер зайнятий повним прогоном, модулі приходять
 * пізно, і без очікування на гідрацію умова справджувалася ще на пререндері. Так вийшов
 * флейк `contrast-runtime` 2026-09-28: «назад» і «додому» шапки заміряно посеред їхнього
 * `in:fade` (2.18 : 1 у `light-green`, `#13371b` на прозорості 0,55). Окремий прогін
 * того самого файлу був зелений, бо сервер тоді не був зайнятий, — тому тут затримку
 * ставить сам тест, і випадок відтворюється щоразу.
 *
 * Сторінка — «Грати» (`/play/`): шапку вона забирає в `onMount`, як і решта, а з базою не
 * з'єднується, тож прогін не витрачає анонімних входів.
 *
 * Зворотний експеримент: без `waitForHydration` у `settlePage` тест червоніє — кнопки
 * «назад» ще немає, на її місці схований заповнювач пререндера.
 */
test('модулі JS із затримкою: після settlePage шапка вже гідрована й нерухома', async ({
	page
}) => {
	await reduceMotion(page);
	await page.route('**/_app/immutable/**/*.js', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 800));
		await route.continue();
	});

	await page.goto('/VetCrewGames/play/');
	await settlePage(page);

	const header = await page.evaluate(() => {
		const back = document.querySelector('[data-testid="header-back-link"]');
		return {
			backLink: back !== null,
			opacity: back?.parentElement ? getComputedStyle(back.parentElement).opacity : null,
			running: document
				.getAnimations()
				.filter(
					(animation) =>
						animation.effect?.getTiming().iterations !== Infinity &&
						(animation.pending || animation.playState === 'running')
				).length
		};
	});
	expect(header).toEqual({ backLink: true, opacity: '1', running: 0 });
});
