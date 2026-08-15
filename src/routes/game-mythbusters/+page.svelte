<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { settings } from '$lib/services/settings.svelte';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import { MythGameController } from '$lib/controllers/mythGame.svelte';
	import { CheckCircle2, XCircle, RotateCcw, Home } from 'lucide-svelte';
	import { base } from '$app/paths';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';

	// Компонент лише СТВОРЮЄ контролер і малює його стан (SVELTE-CORE-v8 § 3.1).
	// Стан партії гине разом зі сторінкою — саме тому контролер тут `new`, а не
	// module-level синглтон.
	const game = new MythGameController();

	function flyAndSlide(
		node: HTMLElement,
		{ delay = 0, duration = 400, easing = cubicOut, y = 0 } = {}
	) {
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

	onMount(() => {
		game.start();
		settings.setHeaderTitle('myth.title');
		return () => settings.setHeaderTitle(null);
	});
</script>

<div class="game-page">
	{#if game.gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
				<span class="score-value">{game.sessionScore} / {game.totalRounds}</span>
			</div>
			<div class="game-over-actions">
				<button class="btn-play-again" onclick={() => game.reset()}>
					<RotateCcw size={24} />
					{@html formatFont(t('common.playAgain'))}
				</button>
				<a href="{base}/" class="btn-menu">
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
				<div
					class="myth-card"
					class:myth-card--correct={q.answered && q.isCorrect}
					class:myth-card--wrong={q.answered && !q.isCorrect}
					in:fly={{ y: 20, duration: 350, delay: 300 }}
					out:flyAndSlide={{ y: -20, duration: 300 }}
				>
					<div class="myth-card__inner-key">
						<div class="myth-card__image-wrap">
							<img
								src={q.animal.image}
								alt={formatPlain(td(q.animal.nameKey))}
								class="myth-card__image"
								loading="lazy"
								width="200"
								height="266"
							/>
							<div class="myth-card__animal-name">{@html formatFont(td(q.animal.nameKey))}</div>
						</div>

						<div class="myth-card__content">
							<p class="myth-card__statement">{@html formatFont(td(q.statementKey))}</p>

							<div class="myth-card__dynamic-container">
								{#if !q.answered}
									<div class="myth-card__actions" out:slide={{ duration: 400 }} in:fade>
										<button class="btn-myth" onclick={() => game.answer(false)} data-testid="mythbusters-myth-btn">
											{@html formatFont(t('myth.myth'))}
										</button>
										<button
											type="button"
											class="btn-truth"
											onclick={() => game.answer(true)}
											data-testid="mythbusters-truth-btn"
										>
											{@html formatFont(t('myth.truth'))}
										</button>
									</div>
								{:else}
									<div class="myth-card__result" in:slide={{ duration: 400 }} out:fade>
										<button class="btn-next" onclick={() => game.nextRound()} data-testid="mythbusters-next-btn">
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
										<p class="myth-card__explanation">
											{@html formatFont(td(q.explanationKey))}
										</p>
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		flex: 1;
		width: 95%;
		max-width: 500px;
		padding: 10dvh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2dvh, var(--space-lg));
		margin: 0 auto;
		box-sizing: border-box;
	}
	@media (min-width: 769px) {
		.game-page {
			padding: 15dvh 0 var(--space-2xl);
		}
	}

	.myth-card-wrapper {
		width: 100%;
		display: grid;
		grid-template-areas: 'card';
		align-items: start;
	}

	.myth-card {
		grid-area: card;
		width: 100%;
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		border: 4px solid transparent;
		transition:
			border-color 0.4s ease,
			box-shadow 0.4s ease;
		display: flex;
		flex-direction: column;
		animation: blur-in 3s ease 650ms both;
	}
	.myth-card__inner-key {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.myth-card--correct {
		border-color: var(--color-success);
		box-shadow: var(--shadow-glow-success);
	}
	.myth-card--wrong {
		border-color: var(--color-error);
		box-shadow: var(--shadow-glow-error);
	}

	.myth-card__image-wrap {
		width: 50%;
		aspect-ratio: 3 / 4;
		position: relative;
		margin: var(--space-lg) auto 0;
		border-radius: var(--radius-md);
		overflow: hidden;
		box-shadow: var(--shadow-card);
		border: 2px solid var(--color-bg-panel-dark);
	}
	.myth-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.myth-card__animal-name {
		position: absolute;
		bottom: var(--space-sm);
		right: var(--space-sm);
		background: rgba(0, 0, 0, 0.6);
		color: white;
		padding: 2px var(--space-sm);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		backdrop-filter: var(--blur-glass);
		animation: blur-in 3s ease 1s both;
	}
	.myth-card__content {
		padding: var(--space-lg);
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
	.myth-card__statement {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
		text-align: center;
		line-height: 1.4;
		margin: 0;
	}

	.myth-card__dynamic-container {
		display: grid;
		grid-template-areas: 'stack';
		align-items: start;
	}

	.myth-card__actions,
	.myth-card__result {
		grid-area: stack;
		width: 100%;
	}

	.myth-card__actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-md);
	}

	.btn-myth,
	.btn-truth {
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border: none;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-md);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.btn-myth {
		background: #e5e5e5;
		color: #333;
		box-shadow: 0 4px 0 #b0b0b0;
	}
	.btn-myth:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #b0b0b0;
		background: #eee;
	}

	.btn-truth {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-truth:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 color-mix(in srgb, var(--color-accent), black 30%);
		background: var(--color-accent-hover);
	}

	.myth-card__result {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}
	.result-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-xl);
	}
	.result-header--correct {
		color: var(--color-success);
	}

	.myth-card__explanation {
		font-size: var(--font-size-md);
		line-height: 1.5;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		backdrop-filter: var(--blur-glass);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-accent);
		margin: 0;
		animation: blur-in 3s ease 400ms both;
	}

	.btn-next {
		padding: var(--space-md);
		background: var(--color-bg-panel);
		color: var(--color-text-on-panel);
		border-radius: var(--radius-md);
		border: none;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 4px 0 var(--color-bg-panel-dark);
	}
	.btn-next:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 var(--color-bg-panel-dark);
		background: var(--color-bg-card-hover);
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
