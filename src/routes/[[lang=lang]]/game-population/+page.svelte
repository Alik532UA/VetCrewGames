<script lang="ts">
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { RotateCcw } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n/index';
	import { settings } from '$lib/services/settings.svelte';
	import { PopulationGameController } from '$lib/controllers/populationGame.svelte';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import PopulationBoard from '$lib/components/PopulationBoard.svelte';

	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Правила гри — у контролері; тут лишається СПОСІБ ВВЕДЕННЯ: миша, палець,
	 * клік і подвійний клік (SVELTE-CORE-v8 § 3.1). Ділити довелося саме так:
	 * `game.dropOnSlot()` викликають усі чотири шляхи, і жоден із них
	 * контролеру не видно.
	 */
	const game = new PopulationGameController();


	/** Максимум партії — у підказці, а не знаменником. Див. `GameOverCard`. */
	const maxHint = $derived(`${t('common.maxScore')}: ${game.maxScore}`);

	/*
	 * Заголовок і «назад» — справа СТОРІНКИ, не дошки.
	 *
	 * Слухачі дотику переїхали разом із перетягуванням у `PopulationBoard`:
	 * вони обслуговують саме його розкладку, і в спільній вікторині мусять
	 * зникати разом із раундом.
	 */
	onMount(() =>
		settings.claimHeader('population.title', () => goto(langPath(lang, 'quiz/play')))
	);
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
				<!-- Тільки набране; максимум — у підказці. Див. `GameOverCard`. -->
				<span class="score-value" title={maxHint} aria-label="{game.sessionScore}. {maxHint}"
					>{game.sessionScore}</span
				>
			</div>
			<button class="btn-play-again" onclick={() => game.reset()} data-testid="population-play-again-btn">
				<RotateCcw size={24} />
				{@html formatFont(t('common.playAgain'))}
			</button>
		</div>
	{:else}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<PopulationBoard {game} />
	{/if}
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
