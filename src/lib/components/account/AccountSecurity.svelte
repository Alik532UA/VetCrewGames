<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import PasswordInput from '$lib/components/ui/PasswordInput.svelte';

	/**
	 * ПАРОЛЬ І ВИДАЛЕННЯ АКАУНТА — дві незворотні дії, і обидві під підтвердженням.
	 *
	 * ## Чому вони в одній панелі
	 *
	 * Бо це та сама відповідальність: доступ до акаунта. Обидві вимагають ввести
	 * пароль, обидві незворотні по-своєму, і обидві не мусять стояти поруч із
	 * «зберегти профіль» — випадкове натискання там коштує рівно нічого, а тут
	 * коштує акаунта.
	 *
	 * ## Видалення — ДВА кроки, і другий не поруч із першим
	 *
	 * Спершу «видалити акаунт», аж потім поле пароля й «так, видалити». Одна
	 * кнопка одразу означала б, що незворотна дія стоїть на тій самій відстані, що
	 * й «відписатися». Той самий засув, що на аварійному скиданні прогресу
	 * (`resetService`): жест плюс підтвердження.
	 *
	 * ## Пароля може не бути зовсім
	 *
	 * Вхід через Google його не створює. Тоді панель показує це словом, а не
	 * порожнім полем: поле, яке нічого не змінює, гірше за його відсутність. Саме
	 * видалення при цьому працює — підтвердженням стає вікно Google
	 * (`net/erase.ts`).
	 */
	interface Props {
		/** Перекладач сторінки: рядки акаунта лежать у лінивому чанку. */
		text: (key: string) => string;
		/** Чи має акаунт пароль. `false` — вхід через Google. */
		hasPassword: boolean;
		busy: boolean;
		/** Пароль щойно змінено — показати підтвердження. */
		passwordChanged: boolean;
		onchangePassword: (current: string, next: string) => void;
		ondelete: (password: string) => void;
		/**
		 * ВИЙТИ З АКАУНТА — тут, а не під формою профілю.
		 *
		 * Прохання автора, і воно про змісти: у цій панелі живуть дії над САМИМ
		 * акаунтом (змінити пароль, видалити), а не над тим, як мене видно іншим.
		 * Під формою підпису кнопка «вийти» пропонувала вихід тому, хто щойно правив
		 * своє імʼя, — тобто стояла в найгіршому можливому місці.
		 */
		onsignout: () => void;
	}

	let { text, hasPassword, busy, passwordChanged, onchangePassword, ondelete, onsignout }: Props =
		$props();

	let current = $state('');
	let next = $state('');
	let confirmPassword = $state('');
	/** Чи відкритий другий крок видалення. Стан суто екранний. */
	let confirming = $state(false);

	// Шість символів — та сама межа, що у Firebase (`auth/weak-password`).
	const canChange = $derived(current.length > 0 && next.length >= 6 && !busy);
	const canDelete = $derived((hasPassword ? confirmPassword.length > 0 : true) && !busy);
</script>

