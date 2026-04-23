<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { settings } from '$lib/services/settings.svelte';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import { myths, type GameQuestion } from '$lib/config/myth-game';
	import { animals } from '$lib/config/population-game';
	import { CheckCircle2, XCircle, RotateCcw, Home } from 'lucide-svelte';
	import { base } from '$app/paths';
	import { storage } from '$lib/services/storage';

	type ActiveQuestion = GameQuestion & { 
		animal: typeof animals[0]; 
		answered?: boolean; 
		selectedTrue?: boolean | null; 
		isCorrect?: boolean; 
	};

	// Game state
	let currentQuestion = $state<ActiveQuestion | null>(null);

	const TOTAL_ROUNDS = 10;
	let roundNumber = $state(1);
	let sessionScore = $state(0);
	let gameOver = $state(false);

	let localUsedIds = $state<string[]>([]);
	let globalUsedIds = $state<string[]>([]);

	function flyAndSlide(node: HTMLElement, { delay = 0, duration = 400, easing = cubicOut, y = 0 } = {}) {
		const style = getComputedStyle(node);
		const target_opacity = +style.opacity;
		const transform = style.transform === 'none' ? '' : style.transform;
		const height = parseFloat(style.height);
		const padding_top = parseFloat(style.paddingTop);
		const padding_bottom = parseFloat(style.paddingBottom);

		return {
			delay,
			duration,
			easing,
			css: (t: number) => {
				const y_val = y * (1 - t);
				return `
					transform: ${transform} translateY(${y_val}px);
					opacity: ${target_opacity * t};
					height: ${t * height}px;
					padding-top: ${t * padding_top}px;
					padding-bottom: ${t * padding_bottom}px;
					overflow: hidden;
				`;
			}
		};
	}

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

		currentQuestion = { 
			...randomMyth, 
			animal,
			answered: false,
			selectedTrue: null,
			isCorrect: false
		};
		localUsedIds.push(randomMyth.id);
		globalUsedIds.push(randomMyth.id);

		if (typeof window !== 'undefined') {
			localStorage.setItem('vetcrewgames_shown_myths', JSON.stringify(globalUsedIds));
		}
	}

	function handleAnswer(choice: boolean) {
		if (!currentQuestion || currentQuestion.answered) return;
		
		currentQuestion.selectedTrue = choice;
		currentQuestion.isCorrect = choice === currentQuestion.isTrue;
		currentQuestion.answered = true;
		if (currentQuestion.isCorrect) {
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
		const stored = storage.getJSON<string[]>('shown_myths');
		if (stored) {
			globalUsedIds = stored;
		}
		nextQuestion();
		settings.setHeaderTitle('myth.title');
		return () => settings.setHeaderTitle(null);
	});
</script>

