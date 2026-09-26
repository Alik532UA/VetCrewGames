<script lang="ts">
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { RotateCcw } from 'lucide-svelte';
	import { t, td, formatFont } from '$lib/i18n/index';
	import { settings } from '$lib/services/settings.svelte';
	import {
		PopulationGameController,
		populationReview
	} from '$lib/controllers/populationGame.svelte';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import PopulationBoard from '$lib/components/PopulationBoard.svelte';
	import ReviewPanel from '$lib/components/ReviewPanel.svelte';
	import ReviewList from '$lib/components/ReviewList.svelte';

	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Правила гри — у контролері; тут лишається СПОСІБ ВВЕДЕННЯ: миша, палець,
	 * клік і подвійний клік (SVELTE-CORE-v8 § 3.1). Ділити довелося саме так:
	 * `game.dropOnSlot()` викликають усі чотири шляхи, і жоден із них
	 * контролеру не видно.
	 */
	const game = new PopulationGameController();
	/** Котре минуле питання переглядають (від нуля); `null` — грають поточне. */
	let viewing = $state<number | null>(null);

	/** Максимум партії — у підказці, а не знаменником. Див. `GameOverCard`. */
	const maxHint = $derived(`${t('common.maxScore')}: ${game.maxScore}`);

	/*
	 * Заголовок і «назад» — справа СТОРІНКИ, не дошки.
	 *
	 * Слухачі дотику переїхали разом із перетягуванням у `PopulationBoard`:
	 * вони обслуговують саме його розкладку, і в спільній вікторині мусять
	 * зникати разом із раундом.
	 */
	onMount(() => settings.claimHeader('population.title', () => goto(langPath(lang, 'quiz/play'))));
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver && viewing !== null}
		{@render review('review.backToResults')}
	{:else if game.gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
				<!-- Тільки набране; максимум — у підказці. Див. `GameOverCard`. -->
				<span class="score-value" title={maxHint} aria-label="{game.sessionScore}. {maxHint}"
					>{game.sessionScore}</span
				>
			</div>
			<button
				class="btn-play-again"
				onclick={() => {
					viewing = null;
					game.reset();
				}}
				data-testid="population-play-again-btn"
			>
				<RotateCcw size={24} />
				{@html formatFont(t('common.playAgain'))}
			</button>
		</div>
		<!-- Питання партії переліком — перегляд у кінці (прохання автора 2026-09-26). -->
		<ReviewList
			results={game.roundResults}
			label={(i) => (game.history[i]?.correctOrder ?? []).map((a) => td(a.nameKey)).join(' · ')}
			onopen={(i) => (viewing = i)}
		/>
	{:else}
		<div class="round-indicator-wrapper">
			<!-- Відповідані сегменти відкривають питання свого раунду. -->
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
				onreview={(i) => (viewing = i)}
				{viewing}
			/>
		</div>

		{#if viewing === null}
			<PopulationBoard {game} />
		{:else}
			{@render review('review.back')}
		{/if}
	{/if}

	<!-- Перегляд — та сама дошка «перевірено», без «Далі» (`populationReview`). -->
	{#snippet review(backKey: 'review.back' | 'review.backToResults')}
		{@const record = game.history[viewing ?? 0]}
		{#if record}
			<ReviewPanel
				index={viewing ?? 0}
				total={game.totalRounds}
				{backKey}
				onback={() => (viewing = null)}
			>
				<PopulationBoard game={populationReview(record)} hideNext />
			</ReviewPanel>
		{/if}
	{/snippet}
</div>

<style>
	@media (min-width: 769px) {
		.game-page {
			padding: var(--space-2xl) 0 var(--space-2xl);
		}
	}
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		width: 95%;
		max-width: var(--measure-population);
		padding: var(--space-md) 0;
		gap: clamp(var(--space-xs), 2svh, var(--space-lg));
		margin: 0 auto;
	}
	.round-indicator-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: var(--space-sm);
		position: relative;
		width: 100%;
	}
	.game-over-card {
		width: 100%;
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xl);
		text-align: center;
		animation: blur-in 3s ease 400ms both;
	}
	.game-over-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		margin: 0;
		color: var(--color-text);
	}
	.game-over-score {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.score-label {
		font-size: var(--font-size-md);
		color: var(--color-text-muted);
		text-transform: uppercase;
	}
	.score-value {
		font-size: 3rem;
		font-weight: 900;
		color: var(--color-accent);
		line-height: 1;
	}
	.btn-play-again {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-xl);
		border-radius: var(--radius-md);
		border: none;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
	}
	.btn-play-again {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-play-again:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
		background: var(--color-accent-hover);
	}
</style>
