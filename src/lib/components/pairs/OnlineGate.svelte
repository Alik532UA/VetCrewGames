<script lang="ts">
	import { t, formatFont } from '$lib/i18n';

	/**
	 * Вхід у спільну партію: імʼя, «створити кімнату» і «зайти за кодом».
	 *
	 * Компонент нічого не знає ні про базу, ні про кімнату — він збирає два поля й
	 * кличе те, що дали. Виніс зі сторінки, коли та перетнула межу розміру файлу:
	 * форма входу існує рівно до появи матчу й далі не показується жодного разу,
	 * тож у сторінці вона тільки заважала читати мережеву частину.
	 */
	interface Props {
		/** Імʼя гравця. Двобічне: сторінка його ще й запамʼятовує у сховищі. */
		name: string;
		/** Код кімнати, який ввели руками. */
		joinCode: string;
		/** Поки триває вхід, кнопки не приймають повторних натискань. */
		busy: boolean;
		onCreate: () => void;
		onJoin: () => void;
	}

	let {
		name = $bindable(),
		joinCode = $bindable(),
		busy,
		onCreate,
		onJoin
	}: Props = $props();

	/** Код кімнати — рівно пʼять літер; коротший вводити ще не закінчили. */
	const CODE_LENGTH = 5;
</script>

<div class="gate">
	<label class="gate__field">
		<span>{@html formatFont(t('pairs.yourName'))}</span>
		<input
			type="text"
			bind:value={name}
			maxlength="24"
			placeholder={t('memory.you')}
			data-testid="pairs-name-input"
		/>
	</label>

	<button
		type="button"
		class="btn-primary"
		onclick={onCreate}
		aria-disabled={busy}
		data-testid="pairs-create-btn"
	>
		{@html formatFont(t('pairs.createRoom'))}
	</button>

	<label class="gate__field">
		<span>{@html formatFont(t('pairs.roomCode'))}</span>
		<input
			type="text"
			bind:value={joinCode}
			maxlength={CODE_LENGTH}
			class="gate__code"
			data-testid="pairs-code-input"
		/>
	</label>

	<button
		type="button"
		class="btn-primary"
		onclick={onJoin}
		aria-disabled={busy || joinCode.trim().length < CODE_LENGTH}
		data-testid="pairs-join-btn"
	>
		{@html formatFont(t('pairs.joinRoom'))}
	</button>
</div>

<style>
	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 22rem;
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.gate__field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		font-size: var(--font-size-sm);
	}

	.gate__field input {
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
	}

	/* Код диктують уголос і вводять великими: так його й показуємо. */
	.gate__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
	}
</style>
