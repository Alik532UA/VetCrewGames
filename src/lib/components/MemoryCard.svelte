<script lang="ts">
	import { PawPrint } from 'lucide-svelte';
	import { td, formatFont, formatPlain } from '$lib/i18n';
	import type { MemorySlot } from '$lib/controllers/memoryGame.svelte';

	/**
	 * Одна картка на дошці: сорочкою догори або лицем.
	 *
	 * Переворот — справжній, через `rotateY` на двох боках. Тому обидва боки в
	 * розмітці ЗАВЖДИ: підміна вмісту в момент кліку виглядала б як блимання,
	 * а не як переворот, і ніякий перехід її не врятував би.
	 */
	interface Props {
		slot: MemorySlot;
		/** Партія триває, а картку чіпати не можна: лежать уже дві. */
		disabled: boolean;
		onflip: () => void;
		testId: string;
	}

	let { slot, disabled, onflip, testId }: Props = $props();

	const open = $derived(slot.faceUp || slot.takenBy !== null);
</script>

<button
	type="button"
	class="card"
	class:card--open={open}
	class:card--taken={slot.takenBy !== null}
	disabled={disabled || open}
	aria-label={open ? formatPlain(td(slot.card.nameKey)) : undefined}
	onclick={onflip}
	data-testid={testId}
>
	<span class="card__inner">
		<span class="card__face card__face--back" aria-hidden="true">
			<PawPrint size={28} />
		</span>
		<span class="card__face card__face--front">
			<img src={slot.card.image} alt="" class="card__image" loading="lazy" width="499" height="665" />
			<span class="card__name">{@html formatFont(td(slot.card.nameKey))}</span>
		</span>
	</span>
</button>

<style>
	.card {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		padding: 0;
		border: none;
		background: none;
		/* Глибина перевороту. Без неї обидва боки просто зникали б і з'являлися. */
		perspective: 700px;
		cursor: pointer;
	}

	.card:disabled {
		cursor: default;
	}

	.card__inner {
		position: relative;
		display: block;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform var(--transition-normal);
	}

	.card--open .card__inner {
		transform: rotateY(180deg);
	}

	.card__face {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		overflow: hidden;
		border-radius: var(--radius-md);
		/* Зворотний бік не малюється — інакше видно обидва одночасно. */
		backface-visibility: hidden;
		border: 2px solid var(--color-border);
	}

	.card__face--back {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 15%);
		color: color-mix(in srgb, var(--color-accent), transparent 35%);
	}

	.card:hover:not(:disabled) .card__face--back {
		border-color: var(--color-accent);
	}

	.card__face--front {
		transform: rotateY(180deg);
		background: var(--color-bg-surface);
	}

	.card--taken .card__face--front {
		border-color: var(--color-success);
	}

	.card__image {
		width: 100%;
		flex: 1;
		min-height: 0;
		object-fit: cover;
	}

	.card__name {
		width: 100%;
		padding: 2px;
		font-size: var(--font-size-xs);
		text-align: center;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}
</style>
