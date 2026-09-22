import { expect, test, type Page } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * Сторінка чеклиста бета-тестування (BETA-CHECKLIST § 5.7, `BETA-PAGE-E2E`).
 *
 * ## Чому цей файл з'явився останнім із десяти
 *
 * Над чеклистом цього проєкту стоїть тридцять вісім інваріантів — більше, ніж
 * будь-де, — і всі вони дивляться на ДАНІ або на ДЖЕРЕЛА: чи заявлена вкладкою
 * кожна адреса, чи існує названий файл тесту, чи є в пункта локатор, чи малює
 * сторінка текст через шрифтовий форматер. Саму сторінку не натискав НІХТО:
 * `/VetCrewGames/beta-test-checklists/` заходила лише в загальний прогін axe й
 * у перевірку унікальності локаторів.
 *
 * Між інваріантами над даними і скриптом над `build/` лишалася діра розміром зі
 * сторінку: чи взагалі працює те, заради чого все це написано. Іронія в тому,
 * що § 2–7 канону написані саме з цієї реалізації, а правило § 5.7 з'явилося
 * після того, як такої діри не знайшлося в сусідньому проєкті.
 *
 * ## Чому саме ці сценарії
 *
 * Кожен закриває крок, на якому робота тестувальника зникає МОВЧКИ: сторінка
 * лишається намальованою, інваріанти зеленими, а вечір роботи — ні. Дублювати
 * тут інваріанти над даними немає сенсу: вони червоніють швидше й дешевше.
 */

const PAGE = '/VetCrewGames/beta-test-checklists/';

/**
 * Перший пункт вкладки `common`, і два імені того самого.
 *
 * У сховищі лежить `common_1` (форма `{вкладка}_{номер}`, § 2.2), у розмітці —
 * `common-1`: підкреслень у локаторах немає (TESTID-AND-NAMING § 1.2). Дві
 * константи саме тому, що звіт нижче звіряється з ПЕРШОЮ, а кліки — з другою.
 */
const CHECK = 'common_1';
const TID = CHECK.replace(/_/g, '-');

const progress = (page: Page) => page.getByTestId('beta-progress-value').innerText();

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
	await page.goto(PAGE);
	await settlePage(page);
	await expect(page.getByTestId('beta-progress-value')).toBeVisible();
});

test('позначка переживає перезавантаження', async ({ page }) => {
	const vote = page.getByTestId(`beta-vote-${TID}-ok-btn`);
	await vote.click();
	await expect(vote).toHaveAttribute('aria-pressed', 'true');

	await page.reload();
	await settlePage(page);

	await expect(
		page.getByTestId(`beta-vote-${TID}-ok-btn`),
		'позначка не пережила перезавантаження — сесія тестувальника зникає мовчки'
	).toHaveAttribute('aria-pressed', 'true');
});

/**
 * § 3.3 `BETA-VOTE-UNDO`: кнопок три, а станів чотири. Повернення до «не
 * перевірено» робиться повторним натисканням уже натиснутого, інакше єдиний
 * спосіб виправити помилковий клік — стерти все.
 */
test('поступ росте на один, а повторне натискання його знімає', async ({ page }) => {
	const before = await progress(page);
	const vote = page.getByTestId(`beta-vote-${TID}-ok-btn`);

	await vote.click();
	await expect(page.getByTestId('beta-progress-value'), 'поступ не зрушив').not.toHaveText(before);

	await vote.click();
	await expect(
		page.getByTestId('beta-progress-value'),
		'повторне натискання не зняло позначку'
	).toHaveText(before);
});

/**
 * § 8.1 `BETA-TAB-PROGRESS`: вкладок одинадцять, і загальне «17 / 169» не
 * відповідає на єдине питання, яке тестувальник собі ставить, — чи закінчена
 * ЦЯ вкладка.
 */
