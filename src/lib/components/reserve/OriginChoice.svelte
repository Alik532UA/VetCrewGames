<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { ORIGINS, type AnimalOrigin } from '$lib/reserve/constants';

	/**
	 * Звідки тварина: три канали з повним переліком наслідків.
	 *
	 * У цьому виборі й лежить головна думка гри: чорний ринок дешевший ГРОШИМА і
	 * дорожчий усім іншим — обома шкалами та ще й розірваними контрактами. Щоб це
	 * читалося, кожне число має бути підписане: доти в рядку стояло «−7 000 −25», і
	 * друге число не належало нікому — ані видно, що це «Користь планеті», ані що
	 * репутація мовчки падає ще на дванадцять.
	 *
	 * Підписи ті самі, що в шапці: гравець уже знає, що таке «Користь планеті», бо
	 * дивиться на неї весь час.
	 */
	interface Props {
		onPick: (origin: AnimalOrigin) => void;
	}

	let { onPick }: Props = $props();

	const money = (value: number) => value.toLocaleString(settings.locale);

	/**
	 * Знак ставимо самі, і мінус — ТИПОГРАФСЬКИЙ.
	 *
	 * Поруч у стовпці стоїть ціна з «−» (U+2212). Дефіс із клавіатури читається як
	 * інший символ на іншій висоті, і три рядки перестають вирівнюватися оком.
	 */
	const signed = (value: number) =>
		value < 0 ? `−${Math.abs(value)}` : `${value > 0 ? '+' : ''}${value}`;
</script>

<div class="origins">
	{#each Object.entries(ORIGINS) as [id, terms] (id)}
		<button
			type="button"
			class="origin"
			title={t(`reserve.origin.${id as AnimalOrigin}.hint` as const)}
			onclick={() => onPick(id as AnimalOrigin)}
			data-testid="reserve-acquire-{id}-btn"
		>
			<b>{@html formatFont(t(`reserve.origin.${id as AnimalOrigin}` as const))}</b>

			<span class="origin__line">
				<span>{@html formatFont(t('reserve.budget'))}</span>
				<b class="origin__bad">−{money(terms.price + terms.logistics)}</b>
			</span>
			<span class="origin__line">
				<span>{@html formatFont(t('reserve.impact'))}</span>
				<b class:origin__bad={terms.impact < 0}>{signed(terms.impact)}</b>
			</span>
			<span class="origin__line">
				<span>{@html formatFont(t('reserve.reputation'))}</span>
				<b class:origin__bad={terms.reputation < 0}>{signed(terms.reputation)}</b>
			</span>
		</button>
	{/each}
</div>

<style>
	.origins {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-top: var(--space-sm);
	}

	.origin {
		display: flex;
		flex: 1 1 9rem;
		flex-direction: column;
		gap: 2px;
		align-items: stretch;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.origin__line {
		display: flex;
		gap: var(--space-sm);
		justify-content: space-between;
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.85;
	}

	.origin__bad {
		color: var(--color-error);
	}
</style>
