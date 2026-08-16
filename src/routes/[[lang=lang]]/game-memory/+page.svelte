<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { MemoryGameController } from '$lib/controllers/memoryGame.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import MemoryCard from '$lib/components/MemoryCard.svelte';

	/**
	 * Правила — у контролері; тут показ і введення (SVELTE-CORE-v8 § 3.1).
	 *
	 * Єдине, що сторінка додає до правил, — ЧАС: пауза, за яку встигаєш
	 * роздивитися невдалу пару. Контролер про неї не знає навмисно: у спільній
	 * партії ту саму дію робитиме повідомлення, а не таймер.
	 */
	const game = new MemoryGameController();
	const lang = $derived(languageFromParam(page.params.lang));

	/** Скільки видно невдалу пару, перш ніж вона закриється. */
	const PEEK_MS = 900;

	let hideTimer: ReturnType<typeof setTimeout> | null = null;

	/** Зерно колоди. Для соло воно випадкове; спільній партії його дасть кімната. */
	const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

	function flip(index: number) {
		if (!game.flip(index)) return;
		if (!game.awaitingPeek) return;

		// Таймер один: другий, накладений на перший, закрив би пару, яку гравець
		// щойно відкрив наступним ходом.
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			hideTimer = null;
			game.resolvePeek();
		}, PEEK_MS);
	}

	function playAgain() {
		if (hideTimer) clearTimeout(hideTimer);
		hideTimer = null;
		game.start(freshSeed());
	}

	onMount(() => {
		game.start(freshSeed());
		settings.setHeaderTitle('memory.title');
		return () => settings.setHeaderTitle(null);
	});

	// Таймер живе поза Svelte, тож його прибирає окремий хук: без цього
	// `resolvePeek()` спрацював би вже після виходу зі сторінки.
	onDestroy(() => {
		if (hideTimer) clearTimeout(hideTimer);
	});
</script>

<div class="game-page">
	{#if game.gameOver}
		<GameOverCard
			score={game.localScore}
			total={game.pairs}
			{lang}
			onPlayAgain={playAgain}
			testId="memory-game-over"
		/>
	{:else}
		<p class="prompt text-panel">{@html formatFont(t('memory.prompt'))}</p>

		<!--
			Табло замість лічильника раундів: партія тут одна, а стежити треба за
			парами й ходами. У спільній грі сюди ж стане рахунок кожного.
		-->
		<div class="scoreboard text-panel">
			{#each game.players as player (player.id)}
				<span
					class="scoreboard__player"
					class:scoreboard__player--turn={player.id === game.current?.id}
					data-testid="memory-player-{player.id}-status"
				>
					{@html formatFont(t(player.nameKey))}: {player.score}
				</span>
			{/each}
			<span class="scoreboard__moves" data-testid="memory-moves-value">
				{@html formatFont(t('memory.moves'))}: {game.moves}
			</span>
		</div>

		<div class="deck" data-testid="memory-deck-container">
			{#each game.slots as slot, index (slot.card.id)}
				<MemoryCard
					{slot}
					disabled={game.awaitingPeek}
					onflip={() => flip(index)}
					testId="memory-card-btn-{slot.card.id}"
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
		flex: 1;
		width: 95%;
		max-width: 560px;
		padding: 3dvh 0 var(--space-lg);
		gap: var(--space-sm);
		margin: 0 auto;
		box-sizing: border-box;
	}

	.prompt {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.scoreboard {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm) var(--space-md);
		font-size: var(--font-size-sm);
		color: var(--color-text);
	}

	.scoreboard__player--turn {
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
	}

	.scoreboard__moves {
		color: var(--color-text-muted);
	}

	/*
	 * Колонки рахує сама сітка: `auto-fit` із мінімумом у 72px дає чотири на
	 * телефоні й шість на широкому екрані, і жодне число не треба міняти, коли
	 * пар стане більше.
	 *
	 * `min(72px, 100%)`, а не гола довжина: інакше 72px стають ПІДЛОГОЮ ширини
	 * колонки, і на вузькому екрані сітка розпирає сторінку (FLUID-SIZING § 1.1).
	 */
	.deck {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(72px, 100%), 1fr));
		gap: var(--space-xs);
		width: 100%;
	}
</style>
