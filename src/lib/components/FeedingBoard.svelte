<script lang="ts">
	import { t, td, formatPlain } from '$lib/i18n';
	import type { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { BIN } from '$lib/config/feeding-game';
	import FeedingZone from './FeedingZone.svelte';
	import type { QuickTarget } from './FeedingDish.svelte';
	import FeedingTable from './FeedingTable.svelte';
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

		<FeedingTable {game} {targets} />

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
	.board {
		display: grid;
		grid-template-columns: minmax(92px, 1.25fr) minmax(76px, 1fr) minmax(92px, 1.25fr);
		grid-template-areas: 'zone0 table zone1';
		gap: var(--space-sm);
		width: 100%;
		align-items: stretch;
		/* Опора для розбору, який на широкому екрані стоїть ПОЗА дошкою. */
		position: relative;
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
	.board > :global(.table) {
		grid-area: table;
	}
	.cell--verdict0 {
		grid-area: verdict0;
	}
	.cell--verdict1 {
		grid-area: verdict1;
	}

	/*
	 * Розбір під твариною — запасний варіант, коли поставити його збоку нема
	 * куди. Стіл лишається В ПЕРШОМУ рядку: якби він тягнувся на обидва, поява
	 * розбору міняла б його висоту, а після відповіді ніщо рухатися не має.
	 */
	.board--fed {
		grid-template-areas:
			'zone0 table zone1'
			'verdict0 . verdict1';
	}

	/*
	 * Від 1100px розбір виходить ПОЗА дошку — у поля, які й так порожні.
	 *
	 * Саме абсолютно, а не п'ятьма колонками: колонки означали б ширшу сторінку,
	 * а отже інші розміри зон, столу й смітника після відповіді. Тепер дошка не
	 * знає про розбір нічого, і геометрія гри до й після відповіді однакова.
	 *
	 * Поріг рахується з місця: сторінка 560px по центру лишає обабіч (V−560)/2.
	 * Щоб умістити 248px картки плюс проміжок, треба 256 — тобто вікно від 1072.
	 */
	@media (min-width: 1100px) {
		/*
		 * Другого рядка тут не треба: розбір поза дошкою, а порожній рядок усе
		 * одно додавав проміжок — і смітник з'їжджав на 8px після відповіді.
		 */
		.board--fed {
			grid-template-areas: 'zone0 table zone1';
		}

		.cell--verdict0,
		.cell--verdict1 {
			position: absolute;
			/*
			 * `grid-area: auto` обов'язковий. Абсолютний нащадок сітки, у якого
			 * область названа, позиціонується від СВОЄЇ ОБЛАСТІ, а не від сітки —
			 * і `top: 0` відлічувався від другого рядка, тобто з-під дошки.
			 */
			grid-area: auto;
			top: 0;
			width: 248px;
		}

		.cell--verdict0 {
			right: calc(100% + var(--space-sm));
		}

		.cell--verdict1 {
			left: calc(100% + var(--space-sm));
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



</style>
