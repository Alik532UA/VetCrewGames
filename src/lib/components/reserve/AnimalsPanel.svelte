<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { speciesById, type ReserveBiome } from '$lib/reserve/species';
	import AcquireTab from './AcquireTab.svelte';
	import type { Animal, Enclosure, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Мешканці, випущені й прийом — три вкладки в одній панелі.
	 *
	 * «Мешканці» — це ті, хто В заповіднику. Випущені живуть у природі, і
	 * тримати їх у тому самому списку означало б показувати заповідник більшим,
	 * ніж він є, а заразом ховати головне досягнення гри в кінці переліку.
	 */
	interface Props {
		biome: ReserveBiome;
		residents: Animal[];
		released: Animal[];
		freeEnclosures: Enclosure[];
		hasVet: boolean;
		selectedId: number | null;
		onSelect: (id: number) => void;
		onCommand: (command: ReserveCommand) => void;
	}

	let {
		biome,
		residents,
		released,
		freeEnclosures,
		hasVet,
		selectedId,
		onSelect,
		onCommand
	}: Props = $props();

	type Tab = 'here' | 'wild' | 'take';
	let tab = $state<Tab>('here');

	/**
	 * Повертає КЛЮЧ, а не готовий рядок.
	 *
	 * Форматування мусить лишатися в розмітці: інваріант у `src/i18n-font.test.ts`
	 * читає саме її, і підпис, зібраний у скрипті, проходив би крізь нього
	 * непоміченим — рівно так і зʼявилася ця помилка вперше.
	 */
	const nameKeyOf = (animal: Animal) => speciesById(animal.speciesId)?.nameKey ?? 'reserve.animals';

	const TABS: Array<{ id: Tab; key: 'reserve.animals' | 'reserve.released' | 'reserve.acquire' }> =
		[
			{ id: 'here', key: 'reserve.animals' },
			{ id: 'wild', key: 'reserve.released' },
			{ id: 'take', key: 'reserve.acquire' }
		];
</script>

<div class="tabs" role="tablist">
	{#each TABS as item (item.id)}
		<button
			type="button"
			role="tab"
			class="chip"
			class:chip--on={tab === item.id}
			aria-selected={tab === item.id}
			onclick={() => (tab = item.id)}
			data-testid="reserve-tab-{item.id}-btn"
		>
			{@html formatFont(t(item.key))}
		</button>
	{/each}
</div>

{#if tab === 'here'}
	{#if residents.length === 0}
		<p class="empty" data-testid="reserve-empty-text">{@html formatFont(t('reserve.empty'))}</p>
	{:else}
		<ul class="list">
			{#each residents as animal (animal.id)}
				<li>
					<button
						type="button"
						class="row"
						class:row--on={animal.id === selectedId}
						aria-pressed={animal.id === selectedId}
						onclick={() => onSelect(animal.id)}
						data-testid="reserve-animal-{animal.id}-btn"
					>
						<b>{@html formatFont(t(nameKeyOf(animal)))}</b>
						<span class="row__meta">
							{@html formatFont(t(`reserve.stage.${animal.stage}` as const))} · {@html formatFont(
								t('reserve.enclosure')
							)}
							{animal.enclosureId}
						</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
{:else if tab === 'wild'}
	{#if released.length === 0}
		<p class="empty" data-testid="reserve-none-released-text">
			{@html formatFont(t('reserve.noneReleased'))}
		</p>
	{:else}
		<ul class="list">
			{#each released as animal (animal.id)}
				<li class="row" data-testid="reserve-released-{animal.id}-item">
					<b>{@html formatFont(t(nameKeyOf(animal)))}</b>
					<span class="row__meta">
						<!-- Прочерк, а не нуль: у сейвах версії 1 дня випуску не існувало. -->
						{@html formatFont(
							animal.releasedOnDay === null
								? t('reserve.releasedUnknown')
								: `${t('reserve.releasedOn')} ${animal.releasedOnDay}`
						)}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
{:else}
	<AcquireTab {biome} {freeEnclosures} {hasVet} {onCommand} />
{/if}

<style>
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
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

	.row {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		width: 100%;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.row--on {
		outline: 2px solid var(--color-accent);
	}

	.row__meta {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.empty {
		margin: 0;
		opacity: 0.75;
	}
</style>
