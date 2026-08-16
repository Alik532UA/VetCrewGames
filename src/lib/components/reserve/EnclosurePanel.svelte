<script lang="ts">
	import { t } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import {
		enclosurePrice,
		QUALITIES,
		repairPrice,
		upgradePrice,
		type Quality
	} from '$lib/reserve/constants';
	import { ENCLOSURE_SIZES } from '$lib/reserve/species';
	import type { Enclosure, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Вольєри: побудувати, полагодити, підняти якість, знести.
	 *
	 * Два виміри — розмір і якість — показані як дві шкали, а не як тридцять
	 * кнопок. Розмір вирішує, ХТО тут поміститься; якість — наскільки йому тут
	 * добре. Ціна перераховується одразу, бо саме вона й робить вибір рішенням.
	 */
	interface Props {
		enclosures: Enclosure[];
		/** `id` вольєрів, у яких хтось живе: їх не можна знести. */
		occupied: Set<number>;
		effectiveQualityOf: (enclosure: Enclosure) => Quality;
		onCommand: (command: ReserveCommand) => void;
	}

	let { enclosures, occupied, effectiveQualityOf, onCommand }: Props = $props();

	let size = $state(3);
	let quality = $state<Quality>(2);

	const money = (value: number) => value.toLocaleString(settings.locale);
	const percent = (value: number) => `${Math.round(value * 100)}%`;
</script>

<div class="build">
	<h3 class="build__title">{t('reserve.build')}</h3>

	<label class="build__row">
		<span>{t('reserve.size')}: <b>{size}</b></span>
		<input
			type="range"
			min={ENCLOSURE_SIZES[0]}
			max={ENCLOSURE_SIZES[ENCLOSURE_SIZES.length - 1]}
			bind:value={size}
			data-testid="reserve-build-size-slider"
		/>
	</label>

	<div class="build__qualities" role="group" aria-label={t('reserve.quality')}>
		{#each QUALITIES as value (value)}
			<button
				type="button"
				class="chip"
				class:chip--on={quality === value}
				aria-pressed={quality === value}
				onclick={() => (quality = value)}
				data-testid="reserve-quality-{value}-btn"
			>
				{t(`reserve.quality.${value}` as const)}
			</button>
		{/each}
	</div>

	<button
		type="button"
		class="btn-primary build__go"
		onclick={() => onCommand({ type: 'build', size, quality })}
		data-testid="reserve-build-btn"
	>
		{t('reserve.build')} — {money(enclosurePrice(size, quality))}
	</button>
</div>

<ul class="list">
	{#each enclosures as enclosure (enclosure.id)}
		{@const worn = effectiveQualityOf(enclosure) < enclosure.quality}
		<li class="card" data-testid="reserve-enclosure-{enclosure.id}-item">
			<div class="card__head">
				<b>{t('reserve.enclosure')} {enclosure.id}</b>
				<span class="card__meta">
					{t('reserve.size')}
					{enclosure.size} · {t(`reserve.quality.${effectiveQualityOf(enclosure)}` as const)}
				</span>
			</div>

			<div class="card__meta" class:card__meta--bad={worn}>
				{t('reserve.durability')}: {percent(enclosure.durability)}
			</div>

			<div class="card__actions">
				{#if enclosure.durability < 1}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'repair', enclosureId: enclosure.id })}
						data-testid="reserve-repair-{enclosure.id}-btn"
					>
						{t('reserve.repair')} — {money(
							repairPrice(enclosure.size, enclosure.quality, enclosure.durability)
						)}
					</button>
				{/if}

				{#if enclosure.quality < 3}
					{@const next = (enclosure.quality + 1) as Quality}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'upgrade', enclosureId: enclosure.id, quality: next })}
						data-testid="reserve-upgrade-{enclosure.id}-btn"
					>
						{t('reserve.upgrade')} — {money(upgradePrice(enclosure.size, enclosure.quality, next))}
					</button>
				{/if}

				{#if !occupied.has(enclosure.id)}
					<button
						type="button"
						class="chip"
						onclick={() => onCommand({ type: 'demolish', enclosureId: enclosure.id })}
						data-testid="reserve-demolish-{enclosure.id}-btn"
					>
						{t('reserve.demolish')}
					</button>
				{/if}
			</div>
		</li>
	{/each}
</ul>

<style>
	.build {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
	}

	.build__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.build__row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.build__row input {
		width: 100%;
		/* Повзунок теж має бути ціллю для пальця (ACCESSIBILITY-v8). */
		min-height: 44px;
	}

	.build__qualities,
	.card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.build__go {
		max-width: none;
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.chip--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.card__head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		justify-content: space-between;
	}

	.card__meta {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	/* Впала якість — це подія, а не дрібниця: її видно кольором. */
	.card__meta--bad {
		color: var(--color-error);
		opacity: 1;
	}
</style>
