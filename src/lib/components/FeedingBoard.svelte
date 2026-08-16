<script lang="ts">
	import { t, td, formatFont, formatPlain } from '$lib/i18n';
	import type { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { BIN } from '$lib/config/feeding-game';
	import FeedingZone from './FeedingZone.svelte';
	import FeedingDish, { type QuickTarget } from './FeedingDish.svelte';
	import FeedingVerdicts from './FeedingVerdicts.svelte';

	/**
	 * Ігрова дошка «Що їмо?»: тварина — стіл — тварина, і розбір довкола них.
	 *
	 * Три розкладки на одній сітці, і перемикають їх іменовані області, а не
	 * різна розмітка: DOM однаковий завжди, тож жоден стан не має власної копії,
	 * яка колись розійдеться з рештою.
	 *
	 * Контролер приходить цілком, а не дванадцятьма властивостями: дошка — це
	 * майже вся взаємодія гри, і розбирати його на частини тут означало б
	 * переписувати той самий інтерфейс удруге.
	 */
	interface Props {
		game: FeedingGameController;
		targets: QuickTarget[];
	}

	let { game, targets }: Props = $props();

	/**
	 * Раунд тут завжди є: дошку показують лише всередині `{#if game.round}`.
	 * Локальна змінна замість `!` у двадцяти місцях — і читається, і звужується
	 * тип один раз.
	 */
	const round = $derived(game.round!);

	/**
	 * Розбір розкладається по тому, кому страва НАСПРАВДІ належить, а не куди її
	 * поклали: пояснення стоїть біля тієї тварини, про яку воно й розповідає.
	 */
	const verdictsFor = (target: string) => game.verdicts.filter((v) => v.correct === target);

	/** Стіл — теж ціль: сюди повертають страву, яку передумали віддавати. */
	function returnToTable() {
		if (game.picked) game.takeBack(game.picked);
	}
</script>

	<div class="board" class:board--fed={game.fed}>
		{#if game.fed}
			<div class="cell cell--verdict0">
				<FeedingVerdicts
					verdicts={verdictsFor(round.animals[0].id)}
					animals={round.animals}
					label={formatPlain(td(round.animals[0].nameKey))}
					testId="feeding-verdicts-animal-0-list"
				/>
			</div>
		{/if}

		<div class="cell cell--zone0">
			<FeedingZone
				labelKey={round.animals[0].nameKey as TranslationKey}
				image={round.animals[0].image}
				foods={game.placedAt(round.animals[0].id)}
				hints={game.unplaced}
				onhint={(food) => game.moveTo(food, round.animals[0].id)}
				picked={game.picked}
				disabled={game.fed}
				onplace={() => game.place(round.animals[0].id)}
				onpickup={(food) => game.pick(food)}
				ontakeback={(food) => game.takeBack(food)}
				testId="feeding-zone-animal-0"
			/>
		</div>

		<!--
			Стіл поводиться як зона: та сама пара «клік або перетягування», той
			самий `role="button"` поверх дітей-кнопок — див. FeedingZone.
		-->
		<div
			class="table cell--table"
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
					{targets}
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

		<div class="cell cell--zone1">
			<FeedingZone
				labelKey={round.animals[1].nameKey as TranslationKey}
				image={round.animals[1].image}
				foods={game.placedAt(round.animals[1].id)}
				hints={game.unplaced}
				onhint={(food) => game.moveTo(food, round.animals[1].id)}
				picked={game.picked}
				disabled={game.fed}
				onplace={() => game.place(round.animals[1].id)}
				onpickup={(food) => game.pick(food)}
				ontakeback={(food) => game.takeBack(food)}
				testId="feeding-zone-animal-1"
			/>
		</div>

		{#if game.fed}
			<div class="cell cell--verdict1">
				<FeedingVerdicts
					verdicts={verdictsFor(round.animals[1].id)}
					animals={round.animals}
					label={formatPlain(td(round.animals[1].nameKey))}
					testId="feeding-verdicts-animal-1-list"
				/>
			</div>
		{/if}
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
			animals={round.animals}
			label={formatPlain(t('feeding.bin'))}
			testId="feeding-verdicts-bin-list"
		/>
	{/if}

<style>
	/* Кнопка в порожньому столі: він вужчий за неї, тож стелю знімаємо. */
	.btn-primary--next {
		max-width: none;
		font-size: var(--font-size-md);
		padding: var(--space-sm);
	}

	.board {
		display: grid;
		grid-template-columns: minmax(92px, 1.25fr) minmax(76px, 1fr) minmax(92px, 1.25fr);
		grid-template-areas: 'zone0 table zone1';
		gap: var(--space-sm);
		width: 100%;
		align-items: stretch;
	}

	.cell {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.cell--zone0 {
		grid-area: zone0;
	}
	.cell--zone1 {
		grid-area: zone1;
	}
	.cell--table {
		grid-area: table;
	}
	.cell--verdict0 {
		grid-area: verdict0;
	}
	.cell--verdict1 {
		grid-area: verdict1;
	}

	/*
	 * Розбір стає під тварину — це запасний варіант, коли поставити його збоку
	 * нема куди. Стіл при цьому тягнеться на обидва рядки, щоб кнопка «Далі»
	 * лишалася по центру дошки, а не приліпала до її верху.
	 */
	.board--fed {
		grid-template-areas:
			'zone0 table zone1'
			'verdict0 table verdict1';
	}

	/*
	 * Від 900px розбір переїжджає ЗБОКУ від тварин — у поля, які доти просто
	 * простоювали: сторінка в грі вужча за вікно вдвічі й більше.
	 *
	 * Поріг саме тут, бо колонка розбору мусить лишатися читною: на 900px їй
	 * дістається 185px, на 1280 — 237. Нижче текст знову стає стовпчиком по
	 * слову, і тоді краще під твариною на всю ширину колонки.
	 */
	@media (min-width: 900px) {
		.board--fed {
			grid-template-columns:
				minmax(0, 1.4fr) minmax(92px, 1.25fr)
				minmax(76px, 1fr) minmax(92px, 1.25fr) minmax(0, 1.4fr);
			grid-template-areas: 'verdict0 zone0 table zone1 verdict1';
			align-items: start;
		}
	}

	/*
	 * Нижче 640px колонці лишається менше за 200px, і пояснення в ній стає
	 * стовпчиком по слову — тому на час розбору дошка стає стовпчиком.
	 */
	@media (max-width: 639px) {
		.board--fed {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'zone0' 'verdict0' 'zone1' 'verdict1' 'table';
		}
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
</style>
