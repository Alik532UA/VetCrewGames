<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { habitatImage } from '$lib/config/habitat-game';
	import { enclosurePrice } from '$lib/reserve/prices';
	import { RESERVE_BIOMES, speciesOfBiome, type ReserveBiome } from '$lib/reserve/species';

	/**
	 * Локації заповідника: чотири картки й нічого більше.
	 *
	 * Ні заголовка, ні опису — навмисно. Заголовок «Де стоятиме заповідник» ще й
	 * казав неправду: заповідник може стояти в усіх локаціях одночасно, кожна веде
	 * власну партію. А підпис «біом вирішує, кого сюди привозять» був неправдою
	 * удвічі: нікого не привозять — тварин забирають з біди, купують або
	 * витягують із чорного ринку. Чотири картки самі кажуть, що треба вибрати
	 * місце; будь-який текст поверх них або повторював би це, або брехав.
	 *
	 * Порядок у картці: скільки видів, які саме, і скільки коштує найдешевший
	 * придатний вольєр. Ціна ОСТАННЯ, бо доти вона розрізала список навпіл —
	 * кількість видів і самі види опинялися по різні боки від грошей.
	 */
	interface Props {
		onPick: (biome: ReserveBiome) => void;
	}

	let { onPick }: Props = $props();

	/** Найдешевший придатний вольєр для найдрібнішого мешканця локації. */
	function entryCost(biome: ReserveBiome): number {
		const sizes = speciesOfBiome(biome).map((species) => species.recSize);
		return enclosurePrice(Math.min(...sizes), 2);
	}
</script>

<section class="picker" data-testid="reserve-biome-picker-section">
	<div class="picker__grid">
		{#each RESERVE_BIOMES as biome (biome)}
			{@const species = speciesOfBiome(biome)}
			<button
				type="button"
				class="biome"
				onclick={() => onPick(biome)}
				data-testid="reserve-biome-{biome}-btn"
			>
				<!--
					`alt` порожній навмисно: назва локації стоїть поруч текстом, і читалка
					оголосила б її двічі. Зображення тут — упізнавання, а не інформація.
				-->
				<img
					class="biome__img"
					src={habitatImage('biomes', biome)}
					alt=""
					width="96"
					height="96"
					loading="lazy"
					decoding="async"
					data-testid="reserve-biome-{biome}-img"
				/>

				<span class="biome__body">
					<span class="biome__name">{@html formatFont(t(`habitat.biome.${biome}` as const))}</span>
					<span class="biome__facts">
						{species.length}
						{@html formatFont(t('reserve.speciesHere'))}
					</span>
					<span class="biome__species">
						{@html formatFont(species.map((s) => t(s.nameKey)).join(', '))}
					</span>
					<span class="biome__facts">
						{@html formatFont(t('reserve.fromPrice'))}
						{entryCost(biome).toLocaleString(settings.locale)}
					</span>
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

	.picker__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--space-sm);
	}

	.biome {
		display: flex;
		gap: var(--space-md);
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

	/*
	 * Зображення не стискається: `flex-shrink: 0` тут не оптимізація, а умова
	 * читабельності — довгий список видів інакше видавлював би картинку в смужку.
	 */
	.biome__img {
		flex: 0 0 auto;
		width: clamp(56px, 18vw, 96px);
		height: clamp(56px, 18vw, 96px);
		border-radius: var(--radius-sm);
		object-fit: cover;
	}

	.biome__body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		/* `min-width: 0` дозволяє довгому списку видів переноситися, а не розпирати. */
		min-width: 0;
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
