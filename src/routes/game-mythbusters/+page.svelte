<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { settings } from '$lib/settings.svelte';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { myths, type GameQuestion } from '$lib/config/myth-game';
	import { animals } from '$lib/config/population-game';
	import { CheckCircle2, XCircle, RotateCcw } from 'lucide-svelte';

	// Game state
	let currentQuestion = $state<GameQuestion | null>(null);
	let answered = $state(false);
	let selectedTrue = $state<boolean | null>(null);
	let isCorrect = $state(false);

	const TOTAL_ROUNDS = 10;
	let roundNumber = $state(1);
	let sessionScore = $state(0);
	let gameOver = $state(false);

	let localUsedIds = $state<string[]>([]);
	let globalUsedIds = $state<string[]>([]);

	function nextQuestion() {
		if (roundNumber > TOTAL_ROUNDS) {
			currentQuestion = null;
			gameOver = true;
			return;
		}

		let availableMyths = myths.filter(m => !localUsedIds.includes(m.id));
		let globalAvailable = availableMyths.filter(m => !globalUsedIds.includes(m.id));

		if (globalAvailable.length === 0) {
			// Clear global history but maintain local exclusions for this game
			globalUsedIds = [];
			if (typeof window !== 'undefined') {
				localStorage.setItem('vetcrewgames_shown_myths', JSON.stringify([]));
			}
			globalAvailable = availableMyths;
		}

		if (globalAvailable.length === 0) return; // Fallback

		const randomMyth = globalAvailable[Math.floor(Math.random() * globalAvailable.length)];
		const animal = animals.find(a => a.id === randomMyth.animalId)!;

		currentQuestion = { ...randomMyth, animal };
		localUsedIds.push(randomMyth.id);
		globalUsedIds.push(randomMyth.id);

		if (typeof window !== 'undefined') {
			localStorage.setItem('vetcrewgames_shown_myths', JSON.stringify(globalUsedIds));
		}

		answered = false;
		selectedTrue = null;
	}

	function handleAnswer(choice: boolean) {
		if (answered || !currentQuestion) return;
		
		selectedTrue = choice;
		isCorrect = choice === currentQuestion.isTrue;
		answered = true;
		if (isCorrect) {
			sessionScore++;
			settings.addScore(1);
		}
	}

	function onNext() {
		roundNumber++;
		nextQuestion();
	}

	function resetGame() {
		roundNumber = 1;
		sessionScore = 0;
		localUsedIds = [];
		gameOver = false;
		nextQuestion();
	}

	onMount(() => {
		const stored = localStorage.getItem('vetcrewgames_shown_myths');
		if (stored) {
			try { globalUsedIds = JSON.parse(stored); } catch(e) {}
		}
		nextQuestion();
	});
</script>

<GameHeader titleKey="myth.title" />

