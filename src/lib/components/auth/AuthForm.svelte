<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import PasswordInput from '$lib/components/ui/PasswordInput.svelte';
	import SegmentedChoice from '$lib/components/ui/SegmentedChoice.svelte';
	import GoogleMark from './GoogleMark.svelte';
	import EmailField from './EmailField.svelte';
	import ResetPanel from './ResetPanel.svelte';

	/**
	 * Вхід, реєстрація й відновлення пароля — ОДНЕ вікно.
	 *
	 * ## Чому одне, а не три
	 *
	 * AUTH-FORM-v8 § 1 вимагає цього, і вимагає по суті: людина, яка спробувала
	 * увійти й не змогла, робить далі одну з двох речей — реєструється або
	 * відновлює пароль. Обидві доступні звідси, без переходів, і поля не
	 * доводиться вводити вдруге.
	 *
	 * Доти тут було інакше: сегментований вибір «створити / зайти в наявний», а
	 * відновлення пароля не було ЗОВСІМ. Автор надіслав знімок сусіднього
	 * `Slovko` як зразок, і різниця, яку він назвав, — «кнопки та поля різного
	 * розміру»: це § 1.1 FORM-INPUTS, де розміри й відступи полів фіксовані.
	 *
	 * ## Компонент не знає, ЯК авторизуватися
	 *
	 * Він приймає callback-пропси й нічого не імпортує з мережі. Причина не в
	 * чистоті: форму треба буде показати й у модалці профілю, а логіка входу
	 * живе в контролері, який тримає стан на весь застосунок. Дві копії логіки
	 * розійшлися б у обробці помилок — найтихіше місце з усіх.
	 *
	 * ## Помилка входу НЕ уточнюється
	 *
	 * «Немає такого листа» окремо від «невірний пароль» — це спосіб перебирати
	 * існуючі акаунти. Текст готує контролер, і він однаковий для обох випадків;
	 * тут лишається тільки показати. Те саме для відновлення: повідомлення про
	 * надсилання однакове й тоді, коли такої пошти немає.
	 */
	interface Props {
		/** `auth` — вхід і реєстрація; `forgot` — відновлення пароля. */
		/**
		 * ПЕРЕКЛАДАЧ ПРОПОМ, а не `t()` з `$lib/i18n`.
		 *
		 * Рядки акаунта живуть у ЛІНИВОМУ чанку: головний словник стоїть рівно на
		 * межі бюджету (120 КБ gzip зі стелі 120). Тобто `t()` цих ключів не знає
		 * в принципі — він типізований по головному словнику, і `svelte-check` це
		 * показав 21 помилкою. Проп, а не стан: функція в `$state` не
		 * перемальовує, і це вже коштувало екрана з ключами замість тексту.
		 */
		text: (key: string) => string;
		mode: 'auth' | 'forgot';
		/** Що робить кнопка входу: створити акаунт чи зайти в наявний. */
		intent: 'register' | 'signin';
		busy?: boolean;
		/** Готовий текст помилки. Порожній — помилки немає. */
		error?: string;
		/** Готовий текст підтвердження (лист надіслано). */
		info?: string;
		/** Чи показувати вхід через Google. */
		withGoogle?: boolean;
		onsubmit: (email: string, password: string) => void;
		onforgot: (email: string) => void;
		ongoogle?: () => void;
		onmode: (mode: 'auth' | 'forgot') => void;
		onintent: (intent: 'register' | 'signin') => void;
	}

	let {
		text,
		mode,
		intent,
		busy = false,
		error = '',
		info = '',
		withGoogle = false,
		onsubmit,
		onforgot,
		ongoogle,
		onmode,
		onintent
	}: Props = $props();

	let email = $state('');
	let password = $state('');

	/*
	 * Порожні поля кнопку не пускають, і межі тут не косметичні: Firebase
	 * відкидає пароль коротший за шість символів власною помилкою, і показати її
	 * замість підказки означало б перекласти на людину читання коду помилки.
	 */
	const canSubmit = $derived(email.trim().length > 3 && password.length >= 6 && !busy);
</script>

