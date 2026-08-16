<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { HabitatGameController } from '$lib/controllers/habitatGame.svelte';
	import type { HabitatMode } from '$lib/config/habitat-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { revealScroll } from '$lib/utils/revealScroll';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import HabitatOptions from '$lib/components/HabitatOptions.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';

	/**
	 * Партія «Де живем?» в одному з підрежимів.
	 *
	 * Підрежим приходить ПРОПСОМ, а не вибирається всередині, бо він живе в
	 * адресі: `/game-habitat/continents/` і `/game-habitat/biomes/` — це дві
	 * різні сторінки, і кожною можна поділитися. Доти обидві були одним URL, і
	 * надіслати другові конкретну гру було нічим.
	 *
	 * Компонент, а не два майже однакові маршрути: різниця між режимами — одне
	 * слово, і дві копії цієї розмітки розійшлися б на першій же правці.
	 */
	interface Props {
		mode: HabitatMode;
	}

	let { mode }: Props = $props();

	// Правила — у контролері; тут показ і кліки (SVELTE-CORE-v8 § 3.1).
	const game = new HabitatGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	/** Підпис варіанта залежить від підрежиму: континент чи природна зона. */
	const optionKey = (option: string): TranslationKey =>
		(mode === 'continents'
			? `habitat.continent.${option}`
			: `habitat.biome.${option}`) as TranslationKey;

	onMount(() => {
		game.chooseMode(mode);
		settings.setHeaderTitle('habitat.title');

		/*
		 * «Назад» веде до вибору режиму, а не в головне меню: гравець, який хоче
		 * перемкнути континенти на природні зони, інакше йшов би через меню й
		 * заходив у гру заново.
		 *
		 * Тепер це справжня адреса, тож перехід звичайний — і працює однаково
		 * що з історії, що при прямому заході за посиланням.
		 */
		settings.setHeaderBack(() => goto(langPath(lang, 'game-habitat')));

		return () => {
			settings.setHeaderTitle(null);
			settings.setHeaderBack(null);
		};
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.roundResults.length}
			{lang}
			onPlayAgain={() => game.chooseMode(mode)}
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
					t(mode === 'continents' ? 'habitat.prompt.continents' : 'habitat.prompt.biomes')
				)}
			</p>
			<p class="question__hint">{@html formatFont(t('habitat.hintMultiple'))}</p>
		</div>

		<HabitatOptions
			options={game.round.options}
			{mode}
			selected={game.selected}
			correct={game.round.correct}
			checked={game.checked}
			ontoggle={(option) => game.toggle(option)}
		/>

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
			<div class="result" use:revealScroll transition:slide={{ duration: 300 }}>
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
						{@html formatFont(game.round.correct.map((option) => t(optionKey(option))).join(', '))}
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
	 * Від 1000px варіанти стають одним рядом (див. HabitatOptions), і сторінка
	 * ширшає під нього. Ширшає САМЕ вона: картка тварини, питання й розбір
	 * лишаються вузькими — рядок тексту на 1100px не читається.
	 *
	 * SYNC: поріг той самий, що й у HabitatOptions. Медіазапит не вміє
	 * посилатися на чужий, тож число неминуче у двох місцях.
	 */
	@media (min-width: 1000px) {
		.game-page {
			max-width: min(96%, 1100px);
		}

		.animal,
		.question,
		.result {
			max-width: 460px;
		}
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
