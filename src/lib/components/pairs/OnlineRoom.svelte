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
		/** Нова партія; `undefined` — я не господар, і роздавати не мені. */
		onRematch?: () => void;
		/** Закрити кімнату назовсім. Так само лише господар. */
		onClose?: () => void;
	}

	let { match, me, online, onRematch, onClose }: Props = $props();

	/** Скільки пар зібрав кожен: рахунок живе в правилах, не в кімнаті. */
	const scoreOf = (uid: string) => match.game.players.find((p) => p.id === uid)?.score ?? 0;

	/**
	 * Хто переміг. `null` — нічия, і це не рідкість: пар парна кількість.
	 *
	 * Рахується з дошки, а не пишеться в базу: усі мають ті самі ходи, тож усі
	 * отримають ту саму відповідь — а ще одне поле в кімнаті було б другим
	 * джерелом правди про те саме.
	 */
	const winner = $derived.by(() => {
		const best = Math.max(...match.players.map((player) => scoreOf(player.uid)));
		const top = match.players.filter((player) => scoreOf(player.uid) === best);
		return top.length === 1 ? top[0] : null;
	});

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

	{#if match.game.gameOver}
		<!--
			Підсумок замість зникнення дошки: картки лишаються на місці, бо після
			партії на них дивляться — «а де ж була та друга сова».
		-->
		<div class="board__over text-panel" data-testid="pairs-result-panel">
			<b data-testid="pairs-result-text">
				{#if winner}
					<!--
						«Перемога: Аня», а не «Аня перемогла»: імʼя тут вільний рядок, і роду
						ми не знаємо. Перша версія писала «Аня — переміг», тобто вгадувала —
						і вгадувала неправильно рівно в половині випадків.
					-->
					{@html formatFont(t('pairs.won'))}: {winner.name}{winner.uid === me ? ' •' : ''}
				{:else}
					{@html formatFont(t('pairs.draw'))}
				{/if}
			</b>
			{#if onRematch}
				<button
					type="button"
					class="btn-primary"
					onclick={onRematch}
					data-testid="pairs-rematch-btn"
				>
					{@html formatFont(t('pairs.rematch'))}
				</button>
				<button type="button" class="chip" onclick={onClose} data-testid="pairs-close-btn">
					{@html formatFont(t('pairs.closeRoom'))}
				</button>
			{:else}
				<span class="board__wait">{@html formatFont(t('pairs.waitingHost'))}</span>
			{/if}
		</div>
	{/if}

	<div class="board__score text-panel">
		{#each match.players as player (player.uid)}
			<span
				class="board__player"
				class:board__player--turn={player.uid === match.actor?.id}
				class:board__player--away={!online.includes(player.uid)}
				data-testid="pairs-player-{player.uid}-status"
			>
				{player.name}{player.uid === me ? ' •' : ''}: {scoreOf(player.uid)}
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

	.board__over {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		align-items: center;
		justify-content: center;
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.board__wait {
		font-size: var(--font-size-sm);
		opacity: 0.75;
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