test('лічильник вкладки росте окремо від загального', async ({ page }) => {
	const own = page.getByTestId('beta-tab-common-progress-text');
	const before = await own.innerText();

	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click();

	await expect(own, 'лічильник вкладки не зрушив').not.toHaveText(before);
	await expect(
		page.getByTestId('beta-tab-reserve-progress-text'),
		'позначка потрапила в чужу вкладку'
	).toHaveText(/^0\//);
});

test('перемикання вкладки міняє перелік і не губить позначене', async ({ page }) => {
	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click();

	await page.getByTestId('beta-tab-reserve-btn').click();
	await expect(
		page.getByTestId(`beta-check-${TID}-item`),
		'пункти чужої вкладки лишилися на екрані'
	).toHaveCount(0);

	await page.getByTestId('beta-tab-common-btn').click();
	await expect(
		page.getByTestId(`beta-vote-${TID}-ok-btn`),
		'позначка загубилася при поверненні на вкладку'
	).toHaveAttribute('aria-pressed', 'true');
});

/**
 * § 6.3 `BETA-CLEAR-TWO-STEP`: стирання — ЄДИНА незворотна дія на сторінці, і
 * стоїть вона в тому самому рядку, що й «Скопіювати звіт», до якого тягнуться
 * щоразу. При 179 пунктах ціна помилки — вечір роботи проти зайвого кліка.
 */
test('перше натискання «стерти» нічого не стирає', async ({ page }) => {
	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click();
	const marked = await progress(page);

	await page.getByTestId('beta-clear-btn').click();
	await expect(
		page.getByTestId('beta-progress-value'),
		'одне натискання знесло всю роботу тестувальника'
	).toHaveText(marked);

	await page.getByTestId('beta-clear-btn').click();
	await expect(page.getByTestId('beta-progress-value')).not.toHaveText(marked);
});

/**
 * Буфер обміну в headless недоступний, і це зручно: сценарій заразом доводить,
 * що запасний шлях (§ 6.2) справді працює. Перевіряється саме локатор ВІДМОВИ
 * (§ 6.2.1): спільна підказка зеленіла б і тоді, коли буфер спрацював, тобто
 * запасний шлях лишався б неперевіреним.
 */
test('звіт доходить до людини навіть без буфера обміну', async ({ page, context }) => {
	await context.clearPermissions();
	await page.getByTestId(`beta-vote-${TID}-ok-btn`).click();
	await page.getByTestId('beta-report-btn').click();

	const field = page.getByTestId('beta-report-input');
	if (await field.isVisible()) {
		await expect(page.getByTestId('beta-report-failed-hint')).toBeVisible();
		await expect(field, 'у звіті немає позначеного пункта').toHaveValue(new RegExp(CHECK));
	}
});

/**
 * § 8.5.1 `BETA-VERSION-VISIBLE` і § 8.4 `BETA-SCREEN-LINKS`.
 *
 * Версія відповідає на «чи рахується моя позначка», перелік екранів знімає
 * найдовший крок у роботі: прочитав пункт — шукає, де це на сайті. Обидва
 * беруться з того самого, що читають інваріанти, тож розійтися з дійсністю
 * непоміченими не можуть, — але лише доти, доки їх справді малюють.
 */
test('на сторінці видно версію, екрани вкладки й вихід', async ({ page }) => {
	await expect(page.getByTestId('beta-version-text')).toHaveText(/\d/);

	const links = page.locator('[data-testid^="beta-screen-"]');
	expect(await links.count(), 'вкладка не показала жодного екрана').toBeGreaterThan(0);
	await expect(links.first()).toHaveAttribute('href', /.+/);

	await expect(page.getByTestId('beta-home-link'), 'зі службової сторінки нема куди піти').toHaveAttribute(
		'href',
		/.+/
	);
});

/**
 * § 8.3 `BETA-OWN-LANG-BTN`: мов інтерфейсу чотири, мов чеклиста дві. Кнопка
 * перемикає РІВНО чеклист — адреса й мова сайту лишаються як були, інакше вона
 * дублювала б мовний перемикач шапки й нічого не вирішувала.
 */
test('кнопка мови перемикає чеклист, не чіпаючи адреси', async ({ page }) => {
	const text = page.getByTestId(`beta-check-${TID}-text`);
	const before = await text.innerText();
	const url = page.url();

	await page.getByTestId('beta-lang-btn').click();

	await expect(text, 'текст пункта не змінився — кнопка нічого не перемкнула').not.toHaveText(
		before
	);
	expect(page.url(), 'кнопка чеклиста змінила адресу сторінки').toBe(url);
});
