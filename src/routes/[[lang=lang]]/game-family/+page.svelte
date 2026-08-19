<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { CheckCircle2, XCircle } from 'lucide-svelte';
	import { page } from '$app/state';
	import { t, td, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FamilyGameController } from '$lib/controllers/familyGame.svelte';
	import { revealScroll } from '$lib/utils/revealScroll';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';

	// Правила — у контролері; тут лише показ і кліки (SVELTE-CORE-v8 § 3.1).
	const game = new FamilyGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => {
		game.start();
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('family.title', () => goto(langPath(lang, 'quiz/play')));
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.roundResults.length}
			{lang}
			onPlayAgain={() => game.reset()}
			testId="family-game-over"
		/>
	{:else if game.round}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<p class="prompt text-panel" data-testid="family-prompt-text">{@html formatFont(t('family.prompt'))}</p>

		{#key game.round.id}
			<div class="cards-grid" in:fade={{ duration: 300 }}>
				{#each game.round.cards as animal (animal.id)}
					{@const isAnswer = animal.id === game.round.oddAnimal.id}
					{@const isChosen = game.chosen?.id === animal.id}
					<button
						type="button"
						class="animal-card"
						class:animal-card--answer={game.answered && isAnswer}
						class:animal-card--wrong={game.answered && isChosen && !isAnswer}
						class:animal-card--dimmed={game.answered && !isAnswer && !isChosen}
						disabled={game.answered}
						onclick={() => game.choose(animal)}
						data-testid="family-animal-btn-{animal.id}"
					>
						<div class="animal-card__image-wrap">
							<img
								src={animal.image}
								alt={td(animal.nameKey)}
								class="animal-card__image"
								loading="lazy"
								width="300"
								height="400"
							/>
							{#if game.answered && (isAnswer || isChosen)}
								<div class="animal-card__mark" in:fade={{ duration: 200 }}>
									{#if isAnswer}
										<CheckCircle2 size={28} aria-hidden="true" />
									{:else}
										<XCircle size={28} aria-hidden="true" />
									{/if}
								</div>
							{/if}
						</div>
						<span class="animal-card__name">{@html formatFont(td(animal.nameKey))}</span>
					</button>
				{/each}
			</div>
		{/key}

		{#if game.answered}
			<div class="result" use:revealScroll transition:slide={{ duration: 350 }}>
				<div class="result__header" class:result__header--correct={game.isCorrect}>
					{#if game.isCorrect}
						<CheckCircle2 size={24} aria-hidden="true" />
						<span>{@html formatFont(t('family.correct'))}</span>
					{:else}
						<XCircle size={24} aria-hidden="true" />
						<span>{@html formatFont(t('family.incorrect'))}</span>
					{/if}
				</div>

				{#if !game.isCorrect}
					<p class="result__answer">
						{@html formatFont(t('family.correctAnswerWas'))}
						<strong>{@html formatFont(td(game.round.oddAnimal.nameKey))}</strong>
					</p>
				{/if}

				<p class="result__explanation" data-testid="family-explanation-text">
					{@html formatFont(t(game.round.explanationKey as never))}
				</p>

				<button
					type="button"
					class="btn-next"
					onclick={() => game.nextRound()}
					data-testid="family-next-btn"
					in:fly={{ y: 8, duration: 250 }}
				>
					{@html formatFont(t('common.next'))}
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.game-page {
		/*
		 * Скільки висоти можемо віддати картинці картки. Від цього залежить і
		 * ширина ряду (див. `.cards-grid`): при співвідношенні 3/4 висота
		 * диктує ширину, а не навпаки.
		 *
		 * `svh`, а не `dvh`: сторінку масштабує `fitToViewport`, а динамічна висота
		 * на телефоні МІНЯЄТЬСЯ, коли ховається адресний рядок — розкладка повзе,
		 * масштаб перераховується, і гра смикається сама собою. `svh` — «найменше
		 * вікно», стала за будь-якого стану панелей; на настільному екрані вони
		 * тотожні (FLUID-SIZING-v8 § 2).
		 */
		--card-image-h: clamp(110px, 26svh, 260px);

		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: 560px;
		/* Верхній відступ теж від екрана: на низькому вікні 4svh — це ті самі
		   кілька рядків, яких бракує поясненню (FLUID-SIZING-v8 § 6). */
		padding: clamp(var(--space-sm), 3svh, var(--space-xl)) 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2svh, var(--space-lg));
		margin: 0 auto;
		box-sizing: border-box;
	}

	.round-indicator-wrapper {
		display: flex;
		justify-content: center;
		width: 100%;
	}

	.prompt {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-md);
		color: var(--color-text);
	}

	/*
	 * `minmax(0, 1fr)`, а не `1fr`: гола `1fr` не дає колонці стати вужчою за
	 * власний вміст, і на екрані 320px сітка розпирала б сторінку
	 * (FLUID-SIZING-v8 § 1).
	 *
	 * Ширина ряду обмежена ВИСОТОЮ, яку можемо віддати картинці. Це те саме
	 * правило § 2 «розмір від екрана», просто застосоване з іншого боку: при
	 * співвідношенні 3/4 ширина колонки = висота × 0,75, тож обмеживши ряд, ми
	 * обмежуємо і його висоту — і пояснення відповіді лишається на екрані.
	 *
	 * Без цього чотири картки на широкому моніторі просто виросли б у висоту й
	 * нічого б не виграли.
	 */
	.cards-grid {
		--columns: 2;

		display: grid;
		grid-template-columns: repeat(var(--columns), minmax(0, 1fr));
		gap: var(--space-md);
		width: 100%;
		max-width: calc(
			var(--columns) * (var(--card-image-h) * 3 / 4) + (var(--columns) - 1) * var(--space-md)
		);
	}

	/*
	 * Чотири в ряд, щойно є ширина. Два ряди по 380px не лишали місця
	 * поясненню: на 1280×800 сторінка була 931px при 748 доступних, і це ще
	 * без самого пояснення.
	 *
	 * `@media`, а не `@container`: рішення залежить від вікна, бо разом із
	 * кількістю колонок міняється й ширина самої сторінки (§ 7A — контейнерний
	 * запит для того, що залежить від МІСЦЯ в батькові, медіазапит для того,
	 * що залежить від вікна).
	 */
	@media (min-width: 700px) {
		.game-page {
			max-width: min(96%, 980px);
		}

		.cards-grid {
			--columns: 4;
		}

		/* Текст лишається вузьким: рядок на 980px не читається. */
		.result {
			max-width: 620px;
		}
	}

	.animal-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		min-width: 0;
		padding: var(--space-sm);
		border: 3px solid transparent;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
		transition:
			transform var(--transition-fast),
			border-color 0.35s ease,
			box-shadow 0.35s ease,
			opacity 0.35s ease;
	}

	@media (hover: hover) {
		.animal-card:not(:disabled):hover {
			transform: translateY(-3px);
			box-shadow: var(--shadow-glow-primary);
		}
	}

	.animal-card:not(:disabled):active {
		transform: scale(0.98);
	}

	.animal-card:disabled {
		cursor: default;
	}

	.animal-card--answer {
		border-color: var(--color-success);
		box-shadow: var(--shadow-glow-success);
	}

	.animal-card--wrong {
		border-color: var(--color-error);
		box-shadow: var(--shadow-glow-error);
	}

	/* Не `visibility`: картки лишаються читабельними, просто відступають назад. */
	.animal-card--dimmed {
		opacity: 0.45;
	}

	.animal-card__image-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: var(--radius-sm);
		overflow: hidden;
		border: 2px solid var(--color-bg-panel-dark);
	}

	.animal-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.animal-card__mark {
		position: absolute;
		top: var(--space-xs);
		right: var(--space-xs);
		display: flex;
		padding: 2px;
		border-radius: var(--radius-full);
		background: rgba(0, 0, 0, 0.55);
		color: #ffffff;
	}

	.animal-card--answer .animal-card__mark {
		color: var(--color-success);
	}

	.animal-card--wrong .animal-card__mark {
		color: var(--color-error);
	}

	.animal-card__name {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.result {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 15%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}

	.result__header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-error);
	}

	.result__header--correct {
		color: var(--color-success);
	}

	.result__answer {
		margin: 0;
		text-align: center;
		color: var(--color-text);
	}

	.result__explanation {
		margin: 0;
		font-size: var(--font-size-md);
		line-height: 1.5;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		border-left: 4px solid var(--color-accent);
	}

	.btn-next {
		padding: var(--space-md);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		border-radius: var(--radius-md);
		border: none;
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
		transition: all var(--transition-fast);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}

	.btn-next:hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

</style>
