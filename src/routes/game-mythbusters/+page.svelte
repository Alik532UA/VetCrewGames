<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { settings } from '$lib/settings.svelte';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { getNextQuestion, type GameQuestion } from '$lib/data/myth-game';
	import { CheckCircle2, XCircle } from 'lucide-svelte';

	// Game state
	let currentQuestion = $state<GameQuestion | null>(null);
	let answered = $state(false);
	let selectedTrue = $state<boolean | null>(null);
	let isCorrect = $state(false);
	let score = $state(0);
	let totalAnswered = $state(0);
	let usedIds = $state<string[]>([]);

	function nextQuestion() {
		if (usedIds.length >= 20) { // Keep last 20 to avoid repeats
			usedIds = usedIds.slice(1);
		}
		
		const next = getNextQuestion(usedIds);
		if (next) {
			currentQuestion = next;
			usedIds.push(next.id);
			answered = false;
			selectedTrue = null;
		} else {
			// If we ran out of myths (unlikely with random), clear history and try again
			usedIds = [];
			currentQuestion = getNextQuestion([]);
			answered = false;
			selectedTrue = null;
		}
	}

	function handleAnswer(choice: boolean) {
		if (answered || !currentQuestion) return;
		
		selectedTrue = choice;
		isCorrect = choice === currentQuestion.isTrue;
		answered = true;
		totalAnswered++;
		if (isCorrect) {
			score++;
			settings.addScore(1);
		}
	}

	onMount(() => {
		nextQuestion();
	});
</script>

<GameHeader titleKey="myth.title" />

<div class="game-page">
	{#if currentQuestion}
		{#key currentQuestion.id}
			<div class="myth-card" 
				class:myth-card--correct={answered && isCorrect} 
				class:myth-card--wrong={answered && !isCorrect}
				in:fade={{ duration: 300 }}
			>
				<div class="myth-card__image-wrap">
					<img src={currentQuestion.animal.image} alt={formatPlain(td(currentQuestion.animal.nameKey))} class="myth-card__image" />
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
							<button class="btn-next" onclick={nextQuestion}>
								{@html formatFont(t('myth.next'))}
							</button>
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

	.progress-container { width: 100%; display: flex; align-items: center; gap: var(--space-md); }
	.progress-bar { flex: 1; height: 12px; background: var(--color-bg-surface); border-radius: var(--radius-full); overflow: hidden; border: 2px solid var(--color-bg-panel-dark); }
	.progress-fill { height: 100%; background: var(--color-accent); transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1); }
	.progress-text { font-weight: var(--font-weight-bold); font-size: var(--font-size-sm); color: var(--color-text-muted); min-width: 45px; }

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

	.btn-truth { background: var(--color-accent); color: var(--color-text-on-panel); box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%); }
	.btn-truth:hover { transform: translateY(-2px); box-shadow: 0 6px 0 color-mix(in srgb, var(--color-accent), black 30%); background: var(--color-accent-hover); }

	.myth-card__result { display: flex; flex-direction: column; gap: var(--space-md); animation: slide-up 0.4s ease both; }
	.result-header { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); font-weight: var(--font-weight-bold); font-size: var(--font-size-xl); }
	.result-header--correct { color: var(--color-success); }
	.result-header--wrong { color: var(--color-error); }
	
	.myth-card__explanation { font-size: var(--font-size-md); line-height: 1.5; color: var(--color-text); background: color-mix(in srgb, var(--color-bg-panel), transparent 90%); padding: var(--space-md); border-radius: var(--radius-md); border-left: 4px solid var(--color-accent); margin: 0; }

	.btn-next {
		padding: var(--space-md); background: var(--color-bg-panel); color: var(--color-text-on-panel);
		border-radius: var(--radius-md); border: none; font-weight: var(--font-weight-bold);
		cursor: pointer; transition: all var(--transition-fast); box-shadow: 0 4px 0 var(--color-bg-panel-dark);
	}
	.btn-next:hover { transform: translateY(-2px); box-shadow: 0 6px 0 var(--color-bg-panel-dark); background: var(--color-bg-card-hover); }
</style>
