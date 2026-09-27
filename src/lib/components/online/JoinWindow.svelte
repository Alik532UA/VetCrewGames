<script lang="ts">
	import { LogIn } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import OnlineWindow from './OnlineWindow.svelte';
	import { CODE_MAX, CODE_MIN } from '$lib/controllers/onlineHub.svelte';

	/**
	 * «ПІДКЛЮЧИТИСЯ» — ВІКНО З КОДОМ (рішення автора 2026-09-27: кожна з трьох доріг хабу
	 * відкриває своє вікно). Гру не вибирають: її каже сама кімната (`OnlineHubState.join`).
	 *
	 * Фокус — одразу в поле, а не на заголовок, як в інших вікнах: людина відкрила це вікно,
	 * щоб набрати код, і на телефоні з фокусом одразу зʼявляється цифрова клавіатура.
	 * `Enter` у полі підключає: поле з кнопкою — форма.
	 */
	interface Props {
		/** Код кімнати, який вводять. Двобічне. */
		joinCode: string;
		/** Поки хаб питає кімнату за кодом, «Підключитися» не приймає повторних натискань. */
		busy: boolean;
		onJoin: () => void;
		onBack: () => void;
		/** Вікно відкрила людина: фокус — у поле коду. */
		focusField?: boolean;
	}

	let { joinCode = $bindable(), busy, onJoin, onBack, focusField = false }: Props = $props();

	let codeInput = $state<HTMLInputElement | null>(null);

	/**
	 * Код зводиться до ЦИФР одразу, у значенні, а не лише на вигляд: вставка з мессенджера
	 * приносить пробіли, дефіси й «код: », і перевірка довжини бачила б їх як цифри.
	 * Провідні нулі зберігаються: «07» — чинний двоцифровий код.
	 */
	const normaliseCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_MAX);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		// Закороткий код — назад у поле: пояснення дає тост хабу, а набирати далі — тут.
		if (joinCode.length < CODE_MIN) codeInput?.focus();
		onJoin();
	}

	const focus = (node: HTMLInputElement) => {
		if (focusField) node.focus();
	};
</script>

<OnlineWindow scope="online-join" {onBack}>
	{#snippet title()}
		<LogIn size={24} aria-hidden="true" />
		{@html formatFont(t('online.join'))}
	{/snippet}

	<form class="join" onsubmit={submit}>
		<label class="join__label" for="online-code">
			<span>{@html formatFont(t('pairs.roomCode'))}</span>
		</label>
		<!--
			`inputmode="numeric"` — цифрова клавіатура на телефоні. Не `type="number"`: той
			ковтає провідні нулі й приймає `e` та мінус, а код — рядок цифр, а не число.
		-->
		<div class="field-shell has-input-tools">
			<input
				id="online-code"
				type="text"
				bind:this={codeInput}
				bind:value={joinCode}
				oninput={() => (joinCode = normaliseCode(joinCode))}
				maxlength={CODE_MAX}
				class="join__code"
				inputmode="numeric"
				pattern="[0-9]*"
				autocomplete="off"
				spellcheck="false"
				data-testid="online-code-input"
				{@attach focus}
			/>
			<InputTools
				bind:value={joinCode}
				input={codeInput}
				scope="online-code"
				fieldLabel={t('pairs.roomCode')}
				onchange={(raw) => (joinCode = normaliseCode(raw))}
			/>
		</div>
		<button
			type="submit"
			class="btn-primary join__go"
			aria-disabled={busy}
			data-testid="online-join-btn"
		>
			{@html formatFont(t('online.join'))}
		</button>
	</form>
</OnlineWindow>

<style>
	.join {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.join__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/* Код диктують уголос і вводять великими: так його й показуємо — посередині поля. */
	.join__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
		text-align: center;
		font-size: var(--font-size-xl);
	}

	/* Висота — від одиниці вікна (`.fill`), дно — сенсорна ціль; ширина — від слова. */
	.join__go {
		align-self: center;
		min-width: min(100%, 12em);
		min-height: max(48px, calc(var(--fill-u) * 3));
		padding: 0 var(--space-xl);
		font-size: var(--font-size-lg);
	}
</style>