<div class="auth" data-testid="auth-card">
	{#if mode === 'forgot'}
		<ResetPanel
			{text}
			{error}
			{info}
			{busy}
			{onforgot}
			onback={() => onmode('auth')}
		/>
	{:else}
		<h2 class="auth__title">{@html formatFont(text('account.signInTitle'))}</h2>
		<p class="auth__hint">{@html formatFont(text('account.why'))}</p>

		{#if withGoogle}
			<button
				type="button"
				class="auth__google"
				onclick={ongoogle}
				disabled={busy}
				data-testid="auth-google-btn"
			>
				<GoogleMark />
				<span>{@html formatFont(text('account.google'))}</span>
			</button>
			<div class="auth__divider"><span>{@html formatFont(text('account.or'))}</span></div>
		{/if}

		<SegmentedChoice
			legend={text('account.mode')}
			scope="account-mode"
			value={intent}
			onchange={(id) => onintent(id as 'register' | 'signin')}
			options={[
				{ id: 'register', label: text('account.modeRegister') },
				{ id: 'signin', label: text('account.modeSignIn') }
			]}
		/>
		<p class="auth__hint" data-testid="account-mode-hint">
			{@html formatFont(text(intent === 'register' ? 'account.registerHint' : 'account.signInHint'))}
		</p>

		<form
			class="auth__form"
			onsubmit={(event) => {
				event.preventDefault();
				onsubmit(email, password);
			}}
		>
			<EmailField
				id="account-email"
				testId="account-email-input"
				label={text('account.email')}
				bind:value={email}
			/>

			<PasswordInput
				{text}
				id="account-password"
				testId="account-password"
				label={text('account.password')}
				autocomplete={intent === 'register' ? 'new-password' : 'current-password'}
				bind:value={password}
			/>

			<!--
				«Відновити пароль» — окремим рядком ПІД полем, а не в самому полі: там
				уже око, CapsLock і попередження про розкладку, і для тексту дії місця
				немає. Назва повна: «Забули?» не каже, що станеться далі.
			-->
			<button
				type="button"
				class="auth__link auth__link--reset"
				onclick={() => onmode('forgot')}
				data-testid="account-forgot-btn"
			>
				{@html formatFont(text('account.forgotPassword'))}
			</button>

			{#if error}
				<p class="auth__error" data-testid="account-error-text">{@html formatFont(error)}</p>
			{/if}

			<button
				type="submit"
				class="auth__primary"
				disabled={!canSubmit}
				data-testid="account-submit-btn"
			>
				{@html formatFont(text(intent === 'register' ? 'account.modeRegister' : 'account.modeSignIn'))}
			</button>
		</form>
	{/if}
</div>

<style>
	/*
	 * Ширина картки — 440px, і це та сама величина, що в каноні (§ 2). Причина
	 * названа там прямо: типова скарга на такі форми — «завузький контейнер».
	 */
	.auth {
		width: 100%;
		max-width: 440px;
		margin-inline: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	:global(.auth__title) {
		margin: 0;
		font-size: var(--font-size-xl);
		color: var(--color-text);
	}

	:global(.auth__hint) {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text);
		opacity: 0.8;
	}

	:global(.auth__form) {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}







	:global(.auth__primary),
	.auth__google {
		width: 100%;
		min-height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	:global(.auth__primary) {
		border: 1px solid var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.auth__google {
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	:global(.auth__primary):disabled,
	.auth__google:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/*
	 * КОЛІР ТЕКСТУ, А НЕ АКЦЕНТУ, і підкреслення замість кольору.
	 *
	 * Тут стояв `--color-accent`, і гейт контрасту заміряв 1.50:1 проти
	 * потрібних 4.5 — `rgb(255, 179, 39)` на `rgb(232, 238, 221)` у темі
	 * `light-green`. Бурштиновий акцент цього проєкту на світлому тлі як
	 * текст не читається взагалі.
	 *
	 * Підкреслення тут не заміна кольору, а те, чим посилання й мусить
	 * позначатися: сенс, переданий ЛИШЕ кольором, не бачить ні дальтонік, ні
	 * Lighthouse (`link-in-text-block`).
	 */
	:global(.auth__link) {
		align-self: flex-start;
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-text);
		text-decoration: underline;
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.auth__link--reset {
		align-self: flex-end;
		/* Притиснуто до поля, під яким стоїть: інакше читається як окрема дія. */
		margin-top: calc(-1 * var(--space-sm));
	}

	.auth__divider {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: var(--font-size-xs);
		color: var(--color-text);
		opacity: 0.7;
	}

	.auth__divider::before,
	.auth__divider::after {
		content: '';
		flex: 1;
		border-bottom: 1px solid var(--color-border);
	}

	:global(.auth__error) {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-error);
	}

	:global(.auth__info) {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-success);
	}
</style>
