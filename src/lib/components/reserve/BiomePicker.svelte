<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { enclosurePrice } from '$lib/reserve/constants';
	import { RESERVE_BIOMES, speciesOfBiome, type ReserveBiome } from '$lib/reserve/species';

	/**
	 * З чого починається партія: де стоятиме заповідник.
	 *
	 * Це і є рівень складності, але названий не «легко / важко», а місцем. Ліс
	 * дає девʼять переважно дрібних видів і дешеві вольєри; савана — чотири
	 * величезних, кожен із яких коштує як пів стартового бюджету. Гравець бачить
	 * ЧОМУ важче, а не просто напис «важко».
	 *
	 * Вибір робиться один раз і назавжди: біом вирішує, які види сюди
	 * приїжджають, а отже — які вольєри мали сенс. Змінити його посеред партії
	 * означало б викинути все збудоване.
	 */
	interface Props {
		onPick: (biome: ReserveBiome) => void;
	}

	let { onPick }: Props = $props();

	/** Найдешевший придатний вольєр для найдрібнішого мешканця біома. */
	function entryCost(biome: ReserveBiome): number {
		const sizes = speciesOfBiome(biome).map((species) => species.recSize);
		return enclosurePrice(Math.min(...sizes), 2);
	}
</script>

<section class="picker" data-testid="reserve-biome-picker-section">
	<h2 class="picker__title">{@html formatFont(t('reserve.pickBiome'))}</h2>
	<p class="picker__hint">{@html formatFont(t('reserve.pickBiomeHint'))}</p>

	<div class="picker__grid">
		{#each RESERVE_BIOMES as biome (biome)}
			{@const species = speciesOfBiome(biome)}
			<button
				type="button"
				class="biome"
				onclick={() => onPick(biome)}
				data-testid="reserve-biome-{biome}-btn"
			>
				<span class="biome__name">{@html formatFont(t(`habitat.biome.${biome}` as const))}</span>
				<span class="biome__facts">
					{species.length}
					{@html formatFont(t('reserve.speciesHere'))}
				</span>
				<span class="biome__facts">
					{@html formatFont(t('reserve.fromPrice'))}
					{entryCost(biome).toLocaleString(settings.locale)}
				</span>
				<span class="biome__species">
					{@html formatFont(species.map((s) => t(s.nameKey)).join(', '))}
				</span>
			</button>
		{/each}
	</div>
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.picker__title {
		margin: 0;
		font-size: var(--font-size-lg);
	}

	.picker__hint {
		margin: 0;
		font-size: var(--font-size-sm);
		opacity: 0.8;
	}

	.picker__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--space-sm);
	}

	.biome {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
		min-height: 44px;
		padding: var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.biome__name {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
	}

	.biome__facts {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}

	.biome__species {
		font-size: var(--font-size-sm);
		opacity: 0.65;
	}
</style>
