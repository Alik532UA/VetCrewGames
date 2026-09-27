import { expect, test } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ФОРМА ВХОДУ — чек-лист приймання AUTH-FORM-v8 § 8.
 *
 * ## Чому цього файлу не було, хоч форма є
 *
 * `PROJECT-CONTEXT.md` тримав `AUTH-FORM` серед НЕЗАСТОСОВНИХ файлів пакета з
 * причиною «немає входу». Причина застаріла: у проєкті є вхід поштою й паролем,
 * вхід через Google, реєстрація, відновлення пароля, зміна пароля й видалення
 * акаунта. Тобто цілий файл пакета з критичністю HIGH випадав з розгляду на
 * підставі, якої вже не існувало.
 *
 * Це рівно той самий клас, який той-таки файл уже одного разу впіймав на собі й
 * записав: «саме на „полів вводу тут немає“ трималося рішення не застосовувати
 * FORM-INPUTS та INPUT-TOOLS. Поля з'явилися разом зі спільною партією, а рядок
 * лишився». Тому цей набір існує, а рядок у `PROJECT-CONTEXT.md` виправлено.
 *
 * ## Що перевіряється тут, а що НЕ МОЖЕ бути тут
 *
 * Дві найдорожчі вимоги § 9 — «помилка входу не розрізняє неіснуючу пошту й
 * хибний пароль» і «відновлення відповідає однаково на будь-яку пошту» —
 * перевіряються НЕ тут, і не тому, що про них забули. Вони вимагають живого
 * акаунта у Firebase, а прогін іде над зібраним статичним сайтом без ключів. У
 * коді ця вимога виконана й пояснена: `controllers/account.svelte.ts` ковтає
 * `auth/user-not-found` та `auth/invalid-credential` в обох місцях. Межу названо
 * тут, щоб зелений результат не читався як «безпеку перевірено».
 *
 * Фічі поля пароля (CapsLock, розкладка) теж не тут: § 9 прямо каже, що їх
 * покриває набір FORM-INPUTS-v8 § 9. Тут — лише те, що поле справді
 * `PasswordInput`, а не голий `<input type="password">`.
 */

/**
 * § 2 каже `max-width: 440px`. ТУТ 32rem, І ЦЕ НАЗВАНЕ ВІДХИЛЕННЯ, а не недогляд.
 *
 * Заміряно: картка 512px при кореневому кеглі 16px, тобто рівно `32rem`
 * (`account/+page.svelte`). Відхилення в бік ШИРШОГО, а канон у цьому пункті
 * стереже вузьке — його власне формулювання: «комфортно, не вузько (типова
 * скарга — „завузький контейнер“)». Тобто 512 не порушує того, заради чого
 * правило написане.
 *
 * Одиниця важливіша за число. `440px` не реагує на кегль, обраний людиною, а
 * ACCESSIBILITY-v8 § 9 вимагає, щоб текст масштабувався до 200% без утрати
 * функціональності: при кеглі 24px картка в rem виросте разом із написами, а в
 * px — лишиться тією самою й почне різати рядки.
 *
 * Тому перевірка тримає ОБИДВІ межі й виражає намір, а не магічне число: не
 * вужче за канонні 440 і рівно 32 ОДИНИЦІ сторінки.
 *
 * Одиниця — `--fill-u`, кегель `.account-page` (2026-09-27, прохання автора «95%
 * порожнє»): на телефоні вона дорівнює `rem`, тобто це ті самі 32rem і 512px, а на
 * великому екрані картка росте разом зі своїм текстом. Міряється на двох вікнах:
 * число в px могло б збігтися з одним із них, але не з обома.
 */
const CARD_UNITS = 32;
const CANON_MIN_WIDTH = 440;

test.beforeEach(async ({ page }) => {
	await reduceMotion(page);
	await page.goto('/VetCrewGames/account/');
	await settlePage(page);
});

test('вхід і реєстрація — в ОДНОМУ вікні (§ 1)', async ({ page }) => {
	const panel = page.getByTestId('auth-panel');
	await expect(panel).toBeVisible();

	/*
	 * Обидві кнопки в ОДНІЙ картці — це і є твердження § 1. Перевіряється не
	 * «обидві на сторінці», а «обидві всередині тієї самої панелі»: дві окремі
	 * модалки теж дали б дві видимі кнопки.
	 */
	await expect(panel.getByTestId('auth-login-btn')).toBeVisible();
	await expect(panel.getByTestId('auth-register-btn')).toBeVisible();
	await expect(panel.getByTestId('account-email-input')).toBeVisible();
	await expect(panel.getByTestId('account-password-input')).toBeVisible();
});

