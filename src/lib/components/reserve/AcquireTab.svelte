<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import OriginChoice from './OriginChoice.svelte';
	import { comfortOf, speciesById, speciesOfBiome, type ReserveBiome } from '$lib/reserve/species';
	import type { Enclosure, ReserveCommand } from '$lib/reserve/types';

	/**
	 * Прийом тварини: кого, куди й яким каналом.
	 *
	 * Три рішення в одному екрані, і всі три показані з наслідками ДО кліку. Вид
	 * несе свої вимоги до вольєра, вольєр — множник швидкості для цього виду,
	 * канал — ціну й плату обома шкалами. У цьому вся гра: чорний ринок дешевший
	 * грошима і дорожчий усім іншим.
	 *
	 * Вид вибирається КНОПКАМИ, а не списком. Випадний список приховує вибір за
	 * кліком і показує наслідки лише того рядка, на який уже натиснули; тут же
	 * кожен вид — окреме рішення з окремими вимогами до вольєра. Той самий висновок
	 * уже застосований до розміру вольєра.
	 *
	 * Попередження не просто попереджають, а ведуть: «немає вільного вольєра»
	 * відкриває будівництво з уже підставленим рекомендованим розміром, «немає
	 * ветеринара» наймає ветеринара. Текст, який називає перешкоду й лишає гравця
	 * її шукати, — це половина роботи.
	 */
	interface Props {
		biome: ReserveBiome;
		freeEnclosures: Enclosure[];
		hasVet: boolean;
		onCommand: (command: ReserveCommand) => void;
		/** Перейти до будівництва з підставленим розміром під вибраний вид. */
		onBuildFor: (size: number) => void;
	}

	let { biome, freeEnclosures, hasVet, onCommand, onBuildFor }: Props = $props();

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
</script>

<div class="take">
	<h3 class="take__title">{@html formatFont(t('reserve.pickSpecies'))}</h3>
	<div class="take__row" role="group" aria-label={t('reserve.pickSpecies')}>
		{#each options as species (species.id)}
			<button
				type="button"
				class="chip"
				class:chip--on={picked?.id === species.id}
				aria-pressed={picked?.id === species.id}
				onclick={() => (speciesId = species.id)}
				data-testid="reserve-species-{species.id}-btn"
			>
				{@html formatFont(t(species.nameKey))}
			</button>
		{/each}
	</div>

	{#if picked}
		<!-- Вимоги ВИБРАНОГО виду: у кнопці їм не місце, а знати їх треба. -->
		<p class="take__note" data-testid="reserve-species-needs-text">
			{@html formatFont(t('reserve.needsMin'))}
			{picked.minSize} · {@html formatFont(t('reserve.needsRec'))}
			{picked.recSize}
		</p>
	{/if}

	<!--
		Або вибір вольєра, або попередження — ніколи разом.

		Доти на екрані стояли обидва: порожній список «куди поселити» й напис, що
		селити нікуди. Це два різні стани того самого питання, і показувати їх
		одночасно означає казати дві речі, з яких правдива одна.
	-->
	{#if fitting.length === 0}
		<div class="warn" data-testid="reserve-no-free-text">
			<span>{@html formatFont(t('reserve.noFreeEnclosure'))}</span>
			<button
				type="button"
				class="warn__do"
				onclick={() => onBuildFor(picked?.recSize ?? 3)}
				data-testid="reserve-build-for-species-btn"
			>
				{@html formatFont(t('reserve.build'))}
			</button>
		</div>
	{:else}
		<h3 class="take__title">{@html formatFont(t('reserve.pickEnclosure'))}</h3>
		<!--
			Вольєри — КНОПКИ, а не випадний список, з тієї самої причини, що й види:
			кожен вольєр несе своє число комфорту, і побачити його треба ДО вибору, а
			не після. Список показував лише той рядок, на який уже натиснули.
		-->
		<div class="take__row" role="group" aria-label={t('reserve.pickEnclosure')}>
			{#each fitting as enclosure (enclosure.id)}
				<button
					type="button"
					class="chip chip--home"
					class:chip--on={home?.id === enclosure.id}
					aria-pressed={home?.id === enclosure.id}
					onclick={() => (enclosureId = enclosure.id)}
					data-testid="reserve-enclosure-{enclosure.id}-btn"
				>
					<b>#{enclosure.id}</b>
					<span class="chip__meta">
						{@html formatFont(t('reserve.size'))}
						{enclosure.size} · ×{picked ? comfortOf(picked, enclosure.size).toFixed(1) : '1'}
					</span>
				</button>
			{/each}
		</div>
	{/if}

	<!--
		Ветеринара немає — попереджаємо, але НЕ забороняємо. Забрати тварину з біди
		краще, ніж лишити її там; за це просто критикують, і мінус репутації
		нараховує ядро. Кнопка поруч — щоб виправити це тут, а не шукати меню.
	-->
	{#if !hasVet}
		<div class="warn" data-testid="reserve-no-vet-text">
			<span>{@html formatFont(t('reserve.noVetWarning'))}</span>
			<button
				type="button"
				class="warn__do"
				onclick={() => onCommand({ type: 'hire', role: 'vet' })}
				data-testid="reserve-hire-vet-now-btn"
			>
				{@html formatFont(t('reserve.hire'))}
			</button>
		</div>
	{/if}

	<OriginChoice
		onPick={(origin) =>
			onCommand({
				type: 'acquire',
				origin,
				speciesId: picked?.id ?? '',
				enclosureId: home?.id ?? 0
			})}
	/>
</div>

<style>
	.take {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.take__title {
		margin: 0;
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.take__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
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

	.take__note {
		margin: 0;
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.75;
	}

	/* Кнопка вольєра ширша за кнопку виду: у неї два рядки — номер і комфорт. */
	.chip--home {
		display: flex;
		flex-direction: column;
		gap: 2px;
		align-items: flex-start;
		padding: 4px var(--space-sm);
		text-align: left;
	}

	.chip__meta {
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	.warn {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
		margin: 0;
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error), transparent 85%);
		font-size: var(--font-size-sm);
	}

	/* Кнопка в попередженні — вихід із нього, тому виглядає як дія, а не як текст. */
	.warn__do {
		flex: 0 0 auto;
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
</style>
