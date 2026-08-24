<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { createQuizGame, startQuizGame } from '$lib/controllers/quizGame';
	import { BIN } from '$lib/config/feeding-game';
	import type { QuizStep } from '$lib/config/quizOnline';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import type { QuickTarget } from '$lib/components/FeedingDish.svelte';
	import MythCard from '$lib/components/MythCard.svelte';
	import FeedingBoard from '$lib/components/FeedingBoard.svelte';
	import HabitatBoard from '$lib/components/HabitatBoard.svelte';
	import FamilyBoard from '$lib/components/FamilyBoard.svelte';
	import PopulationBoard from '$lib/components/PopulationBoard.svelte';

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
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
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

	let { text, step, onanswer }: Props = $props();

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
	 * СТВОРЕННЯ ПЕРЕЇХАЛО У ФАБРИКУ, і не заради стрункості.
	 *
	 * Тут стояло п'ять `new` підряд, і в одного з них аргументи були переставлені:
	 * «Хто численніший?» отримувала одну комірку замість трьох, зерно в поле
	 * `totalRounds` і `Math.random` замість спільної роздачі. Гейт цього не бачив,
	 * бо перевіряв контролери, а не місце виклику. Тепер місце виклику одне
	 * (`controllers/quizGame.ts`), і його перевіряє `quizGame.test.ts`.
	 */
	const created = createQuizGame(mine);
	const game = created?.game ?? null;

	onMount(() => {
		// Яка гра чим починається — знає фабрика: «Де живем?» вибором підрежиму,
		// «Хто численніший?» роздачею в самій дошці, решта звичайним `start()`.
		if (created) startQuizGame(created);
	});

	/**
	 * Про відповідь повідомляємо РІВНО раз.
	 *
	 * `$effect` перезапускається на будь-якій зміні читаного стану, тож без цього
	 * прапорця повідомлення пішло б стільком разів, скільком ще щось ворухнулося.
	 * У журналі це були б повторні записи того самого раунду; вони відкидаються
	 * при застосуванні (`QuizMatch`), але писати їх однаково не треба.
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
		if (created?.kind === 'feeding') {
			const verdicts = created.game.verdicts;
			if (verdicts.length === 0) return 0;
			return verdicts.filter((verdict) => verdict.isCorrect).length / verdicts.length;
		}
		/*
		 * «Де живем?» знає ТРИ результати, а не два: `partial` — це коли вибрано
		 * частину правильних варіантів. Половина очок за нього — не компроміс, а
		 * те, як гра влаштована: питання множинного вибору.
		 */
		if (created?.kind === 'habitat') {
			const outcome = created.game.roundResults[0];
			return outcome === 'correct' ? 1 : outcome === 'partial' ? 0.5 : 0;
		}
		/*
		 * «Хто численніший?» дає частку за побудовою: три картки, і кожна на своєму
		 * місці або ні. Беремо результат раунду так само, як решта — контролер уже
		 * звів його до `correct`/`partial`/`incorrect`.
		 */
		const outcome = game?.roundResults[0];
		return outcome === 'correct' ? 1 : outcome === 'partial' ? 0.5 : 0;
	}

	/**
	 * ВІДПОВІДЬ ІДЕ В ЖУРНАЛ У МИТЬ ВІДПОВІДІ, а не після натиску «Далі».
	 *
	 * Тут стояло `if (!game?.gameOver …)`, і при `totalRounds = 1` цей прапорець
	 * встає лише після того, як дошка покличе `nextRound()` — тобто після натиску
	 * «Далі» на власній кнопці дошки. Наслідків було три, і всі три автор
	 * побачив: бали не зараховувалися, поки не натиснеш «Далі»; множник за
	 * швидкість міряв швидкість НАТИСКУ, а не відповіді (тобто той, хто прочитав
	 * пояснення, платив за це балами); і раунд не міг закінчитися раніше строку,
	 * бо «всі відповіли» не ставало правдою.
	 *
	 * `roundResults` — спільний сигнал усіх п'яти контролерів: кожен додає
	 * результат раунду саме в обробнику відповіді (`answer`, `check`, `feed`).
	 * Тобто це «людина відповіла», тоді як `gameOver` — «міні-партія скінчилася», і
	 * в раунді на одну відповідь це РІЗНІ моменти.
	 */
	$effect(() => {
		if (reported || !game || game.roundResults.length === 0) return;
		reported = true;
		onanswer(correctShare());
	});

	/** Мішені перетягування — та сама похідна, що на сторінці «Роздай страви». */
	const targets = $derived<QuickTarget[]>(
		created?.kind === 'feeding' && created.game.round
			? [
					{
						id: created.game.round.animals[0].id,
						labelKey: created.game.round.animals[0].nameKey as TranslationKey,
						image: created.game.round.animals[0].image,
						place: 'left' as const
					},
					{
						id: created.game.round.animals[1].id,
						labelKey: created.game.round.animals[1].nameKey as TranslationKey,
						image: created.game.round.animals[1].image,
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
	{#if created === null}
		<!--
			Гра з новішої збірки. Крок пропускається з нулем очок — інакше партія
			застрягла б на ньому назавжди, і виглядало б це як зламана кімната.
		-->
		<p class="board__unknown text-panel">{@html formatFont(text('quiz.unknownGame'))}</p>
		<button
			type="button"
			class="btn-primary"
			onclick={() => onanswer(0)}
			data-testid="quiz-skip-btn"
		>
			{@html formatFont(text('quiz.skipStep'))}
		</button>
	{:else if created.kind === 'myths' && created.game.current}
		<!--
			`{#each}` на одному елементі — це спосіб перемонтувати картку на кожне
			питання: без ключа Svelte перевикористав би вузли, і перехід між питаннями
			не грав би. Той самий приймо, що на сторінці гри.

			`onnext` порожній, і це не пропуск: у кімнаті наступний раунд оголошує
			господар, а не гравець. Саму кнопку «Далі» ховає `MythCard` за `hideNext`.
		-->
		{#each [created.game.current] as question (question.id)}
			<MythCard
				{question}
				onanswer={(truth) => created.game.answer(truth)}
				onnext={() => {}}
				hideNext
			/>
		{/each}
	{:else if created.kind === 'family'}
		<FamilyBoard game={created.game} hideNext />
	{:else if created.kind === 'population'}
		<PopulationBoard game={created.game} hideNext />
	{:else if created.kind === 'habitat'}
		<HabitatBoard game={created.game} mode={created.mode} hideNext />
	{:else if created.kind === 'feeding' && created.game.round}
		<p class="board__prompt text-panel">{@html formatFont(t('feeding.prompt'))}</p>
		<FeedingBoard game={created.game} {targets} />
		<!--
			КНОПКИ «ДАЛІ» ТУТ НЕМА, і це не пропуск.

			Після `feed()` наступний раунд оголошує сама дошка — `FeedingTable`
			всередині `FeedingBoard`. Своя кнопка поруч давала б два способи зробити те
			саме, і другий натиск перескочив би раунд.
		-->
		{#if !created.game.fed}
			<button
				type="button"
				class="btn-primary"
				disabled={!created.game.canFeed}
				onclick={() => created.game.feed()}
				data-testid="quiz-feeding-feed-btn"
			>
				{@html formatFont(t(created.game.canFeed ? 'feeding.feed' : 'feeding.placeSomething'))}
			</button>
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
