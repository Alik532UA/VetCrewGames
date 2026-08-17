<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import MemoryCard from '$lib/components/MemoryCard.svelte';
	import type { PairsMatch } from '$lib/controllers/pairsMatch.svelte';

	/**
	 * Спільна партія «Знайди пару»: табло, дошка й підпис «чия черга».
	 *
	 * Компонент нічого не вирішує — навіть пауза перед перегортанням належить
	 * матчу, бо оголошує її ходом той, чия черга. Тут лишається показ і дотик.
	 */
	interface Props {
		match: PairsMatch;
		/** Хто я: підсвітити свій рядок у таблі. */
		me: string;
		/** Хто зараз на звʼязку. Присутність — окрема гілка бази. */
		online: string[];
	}

	let { match, me, online }: Props = $props();

	const rows = $derived(Math.ceil(match.game.slots.length / match.game.cols));
</script>

<div class="board">
	<!--
		Підпис черги — головне, що людина шукає очима в спільній грі. Тому окремим
		рядком і словами, а не лише підсвіткою в таблі.
	-->
	<p class="board__turn text-panel" role="status" data-testid="pairs-turn-status">
		{#if match.game.gameOver}
			{@html formatFont(t('pairs.over'))}
		{:else if match.myTurn}
			{@html formatFont(t('pairs.yourTurn'))}
		{:else}
			{@html formatFont(t('pairs.waitingFor'))}: {match.actor?.name ?? '—'}
		{/if}
	</p>

	<div class="board__score text-panel">
		{#each match.players as player (player.uid)}
			<span
				class="board__player"
				class:board__player--turn={player.uid === match.actor?.id}
				class:board__player--away={!online.includes(player.uid)}
				data-testid="pairs-player-{player.uid}-status"
			>
				{player.name}{player.uid === me ? ' •' : ''}: {match.game.players.find(
					(p) => p.id === player.uid
				)?.score ?? 0}
			</span>
		{/each}
		<span class="board__moves" data-testid="pairs-moves-value">
			{@html formatFont(t('memory.moves'))}: {match.game.moves}
		</span>
	</div>

	<!--
		Колонки приходять із КІМНАТИ, а не з екрана: сітка, яку перебудовує ширина
		вікна, стирає запамʼятане — і в спільній грі ще й розводить двох гравців.
	-->
	<div
		class="board__deck"
		style="--cols: {match.game.cols}; --rows: {rows}"
		data-testid="pairs-deck-container"
	>
		{#each match.game.slots as slot, index (slot.card.id)}
			<MemoryCard
				{slot}
				position={index + 1}
				disabled={!match.myTurn || match.game.gameOver}
				onflip={() => match.flip(index)}
				testId="pairs-card-btn-{slot.card.id}"
			/>
		{/each}
	</div>
</div>

<style>
	.board {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
	}

	.board__turn {
		margin: 0;
		font-size: var(--font-size-md);
	}

	.board__score {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		justify-content: center;
		font-variant-numeric: tabular-nums;
	}

	/* Чия черга — видно й тут: підпис вище відповідає на питання, табло показує рахунок. */
	.board__player--turn {
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
	}

	/* Звʼязок обірвався. Не «вийшов»: людина могла просто зайти в тунель. */
	.board__player--away {
		opacity: 0.5;
		text-decoration: line-through;
	}

	.board__moves {
		opacity: 0.75;
	}

	.board__deck {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: clamp(4px, 1vw, var(--space-sm));
		width: 100%;
		max-width: min(96vw, calc(var(--cols) * 8rem));
	}
</style>
