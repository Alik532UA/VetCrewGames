<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { settings } from '$lib/services/settings.svelte';
	import { t, formatFont } from '$lib/i18n';
	import { MythGameController } from '$lib/controllers/mythGame.svelte';
	import { RotateCcw, Home } from 'lucide-svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import MythCard from '$lib/components/MythCard.svelte';

	const lang = $derived(languageFromParam(page.params.lang));

	// Компонент лише СТВОРЮЄ контролер і малює його стан (SVELTE-CORE-v8 § 3.1).
	// Стан партії гине разом зі сторінкою — саме тому контролер тут `new`, а не
	// module-level синглтон.
	const game = new MythGameController();

	onMount(() => {
		game.start();
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('myth.title', () => goto(langPath(lang, 'quiz/play')));
	});

	/** Максимум партії — у підказці, а не знаменником. Див. `GameOverCard`. */
	const maxHint = $derived(`${t('common.maxScore')}: ${game.maxScore}`);
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
				<!--
					Тільки набране. Максимум — у підказці, тими самими двома атрибутами,
					що в `GameOverCard`: `title` для миші, `aria-label` для читалки.
				-->
				<span class="score-value" title={maxHint} aria-label="{game.sessionScore}. {maxHint}"
					>{game.sessionScore}</span
				>
			</div>
			<div class="game-over-actions">
				<button class="btn-play-again" onclick={() => game.reset()}>
					<RotateCcw size={24} />
					{@html formatFont(t('common.playAgain'))}
				</button>
				<a href={langPath(languageFromParam(page.params.lang))} class="btn-menu">
					<Home size={24} />
					{@html formatFont(t('common.mainMenu'))}
				</a>
			</div>
		</div>
	{:else if game.current}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<div class="myth-card-wrapper" in:fade={{ duration: 300 }}>
			{#each [game.current] as q (q.id)}
				<MythCard
					question={q}
					onanswer={(truth) => game.answer(truth)}
					onnext={() => game.nextRound()}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		flex: 1;
		width: 95%;
		max-width: 500px;
		padding: 10svh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2svh, var(--space-lg));
		margin: 0 auto;
		box-sizing: border-box;
	}
	@media (min-width: 769px) {
		.game-page {
			padding: 15svh 0 var(--space-2xl);
		}
	}

	.myth-card-wrapper {
		width: 100%;
		display: grid;
		grid-template-areas: 'card';
		align-items: start;
	}

	.round-indicator-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: var(--space-sm);
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

	.game-over-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 300px;
	}

	.btn-play-again,
	.btn-menu {
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

	.btn-menu {
		background: rgba(255, 255, 255, 0.1);
		color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.btn-menu:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: translateY(-2px);
	}
</style>
