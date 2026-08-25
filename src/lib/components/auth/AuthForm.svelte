<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import EmailField from './EmailField.svelte';
	import GoogleMark from './GoogleMark.svelte';
	import ResetPanel from './ResetPanel.svelte';
	import PasswordInput from '$lib/components/ui/PasswordInput.svelte';
	import InfoPopover from '$lib/components/ui/InfoPopover.svelte';

	/**
	 * ФОРМА ВХОДУ: чотири шляхи ввійти, ДВІ КНОПКИ, жодного вибору режиму.
	 *
	 * ## Вибір режиму прибрано — і це не те саме, що прибрати спосіб входу
	 *
	 * Доти над полями стояв сегментований вибір «Що зробити: Створити акаунт /
	 * Зайти в наявний», а кнопка внизу була одна й міняла підпис. Міркування було
	 * таке: поля однакові, наслідки протилежні, тож нехай людина спершу скаже, що
	 * саме робить.
	 *
	 * Міркування хибне на одному кроці: воно додає РІШЕННЯ там, де його немає.
	 * Людина не вибирає «режим форми» — вона або має акаунт, або ні, і знає це до
	 * того, як побачила екран. Вибір режиму змушує сказати те саме двічі: спершу
	 * перемикачем, потім кнопкою.
	 *
	 * Тепер намір виражає САМА КНОПКА, і їх дві: «Увійти» — submit форми (частіший
	 * випадок і той, що спрацьовує з клавіатури), «Зареєструватись» — звичайна
	 * кнопка поруч. Той самий склад, що в `Slovko/src/lib/components/auth` і в
	 * каноні AUTH-FORM-v8 § 6 (`auth-login-btn` і `auth-register-btn`).
	 *
	 * ## Чому Google і відновлення пароля стоять ТУТ, а не «повернуті»
	 *
	 * Одна редакція цієї форми прибрала разом із перемикачем ще три речі: кнопку
	 * Google, посилання «Відновити пароль» і поле пароля з інструментами (око,
	 * CapsLock, попередження про розкладку). Мережевий шар при цьому лишився
	 * цілий — `net/account.ts` мав `signInGoogle()` і `resetPassword()`, контролер
	 * мав `google()` і `resetPassword()`, — тобто це були не «незроблені»
	 * можливості, а ВІДʼЄДНАНІ: код на місці, викликати нікому.
	 *
	 * Це найгірший різновид втрати, і саме тому він описаний тут. Гейти його не
	 * бачать: `svelte-check` не скаржиться на функцію, якої ніхто не викликає,
	 * тести на форму перевіряють те, що в ній є, а не те, чого немає, а `lint`
	 * мовчить, бо експорт із `net/` законно може не мати споживача. Червоного
	 * ніде, а на екрані немає двох із чотирьох способів увійти.
	 *
	 * Звідси правило для цієї форми: **шляхів входу чотири** — Google, пошта з
	 * паролем, реєстрація, відновлення пароля — і жоден із них не є деталлю
	 * розкладки. Змінюючи вигляд, перевіряй, що всі чотири лишилися на екрані.
	 *
	 * ## «Відновити пароль» — окрема панель, і це НЕ вибір режиму
	 *
	 * Різниця в тому, що саме питають. Вибір «створити чи зайти» питав про намір,
	 * який людина вже знає, — і тому був зайвий. Відновлення ж міняє САМУ ФОРМУ:
	 * поле пароля тут зашкодило б (його ж і забули), кнопок дві не потрібно, а
	 * підтвердження мусить бути однакове для будь-якої пошти, щоб не казати
	 * стороннім, хто в базі є. Тобто це інший екран, а не інший підпис на кнопці.
	 * Так само зроблено в `Slovko`, де перемикача входу/реєстрації немає, а панель
	 * відновлення є.
	 *
	 * ## `autocomplete` — `current-password`, і це вибір
	 *
	 * Форма не знає заздалегідь, що робить людина, а браузеру треба сказати рівно
	 * одне значення. Вхід частіший за реєстрацію, тож підставити збережений пароль
	 * корисніше, ніж запропонувати новий. Ціна названа: менеджер паролів при
	 * реєстрації сам нового не запропонує.
	 */
	interface Props {
		/**
		 * Перекладач сторінки, а не власний доступ до словника.
		 *
		 * Рядки акаунта лежать у ЛІНИВОМУ чанку (`i18n/account/index.ts`), і
		 * тримає його сторінка. Другий завантажувач тут означав би другий стан із
		 * тим самим словником і другу мить, у яку на екрані ще ключі.
		 */
		text: (key: string) => string;
		/** Ключ повідомлення про останню невдачу. `null` — усе гаразд. */
		errorKey: string | null;
		/** Триває мережева дія: повторні натискання нічого не роблять. */
		busy: boolean;
		/** Лист відновлення надіслано. Текст однаковий для будь-якої пошти. */
		resetSent: boolean;
		onlogin: (email: string, password: string) => void;
		onregister: (email: string, password: string) => void;
		ongoogle: () => void;
		onforgot: (email: string) => void;
	}

	let { text, errorKey, busy, resetSent, onlogin, onregister, ongoogle, onforgot }: Props =
		$props();

	let email = $state('');
	let password = $state('');
	/**
	 * Яка панель на екрані. Стан ЛОКАЛЬНИЙ, бо він суто про вигляд: сторінка не
	 * має чого з ним робити, а тримати його там означало б проп туди й проп назад
	 * заради значення, яке нікого, крім цієї розмітки, не стосується.
	 */
	let forgot = $state(false);

	/**
	 * Чи є що надсилати. Межі ті самі, що в Firebase: пошта з символом і пароль
	 * від шести знаків — інакше відповідь однаково буде відмовою.
	 */
	const ready = $derived(email.trim().length > 3 && password.length >= 6 && !busy);

	/*
	 * `aria-disabled`, а не `disabled`, — і тому обидва наміри мають ВЛАСНИЙ
	 * сторож. Справжній `disabled` виймає кнопку з порядку фокуса, тобто читалка
	 * її не знаходить і не може сказати, чому вона не працює. Ціна названа:
	 * натиснути неготову кнопку можна, і не пустити мусить код.
	 */
	function submit(event: Event) {
		event.preventDefault();
		if (!ready) return;
		onlogin(email.trim(), password);
	}

	function register() {
		if (!ready) return;
		onregister(email.trim(), password);
	}