<section class="security text-panel" data-testid="account-security-panel">
	<h2 class="security__title">{@html formatFont(text('account.securityTitle'))}</h2>

	{#if hasPassword}
		<PasswordInput
			{text}
			id="account-current-password"
			bind:value={current}
			label={text('account.passwordCurrent')}
			testId="account-current-password"
			autocomplete="current-password"
			disabled={busy}
		/>
		<PasswordInput
			{text}
			id="account-new-password"
			bind:value={next}
			label={text('account.passwordNew')}
			testId="account-new-password"
			autocomplete="new-password"
			disabled={busy}
		/>
		<button
			type="button"
			class="security__btn"
			aria-disabled={!canChange}
			data-testid="account-password-change-btn"
			onclick={() => {
				if (!canChange) return;
				onchangePassword(current, next);
				current = '';
				next = '';
			}}
		>
			{@html formatFont(text('account.passwordChange'))}
		</button>
		{#if passwordChanged}
			<p class="security__done" role="status" data-testid="account-password-done-text">
				{@html formatFont(text('account.passwordChanged'))}
			</p>
		{/if}
	{:else}
		<p class="security__hint" data-testid="account-password-google-hint">
			{@html formatFont(text('account.passwordGoogle'))}
		</p>
	{/if}

	<p class="security__hint">{@html formatFont(text('account.deleteHint'))}</p>

	{#if confirming}
		{#if hasPassword}
			<PasswordInput
				{text}
				id="account-delete-password"
				bind:value={confirmPassword}
				label={text('account.deletePassword')}
				testId="account-delete-password"
				autocomplete="current-password"
				disabled={busy}
			/>
		{/if}
		<div class="security__pair">
			<button
				type="button"
				class="security__btn security__btn--danger"
				aria-disabled={!canDelete}
				data-testid="account-delete-confirm-btn"
				onclick={() => {
					if (!canDelete) return;
					ondelete(confirmPassword);
					confirmPassword = '';
					confirming = false;
				}}
			>
				{@html formatFont(text('account.deleteConfirm'))}
			</button>
			<button
				type="button"
				class="security__btn"
				data-testid="account-delete-cancel-btn"
				onclick={() => {
					confirming = false;
					confirmPassword = '';
				}}
			>
				{@html formatFont(text('account.deleteCancel'))}
			</button>
		</div>
	{:else}
		<button
			type="button"
			class="security__btn"
			data-testid="account-delete-btn"
			onclick={() => (confirming = true)}
		>
			{@html formatFont(text('account.deleteTitle'))}
		</button>
	{/if}

	<!--
		ВИЙТИ — ПОСЛІДОВНО ПІСЛЯ ВИДАЛЕННЯ, і це порядок за незворотністю: змінити
		пароль, видалити акаунт, вийти. Кнопка тиха навмисно: дія зворотна (заходять
		назад тим самим паролем) і не конкурує з тими, що вище.

		Стоїть ПОЗА гілкою підтвердження видалення: людина, яка передумала видаляти,
		не мусить втрачати єдиний спосіб вийти.
	-->
	<button type="button" class="security__leave" onclick={onsignout} data-testid="account-leave-btn">
		{@html formatFont(text('account.signOut'))}
	</button>
</section>

<style>
	.security {
		display: flex;
		flex-direction: column;
		gap: var(--account-gap);
		width: 100%;
		border-radius: var(--account-card-radius);
		padding: var(--account-pad);
	}

	.security__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	/*
	 * «Вийти з акаунта» — тиха кнопка й окремий відступ понад рештою.
	 *
	 * Відступ тут значущий: він відділяє вихід від видалення, щоб дві кнопки
	 * поспіль не читалися як одна пара «підтвердити / скасувати».
	 */
	.security__leave {
		align-self: flex-start;
		min-height: 44px;
		margin-top: var(--space-md);
		padding: 0 var(--space-md);
		border: 1px solid var(--account-line, var(--color-border));
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	/* Підказка — кеглем, а не прозорістю: див. `PrivacyPanel`. */
	.security__hint {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	/*
	 * Підтвердження — АКЦЕНТОМ, як і помилка на сторінці акаунта: свого токена
	 * для успіху в проєкті немає, а вигадувати колір означало б завести пару, якої
	 * гейт контрасту не бачив, — у чотирьох темах одразу.
	 */
	.security__done {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	.security__pair {
		display: flex;
		gap: var(--space-xs);
	}

	.security__btn {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: var(--account-control);
		padding: 0 var(--account-pad);
		border: 1px solid var(--account-line, var(--color-border));
		border-radius: var(--account-field-radius);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	/*
	 * Небезпечна кнопка — АКЦЕНТОМ і словом, а не власним червоним: пара
	 * «акцент + текст на акценті» вже підібрана в кожній темі, а те, що дія
	 * незворотна, каже сам підпис і крок підтвердження перед ним.
	 */
	.security__btn--danger {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}
</style>
