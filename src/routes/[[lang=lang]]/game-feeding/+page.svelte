<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import { BIN, type Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import FeedingZone from '$lib/components/FeedingZone.svelte';
	import FeedingVerdicts from '$lib/components/FeedingVerdicts.svelte';

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
	function startDrag(event: DragEvent, food: Food) {
		if (game.fed) return;
		game.pick(food);
		if (event.dataTransfer) {
			event.dataTransfer.setData('text/plain', food.id);
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	onMount(() => {
		game.start();
		settings.setHeaderTitle('feeding.title');
		return () => settings.setHeaderTitle(null);
	});
</script>

<div class="game-page">
	{#if game.gameOver}
		<GameOverCard
			score={game.sessionScore}
			total={game.roundResults.length * 3}
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

		<p class="prompt">{@html formatFont(t('feeding.prompt'))}</p>

		<FeedingZone
			labelKey={game.round.animals[0].nameKey as TranslationKey}
			image={game.round.animals[0].image}
			foods={game.placedAt(game.round.animals[0].id)}
			active={game.picked !== null}
			disabled={game.fed}
			onplace={() => game.place(game.round!.animals[0].id)}
			ontakeback={(food) => game.takeBack(food)}
			testId="feeding-zone-top"
		/>

		<!-- Стіл зі стравами й смітник поруч — розкладка з концепції. -->
		<div class="table-row">
			<div class="table" data-testid="feeding-table-container">
				{#each game.unplaced as food (food.id)}
					<button
						type="button"
						class="dish"
						class:dish--picked={game.picked?.id === food.id}
						draggable={!game.fed}
						disabled={game.fed}
						onclick={() => game.pick(food)}
						ondragstart={(e) => startDrag(e, food)}
						data-testid="feeding-dish-btn-{food.id}"
					>
						<img
							src={food.image}
							alt=""
							class="dish__image"
							loading="lazy"
							width="300"
							height="400"
						/>
						<span class="dish__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
					</button>
				{/each}
				{#if game.unplaced.length === 0}
					<p class="table__empty">{@html formatFont(t('feeding.hintTap'))}</p>
				{/if}
			</div>

			<FeedingZone
				labelKey="feeding.bin"
				image={null}
				foods={game.placedAt(BIN)}
				active={game.picked !== null}
				disabled={game.fed}
				onplace={() => game.place(BIN)}
				ontakeback={(food) => game.takeBack(food)}
				testId="feeding-zone-bin"
			/>
		</div>

		<FeedingZone
			labelKey={game.round.animals[1].nameKey as TranslationKey}
			image={game.round.animals[1].image}
			foods={game.placedAt(game.round.animals[1].id)}
			active={game.picked !== null}
			disabled={game.fed}
			onplace={() => game.place(game.round!.animals[1].id)}
			ontakeback={(food) => game.takeBack(food)}
			testId="feeding-zone-bottom"
		/>

		{#if !game.fed}
			<button
				type="button"
				class="btn-primary"
				disabled={!game.canFeed}
				onclick={() => game.feed()}
				data-testid="feeding-feed-btn"
			>
				{@html formatFont(t(game.canFeed ? 'feeding.feed' : 'feeding.allPlaced'))}
			</button>
		{:else}
			<div class="result" transition:slide={{ duration: 300 }}>
				<FeedingVerdicts verdicts={game.verdicts} animals={game.round.animals} />
				<button
					type="button"
					class="btn-primary"
					onclick={() => game.nextRound()}
					data-testid="feeding-next-btn"
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
		padding: 3dvh 0 var(--space-lg);
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

	.game-page > :global(.zone) {
		width: 100%;
	}

	/*
	 * Стіл і смітник в один ряд. `minmax(0, …)` на столі обовʼязковий: без
	 * нього три страви не дають колонці стиснутися, і на вузькому екрані ряд
	 * розпирає сторінку (FLUID-SIZING-v8 § 1).
	 */
	.table-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: var(--space-sm);
		width: 100%;
		align-items: stretch;
	}

	.table {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-width: 0;
		min-height: 92px;
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 35%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}

	.table__empty {
		margin: 0;
		font-size: var(--font-size-xs);
		text-align: center;
		color: var(--color-text-on-panel);
		opacity: 0.8;
	}

	.dish {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-width: 44px;
		min-height: 44px;
		padding: var(--space-xs);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 20%);
		color: var(--color-text);
		font: inherit;
		cursor: grab;
		transition: all var(--transition-fast);
	}

	.dish--picked {
		border-color: var(--color-accent);
		transform: translateY(-3px);
		box-shadow: var(--shadow-glow-accent);
	}

	.dish:disabled {
		cursor: default;
	}

	.dish__image {
		width: 48px;
		aspect-ratio: 1;
		height: auto;
		object-fit: contain;
	}

	.dish__name {
		font-size: var(--font-size-xs);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.btn-primary {
		width: 100%;
		max-width: 320px;
		padding: var(--space-md);
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
		transition: all var(--transition-fast);
	}

	.btn-primary:disabled {
		background: var(--color-disabled);
		color: var(--color-disabled-text);
		box-shadow: none;
		cursor: not-allowed;
	}

	.btn-primary:not(:disabled):hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
	}
</style>