<div class="game-page">
	{#if gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
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
		<div class="round-indicator-wrapper">
			{#key roundNumber}
				<div class="round-indicator" in:fly={{ y: 10, duration: 350, delay: 300 }} out:fly={{ y: -10, duration: 300 }}>
					{@html formatFont(t('population.round' as any))} {roundNumber} / {TOTAL_ROUNDS}
				</div>
			{/key}
		</div>
		
		<div class="myth-card-wrapper" in:fade={{ duration: 300 }}>
			{#each [currentQuestion] as q (q.id)}
				<div class="myth-card" 
					class:myth-card--correct={q.answered && q.isCorrect} 
					class:myth-card--wrong={q.answered && !q.isCorrect}
					in:fly={{ y: 20, duration: 350, delay: 300 }} out:flyAndSlide={{ y: -20, duration: 300 }}
				>
					<div class="myth-card__inner-key">
						<div class="myth-card__image-wrap">
							<img src={q.animal.image} alt={formatPlain(td(q.animal.nameKey))} class="myth-card__image" loading="lazy" width="200" height="266" />
							<div class="myth-card__animal-name">{@html formatFont(td(q.animal.nameKey))}</div>
						</div>
						
						<div class="myth-card__content">
							<p class="myth-card__statement">{@html formatFont(t(q.statementKey as any))}</p>
							
							<div class="myth-card__dynamic-container">
								{#if !q.answered}
									<div class="myth-card__actions" out:slide={{ duration: 400 }} in:fade>
										<button class="btn-myth" onclick={() => handleAnswer(false)}>
											{@html formatFont(t('myth.myth'))}
										</button>
										<button class="btn-truth" onclick={() => handleAnswer(true)}>
											{@html formatFont(t('myth.truth'))}
										</button>
									</div>
								{:else}
									<div class="myth-card__result" in:slide={{ duration: 400 }} out:fade>
										<button class="btn-next" onclick={onNext}>
											{@html formatFont(t('myth.next'))}
										</button>
										<div class="result-header" class:result-header--correct={q.isCorrect}>
											{#if q.isCorrect}
												<CheckCircle2 size={24} />
												<span>{@html formatFont(t('myth.correct'))}</span>
											{:else}
												<XCircle size={24} />
												<span>{@html formatFont(t('myth.incorrect'))}</span>
											{/if}
										</div>
										<p class="myth-card__explanation">{@html formatFont(t(q.explanationKey as any))}</p>
									</div>
								{/if}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-page { 
		display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
		flex: 1;
		width: 95%; max-width: 500px; padding: 10vh 0 var(--space-lg); gap: var(--space-lg); margin: 0 auto; 
	}
	@media (min-width: 769px) { .game-page { padding: 15vh 0 var(--space-2xl); } }

	.myth-card-wrapper {
		width: 100%;
		display: grid;
		grid-template-areas: "card";
		align-items: start;
	}

	.myth-card {
		grid-area: card;
		width: 100%;
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg); overflow: hidden;
		box-shadow: var(--shadow-card); border: 4px solid transparent; transition: border-color 0.4s ease, box-shadow 0.4s ease;
		display: flex; flex-direction: column;
		animation: blur-in 3s ease 650ms both;
	}
	.myth-card__inner-key { display: flex; flex-direction: column; width: 100%; }

	.myth-card--correct { border-color: var(--color-success); box-shadow: var(--shadow-glow-success); }
	.myth-card--wrong { border-color: var(--color-error); box-shadow: var(--shadow-glow-error); }

	.myth-card__image-wrap { width: 50%; aspect-ratio: 3 / 4; position: relative; margin: var(--space-lg) auto 0; border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-card); border: 2px solid var(--color-bg-panel-dark); }
	.myth-card__image { width: 100%; height: 100%; object-fit: cover; }
	.myth-card__animal-name { 
		position: absolute; bottom: var(--space-sm); right: var(--space-sm); 
		background: rgba(0,0,0,0.6); color: white; padding: 2px var(--space-sm); 
		border-radius: var(--radius-sm); font-size: var(--font-size-xs); font-weight: var(--font-weight-bold);
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		animation: blur-in 3s ease 1s both;
	}
	.myth-card__content { padding: var(--space-lg); display: flex; flex-direction: column; gap: var(--space-lg); }
	.myth-card__statement { font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); text-align: center; line-height: 1.4; margin: 0; }

	.myth-card__dynamic-container {
		display: grid;
		grid-template-areas: "stack";
		align-items: start;
	}

	.myth-card__actions, .myth-card__result { 
		grid-area: stack;
		width: 100%;
	}

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

	.myth-card__result { display: flex; flex-direction: column; gap: var(--space-md); }
	.result-header { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); font-weight: var(--font-weight-bold); font-size: var(--font-size-xl); }
	.result-header--correct { color: var(--color-success); }
	
	.myth-card__explanation { 
		font-size: var(--font-size-md); line-height: 1.5; color: var(--color-text); 
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%); 
		backdrop-filter: var(--blur-glass);
		-webkit-backdrop-filter: var(--blur-glass);
		padding: var(--space-md); border-radius: var(--radius-md); border-left: 4px solid var(--color-accent); margin: 0; 
		animation: blur-in 3s ease 400ms both;
	}

	.btn-next {
		padding: var(--space-md); background: var(--color-bg-panel); color: var(--color-text-on-panel);
		border-radius: var(--radius-md); border: none; font-weight: var(--font-weight-bold);
		cursor: pointer; transition: all var(--transition-fast); box-shadow: 0 4px 0 var(--color-bg-panel-dark);
	}
	.btn-next:hover { transform: translateY(-2px); box-shadow: 0 6px 0 var(--color-bg-panel-dark); background: var(--color-bg-card-hover); }

	.round-indicator-wrapper {
		display: grid;
		grid-template-areas: "indicator";
		align-items: center;
		justify-items: center;
		margin-bottom: var(--space-sm);
	}
	.round-indicator {
		grid-area: indicator;
		font-size: var(--font-size-md); font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel); opacity: 0.8; margin-bottom: 0;
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
	.btn-play-again:hover { transform: translateY(-2px); box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%); background: var(--color-accent-hover); }
</style>
