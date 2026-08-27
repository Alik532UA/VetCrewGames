import { expect, test, type Page } from '@playwright/test';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ВИМИКАЧ СПРАВДІ ВИМИКАЄ — WCAG SC 2.1.4, рівень A (HOTKEYS-v8 § 3).
 *
 * ## Чому це окремий гейт, коли скорочення вже перевірені
 *
 * `src/hotkeys.test.ts` читає ДЖЕРЕЛА і доводить, що кожен обробник на вікні
 * КЛИЧЕ `acceptsShortcut(`; `src/lib/services/keyboard.test.ts` доводить, що сама
 * `acceptsShortcut` віддає `false` при знятому прапорці. Обидва твердження —
 * про деталі, і з них НЕ випливає третє: що прапорець із шапки доходить до
 * обробника, а натискання після цього справді нічого не робить.
 *
 * `PROJECT-CONTEXT.md` тримав це в переліку неперевіреного дослівно: «„є
 * перемикач“ і „перемикач вимикає скорочення“ — різні твердження, і друге
 * доводиться лише прогоном». Ось прогін.
 *
 * ## Чому саме `T`, і чому ще й `L`
 *
 * `T` — найдешевший доказ, який взагалі можна поставити: дія суто клієнтська й
 * миттєва (`settings.setTheme`), а результат видно атрибутом на `<html>`. Ні
 * навігації, ні мережі, ні анімації, від якої залежав би замір.
 *
 * `L` поруч тому, що критерій — про ВСІ одиночні скорочення, а не про одне.
 * Прапорець іде в `acceptsShortcut` спільним параметром, тож достатньо двох
 * різних обробників, щоб довести саме це, а не «в одному місці не забули».
 *
 * ## Чому вмикання назад — не зайве твердження
 *
 * Без нього «нічого не сталося» могло б означати що завгодно: сторінка втратила
 * фокус, вікно не отримує подій, обробник відвалився. Дія, що повертається
 * разом із прапорцем, відрізняє вимкнене скорочення від зламаного.
 */

const THEME_KEY = 'data-theme';

async function theme(page: Page): Promise<string> {
	return page.evaluate(() => document.documentElement.getAttribute('data-theme') ?? '');
}

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
});

test('одиночні скорочення вимикаються перемикачем (WCAG SC 2.1.4, рівень A)', async ({ page }) => {
	await page.goto('/VetCrewGames/');
	await settlePage(page);

	const toggle = page.getByTestId('header-shortcuts-toggle');
	await expect(toggle, 'перемикач скорочень мусить бути в шапці').toBeVisible();
	await expect(toggle, 'скорочення типово ввімкнені').toHaveAttribute('aria-pressed', 'true');

	/*
	 * ДОКАЗ ЗВЕРХУ: спершу скорочення мусить ПРАЦЮВАТИ.
	 *
	 * Без цього кроку весь тест доводив би «клавіша нічого не робить», а це
	 * істина і в застосунку, де скорочень немає зовсім (AI-AGENT-PITFALLS-v8 § 1).
	 */
	const before = await theme(page);
	await page.keyboard.press('KeyT');
	const afterOn = await theme(page);
	expect(
		afterOn,
		`натискання T не змінило ${THEME_KEY} — скорочення не працює й до вимикача`
	).not.toBe(before);

	await toggle.click();
	await expect(toggle, 'клік мусить зняти прапорець').toHaveAttribute('aria-pressed', 'false');

	// ВЛАСНЕ КРИТЕРІЙ: та сама клавіша після вимикача не робить нічого.
	await page.keyboard.press('KeyT');
	expect(await theme(page), 'T перемкнула тему при ВИМКНЕНИХ скороченнях').toBe(afterOn);

	/*
	 * Друге скорочення, інший обробник: критерій про всі одиночні клавіші, а не
	 * про ту, яку перевірили.
	 */
	await page.keyboard.press('KeyL');
	await expect(
		page.getByTestId('header-locale-menu'),
		'L відкрила меню мов при ВИМКНЕНИХ скороченнях'
	).toBeHidden();

	// Вмикання назад: відрізняє вимкнене скорочення від зламаного.
	await toggle.click();
	await expect(toggle).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('KeyT');
	expect(await theme(page), 'після повторного ввімкнення T перестала працювати').not.toBe(afterOn);
});

