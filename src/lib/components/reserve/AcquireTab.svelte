<script lang="ts">
	import { t } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { ORIGINS, type AnimalOrigin } from '$lib/reserve/constants';
	import { comfortOf, speciesById, speciesOfBiome, type ReserveBiome } from '$lib/reserve/species';
	import type { Enclosure, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Прийом тварини: кого, куди й яким каналом.
	 *
	 * Три рішення в одному екрані, і всі три показані з наслідками ДО кліку.
	 * Вид несе свої вимоги до вольєра, вольєр — множник швидкості для цього
	 * виду, канал — ціну й плату «Користю планеті». У цьому вся гра: чорний
	 * ринок дешевший грошима і дорожчий усім іншим.
	 */
	interface Props {
		biome: ReserveBiome;
		freeEnclosures: Enclosure[];
		hasVet: boolean;
		onCommand: (command: ReserveCommand) => void;
	}

	let { biome, freeEnclosures, hasVet, onCommand }: Props = $props();

	/** Кого можна взяти: лише види цього біома. Лева в тундру не привозять. */
	const options = $derived(speciesOfBiome(biome));

	/*
	 * Порожній рядок, а не `options[0].id`: початкове значення захопило б список
	 * ОДИН раз, а біом приходить пропсом. Обраний вид обчислюється нижче з
	 * відкатом на перший — так він правильний і до першого кліку.
	 */
	let speciesId = $state('');
	let enclosureId = $state(0);

	const picked = $derived(speciesById(speciesId) ?? options[0]);
	/** Вольєри, які підходять виду: менші за мінімум просто не пропонують. */
	const fitting = $derived(
		picked ? freeEnclosures.filter((e) => e.size >= picked.minSize) : freeEnclosures
	);
	/** Куди селимо: якщо вибране вже не підходить, беремо перший придатний. */
	const home = $derived(fitting.find((e) => e.id === enclosureId) ?? fitting[0]);

	const money = (value: number) => value.toLocaleString(settings.locale);
</script>

<div class="take">
	<label class="take__row">
		<span>{t('reserve.pickSpecies')}</span>
		<select
			value={picked?.id ?? ''}
			onchange={(event) => (speciesId = event.currentTarget.value)}
			data-testid="reserve-species-select"
		>
			{#each options as species (species.id)}
				<option value={species.id}>
					{t(species.nameKey)} — {t('reserve.needsMin')}
					{species.minSize}, {t('reserve.needsRec')}
					{species.recSize}
				</option>
			{/each}
		</select>
	</label>

	<label class="take__row">
		<span>{t('reserve.pickEnclosure')}</span>
		<select
			value={home?.id ?? 0}
			onchange={(event) => (enclosureId = Number(event.currentTarget.value))}
			data-testid="reserve-enclosure-select"
		>
			{#each fitting as enclosure (enclosure.id)}
				<option value={enclosure.id}>
					{t('reserve.enclosure')}
					{enclosure.id} · {t('reserve.size')}
					{enclosure.size} · {t('reserve.comfort')} ×{picked
						? comfortOf(picked, enclosure.size).toFixed(1)
						: '1'}
				</option>
			{/each}
		</select>
	</label>

	{#if fitting.length === 0}
		<p class="warn" data-testid="reserve-no-free-text">{t('reserve.noFreeEnclosure')}</p>
	{/if}

	<!--
		Ветеринара немає — попереджаємо, але НЕ забороняємо. Забрати тварину з
		біди краще, ніж лишити її там; за це просто критикують, і мінус
		репутації нараховує ядро.
	-->
	{#if !hasVet}
		<p class="warn" data-testid="reserve-no-vet-text">{t('reserve.noVetWarning')}</p>
	{/if}

	<div class="take__origins">
		{#each Object.entries(ORIGINS) as [id, terms] (id)}
			<button
				type="button"
				class="origin"
				title={t(`reserve.origin.${id as AnimalOrigin}.hint` as const)}
				onclick={() =>
					onCommand({
						type: 'acquire',
						origin: id as AnimalOrigin,
						speciesId: picked?.id ?? '',
						enclosureId: home?.id ?? 0
					})}
				data-testid="reserve-acquire-{id}-btn"
			>
				<b>{t(`reserve.origin.${id as AnimalOrigin}` as const)}</b>
				<span class="origin__meta">
					−{money(terms.price + terms.logistics)}
					<span class:origin__bad={terms.impact < 0}>
						{terms.impact > 0 ? '+' : ''}{terms.impact}
					</span>
				</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.take {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.take__row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.take__row select {
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
	}

	.take__origins {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.origin {
		display: flex;
		flex: 1 1 8rem;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		min-height: 44px;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.origin__meta {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.origin__bad {
		color: var(--color-error);
	}

	.warn {
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error), transparent 85%);
		font-size: var(--font-size-sm);
	}
</style>
