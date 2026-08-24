<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { MythGameController } from '$lib/controllers/mythGame.svelte';
	import { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import type { QuizStep } from '$lib/config/quizOnline';
	import { BIN } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import type { QuickTarget } from '$lib/components/FeedingDish.svelte';
	import MythCard from '$lib/components/MythCard.svelte';
	import FeedingBoard from '$lib/components/FeedingBoard.svelte';

	/**
	 * Один КРОК спільної вікторини: своя дошка, чужий рахунок.
	 *
	 * ## Що тут головне
	 *
	 * Контролер створюється з ЗЕРНОМ КРОКУ, а не без нього. Саме це робить партію
	 * спільною: обидва гравці бачать ті самі питання в тому самому порядку, бо
	 * виводять їх із того самого числа. Зерно приходить із програми, а програма —
	 * із зерна кімнати (`config/quizOnline.ts`).
	 *
	 * ## Чому компонент перемонтовується на кожен крок
	 *
	 * Контролер тримає стан партії, і «почати наступну гру» для нього — це нова
	 * партія, а не наступний раунд. Батько ставить `{#key}` на зерно кроку, тож
	 * компонент народжується заново; спроба переставити контролер усередині дала б
	 * дошку, у якій половина стану від попередньої гри.
	 *
	 * ## Про рахунок сайту
	 *
	 * Локальні контролери самі додають очки в загальний рахунок сайту, і це
	 * лишається як є: гравець і справді відповів на ці питання. Спільний рахунок
	 * партії — окреме число, воно живе в журналі кімнати.
	 */
	interface Props {
		step: QuizStep;
		/**
		 * Я відповів — ось ЧАСТКА правильного, від 0 до 1. Кличеться РІВНО раз.
		 *
		 * Частка, а не очки, і це ключове. Очки залежать від швидкості, а швидкість
		 * рахується з двох СЕРВЕРНИХ позначок часу в журналі — дошка про неї не
		 * знає й знати не мусить. Доти сюда їхало готове число, тобто клієнт
		 * оголошував і правильність, і швидкість; тепер він оголошує лише першу.
		 */
		onanswer: (correct: number) => void;
	}

	let { step, onanswer }: Props = $props();

	/*
	 * КРОК ЧИТАЄТЬСЯ ОДИН РАЗ, і `untrack` про це і каже.
	 *
	 * Компонент перемонтовується на кожен крок (`{#key}` у батька), тож
	 * початкового значення тут досить — а без `untrack` компілятор
	 * справедливо попереджає, що зчитано лише перше значення реактивного
	 * пропа. Попередження тут не шум: якби `{#key}` колись зник, дошка
	 * лишилася б від попередньої гри, і саме це воно й ловить.
	 */
	const mine = untrack(() => step);
	/*
	 * ОДИН РАУНД НА КОНТРОЛЕР, і це те, що зробило раундову модель дешевою.
	 *
	 * Усі пʼять контролерів ігор приймають `(totalRounds, seed)`, а
	 * `quizSeed.test.ts` доводить, що за однакового зерна послідовність однакова.
	 * Тобто «одне питання» — це просто контролер на один раунд, і жодної нової
	 * механіки роздачі не потрібно.
	 */
	const ROUNDS_PER_STEP = 1;

	/*
	 * Контролер вибирається за грою кроку. `null` означає, що гра кроку невідома —
	 * так буває, коли кімнату створила НОВІША збірка, у якій ігор більше.
	 *
	 * Це не помилка й не падіння: крок просто нічим грати, і батько мусить мати
	 * змогу його закрити. Тому нижче стоїть кнопка «пропустити», а не порожній
	 * екран без виходу.
	 */
	const myths = mine.game === 'myths' ? new MythGameController(ROUNDS_PER_STEP, mine.seed) : null;
	const feeding =
		mine.game === 'feeding' ? new FeedingGameController(ROUNDS_PER_STEP, mine.seed) : null;
	const game = myths ?? feeding;

	onMount(() => game?.start());

	/**
	 * Про закінчення кроку повідомляємо РІВНО раз.
	 *
	 * `$effect` перезапускається на будь-якій зміні читаного стану, а `gameOver`
	 * лишається `true` до кінця життя компонента — тобто без цього прапорця
	 * повідомлення пішло б стільком разів, скільком ще щось ворухнулося. У журналі
	 * це були б повторні записи того самого кроку; вони відкидаються при
	 * застосуванні (`QuizMatch`), але писати їх однаково не треба.
	 */
	let reported = false;

	/**
	 * Частка правильного в цьому раунді.
	 *
	 * У «Міфів» відповідь бінарна — один результат раунду. У «Роздай страви» три
	 * страви, і дві з трьох мусять давати дві третини: інакше гра стає «усе або
	 * нічого», хоч сама вона так не влаштована.
	 */
	function correctShare(): number {
		if (feeding) {
			const verdicts = feeding.verdicts;
			if (verdicts.length === 0) return 0;
			return verdicts.filter((verdict) => verdict.isCorrect).length / verdicts.length;
		}
		return game?.roundResults[0] === 'correct' ? 1 : 0;
	}

	$effect(() => {
		if (!game?.gameOver || reported) return;
		reported = true;
		onanswer(correctShare());
	});

	/** Мішені перетягування — та сама похідна, що на сторінці «Роздай страви». */
	const targets = $derived<QuickTarget[]>(
		feeding?.round
			? [
					{
						id: feeding.round.animals[0].id,
						labelKey: feeding.round.animals[0].nameKey as TranslationKey,
						image: feeding.round.animals[0].image,
						place: 'left' as const
					},
					{
						id: feeding.round.animals[1].id,
						labelKey: feeding.round.animals[1].nameKey as TranslationKey,
						image: feeding.round.animals[1].image,
						place: 'right' as const
					},
					/*
					 * Смітник: `image: null` і `place: top`.
					 *
					 * `null` тут не «забули картинку», а умова: `FeedingDish` малює на
					 * цьому місці іконку, а не фото. Ті самі три мішені, що на сторінці
					 * «Роздай страви», — і `BIN` узято з конфігу, а не написано рядком.
					 */
					{ id: BIN, labelKey: 'feeding.bin' as TranslationKey, image: null, place: 'top' as const }
				]
			: []
	);
</script>

<div class="board" data-testid="quiz-board-panel">
	{#if game === null}
		<!--
			Гра з новішої збірки. Крок пропускається з нулем очок — інакше партія
			застрягла б на ньому назавжди, і виглядало б це як зламана кімната.
		-->
		<p class="board__unknown text-panel">{@html formatFont(t('quiz.unknownGame'))}</p>
		<button
			type="button"
			class="btn-primary"
			onclick={() => onanswer(0)}
			data-testid="quiz-skip-btn"
		>
			{@html formatFont(t('quiz.skipStep'))}
		</button>
	{:else if !game.gameOver}

		{#if myths?.current}
			<!--
				`{#each}` на одному елементі — це спосіб перемонтувати картку на кожне
				питання: без ключа Svelte перевикористав би вузли, і перехід між
				питаннями не грав би. Той самий приймо, що на сторінці гри.
			-->
			{#each [myths.current] as question (question.id)}
				<MythCard
					{question}
					onanswer={(truth) => myths.answer(truth)}
					onnext={() => myths.nextRound()}
				/>
			{/each}
		{:else if feeding?.round}
			<p class="board__prompt text-panel">{@html formatFont(t('feeding.prompt'))}</p>
			<FeedingBoard game={feeding} {targets} />
			<!--
				КНОПКИ «ДАЛІ» ТУТ НЕМА, і це не пропуск.
			
				Після `feed()` наступний раунд оголошує сама дошка — `FeedingTable`
				всередині `FeedingBoard`. Своя кнопка поруч давала б два способи
				зробити те саме, і другий натиск перескочив би раунд.
			-->
			{#if !feeding.fed}
				<button
					type="button"
					class="btn-primary"
					disabled={!feeding.canFeed}
					onclick={() => feeding.feed()}
					data-testid="quiz-feeding-feed-btn"
				>
					{@html formatFont(t(feeding.canFeed ? 'feeding.feed' : 'feeding.placeSomething'))}
				</button>
			{/if}
		{/if}
	{/if}
</div>

<style>
	.board {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
	}

	.board__prompt,
	.board__unknown {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
	}
</style>
