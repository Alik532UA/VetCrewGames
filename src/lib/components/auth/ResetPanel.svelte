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
		if (!canSend) return;
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

	<button
		type="submit"
		class="auth__btn auth__btn--main"
		aria-disabled={!canSend}
		data-testid="reset-submit-btn"
	>
		{@html formatFont(text('account.resetSend'))}
	</button>
	<button type="button" class="auth__link" onclick={onback} data-testid="reset-back-btn">
		{@html formatFont(text('account.resetBack'))}
	</button>
</form>

<style>
	/*
	 * ВЛАСНІ ПРАВИЛА, а не позичені в `AuthForm.svelte`.
	 *
	 * Тут не було жодного `style`, і класи `auth__*` збігалися з іменами в
	 * `AuthForm`. Виглядало як спільний набір — а Svelte стилі СКОПУЄ per
	 * компонент: правила сусіда отримують його хеш і на ці вузли не діють
	 * ніколи. Тобто панель малювалася голим текстом: два заголовки без кеглю,
	 * кнопки поспіль в одному рядку.
	 *
	 * Мовчало це тому, що компонента не імпортував ніхто — гейт `structure.test`
	 * ходить від маршрутів, і відʼєднаний файл до нього не доходив. Щойно панель
	 * підключили, гейт назвав усі вісім класів одразу.
	 *
	 * Дублювання з `AuthForm` тут навмисне й дешевше за два інші виходи:
	 * `:global` вивів би правила з-під скоупу для всього застосунку, а спільний
	 * файл стилів на два компоненти — це третє місце, куди треба не забути
	 * зайти.
	 */
	.auth__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	.auth__form {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	/* Кегль, а не прозорість: `opacity` тут опускає пару під 4.5:1. */
	.auth__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.auth__error,
	.auth__info {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-accent);
		font-weight: var(--font-weight-bold);
	}

	/* Та сама міра, що в полів і кнопок форми входу: 44px і на всю ширину. */
	.auth__btn {
		display: flex;
		align-items: center;
		justify-content: center;
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

	.auth__btn[aria-disabled='true'] {
		cursor: not-allowed;
	}

	/*
	 * «Повернутися» — посиланням: це вихід із панелі, а не другий рівноправний
	 * варіант. Підкреслення обовʼязкове — колір як єдина ознака натискального
	 * заборонений.
	 */
	.auth__link {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-xs);
		border: none;
		background: none;
		color: var(--color-accent);
		font: inherit;
		font-size: var(--font-size-sm);
		text-decoration: underline;
		cursor: pointer;
	}
</style>