</script>

<section class="auth text-panel" data-testid="auth-panel">
	{#if forgot}
		<!--
			Панель відновлення отримує ГОТОВІ тексти, а не ключі: помилку сторінка
			вже переклала для решти форми, і другий переклад того самого коду
			розійшовся б із першим.
		-->
		<ResetPanel
			{text}
			{busy}
			error={errorKey === null ? '' : text(errorKey)}
			info={resetSent ? text('account.resetSent') : ''}
			{onforgot}
			onback={() => (forgot = false)}
		/>
	{:else}
		<!--
			ЗАГОЛОВОК І `i` — В ОДНОМУ РЯДКУ, кнопка праворуч.

			Довідка мусить бути там, де на неї дивляться, коли не розуміють: біля
			назви екрана. Саме пояснення відкривається ПОВЕРХ (`InfoPopover`), тобто
			форма під ним не ворушиться — доти воно розсувало картку, і поля, на які
			людина щойно дивилася, з'їжджали вниз.

			Порядок абзаців — порядок питань: навіщо це взагалі, що буде після
			реєстрації, що буде після входу в наявний акаунт і чому для друзів
			акаунт потрібен обом.
		-->
		<div class="auth__head">
			<h2 class="auth__title">{@html formatFont(text('account.signInTitle'))}</h2>
			<InfoPopover label={text('account.infoOpen')} scope="auth">
				<p class="auth__note">{@html formatFont(text('account.infoWhy'))}</p>
				<p class="auth__note">{@html formatFont(text('account.infoRegister'))}</p>
				<p class="auth__note">{@html formatFont(text('account.infoSignIn'))}</p>
				<p class="auth__note">{@html formatFont(text('account.infoFriends'))}</p>
			</InfoPopover>
		</div>

		<!--
			GOOGLE СТОЇТЬ ПЕРШИМ, а не під формою.
			Це найкоротший шлях: жодного поля, жодного пароля, який треба вигадати
			й запамʼятати. Поставити його під формою означало б показати спершу
			довгий шлях, а короткий — тим, хто долистав.
		-->
		<button
			type="button"
			class="auth__btn auth__btn--google"
			onclick={ongoogle}
			aria-disabled={busy}
			data-testid="auth-google-btn"
		>
			<GoogleMark />
			<span>{@html formatFont(text('account.google'))}</span>
		</button>

		<!--
			Розділювач зі словом «або» — саме словом, а не рискою.
			Дві кнопки без нього читаються як послідовність («спершу це, тоді те»),
			тоді як вони альтернативи.
		-->
		<p class="auth__or"><span>{@html formatFont(text('account.or'))}</span></p>

		<form class="auth__form" onsubmit={submit} data-testid="auth-form">
			<EmailField
				id="account-email"
				label={text('account.email')}
				testId="account-email-input"
				bind:value={email}
			/>

			<!--
				Поле пароля — з інструментами В ПОЛІ (око, CapsLock, розкладка), а не
				звичайний `input type="password"`. Це вимога INPUT-TOOLS-v8, і вона
				не про красу: пароль не видно, тож помилку розкладки чи CapsLock
				людина інакше знаходить лише по відмові сервера.
			-->
			<PasswordInput
				{text}
				id="account-password"
				label={text('account.password')}
				testId="account-password"
				autocomplete="current-password"
				bind:value={password}
			/>

			<!--
				«Відновити пароль» — ПІД полем і праворуч, окремим рядком.
				Не в полі: там уже живуть око, CapsLock і розкладка, і четвертий
				знак у тому самому рядку перетворив би поле на панель кнопок.
			-->
			<button
				type="button"
				class="auth__forgot"
				onclick={() => (forgot = true)}
				data-testid="auth-forgot-btn"
			>
				{@html formatFont(text('account.forgotPassword'))}
			</button>

			{#if errorKey}
				<p class="auth__error" role="alert" data-testid="account-error-text">
					{@html formatFont(text(errorKey))}
				</p>
			{/if}

			<button
				type="submit"
				class="auth__btn auth__btn--main"
				aria-disabled={!ready}
				data-testid="auth-login-btn"
			>
				{@html formatFont(text('account.signIn'))}
			</button>

			<button
				type="button"
				class="auth__btn auth__btn--alt"
				onclick={register}
				aria-disabled={!ready}
				data-testid="auth-register-btn"
			>
				{@html formatFont(text('account.register'))}
			</button>
		</form>
	{/if}
</section>

<style>
	/*
	 * КАРТКА ВХОДУ: скруглення картки, проміжок у зріст рядка, відступи від країв.
	 *
	 * Автор про попередній вигляд: «скомкано, квадратні елементи без скруглень», і
	 * показав `Slovko` — там картка 20px, поля й кнопки 14px, проміжок 1rem. Тут
	 * стояв проміжок 4px (`--space-xs`) і скруглення 8px, тобто поля злипалися в
	 * одну сходинку, а кути читалися як прямі.
	 *
	 * Міри — спільні для всієї сторінки акаунта (`--account-*` на `.account-page`):
	 * форма входу й кабінет — той самий екран, і різні числа в них читалися б як
	 * два різні застосунки.
	 */
	.auth {
		display: flex;
		flex-direction: column;
		gap: var(--account-gap);
		width: 100%;
		border-radius: var(--account-card-radius);
		padding: var(--account-pad);
	}

	.auth__form {
		display: flex;
		flex-direction: column;
		gap: var(--account-gap);
	}

	/*
	 * Заголовок і кнопка довідки — один рядок, кнопка притиснута праворуч.
	 *
	 * `space-between`, а не `margin-left: auto` на кнопці: у рядку рівно два
	 * елементи, і саме про їхню відстань тут ідеться. Відступ під рядком лишився
	 * той самий, що був у заголовка, — інакше форма підскочила б на кілька
	 * пікселів проти того, до чого око вже звикло.
	 */
	.auth__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		margin: 0 0 var(--space-xs);
	}

	/*
	 * Абзац довідки — КОЛЬОРОМ ТЕКСТУ, а не приглушеним.
	 *
	 * Панель поповера має власне тло (`--color-bg-surface`), тобто пара тут інша,
	 * ніж у підказок на самій картці. Приглушений колір на цьому тлі вже
	 * впирався в 4,5:1 у світлих темах — заміряно в `CountryMenu`, — тож текст
	 * повним кольором, а «це пояснення, а не дія» каже кегль.
	 */
	.auth__note {
		margin: 0;
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	/* Відступ під заголовком тепер тримає рядок `.auth__head`, а не він сам. */
	.auth__title {
		margin: 0;
		font-size: var(--font-size-md);
	}

	/*
	 * Розділювач: слово посередині, риски по боках через `::before`/`::after`.
	 *
	 * Риски саме псевдоелементами, а не двома `<span>`: вони нічого не значать
	 * для читалки, і як вузли розмітки їх довелося б окремо ховати.
	 */
	.auth__or {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		margin: var(--space-xs) 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.auth__or::before,
	.auth__or::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--color-border);
	}

	/*
	 * «Відновити пароль» — посиланням, а не кнопкою, і праворуч.
	 *
	 * Кнопка тут читалася б як третій рівноправний варіант поруч із «Увійти» й
	 * «Зареєструватись», хоч це шлях для рідкого випадку. Підкреслення
	 * обовʼязкове: без нього акцентний колір лишається єдиною ознакою, що це
	 * можна натиснути, — а колір як єдина ознака заборонений (ACCESSIBILITY-v8).
	 */
	/*
	 * «ВІДНОВИТИ ПАРОЛЬ» — КОЛЬОРОМ ТЕКСТУ, а не акцентом.
	 *
	 * Акцент тут не проходив: `contrast-runtime.spec.ts` заміряв 1,50:1 у
	 * `light-green` і 1,60:1 у `winter` при потрібних 4,5 — жовтий на світлій
	 * панелі. Це не «майже видно», а нечитабельно, і тримався той колір рівно на
	 * тому, що гейт рантайму запускають рідше за юніт-тести.
	 *
	 * Посилання пізнається за ПІДКРЕСЛЕННЯМ, і воно тут і було: колір нічого до
	 * цього не додавав, тож заміна нічого не коштує. Пара «текст на панелі» вже
	 * підібрана в усіх чотирьох темах (6,23–4,67:1 — заміряно в `CountryMenu`).
	 */
	.auth__forgot {
		align-self: flex-end;
		/* 44px сенсорної цілі набирається відступами, а не висотою рядка. */
		min-height: 44px;
		padding: 0 var(--space-xs);
		border: none;
		background: none;
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-decoration: underline;
		cursor: pointer;
	}

	/*
	 * Помилка — АКЦЕНТОМ, а не власним червоним: свого токена для помилки в
	 * проєкті немає, і вигадувати колір тут означало б завести пару, якої гейт
	 * контрасту не бачив, — у чотирьох темах одразу.
	 */
	.auth__error {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	/*
	 * УСІ ТРИ КНОПКИ — на всю ширину й тієї самої висоти, що поля.
	 *
	 * Саме про це автор сказав «кнопки та поля різного розміру». Глобальний
	 * `.btn-primary` тут не годиться: у нього `max-width: 320px` і кегль
	 * `--font-size-lg`, тобто в цій панелі він вийшов би і вужчим за поля, і
	 * вищим за 44px. Кнопки різної ваги, але однакової міри читаються як набір
	 * варіантів; різної міри — як головна дія і випадковий додаток.
	 */
	.auth__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: 100%;
		min-height: var(--account-control);
		padding: 0 var(--account-pad);
		border-radius: var(--account-field-radius);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		/*
		 * Перехід ЛИШЕ на кольорі: `all` ловив би ще й `outline` фокусу, і рамка
		 * приїжджала б із запізненням (те саме рішення в `SegmentedChoice`).
		 */
		transition: background-color var(--transition-fast);
	}

	@media (hover: hover) {
		.auth__btn--main:hover {
			background: var(--color-accent-hover);
		}

		.auth__btn--alt:hover,
		.auth__btn--google:hover {
			background: color-mix(in srgb, var(--color-text), var(--color-bg-card) 88%);
		}
	}

	.auth__btn--main {
		border: 1px solid var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	/*
	 * Друга кнопка виглядає як ПОЛЕ, а не як приглушена копія першої: сірої
	 * кнопки поруч із яскравою легко не побачити зовсім, а реєстрація — не
	 * другорядна дія, лише рідша.
	 */
	.auth__btn--alt,
	.auth__btn--google {
		border: 1px solid var(--account-line, var(--color-border));
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.auth__btn[aria-disabled='true'] {
		cursor: not-allowed;
	}
</style>
