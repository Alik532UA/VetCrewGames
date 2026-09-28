<script lang="ts">
	import { slide } from 'svelte/transition';
	import { t, td, formatFont } from '$lib/i18n';
	import { motionMs } from '$lib/utils/transitions';
	import type { FeedingView } from '$lib/controllers/feedingGame.svelte';
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
		/** Жива партія або минулий раунд для перегляду (`feedingReview`). */
		game: FeedingView;
		targets: QuickTarget[];
		/** Онлайн: кнопки «Далі» немає — передається далі в `FeedingTable`, де вона й живе. */
		hideNext?: boolean;
		/**
		 * ЛИШЕ РОЗБІР: присуди під іменем тварини, без столу й зон — табло між раундами
		 * спільної вікторини (`QuizBoard`, `settled`), де під рахунком мусить уміститися й це.
		 */
		compact?: boolean;
		/** Розбір без оцінки: гравець не розклав нічого, і це відповідь-ключ (`answerKeyOf`). */
		plain?: boolean;
	}

	let { game, targets, hideNext = false, compact = false, plain = false }: Props = $props();

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

	/**
	 * Кому належать страви — у тому порядку, в якому їх видно на дошці: тварини, смітник.
	 * Ключ словника, а не готовий рядок: розмітку як HTML дає лише словник (`src/security.test.ts`).
	 */
	const owners = $derived([
		...round.animals.map((animal) => ({ id: animal.id, nameKey: animal.nameKey })),
		{ id: BIN, nameKey: 'feeding.bin' }
	]);
</script>

{#if compact}
	<div class="settled" in:slide={{ duration: motionMs(300) }} data-testid="feeding-settled-panel">
		{#each owners as owner (owner.id)}
			{@const verdicts = verdictsFor(owner.id)}
			{#if verdicts.length > 0}
				<section class="settled__group">
					<h3 class="settled__owner text-panel">{@html formatFont(td(owner.nameKey))}</h3>
					<FeedingVerdicts
						{verdicts}
						animals={round.animals}
						label={td(owner.nameKey)}
						{plain}
						testId="feeding-settled-{owner.id}-list"
					/>
				</section>
			{/if}
		{/each}
	</div>
{:else}
	<div class="board" class:board--fed={game.fed} out:slide={{ duration: motionMs(300) }}>
		{#if game.fed}
			<div class="cell cell--verdict0">
				<FeedingVerdicts
					verdicts={verdictsFor(round.animals[0].id)}
					animals={round.animals}
					label={td(round.animals[0].nameKey)}
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

		<FeedingTable {game} {targets} {hideNext} />

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
					label={td(round.animals[1].nameKey)}
					testId="feeding-verdicts-animal-1-list"
				/>
			</div>
		{/if}
	</div>

	<!--
		Смітник і його розбір — одна пара, тож і обгортка в них спільна: на
		телефоні вони стають рядом, як тварина з розбором вище.
	-->
	<div class="bin-row" class:bin-row--fed={game.fed} out:slide={{ duration: motionMs(300) }}>
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
				label={t('feeding.bin')}
				reveal
				testId="feeding-verdicts-bin-list"
			/>
		{/if}
	</div>
{/if}

<style>
	/*
	 * Розбір на таблі: назва тварини — над своїми присудами, а групи — рядом, коли є ширина.
	 * Одна під одною на компʼютері вони не вміщалися під рахунком: заміряно на 1280×800 —
	 * смітник із поясненням ішов за нижній край. На телефоні колонка одна.
	 */
	.settled {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		align-items: start;
		gap: var(--space-sm);
		width: 100%;
	}

	.settled__group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.settled__owner {
		align-self: flex-start;
		margin: 0;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
	}

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
	 * Смітник із розбором: один стовпець, тобто те саме, що й раніше давав
	 * `gap` сторінки. Обгортка потрібна лише щоб на телефоні зробити з них ряд.
	 */
	.bin-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-sm);
		width: 100%;
	}

	/*
	 * Телефон, стан розбору: тварина ЛІВОРУЧ, її розбір ПРАВОРУЧ.
	 *
	 * Стовпчиком це давало 1538px при 800 видимих — майже два екрани, з яких
	 * половина порожнього поля обабіч вузьких карток. Причина була в тому, що
	 * пара «тварина — її розбір» розривалася по вертикалі, хоча читають її
	 * разом.
	 *
	 * Кнопка «Далі» піднялася в перший рядок. У столі вона опинилася тому, що
	 * після годування стіл порожній, — але на телефоні стіл стояв ОСТАННІМ, і
	 * по кнопку доводилося крутити повз увесь розбір. Тепер вона там, де на неї
	 * дивляться: зверху.
	 *
	 * 2fr/3fr, а не половина на половину: ліворуч фото зі стелею в 100px, а
	 * праворуч текст, якому ширина потрібніша.
	 */
	@media (max-width: 639px) {
		.board--fed {
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			grid-template-areas:
				'table table'
				'zone0 verdict0'
				'zone1 verdict1';
		}

		.bin-row--fed {
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		}

		/*
		 * Порожній стіл більше не тримає 92px. Ця висота резервувалася під
		 * страви, щоб дошка не змінювала розмір під час гри, — але після
		 * годування страв там немає й не буде, лишається сама кнопка.
		 */
		.board--fed > :global(.table) {
			min-height: 0;
		}
	}



</style>
