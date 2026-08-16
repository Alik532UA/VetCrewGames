<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import { BIN } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';
	import FeedingZone from '$lib/components/FeedingZone.svelte';
	import FeedingDish, { type QuickTarget } from '$lib/components/FeedingDish.svelte';
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

	/**
	 * Розбір розкладається по тому, кому страва НАСПРАВДІ належить, а не куди її
	 * поклали: пояснення стоїть біля тієї тварини, про яку воно й розповідає.
	 * Тим-таки воно займає порожні боки замість того, щоб тягнути сторінку вниз.
	 */
	const verdictsFor = (target: string) => game.verdicts.filter((v) => v.correct === target);

	/** Стіл — теж ціль: сюди повертають страву, яку передумали віддавати. */
	function returnToTable() {
		if (game.picked) game.takeBack(game.picked);
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

		<p class="prompt text-panel">{@html formatFont(t('feeding.prompt'))}</p>

		<!-- Тварина ліворуч, стіл посередині, тварина праворуч; смітник — під ними. -->
		<div class="board" class:board--fed={game.fed}>
			<div class="board__column">
				<FeedingZone
					labelKey={game.round.animals[0].nameKey as TranslationKey}
					image={game.round.animals[0].image}
					foods={game.placedAt(game.round.animals[0].id)}
					hints={game.unplaced}
					onhint={(food) => game.moveTo(food, game.round!.animals[0].id)}
					picked={game.picked}
					disabled={game.fed}
					onplace={() => game.place(game.round!.animals[0].id)}
					onpickup={(food) => game.pick(food)}
					ontakeback={(food) => game.takeBack(food)}
					testId="feeding-zone-animal-0"
				/>
				{#if game.fed}
					<FeedingVerdicts
						verdicts={verdictsFor(game.round.animals[0].id)}
						animals={game.round.animals}
						label={formatPlain(td(game.round.animals[0].nameKey))}
						testId="feeding-verdicts-animal-0-list"
					/>
				{/if}
			</div>

			<!--
				Стіл поводиться як зона: та сама пара «клік або перетягування», той
				самий `role="button"` поверх дітей-кнопок — див. FeedingZone.
			-->
			<div
				class="table"
				class:table--active={game.picked !== null && !game.fed}
				role="button"
				tabindex="0"
				aria-label={formatPlain(t('feeding.table'))}
				data-testid="feeding-table-container"
				onclick={returnToTable}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						returnToTable();
					}
				}}
				ondragover={(e) => {
					if (game.fed) return;
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
				}}
				ondrop={(e) => {
					e.preventDefault();
					returnToTable();
				}}
			>
				{#each game.unplaced as food (food.id)}
					<FeedingDish
						{food}
						picked={game.picked?.id === food.id}
						disabled={game.fed}
						targets={quickTargets}
						onpick={() => game.pick(food)}
						onsend={(target) => game.moveTo(food, target)}
					/>
				{/each}
				{#if game.fed}
					<!--
						Стіл після годування порожній завжди — залишки їдуть у смітник.
						Кнопка стає сюди, щоб по неї не тягнутися вниз повз увесь розбір.
					-->
					<button
						type="button"
						class="btn-primary btn-primary--next"
						onclick={() => game.nextRound()}
						data-testid="feeding-next-btn"
					>
						{@html formatFont(t('common.next'))}
					</button>
				{:else if game.unplaced.length === 0}
					<p class="table__empty">
						{@html formatFont(t(game.picked ? 'feeding.hintReturn' : 'feeding.hintTap'))}
					</p>
				{/if}
			</div>

			<div class="board__column">
				<FeedingZone
					labelKey={game.round.animals[1].nameKey as TranslationKey}
					image={game.round.animals[1].image}
					foods={game.placedAt(game.round.animals[1].id)}
					hints={game.unplaced}
					onhint={(food) => game.moveTo(food, game.round!.animals[1].id)}
					picked={game.picked}
					disabled={game.fed}
					onplace={() => game.place(game.round!.animals[1].id)}
					onpickup={(food) => game.pick(food)}
					ontakeback={(food) => game.takeBack(food)}
					testId="feeding-zone-animal-1"
				/>
				{#if game.fed}
					<FeedingVerdicts
						verdicts={verdictsFor(game.round.animals[1].id)}
						animals={game.round.animals}
						label={formatPlain(td(game.round.animals[1].nameKey))}
						testId="feeding-verdicts-animal-1-list"
					/>
				{/if}
			</div>
		</div>

		<FeedingZone
			labelKey="feeding.bin"
			image={null}
			foods={game.placedAt(BIN)}
			hints={game.unplaced}
			onhint={(food) => game.moveTo(food, BIN)}
			picked={game.picked}
			disabled={game.fed}
			onplace={() => game.place(BIN)}
			onpickup={(food) => game.pick(food)}
			ontakeback={(food) => game.takeBack(food)}
			testId="feeding-zone-bin"
		/>

		{#if game.fed}
			<FeedingVerdicts
				verdicts={verdictsFor(BIN)}
				animals={game.round.animals}
				label={formatPlain(t('feeding.bin'))}
				testId="feeding-verdicts-bin-list"
			/>
		{/if}

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
	 * Тварини по боках столу, стіл посередині — і так на будь-якій ширині.
	 *
	 * Медіазапиту тут немає навмисно. Він був потрібен, поки страви стояли на
	 * столі в ряд: три по 44px вимагали 410px вікна, і нижче розкладка мусила
	 * ставати стовпчиком. Відколи стіл вертикальний, йому досить 76px, і три
	 * колонки вміщуються навіть у 320px — найвужче, під що тут узагалі верстають.
	 *
	 * Колонки часткові, а НЕ `auto`: зона росте разом зі стравами на тарілці,
	 * і з трьома стравами в однієї тварини `auto` роздував її до 251px, а стіл
	 * схлопувався до 24px. Частки тримають пропорцію незалежно від вмісту.
	 * Нижні межі — це найменше, що має сенс: 92px на фото тварини з відступами,
	 * 76px на страву зі своїми полями.
	 */
	.board {
		display: grid;
		grid-template-columns: minmax(92px, 1.25fr) minmax(76px, 1fr) minmax(92px, 1.25fr);
		gap: var(--space-sm);
		width: 100%;
		align-items: stretch;
	}

	.board__column {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		min-width: 0;
	}

	/*
	 * Після годування колонки несуть ще й розбір, а це суцільний текст. У 103px
	 * (стільки дістається колонці на 320px) з нього виходить десять символів у
	 * рядок, тож на вузькому екрані дошка на цей час стає стовпчиком.
	 *
	 * Поріг — 640px: саме там колонці лишається близько 200px, і пояснення
	 * читається рядками, а не стовпчиком по слову. Виміряно на зібраній сторінці.
	 */
	@media (max-width: 639px) {
		.board--fed {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	/* Кнопка в порожньому столі: він вужчий за неї, тож стелю знімаємо. */
	.btn-primary--next {
		max-width: none;
		font-size: var(--font-size-md);
		padding: var(--space-sm);
	}

	.table {
		display: flex;
		flex-direction: column;
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

	.table--active {
		outline: 2px dashed color-mix(in srgb, var(--color-accent), transparent 40%);
		outline-offset: -4px;
	}

	.table__empty {
		margin: 0;
		font-size: var(--font-size-xs);
		text-align: center;
		color: var(--color-text-on-panel);
		opacity: 0.8;
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

	/* Підказка з'являється лише коли на столі щось лишилося, тож місця під неї
	   не резервуємо: поява внизу сторінки нічого не зсуває. */
	.leftovers {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

</style>
