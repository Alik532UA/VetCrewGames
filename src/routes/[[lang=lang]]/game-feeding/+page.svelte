<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import { BIN } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import FeedingBoard from '$lib/components/FeedingBoard.svelte';
	import type { QuickTarget } from '$lib/components/FeedingDish.svelte';

	// Правила — у контролері; тут показ і введення (SVELTE-CORE-v8 § 3.1).
	const game = new FeedingGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Перетягування мишею — надбудова, а не основа: HTML5 drag-and-drop на
	 * сенсорних екранах не працює взагалі. Основний шлях тут — «взяти страву
	 * кліком, клікнути ціль», і він же єдиний доступний із клавіатури
	 * (ACCESSIBILITY-v8 § 2). Через це гра свідомо не повторює клон-під-пальцем
	 * із гри про чисельність: там перетягування — сама механіка, тут — зручність.
	 */

	/**
	 * Кнопки «кому віддати» стоять довкола страви: тварини ліворуч і праворуч,
	 * смітник — зверху. Усі три накладками, тож ширини страві вони не додають.
	 */
	const quickTargets = $derived<QuickTarget[]>(
		game.round
			? [
					{
						id: game.round.animals[0].id,
						labelKey: game.round.animals[0].nameKey as TranslationKey,
						image: game.round.animals[0].image,
						place: 'left' as const
					},
					{
						id: game.round.animals[1].id,
						labelKey: game.round.animals[1].nameKey as TranslationKey,
						image: game.round.animals[1].image,
						place: 'right' as const
					},
					{ id: BIN, labelKey: 'feeding.bin' as TranslationKey, image: null, place: 'top' as const }
				]
			: []
	);

	onMount(() => {
		game.start();
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('feeding.title', () => goto(langPath(lang, 'quiz/play')));
	});
</script>

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.maxScore}
			{lang}
			onPlayAgain={() => game.reset()}
			testId="feeding-game-over"
		/>
	{:else if game.round}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<p class="prompt text-panel">{@html formatFont(t('feeding.prompt'))}</p>

		<!-- Тварина ліворуч, стіл посередині, тварина праворуч; смітник — під ними. -->
		<FeedingBoard {game} targets={quickTargets} />

		{#if !game.fed}
			<button
				type="button"
				class="btn-primary"
				disabled={!game.canFeed}
				onclick={() => game.feed()}
				data-testid="feeding-feed-btn"
			>
				{@html formatFont(t(game.canFeed ? 'feeding.feed' : 'feeding.placeSomething'))}
			</button>
			{#if game.canFeed && game.unplaced.length > 0}
				<p class="leftovers text-panel text-panel--tight">
					{@html formatFont(t('feeding.leftoversToBin'))}
				</p>
			{/if}
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
		max-width: var(--measure-feeding);
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-sm);
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
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.leftovers {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

</style>
