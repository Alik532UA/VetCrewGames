<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import EmailField from './EmailField.svelte';

	/**
	 * Режим відновлення пароля — вміст того самого вікна, а не окрема сторінка.
	 *
	 * AUTH-FORM-v8 § 1 вимагає, щоб відновлення було РЕЖИМОМ, а не сторінкою-
	 * сиротою, і воно ним і лишається: `mode` тримає `AuthForm`, картка та сама,
	 * перехід — без навігації. Тут лише розмітка цього режиму.
	 *
	 * Виносилося не заради краси: `AuthForm` переріс межу розміру, і межу канон
	 * піднімати забороняє. Два режими — природний розріз: спільного між ними
	 * рівно поле пошти, і воно вже окремим компонентом.
	 *
	 * Стилі беруться з батька через `:global` — див. кінець `AuthForm.svelte`.
	 * Своя копія кнопки й підказки тут дала б другий набір розмірів, тобто рівно
	 * те, на що скаржився автор: «кнопки та поля різного розміру».
	 */
	interface Props {
		text: (key: string) => string;
		/** Готовий текст помилки. Порожній — помилки немає. */
		error: string;
		/** Готовий текст підтвердження. Порожній — ще не надсилали. */
		info: string;
		busy: boolean;
		onforgot: (email: string) => void;
		onback: () => void;
	}

	let { text, error, info, busy, onforgot, onback }: Props = $props();

	let email = $state('');
	const canSend = $derived(email.trim().length > 3 && !busy);
</script>

<h2 class="auth__title">{@html formatFont(text('account.resetTitle'))}</h2>
<p class="auth__hint">{@html formatFont(text('account.resetHint'))}</p>

<form
	class="auth__form"
	onsubmit={(event) => {
		event.preventDefault();
		onforgot(email);
	}}
>
	<EmailField
		id="reset-email"
		testId="reset-email-input"
		label={text('account.email')}
		bind:value={email}
	/>

	{#if error}
		<p class="auth__error" data-testid="reset-error-text">{@html formatFont(error)}</p>
	{/if}
	{#if info}
		<p class="auth__info" data-testid="reset-info-text">{@html formatFont(info)}</p>
	{/if}

	<!--
		Попередження про теку «Спам» — не ввічливість. Домен новий, і лист туди
		справді потрапляє; без цього рядка людина вважає, що нічого не надіслали, і
		тисне ще раз.
	-->
	<p class="auth__hint">{@html formatFont(text('account.resetSpam'))}</p>

	<button type="submit" class="auth__primary" disabled={!canSend} data-testid="reset-submit-btn">
		{@html formatFont(text('account.resetSend'))}
	</button>
	<button type="button" class="auth__link" onclick={onback} data-testid="reset-back-btn">
		{@html formatFont(text('account.resetBack'))}
	</button>
</form>
