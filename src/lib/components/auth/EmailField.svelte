<script lang="ts">
	import { Mail } from 'lucide-svelte';
	import { formatFont } from '$lib/i18n';

	/**
	 * Поле пошти зі значком і підписом, що спливає.
	 *
	 * Виносилося не «для чистоти»: у `AuthForm` воно стояло ДВІЧІ дослівно — у
	 * режимі входу й у режимі відновлення пароля, — разом із чотирма правилами
	 * стилів на кожне. Дві копії того самого поля розійшлися б на першій же
	 * правці відступів, і розійшлися б тихо: обидві виглядали б правильними
	 * окремо.
	 *
	 * Розміри тут ті самі, що в `PasswordInput`: висота 44px, місце ліворуч під
	 * значок, той самий радіус і рамка. Саме про це говорив автор — «кнопки та
	 * поля різного розміру», і однакові вони лишаються тому, що описані в двох
	 * місцях однаково, а не тому, що хтось звірив на око.
	 */
	interface Props {
		id: string;
		value: string;
		/** Текст підпису, що спливає з поля. */
		label: string;
		/** Готовий локатор поля: `account-email-input`. */
		testId: string;
	}

	let { id, value = $bindable(''), label, testId }: Props = $props();
</script>

<div class="mail">
	<Mail size={18} class="mail__lead" aria-hidden="true" />
	<input
		{id}
		type="email"
		bind:value
		class="mail__input"
		placeholder=" "
		autocomplete="email"
		inputmode="email"
		data-testid={testId}
	/>
	<label class="mail__label" for={id}>{@html formatFont(label)}</label>
</div>

<style>
	.mail {
		position: relative;
		display: flex;
		align-items: center;
	}

	/* Акцент на фокусі — лише прозорістю: другий відтінок у полі заборонений. */
	:global(.mail__lead) {
		position: absolute;
		left: var(--space-md);
		color: var(--color-text);
		opacity: 0.65;
		pointer-events: none;
	}

	.mail:focus-within :global(.mail__lead) {
		opacity: 1;
	}

	.mail__input {
		width: 100%;
		/* 44px — власний стандарт сенсорної цілі, той самий, що в кнопок форми. */
		min-height: var(--account-control);
		padding: 0 var(--space-md) 0 3rem;
		border: 1px solid var(--account-line, var(--color-border));
		border-radius: var(--account-field-radius);
		transition: border-color var(--transition-fast);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
	}

	/*
	 * Підпис у полі, що спливає на межу. Тло «чипа» — те саме, що в поля: інакше
	 * на межі просвічувала б рамка й підпис читався б перекресленим.
	 */
	/*
	 * БЕЗ `opacity` НА ПІДПИСІ, і це не смак.
	 *
	 * Тут стояло `opacity: 0.7`, щоб підпис у порожньому полі читався як
	 * плейсхолдер. Гейт контрасту заміряв 3.97:1 проти потрібних 4.5 —
	 * `rgb(178, 187, 173)` на `rgb(58, 90, 42)` у темі `light-green`.
	 *
	 * Прозорість тут і не потрібна: за § 1 це ПІДПИС, а не плейсхолдер, і
	 * приглушувати його означає приглушувати єдине, що називає поле.
	 */
	.mail__label {
		position: absolute;
		left: 3rem;
		top: 50%;
		translate: 0 -50%;
		padding: 0 var(--space-xs);
		background: var(--color-bg-card);
		color: var(--color-text);
		font-size: var(--font-size-sm);
		pointer-events: none;
	}

	.mail__input:focus ~ .mail__label,
	.mail__input:not(:placeholder-shown) ~ .mail__label {
		top: 0;
		scale: 0.82;
	}
</style>
