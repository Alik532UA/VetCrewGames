<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Check, X } from 'lucide-svelte';
	import { page } from '$app/state';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { HabitatGameController } from '$lib/controllers/habitatGame.svelte';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import HabitatModeSelect from '$lib/components/HabitatModeSelect.svelte';

	// Правила — у контролері; тут показ і кліки (SVELTE-CORE-v8 § 3.1).
	const game = new HabitatGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	/** Підпис варіанта залежить від підрежиму: континент чи природна зона. */
	const optionKey = (option: string): TranslationKey =>
		(game.mode === 'continents'
			? `habitat.continent.${option}`
			: `habitat.biome.${option}`) as TranslationKey;

	onMount(() => {
		settings.setHeaderTitle('habitat.title');
		return () => settings.setHeaderTitle(null);
	});
</script>

<div class="game-page">
	{#if game.mode === null}
		<HabitatModeSelect onchoose={(mode) => game.chooseMode(mode)} />
	{:else if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.roundResults.length}
			{lang}
			onPlayAgain={() => game.reset()}
			testId="habitat-game-over"
		/>
	{:else if game.round}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<div class="animal text-panel">
			<img
				src={game.round.animal.image}
				alt={formatPlain(td(game.round.animal.nameKey))}
				class="animal__image"
				loading="lazy"
				width="300"
				height="400"
			/>
			<span class="animal__name" data-testid="habitat-animal-name-text">
				{@html formatFont(td(game.round.animal.nameKey))}
			</span>
		</div>

		<div class="question text-panel">
			<p class="question__prompt">
				{@html formatFont(
					t(game.mode === 'continents' ? 'habitat.prompt.continents' : 'habitat.prompt.biomes')
				)}
			</p>
			<p class="question__hint">{@html formatFont(t('habitat.hintMultiple'))}</p>
		</div>

		<div class="options">
			{#each game.round.options as option (option)}
				{@const isCorrect = game.round.correct.includes(option)}
				{@const isSelected = game.selected.includes(option)}
				<button
					type="button"
					class="option"
					class:option--selected={!game.checked && isSelected}
					class:option--hit={game.checked && isCorrect && isSelected}
					class:option--missed={game.checked && isCorrect && !isSelected}
					class:option--wrong={game.checked && !isCorrect && isSelected}
					disabled={game.checked}
					onclick={() => game.toggle(option)}
					data-testid="habitat-option-btn-{option}"
				>
					{#if game.checked && isCorrect}
						<Check size={16} aria-hidden="true" />
					{:else if game.checked && isSelected}
						<X size={16} aria-hidden="true" />
					{/if}
					{@html formatFont(t(optionKey(option)))}
				</button>
			{/each}
		</div>

		{#if !game.checked}
			<button
				type="button"
				class="btn-primary"
				disabled={!game.canCheck}
				onclick={() => game.check()}
				data-testid="habitat-check-btn"
			>
				{@html formatFont(t('habitat.check'))}
			</button>
		{:else}
			<div class="result" transition:slide={{ duration: 300 }}>
				<div
					class="result__header"
					class:result__header--correct={game.outcome === 'correct'}
					class:result__header--partial={game.outcome === 'partial'}
					data-testid="habitat-outcome-status"
				>
					{#if game.outcome === 'correct'}
						{@html formatFont(t('habitat.correct'))}
					{:else if game.outcome === 'partial'}
						{@html formatFont(t('habitat.partial'))}
					{:else}
						{@html formatFont(t('habitat.incorrect'))}
					{/if}
				</div>

				<p class="result__answer">
					{@html formatFont(t('habitat.correctAnswerWas'))}
					<strong>
						{@html formatFont(
							game.round.correct.map((option) => t(optionKey(option))).join(', ')
						)}
					</strong>
				</p>

				{#if game.round.noteKey}
					<p class="result__note" data-testid="habitat-note-text">
						{@html formatFont(t(game.round.noteKey as TranslationKey))}
					</p>
				{/if}

				<button
					type="button"
					class="btn-primary"
					onclick={() => game.nextRound()}
					data-testid="habitat-next-btn"
				>
					{@html formatFont(t('common.next'))}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: 560px;
		padding: 4dvh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2dvh, var(--space-md));
		margin: 0 auto;
		box-sizing: border-box;
	}

	.round-indicator-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	/* --- Раунд --- */
	.animal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
	}

	.animal__image {
		width: clamp(96px, 22dvh, 168px);
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-md);
		border: 2px solid var(--color-bg-panel-dark);
		box-shadow: var(--shadow-card);
	}

	.animal__name {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}

	.question {
		text-align: center;
	}

	.question__prompt {
		margin: 0;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}

	.question__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	/*
	 * `min(160px, 100%)`, а не гола довжина: інакше 160px стають ПІДЛОГОЮ
	 * ширини колонки, і на екрані 320px сітка розпирає сторінку
	 * (FLUID-SIZING-v8 § 1.1).
	 */
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
		gap: var(--space-sm);
		width: 100%;
	}

	.option {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		/* 44px — власний стандарт проєкту для сенсорних цілей (ACCESSIBILITY § 8). */
		min-height: 44px;
		padding: var(--space-sm);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option--selected {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent), transparent 75%);
	}

	.option--hit {
		border-color: var(--color-success);
		background: color-mix(in srgb, var(--color-success), transparent 70%);
	}

	/* Пропущену правильну показуємо пунктиром: гравець її не обирав. */
	.option--missed {
		border-style: dashed;
		border-color: var(--color-success);
	}

	.option--wrong {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error), transparent 75%);
	}

	.option:disabled {
		cursor: default;
	}

	.btn-primary {
		width: 100%;
		max-width: 320px;
		padding: var(--space-md);
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
		transition: all var(--transition-fast);
	}

	.btn-primary:disabled {
		background: var(--color-disabled);
		color: var(--color-disabled-text);
		box-shadow: none;
		cursor: not-allowed;
	}

	.btn-primary:not(:disabled):hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 15%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}

	.result__header {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-error);
	}

	.result__header--correct {
		color: var(--color-success);
	}

	.result__header--partial {
		color: var(--color-warning);
	}

	.result__answer {
		margin: 0;
		text-align: center;
		color: var(--color-text);
	}

	.result__note {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: 1.5;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-accent);
	}
</style>
