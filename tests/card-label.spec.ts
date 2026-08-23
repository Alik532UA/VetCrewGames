import { expect, test, type Page } from '@playwright/test';

/**
 * Підпис картки не має права розсувати картку.
 *
 * ## Дефект, через який цей файл існує
 *
 * Скарга автора зі скріншотами: довга назва робила картку ШИРШОЮ за її слот —
 * заміряно 118.78px картки в 110px слоті. Картка визирала з-під рамки й штовхала
 * сусідів у рядку. Найдовші назви трапляються в німецькій і нідерландській:
 * `Stachelschwein`, `Reuzenmiereneter`, `Manoel (pallaskat)`.
 *
 * Причина була структурна: картка — елемент сітки, а елемент сітки типово не може
 * стати вужчим за свій `min-content`, і для нерозривного слова цей мінімум і є
 * ширина слова.
 *
 * ## Що перевіряється тут, а що юнітом
 *
 * Арифметику масштабу перевіряє `src/lib/utils/labelScale.test.ts` — там межі,
 * крок і дно. Браузер потрібен для іншого, і саме це вимога автора:
 *
 *   картка не виїжджає за слот НІКОЛИ;
 *   кегль зменшується САМЕ ТОДІ, коли текст не вміщається;
 *   кегль НЕ зменшується, коли текст уміщається.
 *
 * ## «Вміщається» міряється при БАЗОВОМУ кеглі, і це головна тонкість файлу
 *
 * Перша редакція питала `scrollWidth <= clientWidth` як є — тобто ВЖЕ ПІСЛЯ
 * зменшення. Для довгої назви це давало «вміщається», і перевірка вимагала від неї
 * базового кегля: тест падав на `Reuzenmiereneter: 12px`, тобто на цілком
 * правильному коді. Тому `readLabels` знімає масштаб, міряє природну ширину й
 * повертає масштаб назад — так само, як це робить сама дія.
 */

/** Базовий кегль підпису — `--font-size-md`, тобто 1rem. */
const BASE_FONT_PX = 16;

/**
 * Наскільки звузити слот, щоб не вміщалася ЖОДНА назва.
 *
 * Число заміряне, а не вибране. Перша редакція брала 40px — і тест плавав: при
 * такому слоті підпису лишається близько 20px, а найкоротші назви («Bij», «Kip»,
 * «Mol») у 16px займають ~19px, тобто ВМІЩАЮТЬСЯ. Прогін падав лише тоді, коли в
 * раунд трапилася коротка назва, і повідомлення казало «Bij: 16px, слот 40.0px» —
 * тобто код був правий, а тест ні.
 *
 * При 24px доступного місця лишаються одиниці пікселів: не вміщається нічого.
 */
const NARROW_SLOT_CSS = '.game-container { max-width: 24px !important; }';

interface LabelState {
	name: string;
	slotWidth: number;
	cardWidth: number;
	fontSize: number;
	/** Чи вміщався б рядок при БАЗОВОМУ кеглі. Саме це і є «вміщається». */
	fitsAtBase: boolean;
	whiteSpace: string;
}

async function readLabels(page: Page): Promise<LabelState[]> {
	return page.$$eval('.game-card', (cards) =>
		cards.map((card) => {
			const slot = card.closest('.game-container') as HTMLElement;
			const text = card.querySelector('.game-card__name-text') as HTMLElement;
			const cs = getComputedStyle(text);

			/*
			 * Знімаємо масштаб, міряємо, повертаємо — усе синхронно, тож браузер між
			 * цими рядками не малює і блимання не буде. Це той самий прийом, яким
			 * міряє сама дія: природну ширину рядка видно лише при кеглі 1.
			 */
			const savedScale = text.style.getPropertyValue('--label-scale');
			const savedWrap = text.style.getPropertyValue('--label-wrap');
			text.style.removeProperty('--label-scale');
			text.style.removeProperty('--label-wrap');
			const natural = text.scrollWidth;
			const available = (text.parentElement as HTMLElement).clientWidth;
			if (savedScale) text.style.setProperty('--label-scale', savedScale);
			if (savedWrap) text.style.setProperty('--label-wrap', savedWrap);

			return {
				name: (text.textContent ?? '').trim(),
				slotWidth: slot.getBoundingClientRect().width,
				cardWidth: card.getBoundingClientRect().width,
				fontSize: parseFloat(cs.fontSize),
				// Той самий запас в один піксель, що в `labelScale.ts`.
				fitsAtBase: natural <= available - 1,
				whiteSpace: cs.whiteSpace
			};
		})
	);
}

/**
 * Перелік заміряного — щоб повідомлення про невдачу було самодостатнім.
 *
 * `expect.poll(...).toBe(true)` при падінні каже лише «expected true, received
 * false», і плаваюче падіння лишається без жодних чисел. Саме через це перші
 * редакції цих перевірок довелося ловити наосліп; із числами причина знайшлася з
 * першого падіння.
 */
function report(labels: LabelState[]): string {
	return labels
		.map(
			(l) =>
				`${l.name}: ${l.fontSize}px, слот ${l.slotWidth.toFixed(1)}px, ` +
				`${l.fitsAtBase ? 'вміщається' : 'НЕ вміщається'}`
		)
		.join('; ');
}

/**
 * Нідерландська: саме там найдовші назви, і саме на ній автор побачив дефект.
 *
 * Кінцева коса обов'язкова: без неї preview статичного адаптера віддає підказку
 * «did you mean …/?» замість сторінки, і перша редакція цього файлу падала на
 * «карток немає» — не тому, що щось зламано.
 */
