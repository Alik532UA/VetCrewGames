<script lang="ts">
	import { Delete, LogIn } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import OnlineWindow from './OnlineWindow.svelte';
	import { CODE_MAX, CODE_MIN } from '$lib/controllers/onlineHub.svelte';

	/**
	 * «ПІДКЛЮЧИТИСЯ» — ВІКНО З КОДОМ (рішення автора 2026-09-27: кожна з трьох доріг хабу
	 * відкриває своє вікно). Гру не вибирають: її каже сама кімната (`OnlineHubState.join`).
	 *
	 * ## Власна цифрова клавіатура
	 *
	 * Прохання автора 2026-09-27: «код кімнати — це тільки цифри, тож можемо зробити власну
	 * візуальну клавіатуру, щоб на компʼютері можна було мишкою ввести, а на телефоні не
	 * викликати клавіатуру системи». Тому під полем — десять цифр і «стерти», а поле має
	 * `inputmode="none"`: системна клавіатура не вилазить і не закриває пів екрана, а
	 * фізична на компʼютері й «Вставити» з повідомлення працюють як і доти.
	 *
	 * Клік мишею по клавіші фокуса з поля не забирає: той, хто клацає й друкує впереміш, не
	 * мусить щоразу повертатися в поле. Дотик і клавіатура поводяться звичайно — фокус іде
	 * на клавішу, і читалка каже, що натиснуто.
	 *
	 * Фокус на відкритті — одразу в поле, а не на заголовок, як в інших вікнах: людина
	 * відкрила це вікно, щоб набрати код. `Enter` у полі підключає: поле з кнопкою — форма.
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

	/** Клавіші рядками телефонної клавіатури; нуль — під вісімкою, «стерти» — праворуч. */
	const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

	/**
	 * Код зводиться до ЦИФР одразу, у значенні, а не лише на вигляд: вставка з мессенджера
	 * приносить пробіли, дефіси й «код: », і перевірка довжини бачила б їх як цифри.
	 * Провідні нулі зберігаються: «07» — чинний двоцифровий код.
	 */
	const normaliseCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_MAX);

	const press = (digit: string) => (joinCode = normaliseCode(joinCode + digit));
	const erase = () => (joinCode = joinCode.slice(0, -1));

	/** Миша фокуса з поля не забирає; дотик і клавіатура — як завжди. */
	function keepFocus(event: PointerEvent) {
		if (event.pointerType === 'mouse' && document.activeElement === codeInput) {
			event.preventDefault();
		}
	}

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
			`inputmode="none"` — системної клавіатури немає: цифри дає власна, під полем. Не
			`type="number"`: той ковтає провідні нулі й приймає `e` та мінус, а код — рядок
			цифр, а не число. `pattern` тут навмисно немає: iOS за ним відкривав би цифрову
			клавіатуру всупереч `inputmode`.
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
				inputmode="none"
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

		<div class="keypad" role="group" aria-label={t('online.keypad')}>
			{#each DIGITS as digit (digit)}
				<button
					type="button"
					class="keypad__key"
					onpointerdown={keepFocus}
					onclick={() => press(digit)}
					data-testid="online-key-{digit}-btn"
				>
					{digit}
				</button>
			{/each}
			<span class="keypad__gap" aria-hidden="true"></span>
			<button
				type="button"
				class="keypad__key"
				onpointerdown={keepFocus}
				onclick={() => press('0')}
				data-testid="online-key-0-btn"
			>
				0
			</button>
			<button
				type="button"
				class="keypad__key keypad__key--erase"
				onpointerdown={keepFocus}
				onclick={erase}
				aria-label={t('online.keyErase')}
				data-testid="online-key-erase-btn"
			>
				<Delete size={24} aria-hidden="true" />
			</button>
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

	/*
	 * Клавіатура — три стовпці, як на телефоні, посередині вікна. Ширина — від одиниці
	 * вікна (`.fill`): на телефоні клавіша 44px заввишки, на ноутбуці росте разом із текстом.
	 */
	.keypad {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-xs);
		align-self: center;
		width: min(100%, 14em);
	}

	.keypad__key {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: max(44px, calc(var(--fill-u) * 2.5));
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		touch-action: manipulation;
	}

	@media (hover: hover) {
		.keypad__key:hover {
			border-color: var(--color-accent);
		}
	}

	/* «Стерти» — тихіше за цифри: рамка без заливки, як друга дорога вікна. */
	.keypad__key--erase {
		background: none;
		color: var(--color-text-on-panel);
	}

	/* Порожня клітинка ліворуч від нуля — як на телефоні: нуль стоїть під вісімкою. */
	.keypad__gap {
		display: block;
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
