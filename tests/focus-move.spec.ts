import { expect, test } from '@playwright/test';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ФОКУС: ПОСИЛАННЯ «ДО ВМІСТУ» І ПЕРЕХІД МІЖ СТОРІНКАМИ (ACCESSIBILITY-v9 § 3).
 *
 * ## Що знайшлося, коли перевірку писали
 *
 * Заміряно у прев'ю ЗІБРАНОГО сайту 2026-09-11, до правки, двома вимірами:
 *
 *   `document.getElementById('main-content').focus()` → `activeElement` лишався
 *   `BODY`. У `<main>` не було `tabindex`, тож приймати фокус він не міг зовсім;
 *
 *   клік по самому посиланню `href="#main-content"` → те саме: `BODY`.
 *
 * Тобто посилання прокручувало сторінку й лишало фокус у шапці, а наступний Tab
 * вів назад у шапку. Обхід не обходив нічого — при тому, що весь сенс WCAG 2.4.1
 * («Bypass Blocks») рівно в цьому.
 *
 * Друга половина — перехід між сторінками. Він клієнтський, тобто DOM
 * підмінюється під фокусом: посилання, на якому фокус стояв, зникає, і фокус
 * падає на `body`. Читалка не оголошує нічого (для неї сторінка «не
 * змінилася»), а наступний Tab починається з початку документа.
 *
 * ## Чому цього не бачив жоден чинний гейт
 *
 * axe міряє ЗНІМОК сторінки: DOM, роли, кольори. Поведінка фокуса після
 * переходу — не властивість знімка, і жодне правило axe її не описує. `svelte-check`
 * бачить розмітку без `tabindex` як цілком правильну (нею вона і є — доти, доки
 * хтось не спробує навести туди фокус). Інваріанти по джерелах бачать рядки, а
 * не те, куди фокус СПРАВДІ поїхав.
 *
 * Тобто це рівно той клас, для якого існує браузерна перевірка: стан, якого в
 * коді не видно.
 *
 * ## Три твердження, і третє важливе не менше за перші два
 *
 * Фокус мусить переїжджати на переході — і НЕ мусить на першому показі
 * сторінки: там людина могла вже почати натискати, і забрати в неї фокус
 * означало б зламати те, що працювало. Тому «не переїжджає при повному
 * завантаженні» стоїть тут окремим тестом, а не приміткою.
 */

const MAIN = '#main-content';

const activeDescription = () =>
	// Опис, а не сам елемент: `activeElement` через межу браузера не передати.
	`${document.activeElement?.tagName ?? '(none)'}${
		document.activeElement?.id ? `#${document.activeElement.id}` : ''
	}`;

test.describe('переїзд фокуса', () => {
	/*
	 * `reduceMotion` викликається явно, як у решті спеків: значення в
	 * `playwright.config.ts` до `matchMedia` сторінки тут не доходить, і
	 * `settlePage` це помічає першим твердженням. Без емуляції перехід сторінки
	 * триває 800 мс, і фокус перевірявся б посеред анімації.
	 */
	test.beforeEach(async ({ page }) => {
		await reduceMotion(page);
	});

	test('посилання «до вмісту» справді ставить фокус у <main>', async ({ page }) => {
		await page.goto('/VetCrewGames/');
		await settlePage(page);

		const main = page.locator(MAIN);
		await expect(main, 'сторінка не та: <main id="main-content"> не знайдено').toHaveCount(1);
		await expect(
			main,
			'без tabindex="-1" елемент не приймає фокус, і посилання «до вмісту» лишається декорацією'
		).toHaveAttribute('tabindex', '-1');

		const skip = page.locator('a.skip-link');
		await expect(skip, 'посилання «до вмісту» не знайдено').toHaveCount(1);
		await expect(skip).toHaveAttribute('href', MAIN);

		// Саме клавіатурою: посилання видиме лише у фокусі, і шлях людини такий самий.
		await skip.focus();
		await page.keyboard.press('Enter');

		await expect
			.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), {
				message: 'фокус не переїхав у <main> — обхід шапки не працює (WCAG 2.4.1)'
			})
			.toBe('main-content');
	});

	test('перехід між сторінками переносить фокус у новий вміст', async ({ page }) => {
		await page.goto('/VetCrewGames/');
		await settlePage(page);

		/*
		 * Перехід саме КЛІКОМ по посиланню, а не `page.goto`: другий — це повне
		 * завантаження, тобто інший випадок (він перевіряється нижче). Дефект
		 * живе рівно там, де DOM підмінюється під фокусом.
		 *
		 * Локатор — за `data-testid`, і це не стиль, а виправлення. Спершу тут
		 * стояло `a[href="/VetCrewGames/quiz/"]`, і перевірка падала «через раз»:
		 * у пререндері адреса ВІДНОСНА (`./quiz/`), а абсолютною вона стає лише
		 * після гідрації, коли `langPath()` перерахує її з `base`. Тобто локатор
		 * міряв не наявність посилання, а те, чи встигла гідрація.
		 */
		const link = page.getByTestId('menu-quiz-link');
		await expect(link, 'посилання на «Вікторину» не знайдено — меню змінилося').toHaveCount(1);
		await link.focus();
		await link.click();

		await expect(page).toHaveURL(/\/VetCrewGames\/quiz\/$/);
		await expect
			.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), {
				message:
					'після переходу фокус лишився на зниклому посиланні або впав на body — ' +
					'читалка не оголосить нову сторінку, а наступний Tab почнеться з шапки'
			})
			.toBe('main-content');
	});

	test('повне завантаження фокус НЕ забирає', async ({ page }) => {
		await page.goto('/VetCrewGames/reserve/');
		await settlePage(page);

		const active = await page.evaluate(activeDescription);
		expect(
			active,
			'на першому показі сторінки фокус мусить лишатися там, де його поставив браузер: ' +
				'людина могла вже почати натискати'
		).toBe('BODY');
	});
});
