<script lang="ts">
	import { formatFont } from '$lib/i18n';

	/**
	 * ФОРМА ВХОДУ: спільні поля, ДВІ КНОПКИ, жодного вибору режиму.
	 *
	 * ## Що тут було й чому це прибрано
	 *
	 * Доти над полями стояв сегментований вибір «Що зробити: Створити акаунт /
	 * Зайти в наявний», а кнопка внизу була одна й міняла підпис. Міркування було
	 * таке: поля однакові, наслідки протилежні, тож нехай людина спершу скаже, що
	 * саме робить.
	 *
	 * Міркування хибне на одному кроці: воно додає РІШЕННЯ там, де його немає.
	 * Людина не вибирає «режим форми» — вона або має акаунт, або ні, і знає це до
	 * того, як побачила екран. Вибір режиму змушує сказати те саме двічі: спершу
	 * перемикачем, потім кнопкою. Автор сказав про це прямо, показавши знімок
	 * сусіднього `Slovko`, де вибору немає зовсім.
	 *
	 * Тепер намір виражає САМА КНОПКА, і їх дві: «Увійти» — submit форми (частіший
	 * випадок і той, що спрацьовує з клавіатури), «Зареєструватись» — звичайна
	 * кнопка поруч. Той самий склад, що в `Slovko/src/lib/components/auth` і в
	 * каноні AUTH-FORM-v8 § 6 (`auth-login-btn` і `auth-register-btn`).
	 *
	 * ## Попередження лишилося, бо воно НЕ про режим
	 *
	 * Вхід у ІНШИЙ акаунт міняє `uid`, тобто анонімний доробок лишається під
	 * старим — це не деталь інтерфейсу, а незворотна річ. Тому текст стоїть
	 * рядком ПІД кнопкою «Увійти»: попередження мусить бути там, де дія, а не в
	 * підказці до перемикача, якого більше немає.
	 *
	 * Симетричну підказку про реєстрацію («профіль і кімнати збережуться»)
	 * ПРИБРАНО, і це рішення, а не недогляд: вона заспокоювала, а не
	 * застерігала. Її відсутність нічим не загрожує, тоді як відсутність
	 * попередження про зміну `uid` — загрожує.
	 *
	 * ## `autocomplete` — `current-password`, і це вибір
	 *
	 * Форма більше не знає заздалегідь, що робить людина, а браузеру треба сказати
	 * рівно одне значення. Вхід частіший за реєстрацію, тож підставити збережений
	 * пароль корисніше, ніж запропонувати новий. Ціна названа: менеджер паролів
	 * при реєстрації сам нового не запропонує.
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
		onlogin: (email: string, password: string) => void;
		onregister: (email: string, password: string) => void;
	}

	let { text, errorKey, busy, onlogin, onregister }: Props = $props();

	let email = $state('');
	let password = $state('');

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
	<h2 class="auth__title">{@html formatFont(text('account.signInTitle'))}</h2>
	<p class="auth__hint">{@html formatFont(text('account.why'))}</p>

	<form class="auth__form" onsubmit={submit} data-testid="auth-form">
		<label class="auth__label" for="account-email">
			<span>{@html formatFont(text('account.email'))}</span>
		</label>
		<input
			id="account-email"
			class="auth__input"
			type="email"
			bind:value={email}
			autocomplete="email"
			inputmode="email"
			data-testid="account-email-input"
		/>

		<label class="auth__label" for="account-password">
			<span>{@html formatFont(text('account.password'))}</span>
		</label>
		<input
			id="account-password"
			class="auth__input"
			type="password"
			bind:value={password}
			autocomplete="current-password"
			data-testid="account-password-input"
		/>

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

		<!--
			Попередження стоїть МІЖ кнопками, і саме тому воно тут, а не під обома:
			воно стосується рівно «Увійти». Ціна названа — пара кнопок не злита в
			одну смугу, як у `Slovko`; натомість кожна відповідає сама за себе.
		-->
		<p class="auth__hint" data-testid="auth-signin-hint">
			{@html formatFont(text('account.signInHint'))}
		</p>

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
</section>

<style>
	.auth {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
	}

	.auth__form {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.auth__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	.auth__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Підказки — КЕГЛЕМ, а не прозорістю: `opacity` на тексті цієї панелі
	 * опускає пару під 4.5:1, і жодне значення прозорості її не рятує. Те саме
	 * міркування записане в `RoomList`, `OnlineGate` і на сторінці акаунта.
	 */
	.auth__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
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

	.auth__input {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
	}

	/*
	 * ОБИДВІ КНОПКИ — на всю ширину й тієї самої висоти, що поля.
	 *
	 * Глобальний `.btn-primary` тут не годиться: у нього `max-width: 320px` і
	 * кегль `--font-size-lg`, тобто в цій панелі він вийшов би і вужчим за
	 * поля, і вищим за 44px. Дві кнопки різної ваги, але однакової міри
	 * читаються як пара варіантів; різної міри — як головна дія і випадковий
	 * додаток.
	 */
	.auth__btn {
		width: 100%;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
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
	.auth__btn--alt {
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.auth__btn[aria-disabled='true'] {
		cursor: not-allowed;
	}
</style>
