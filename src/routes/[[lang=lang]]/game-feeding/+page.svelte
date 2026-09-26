<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FeedingGameController, feedingReview } from '$lib/controllers/feedingGame.svelte';
	import { BIN, type FeedingRound } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import FeedingBoard from '$lib/components/FeedingBoard.svelte';
	import type { QuickTarget } from '$lib/components/FeedingDish.svelte';
	import ReviewPanel from '$lib/components/ReviewPanel.svelte';
	import ReviewList from '$lib/components/ReviewList.svelte';
	import { td } from '$lib/i18n';

	// Правила — у контролері; тут показ і введення (SVELTE-CORE-v8 § 3.1).
	const game = new FeedingGameController();
	/** Котре минуле питання переглядають (від нуля); `null` — грають поточне. */
	let viewing = $state<number | null>(null);
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
	/** Куди можна покласти страву одним дотиком — для раунду поточного й минулого. */
	const targetsOf = (round: FeedingRound): QuickTarget[] => [
		{
			id: round.animals[0].id,
			labelKey: round.animals[0].nameKey as TranslationKey,
			image: round.animals[0].image,
			place: 'left' as const
		},
		{
			id: round.animals[1].id,
			labelKey: round.animals[1].nameKey as TranslationKey,
			image: round.animals[1].image,
			place: 'right' as const
		},
		{ id: BIN, labelKey: 'feeding.bin' as TranslationKey, image: null, place: 'top' as const }
	];
	const quickTargets = $derived<QuickTarget[]>(game.round ? targetsOf(game.round) : []);

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

<!-- Смужка поступу: відповідані сегменти відкривають питання свого раунду. -->
{#snippet indicator()}
	<div class="round-indicator-wrapper">
		<RoundIndicator
			current={game.roundNumber}
			total={game.totalRounds}
			results={game.roundResults}
			onreview={(i) => (viewing = i)}
			{viewing}
		/>
	</div>
{/snippet}

<!-- Перегляд — та сама дошка «нагодовано», з присудами, без «Далі» (`feedingReview`). -->
{#snippet review(backKey: 'review.back' | 'review.backToResults')}
	{@const record = game.history[viewing ?? 0]}
	{#if record}
		<ReviewPanel index={viewing ?? 0} total={game.totalRounds} {backKey} onback={() => (viewing = null)}>
			<FeedingBoard game={feedingReview(record)} targets={targetsOf(record.round)} hideNext />
		</ReviewPanel>
	{/if}
{/snippet}

<div class="game-page" use:fitToViewport>
	{#if game.gameOver}
		{#if viewing === null}
			<GameOverCard
				score={game.sessionScore}
				total={game.maxScore}
				{lang}
				onPlayAgain={() => {
					viewing = null;
					game.reset();
				}}
				testId="feeding-game-over"
			/>
			<!-- Питання партії переліком — перегляд у кінці (прохання автора 2026-09-26). -->
			<ReviewList
				results={game.roundResults}
				label={(i) => (game.history[i]?.round.animals ?? []).map((a) => td(a.nameKey)).join(' · ')}
				onopen={(i) => (viewing = i)}
			/>
		{:else}
			{@render review('review.backToResults')}
		{/if}
	{:else if game.round && viewing !== null}
		{@render indicator()}
		{@render review('review.back')}
	{:else if game.round}
		{@render indicator()}

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
