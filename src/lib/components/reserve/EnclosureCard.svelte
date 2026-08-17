<script lang="ts">
	import { t, td, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import type { Quality } from '$lib/reserve/constants';
	import { effectiveQuality } from '$lib/reserve/simulation';
	import { repairPrice, upgradePrice } from '$lib/reserve/prices';
	import { speciesById } from '$lib/reserve/species';
	import type { Animal, Enclosure, ReserveCommand } from '$lib/reserve/types';
	import MapCard from './MapCard.svelte';

	/**
	 * Картка ВОЛЬЄРА: скільки в ньому міцності й що з ним можна зробити.
	 *
	 * Доти на карті вибиралася лише тварина, і порожній вольєр був нічим: його
	 * видно, а взяти не можна. Ремонт і покращення жили тільки списком у панелі
	 * «Вольєри» — тобто щоб відремонтувати те, що бачиш, треба було закрити карту,
	 * відкрити список і знайти в ньому потрібний номер.
	 *
	 * Тепер тап по паркану чи землі всередині відкриває саму будівлю. Список у
	 * панелі лишається: коли вольєрів двадцять, обійти їх поспіль швидше, ніж
	 * тицяти кожен на карті. Це два різні способи однієї роботи, а не дублювання.
	 */
	interface Props {
		enclosure: Enclosure;
		/** Хто тут живе; `null` — порожній, і тоді його можна знести. */
		resident: Animal | null;
		onCommand: (command: ReserveCommand) => void;
		/** Перейти до картки мешканця. */
		onAnimal: (animalId: number) => void;
		onClose: () => void;
	}

	let { enclosure, resident, onCommand, onAnimal, onClose }: Props = $props();

	const money = (value: number) => value.toLocaleString(settings.locale);
	const percent = (value: number) => `${Math.round(value * 100)}%`;

	/** Якість, яку вольєр дає ЗАРАЗ: знос її знижує, і це видно окремо. */
	const real = $derived(effectiveQuality(enclosure));
	const worn = $derived(real < enclosure.quality);
	const next = $derived(Math.min(3, enclosure.quality + 1) as Quality);
	const species = $derived(resident ? speciesById(resident.speciesId)?.nameKey : undefined);
</script>

<MapCard
	title="{t('reserve.enclosure')} {enclosure.id}"
	id="card:enclosure"
	testid="reserve-enclosure-card"
	{onClose}
>
	<p class="pen__meta" data-testid="reserve-enclosure-size-value">
		{@html formatFont(t('reserve.size'))}
		{enclosure.size}×{enclosure.size} · {@html formatFont(t(`reserve.quality.${real}` as const))}
		{#if worn}
			<span class="pen__drop">
				({@html formatFont(t(`reserve.quality.${enclosure.quality}` as const))})
			</span>
		{/if}
	</p>

	<dl class="pen__bars">
		<dt>{@html formatFont(t('reserve.durability'))}</dt>
		<dd>
			<progress
				value={enclosure.durability}
				max="1"
				data-testid="reserve-enclosure-durability-progress"
			></progress>
			<span class:pen__drop={worn}>{percent(enclosure.durability)}</span>
		</dd>
	</dl>

	{#if resident}
		<button
			type="button"
			class="chip"
			onclick={() => onAnimal(resident.id)}
			data-testid="reserve-enclosure-resident-btn"
		>
			{@html formatFont(t('reserve.resident') + (species ? `: ${td(species)}` : ''))}
		</button>
	{:else}
		<p class="pen__meta" data-testid="reserve-enclosure-vacant-text">
			{@html formatFont(t('reserve.vacant'))}
		</p>
	{/if}

	<!--
		Ціни на кнопках, а не в підказці. Ремонт коштує пропорційно зносу, тож число
		міняється щодня — побачити його ПЕРЕД натисканням і є те рішення, яке гравець
		тут ухвалює.
	-->
	{#if enclosure.durability < 1}
		<button
			type="button"
			class="chip"
			onclick={() => onCommand({ type: 'repair', enclosureId: enclosure.id })}
			data-testid="reserve-enclosure-repair-btn"
		>
			{@html formatFont(t('reserve.repair'))} — {money(
				repairPrice(enclosure.size, enclosure.quality, enclosure.durability)
			)}
		</button>
	{/if}

	{#if enclosure.quality < 3}
		<button
			type="button"
			class="chip"
			onclick={() => onCommand({ type: 'upgrade', enclosureId: enclosure.id, quality: next })}
			data-testid="reserve-enclosure-upgrade-btn"
		>
			{@html formatFont(t('reserve.upgrade'))} — {money(
				upgradePrice(enclosure.size, enclosure.quality, next)
			)}
		</button>
	{/if}

	{#if !resident}
		<button
			type="button"
			class="chip chip--warn"
			onclick={() => {
				onCommand({ type: 'demolish', enclosureId: enclosure.id });
				onClose();
			}}
			data-testid="reserve-enclosure-demolish-btn"
		>
			{@html formatFont(t('reserve.demolish'))}
		</button>
	{/if}
</MapCard>

<style>
	.pen__meta {
		margin: 0;
		font-size: var(--font-size-sm);
		opacity: 0.85;
	}

	/* Впала якість — це подія, а не дрібниця: її видно кольором. */
	.pen__drop {
		color: var(--color-error);
		opacity: 1;
	}

	.pen__bars {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.pen__bars dt {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.pen__bars dd {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		margin: 0;
	}

	.pen__bars progress {
		flex: 1;
		min-width: 0;
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

	/* Знесення — незворотне: колір попереджає ще до натискання. */
	.chip--warn {
		color: var(--color-error);
	}
</style>