test('відновлення пароля — режим ТОГО САМОГО вікна, і воно повертається (§ 1, § 4)', async ({
	page
}) => {
	const panel = page.getByTestId('auth-panel');

	/*
	 * § 3: «Відновити пароль» — окремим рядком ПІД полем пароля, а не всередині
	 * нього. Міряється геометрією: верх кнопки нижче за низ поля.
	 */
	const passwordBox = await page.getByTestId('account-password-input').boundingBox();
	const forgotBox = await page.getByTestId('auth-forgot-btn').boundingBox();
	expect(passwordBox).not.toBeNull();
	expect(forgotBox).not.toBeNull();
	expect(
		forgotBox!.y,
		'«Відновити пароль» стоїть усередині поля, а не окремим рядком під ним'
	).toBeGreaterThanOrEqual(passwordBox!.y + passwordBox!.height - 1);

	await page.getByTestId('auth-forgot-btn').click();

	// Та сама панель, змінився лише вміст — не нове вікно.
	await expect(panel, 'відновлення відкрилося окремим вікном').toBeVisible();
	await expect(page.getByTestId('reset-email-input')).toBeVisible();
	await expect(page.getByTestId('account-email-input')).toBeHidden();
	await expect(page.getByTestId('reset-submit-btn')).toBeVisible();

	await page.getByTestId('reset-back-btn').click();
	await expect(page.getByTestId('account-email-input')).toBeVisible();
	await expect(page.getByTestId('reset-email-input')).toBeHidden();
});

test('поле пароля — це PasswordInput, а не голий input (§ 3)', async ({ page }) => {
	const field = page.getByTestId('account-password-input');
	await expect(field).toHaveAttribute('type', 'password');

	const toggle = page.getByTestId('account-password-toggle-btn');
	await expect(toggle, 'немає кнопки «показати пароль» — отже це не PasswordInput').toBeVisible();

	await toggle.click();
	await expect(field, 'кнопка є, а пароль не показується').toHaveAttribute('type', 'text');
	await toggle.click();
	await expect(field).toHaveAttribute('type', 'password');
});

/**
 * `autocomplete` — вимога SECURITY-v8 через § 5, і водночас єдине, що робить
 * форму придатною для менеджера паролів. Без нього людина або набирає пароль
 * руками, або менеджер підставляє не те поле.
 */
test('поля названі для менеджера паролів (§ 5)', async ({ page }) => {
	await expect(page.getByTestId('account-email-input')).toHaveAttribute('autocomplete', 'email');
	await expect(page.getByTestId('account-password-input')).toHaveAttribute(
		'autocomplete',
		'current-password'
	);
});

test('ширина картки — 32 одиниці сторінки, і не вужче за канонні 440px (§ 2)', async ({ page }) => {
	for (const viewport of [
		{ width: 1280, height: 800 },
		{ width: 1600, height: 800 }
	]) {
		await page.setViewportSize(viewport);
		await settlePage(page);

		const box = await page.getByTestId('auth-panel').boundingBox();
		expect(box).not.toBeNull();

		const unit = await page.evaluate(() =>
			parseFloat(getComputedStyle(document.querySelector('.account-page')!).fontSize)
		);
		const width = Math.round(box!.width);

		expect(
			width,
			`картка ${width}px — канон § 2 стереже саме ВУЗЬКУ картку («типова скарга — завузький контейнер»)`
		).toBeGreaterThanOrEqual(CANON_MIN_WIDTH);

		/*
		 * Стеля виражена в одиницях, а не числом: інакше перехід на px пройшов би повз
		 * перевірку, лишивши те саме число й забравши масштабування під кегль людини.
		 */
		expect(
			width,
			`картка ${width}px при одиниці сторінки ${unit}px на ${viewport.width}×${viewport.height} — ` +
				`це не ${CARD_UNITS} одиниці. Або змінили ширину, або перевели її в px; друге ламає ` +
				'масштабування до 200%.'
		).toBe(Math.round(CARD_UNITS * unit));
	}
});

/**
 * § 7.1: РЕЖИМИ РОЗВОДЯТЬСЯ ЛОКАТОРАМИ.
 *
 * Гілки взаємовиключні, тож у DOM вони не зустрічаються — і саме тому спільний
 * локатор був би непомітною вадою: тест не відрізнив би, у якому режимі форма.
 * Канон називає типовий баг, який так і проходить повз: «після відновлення
 * пароля форма лишилася в режимі forgot».
 */
test('локатори режимів не збігаються (§ 7.1)', async ({ page }) => {
	await expect(page.getByTestId('account-email-input')).toBeVisible();
	await expect(page.getByTestId('reset-email-input')).toBeHidden();

	await page.getByTestId('auth-forgot-btn').click();
	await expect(page.getByTestId('reset-email-input')).toBeVisible();
	await expect(page.getByTestId('account-email-input')).toBeHidden();
});
