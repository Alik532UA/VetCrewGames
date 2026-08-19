<script lang="ts">
	import { fade } from 'svelte/transition';
	import { td } from '$lib/i18n/index';
	import type { Animal } from '$lib/config/population-game';

	/**
	 * Підказка на порожньому місці: мініатюри тварин, які ще не розставлені.
	 *
	 * Показується на наведенні й дає покласти тварину одним кліком, не
	 * тягнучи її через пів екрана. Порожніх місць двоє — слот і комірка
	 * запасу, — і поводяться вони однаково, тож розмітка одна на обох:
	 * дві копії розійшлися б на першій же правці.
	 */
	interface Props {
		animals: Animal[];
		/** Уже взята тварина — її мініатюру треба підсвітити. */
		pickedId?: string | null;
		onpick: (animal: Animal) => void;
	}

	let { animals, pickedId = null, onpick }: Props = $props();
</script>

<!-- Поява на кореневому елементі, а не в батьків: обгортка навколо компонента
	 стала б зайвою коміркою гриду й з'їла б `grid-area: 1 / 1`. -->
<div class="mini-ghost-grid" transition:fade={{ duration: 150 }}>
	{#each animals as animal (animal.id)}
		<button
			class="mini-ghost-card"
			class:mini-ghost-card--selected={animal.id === pickedId}
			onclick={(e) => {
				e.stopPropagation();
				onpick(animal);
			}}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onpick(animal)}
			aria-label={td(animal.nameKey)}
		>
			<img
				src={animal.image}
				alt=""
				class="mini-ghost-card__img"
				loading="lazy"
				width="60"
				height="80"
			/>
		</button>
	{/each}
</div>

<style>
	.mini-ghost-grid {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: row;
		gap: 4px;
		padding: 6px;
		justify-content: center;
		align-items: flex-end;
		width: 100%;
		height: 100%;
		z-index: 10;
	}
	.mini-ghost-card {
		flex: 1;
		max-width: 28%;
		aspect-ratio: 3 / 4;
		border-radius: 4px;
		overflow: hidden;
		background-color: var(--color-bg-card);
		opacity: 0.9;
		border: 1px solid rgba(255, 255, 255, 0.4);
		transition: all var(--transition-fast);
		display: flex;
		flex-direction: column;
		cursor: pointer;
		padding: 0;
		margin-bottom: 4px;
	}
	.mini-ghost-card:hover {
		transform: scale(1.1);
		z-index: 2;
		border-color: var(--color-accent);
	}
	.mini-ghost-card__img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.mini-ghost-card--selected {
		opacity: 1;
		border-color: var(--color-accent);
		box-shadow: 0 0 8px var(--color-accent);
		transform: scale(1.1);
		z-index: 2;
	}
</style>