/**
 * Стан перемикача переживає перезавантаження (HOTKEYS-v8 § 3, MEDIUM).
 *
 * Вимикач, який скидається з кожним відкриттям сторінки, не виконує критерій:
 * людині, що диктує голосом, довелося б знімати прапорець щоразу, і рівно доти,
 * доки вона його шукає, кожна продиктована літера була б командою.
 */
test('знятий прапорець переживає перезавантаження', async ({ page }) => {
	await page.goto('/VetCrewGames/');
	await settlePage(page);

	await page.getByTestId('header-shortcuts-toggle').click();
	await expect(page.getByTestId('header-shortcuts-toggle')).toHaveAttribute(
		'aria-pressed',
		'false'
	);

	await page.reload();
	await settlePage(page);

	await expect(
		page.getByTestId('header-shortcuts-toggle'),
		'після перезавантаження прапорець повернувся — вибір не зберігся'
	).toHaveAttribute('aria-pressed', 'false');

	const before = await theme(page);
	await page.keyboard.press('KeyT');
	expect(await theme(page), 'T працює після перезавантаження, хоч прапорець знято').toBe(before);
});

/**
 * РЯД ШАПКИ ВМІЩАЄТЬСЯ НА НАЙВУЖЧОМУ ЕКРАНІ — і це не «заразом перевірив».
 *
 * Вимикач скорочень свого часу прибрали саме через місце в ряду: «кнопка займає
 * місце, а користуються нею рідко». Заперечення справедливе, і повертати кнопку,
 * не відповівши на нього, означало б поміняти одну незамірену думку на іншу.
 * Тому поруч із доказом критерію стоїть замір ціни: сім кнопок, заголовок і
 * рахунок на 390px не мусять давати горизонтальної прокрутки.
 *
 * Міряється `scrollWidth` проти `clientWidth` на самій шапці, а не на `body`:
 * прокрутка сторінки тут не віконна (`html` і `body` заввишки рівно з вікно), і
 * переповнення всередині ряду виглядало б як обрізаний край, а не як смуга.
 */
test('ряд шапки не переповнюється на 390px', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/VetCrewGames/game-memory/');
	await settlePage(page);

	await expect(page.getByTestId('header-shortcuts-toggle')).toBeVisible();

	const overflow = await page.evaluate(() => {
		const row = document.querySelector('.game-header__inner');
		if (!row) return null;
		return { scroll: row.scrollWidth, client: row.clientWidth };
	});

	expect(overflow, 'ряду шапки не знайдено — замір дивиться не туди').not.toBeNull();
	expect(
		overflow!.scroll,
		`ряд шапки ширший за екран: ${overflow!.scroll} проти ${overflow!.client}`
	).toBeLessThanOrEqual(overflow!.client);
});

/**
 * ФОКУС У ПОЛІ ВВОДУ ГЛУШИТЬ СКОРОЧЕННЯ (HOTKEYS-v8, `HK-TEXT-ENTRY-GUARD`,
 * CRITICAL) — і це перевіряється НА ЗІБРАНІЙ СТОРІНЦІ, а не на функції.
 *
 * `isTypingTarget` має власні юніт-перевірки, але вони нічого не кажуть про те,
 * чи дійшло її значення до обробника на вікні. Ціна помилки тут найбільша з
 * усіх у цьому файлі: набираючи ім'я гравця, людина вводить «т» — і застосунок
 * міняє тему замість літери.
 */
test('набір тексту в полі не виконує команд', async ({ page }) => {
	await page.goto('/VetCrewGames/pairs/online/');
	await settlePage(page);

	const field = page.getByTestId('pairs-name-input');
	await expect(field).toBeVisible();
	await field.click();

	const before = await theme(page);
	await field.press('KeyT');
	expect(await theme(page), 'літера в полі вводу перемкнула тему').toBe(before);
	await expect(field, 'літера не потрапила в поле').toHaveValue(/t/i);
});
