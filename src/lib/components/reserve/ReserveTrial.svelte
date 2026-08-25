<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { isSuccess } from '$lib/config/scoring';
	import { quizProgramme, ONLINE_GAMES } from '$lib/config/quizOnline';
	import { loadQuizText } from '$lib/i18n/quiz';
	import QuizBoard from '$lib/components/quiz/QuizBoard.svelte';

	/**
	 * ПЕРЕВІРКА «ЗРОБИТИ САМОМУ»: пʼять раундів однієї міні-гри й поріг 70%.
	 *
	 * ## Звідки взялися саме такі правила
	 *
	 * Технічне завдання автора: «Зробити самому це запускається випадкова міні гра
	 * одна з шести. Різниця в тому що не 10 запитань а 5 і треба набрати певну
	 * кількість балів… І поріг це більше 70% правильних відповідей, тоді
	 * зараховується успішна дія».
	 *
	 * Шкала очок для цього вже існувала й лежала невжитою: `config/scoring.ts` дає
	 * три очки за бінарну правильну відповідь, по одному за частину складеної й
	 * бонус за бездоганний раунд, а `isSuccess` рахує поріг. Доти цю функцію не
	 * викликав НІХТО — вона й була написана під цю перевірку.
	 *
	 * ## Чому одна гра на всі пʼять раундів, а не пʼять різних
	 *
	 * Бо це перевірка, а не вікторина. Пʼять раундів однієї гри міряють одне
	 * вміння; пʼять різних ігор міряли б, чи пощастило з набором — «Правда чи міф»
	 * коштує три очки за раунд, а «Що їмо» до чотирьох, і поріг у 70% залежав би від
	 * того, які саме ігри випали.
	 *
	 * Гра вибирається випадково з шести — саме як просив автор.
	 *
	 * ## Чому `QuizBoard`, а не власні дошки
	 *
	 * Він уже вміє показати будь-яку з шести ігор одним раундом і сказати, скільки
	 * очок узято: цей самий шлях працює у спільній вікторині. Власна копія тут
	 * означала б другу реалізацію п'яти дошок і другий спосіб рахувати очки.
	 */
	interface Props {
		/** Скільки раундів у перевірці. Прохання автора — пʼять замість десяти. */
		rounds?: number;
		/** Зерно програми: щоб та сама перевірка була відтворюваною в тестах. */
		seed?: number;
		/** Перевірку пройдено (понад 70% очок) чи ні. Кличеться РІВНО раз. */
		ondone: (ok: boolean) => void;
		/** Людина передумала. Дія лишається невиконаною — як «нічого не робити». */
		oncancel: () => void;
	}

	let {
		rounds = 5,
		seed = Math.floor(Math.random() * 2 ** 31),
		ondone,
		oncancel
	}: Props = $props();

	/**
	 * Рядки вікторини лежать у ЛІНИВОМУ чанку (`i18n/quiz`) — дошки читають саме їх.
	 *
	 * Тут вони довантажуються так само, як на сторінці спільної гри: головний
	 * словник вантажать усі відвідувачі, і кегль дошок туди не переїде.
	 */
	let dict = $state<Record<string, string>>({});
	const text = $derived((key: string) => dict[key] ?? key);

	/**
	 * Програма перевірки: ОДНА випадкова гра, `rounds` кроків.
	 *
	 * `quizProgramme` уже вміє видавати кроки з різними зернами з одного —
	 * тобто пʼять різних питань тієї самої гри, а не одне пʼять разів.
	 */
	const pick = ONLINE_GAMES[Math.floor(Math.random() * ONLINE_GAMES.length)];
	/*
	 * Програма збирається РАЗ, з початкових значень — `untrack` про це й каже.
	 *
	 * Перевірка триває від першого раунду до останнього, і міняти її склад
	 * посеред неї означало б інші питання після відповіді на попереднє. Той самий
	 * взірець і з тієї самої причини — у `QuizBoard`, який так само читає свій крок
	 * один раз.
	 */
	const programme = untrack(() => quizProgramme(seed, [pick.id], rounds));

	let index = $state(0);
	let points = $state(0);
	let max = $state(0);
	/** Щоб відповідь не порахувалася двічі: дошка кличе `onanswer` раз, але крок міняється. */
	let finished = $state(false);

	onMount(() => void loadQuizText('uk').then((loaded) => (dict = loaded)));

	function answered(_correct: number, scored?: { points: number; max: number }) {
		points += scored?.points ?? 0;
		max += scored?.max ?? 0;

		if (index + 1 < programme.length) {
			index += 1;
			return;
		}
		if (finished) return;
		finished = true;
		// Поріг живе в `config/scoring.ts` — там же, де й самі очки.
		ondone(isSuccess(points, max));
	}
</script>

<div class="trial" data-testid="reserve-trial-panel">
	<header class="trial__head">
		<span class="trial__step" data-testid="reserve-trial-progress-text">
			{index + 1} / {programme.length}
		</span>
		<button
			type="button"
			class="trial__quit"
			onclick={oncancel}
			data-testid="reserve-trial-quit-btn"
		>
			{text('quiz.leave') === 'quiz.leave' ? '✕' : text('quiz.leave')}
		</button>
	</header>

	<!--
		`{#key}` обовʼязковий: дошка читає свій крок ОДИН раз (`untrack`), тож без
		перемонтування другий раунд показав би питання першого.
	-->
	{#key index}
		<QuizBoard {text} step={programme[index]} onanswer={answered} />
	{/key}
</div>

<style>
	.trial {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.trial__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.trial__step {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		color: var(--color-text-on-panel);
	}

	.trial__quit {
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-width: 44px;
		min-height: 44px;
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 78%);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text-on-panel);
		font: inherit;
		cursor: pointer;
	}
</style>