<div class="game-page">
	{#if gameOver}
		<div class="game-over-card" in:fade={{ duration: 300 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver' as any))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore' as any))}</span>
				<span class="score-value">{sessionScore} / {TOTAL_ROUNDS}</span>
			</div>
			<button class="btn-play-again" onclick={resetGame}>
				<RotateCcw size={24} />
				{@html formatFont(t('common.playAgain' as any))}
			</button>
		</div>
	{:else if currentQuestion}
		<div class="round-indicator">{@html formatFont(t('population.round' as any))} {roundNumber} / {TOTAL_ROUNDS}</div>
		{#key currentQuestion.id}
			<div class="myth-card" 
				class:myth-card--correct={answered && isCorrect} 
				class:myth-card--wrong={answered && !isCorrect}
				in:fade={{ duration: 300 }}
			>
				<div class="myth-card__image-wrap">
					<img src={currentQuestion.animal.image} alt={formatPlain(td(currentQuestion.animal.nameKey))} class="myth-card__image" loading="lazy" />
					<div class="myth-card__animal-name">{@html formatFont(td(currentQuestion.animal.nameKey))}</div>
				</div>
				
				<div class="myth-card__content">
					<p class="myth-card__statement">{@html formatFont(t(currentQuestion.statementKey as any))}</p>
					
					{#if !answered}
						<div class="myth-card__actions" transition:fade>
							<button class="btn-myth" onclick={() => handleAnswer(false)}>
								{@html formatFont(t('myth.myth'))}
							</button>
							<button class="btn-truth" onclick={() => handleAnswer(true)}>
								{@html formatFont(t('myth.truth'))}
							</button>
						</div>
					{:else}
						<div class="myth-card__result" in:slide>
							<button class="btn-next" onclick={onNext}>
								{@html formatFont(t('myth.next'))}
							</button>
							<div class="result-header" class:result-header--correct={isCorrect}>
								{#if isCorrect}
									<CheckCircle2 size={24} />
									<span>{@html formatFont(t('myth.correct'))}</span>
								{:else}
									<XCircle size={24} />
									<span>{@html formatFont(t('myth.incorrect'))}</span>
								{/if}
							</div>
							<p class="myth-card__explanation">{@html formatFont(t(currentQuestion.explanationKey as any))}</p>
						</div>
					{/if}
				</div>
			</div>
		{/key}
	{/if}
</div>

<style>
	.game-page { display: flex; flex-direction: column; align-items: center; width: 95%; max-width: 500px; padding: var(--space-2xl) 0 var(--space-2xl); gap: var(--space-lg); margin: 0 auto; }
	@media (min-width: 769px) { .game-page { padding: var(--space-2xl) 0 var(--space-2xl); } }

	.myth-card {
		width: 100%; background: var(--color-bg-surface); border-radius: var(--radius-lg); overflow: hidden;
		box-shadow: var(--shadow-card); border: 4px solid transparent; transition: all var(--transition-normal);
		display: flex; flex-direction: column;
	}
	.myth-card--correct { border-color: var(--color-success); box-shadow: var(--shadow-glow-success); }
	.myth-card--wrong { border-color: var(--color-error); box-shadow: var(--shadow-glow-error); }

	.myth-card__image-wrap { width: 50%; aspect-ratio: 3 / 4; position: relative; margin: var(--space-lg) auto 0; border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-card); border: 2px solid var(--color-bg-panel-dark); }
	.myth-card__image { width: 100%; height: 100%; object-fit: cover; }
	.myth-card__animal-name { 
		position: absolute; bottom: var(--space-sm); right: var(--space-sm); 
		background: rgba(0,0,0,0.6); color: white; padding: 2px var(--space-sm); 
		border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
		backdrop-filter: blur(4px);
	}

	.myth-card__content { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); }
	.myth-card__statement { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); text-align: center; line-height: 1.4; margin: 0; }

	.myth-card__actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
	
	.btn-myth, .btn-truth {
		padding: var(--space-md); border-radius: var(--radius-md); border: none;
		font-weight: var(--font-weight-bold); font-size: var(--font-size-md); cursor: pointer;
		transition: all var(--transition-fast); text-transform: uppercase; letter-spacing: 1px;
	}

	.btn-myth { background: #e5e5e5; color: #333; box-shadow: 0 4px 0 #b0b0b0; }
	.btn-myth:hover { transform: translateY(-2px); box-shadow: 0 6px 0 #b0b0b0; background: #eee; }

	.btn-truth { background: var(--color-accent); color: var(--color-text-on-accent); box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%); }
	.btn-truth:hover { transform: translateY(-2px); box-shadow: 0 6px 0 color-mix(in srgb, var(--color-accent), black 30%); background: var(--color-accent-hover); }

	.myth-card__result { display: flex; flex-direction: column; gap: var(--space-md); animation: slide-up 0.4s ease both; }
	.result-header { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); font-weight: var(--font-weight-bold); font-size: var(--font-size-xl); }
	.result-header--correct { color: var(--color-success); }
	
	.myth-card__explanation { font-size: var(--font-size-md); line-height: 1.5; color: var(--color-text); background: color-mix(in srgb, var(--color-bg-panel), transparent 90%); padding: var(--space-md); border-radius: var(--radius-md); border-left: 4px solid var(--color-accent); margin: 0; }

	.btn-next {
		padding: var(--space-md); background: var(--color-bg-panel); color: var(--color-text-on-panel);
		border-radius: var(--radius-md); border: none; font-weight: var(--font-weight-bold);
		cursor: pointer; transition: all var(--transition-fast); box-shadow: 0 4px 0 var(--color-bg-panel-dark);
	}
	.btn-next:hover { transform: translateY(-2px); box-shadow: 0 6px 0 var(--color-bg-panel-dark); background: var(--color-bg-card-hover); }

	.round-indicator {
		font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel); opacity: 0.8; margin-bottom: var(--space-sm);
	}

	.game-over-card {
		width: 100%; background: var(--color-bg-surface); border-radius: var(--radius-lg); padding: var(--space-2xl);
		box-shadow: var(--shadow-card); display: flex; flex-direction: column; align-items: center; gap: var(--space-xl);
		text-align: center;
	}
	.game-over-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; color: var(--color-text); }
	.game-over-score { display: flex; flex-direction: column; gap: var(--space-xs); }
	.score-label { font-size: var(--font-size-md); color: var(--color-text-muted); text-transform: uppercase; }
	.score-value { font-size: 3rem; font-weight: 900; color: var(--color-accent); line-height: 1; }
	.btn-play-again {
		display: flex; align-items: center; justify-content: center; gap: var(--space-sm);
		padding: var(--space-md) var(--space-xl); background: var(--color-accent); color: var(--color-text-on-accent);
		border-radius: var(--radius-md); border: none; font-weight: var(--font-weight-bold); font-size: var(--font-size-lg);
		cursor: pointer; transition: all var(--transition-fast); box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-play-again:hover { transform: translateY(-2px); box-shadow: 0 6px 0 color-mix(in srgb, var(--color-accent), black 30%); background: var(--color-accent-hover); }
</style>