async function openGame(page: Page) {
	await page.goto('/VetCrewGames/nl/game-population/');
	await expect(page.locator('.game-card').first()).toBeVisible();
	await page.evaluate(() => document.fonts?.ready);
}

test.describe('підпис картки', () => {
	test('картка не ширша за свій слот', async ({ page }) => {
		await openGame(page);
		const labels = await readLabels(page);

		expect(labels.length, 'карток на екрані немає — перевіряти нічого').toBeGreaterThan(0);
		for (const l of labels) {
			// Пів пікселя допуску: обидві ширини дробові.
			expect(
				l.cardWidth,
				`«${l.name}»: картка ${l.cardWidth.toFixed(2)}px у слоті ${l.slotWidth.toFixed(2)}px`
			).toBeLessThanOrEqual(l.slotWidth + 0.5);
		}
	});

	/**
	 * Головна перевірка файлу — рівно вимога автора, обидві її половини.
	 *
	 * Працює на будь-якій трійці тварин: короткі назви перевіряють «не зменшувати»,
	 * довгі — «зменшити». Нічого підмінювати не треба.
	 *
	 * Опитування, а не одне читання: вимір у дії відкладений на ~140 мс після того,
	 * як розкладка вгамувалася (`SETTLE_MS`), тож стан приходить не в тому кадрі, у
	 * якому з'явилися картки.
	 */
	test('кегль зменшується тільки тоді, коли текст не вміщається', async ({ page }) => {
		await openGame(page);

		await expect
			.poll(
				async () => {
					const labels = await readLabels(page);
					if (labels.length === 0) return 'карток немає';
					const wrong = labels.filter((l) =>
						l.fitsAtBase ? l.fontSize !== BASE_FONT_PX : l.fontSize >= BASE_FONT_PX
					);
					return wrong.length === 0 ? 'усе за правилом' : report(wrong);
				},
				{ timeout: 10_000 }
			)
			.toBe('усе за правилом');
	});

	/**
	 * Слот звужується так, що не вміщається жодна назва — механізм під тиском.
	 *
	 * `!important` обов'язковий: `max-width` слота задано в компоненті, і без нього
	 * правило з тесту програє за специфічністю, а тест лишиться зеленим, не
	 * перевіривши нічого.
	 */
	test('коли місця стає обмаль, зменшуються всі — і картка все одно в межах слота', async ({
		page
	}) => {
		await openGame(page);
		await page.addStyleTag({ content: NARROW_SLOT_CSS });

		await expect
			.poll(
				async () => {
					const big = (await readLabels(page)).filter((l) => l.fontSize >= BASE_FONT_PX);
					return big.length === 0 ? 'усі зменшені' : report(big);
				},
				{ timeout: 10_000 }
			)
			.toBe('усі зменшені');

		const after = await readLabels(page);
		for (const l of after) {
			expect(
				l.cardWidth,
				`«${l.name}»: картка ${l.cardWidth.toFixed(2)}px у слоті ${l.slotWidth.toFixed(2)}px`
			).toBeLessThanOrEqual(l.slotWidth + 0.5);
		}

		/*
		 * На такому слоті дна масштабу не досить нікому, тож підпис мусить перейти в
		 * два рядки. Обрізане «Reuzenmierenet…» у грі, де тварину впізнають за
		 * назвою, гірше за дрібний шрифт у два рядки.
		 */
		expect(
			after.every((l) => l.whiteSpace === 'normal'),
			`на дні масштабу підпис мусить переноситися: ${report(after)}`
		).toBe(true);
	});

	/**
	 * Масштаб не «залипає»: коли місце повертається, повертається й кегль.
	 *
	 * Порівнюється з ТИМ, ЩО БУЛО, а не з базовим кеглем. Довга назва
	 * (`Reuzenmiereneter`) законно лишається зменшеною й при звичайному слоті —
	 * саме на цьому падала перша редакція цієї перевірки.
	 *
	 * Дефект, від якого це стереже, справжній і знайдений тут: спостерігач стояв на
	 * самому підписі, а його ширина для короткої назви дорівнює ширині ТЕКСТУ,
	 * тобто від розширення картки не змінюється зовсім. Зменшений кегль лишався
	 * назавжди — і залежало це від довжини слова.
	 */
	test('коли місце повертається, кегль повертається до того, що був', async ({ page }) => {
		await openGame(page);

		// Знімок «як було» — уже після того, як дія відпрацювала перший вимір.
		await expect
			.poll(async () => (await readLabels(page)).length, { timeout: 5000 })
			.toBeGreaterThan(0);
		await page.waitForTimeout(400);
		const before = await readLabels(page);

		const narrow = await page.addStyleTag({ content: NARROW_SLOT_CSS });
		await expect
			.poll(async () => (await readLabels(page)).every((l) => l.fontSize < BASE_FONT_PX), {
				timeout: 10_000
			})
			.toBe(true);

		await narrow.evaluate((node) => (node as HTMLElement).remove());
		await expect
			.poll(
				async () => {
					const now = await readLabels(page);
					const stuck = now.filter((l, i) => l.fontSize !== before[i]?.fontSize);
					return stuck.length === 0 ? 'усі повернулися' : report(stuck);
				},
				{ timeout: 10_000 }
			)
			.toBe('усі повернулися');
	});
});
