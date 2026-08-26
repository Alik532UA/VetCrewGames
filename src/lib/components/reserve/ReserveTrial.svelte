<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { formatFont } from '$lib/i18n';
	import { isSuccess, SUCCESS_SHARE } from '$lib/config/scoring';
	import { distinctProgramme } from '$lib/config/quizOnline';
	import { loadQuizText } from '$lib/i18n/quiz';
	import { playerData } from '$lib/services/playerData.svelte';
	import type { RoundStatus } from '$lib/types/game';
	import QuizBoard from '$lib/components/quiz/QuizBoard.svelte';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';

	/**
	 * ПЕРЕВІРКА «ЗРОБИТИ САМОМУ»: пʼять раундів міні-ігор і поріг 70%.
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
	 * бонус за бездоганний раунд, а `isSuccess` рахує поріг.
	 *
	 * ## Пʼять РІЗНИХ ігор, а не одна на всі пʼять раундів
	 *
	 * Тут стояла одна гра, і причина була написана так: пʼять різних ігор міряли
	 * б, чи пощастило з набором, бо «Правда чи міф» коштує три очки за раунд, а
	 * «Що їмо» — до чотирьох.
	 *
	 * Причина хибна, і це видно з самого виклику: `isSuccess(points, max)` рахує
	 * поріг від НАБРАНОГО максимуму, а не від числа раундів. Дорога гра піднімає
	 * обидва числа однаково, тож пропорція не зсувається. Автор попросив прямо:
	 * «кожне з питань з різних міні ігор» — і плата за це нульова.
	 *
	 * Перемішування живе в `distinctProgramme`: ігор шість, кроків пʼять, тож без
	 * перемішування одна гра завжди лишалася б за бортом.
	 *
	 * ## Темп — СОЛО, а не кімнатний
	 *
	 * Доти дошка отримувала `hideNext`, а перевірка перескакувала на наступний
	 * крок у ту саму мить, коли приходила відповідь. Наслідок автор і побачив:
	 * «результати кожного з раундів не показується, а показується одразу наступне
	 * запитання» — тобто розбір, який дошка вже намалювала, жив нуль кадрів.
	 *
	 * Тепер `QuizBoard` дістає `onnext`, і крок міняється рівно на натиск «Далі» —
	 * як на соло-сторінці. Заразом зʼявився `RoundIndicator`: він показує не лише
	 * «котрий раунд», а й ЯК пройшов кожен попередній, і це той самий компонент,
	 * що в усіх пʼятьох соло-іграх.
	 */
	interface Props {
		/**
		 * Перекладач ЛІНИВОГО словника вибору (`i18n/reserveCare`).
		 *
		 * Два різні перекладачі в одному компоненті — не недогляд: рядки дошок
		 * лежать у чанку вікторини (`i18n/quiz`, довантажується тут), а рядки самої
		 * перевірки — у чанку вибору, який уже завантажив господар вікна. Тягнути
		 * другий чанк удруге означало б другий `import()` за тими самими даними.
		 */
		careText: (key: string) => string;
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
		careText,
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

	/*
	 * Програма збирається РАЗ, з початкових значень — `untrack` про це й каже.
	 *
	 * Перевірка триває від першого раунду до останнього, і міняти її склад
	 * посеред неї означало б інші питання після відповіді на попереднє. Той самий
	 * взірець і з тієї самої причини — у `QuizBoard`, який так само читає свій крок
	 * один раз.
	 */
	const programme = untrack(() => distinctProgramme(seed, rounds));

	let index = $state(0);
	let points = $state(0);
	let max = $state(0);
	/**
	 * Як пройшов кожен раунд — для індикатора над дошкою.
	 *
	 * Масив, а не число правильних: індикатор малює ТРИ стани («правильно»,
	 * «частково», «ні»), і саме `partial` тут не рідкість — «Де живем?» і «Хто
	 * численніший?» дають його щоразу, коли вибрано частину.
	 */
	let results = $state<RoundStatus[]>([]);
	/** Щоб відповідь не порахувалася двічі: дошка кличе `onanswer` раз, але крок міняється. */
	let finished = $state(false);

	onMount(() => {
		void loadQuizText('uk').then((loaded) => (dict = loaded));

		/*
		 * ПЕРЕВІРКА — НЕ ПАРТІЯ ЦИХ ІГОР, і сказати це треба явно.
		 *
		 * Наслідок соло-темпу: тепер натиск «Далі» справді закінчує міні-партію
		 * (`nextRound()` при одному раунді ставить `gameOver`), а разом із нею
		 * контролер пише `playerData.finishGame` — тобто «зіграно» в статистику
		 * гри. За пʼять раундів це пʼять фальшивих партій пʼяти різних ігор, і
		 * заміряно це в браузері, а не передбачено: доти `nextRound()` тут не
		 * кликав ніхто, тож запису й не було.
		 *
		 * `beginOnline` — той самий прапорець, яким від статистики відгороджена
		 * спільна вікторина, і з тієї самої причини («онлайн-раунд — не партія цієї
		 * гри»). Тут вона підходить дослівно: пʼять раундів чужих ігор — це
		 * перевірка в заповіднику, а не пʼять партій.
		 *
		 * ЦІНА НАЗВАНА: разом із рекордом перестає рухатися й наскрізний рахунок
		 * сайту, а доти перевірка його додавала. Це радше лікування, ніж утрата:
		 * інакше «зробити самому» було б способом набивати рахунок, а нагорода за
		 * перевірку — це виконана дія в заповіднику.
		 */
		playerData.beginOnline();
		return () => playerData.endOnline();
	});

	/** Частка правильного → стан раунду. Ті самі три стани, що в соло-іграх. */
	const statusOf = (share: number): RoundStatus =>
		share >= 1 ? 'correct' : share > 0 ? 'partial' : 'incorrect';

	/**
	 * ВІДПОВІДЬ ПОРАХОВАНА, але крок ще НЕ мінявся.
	 *
	 * Розділення тут головне: очки треба взяти в мить відповіді (дошка живе один
	 * раунд і своє `sessionScore` після `nextRound()` уже не віддасть), а крок
	 * мусить триматися, поки людина не подивилася розбір.
	 */
	function answered(correct: number, scored?: { points: number; max: number }) {
		points += scored?.points ?? 0;
		max += scored?.max ?? 0;
		results = [...results, statusOf(correct)];
	}

	/** «Далі» натиснуто: наступний крок або підсумок. */
	function advance() {
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
		<!--
			Індикатор — той самий компонент, що в соло-іграх, і саме тому він тут
			головний, а число «1 / 5» лишилося поруч дрібним: індикатор показує ЩО
			вже сталося, а число відповідає на «скільки лишилося» одним поглядом.
		-->
		<div class="trial__rounds">
			<RoundIndicator current={index + 1} total={programme.length} {results} />
		</div>
		<span class="trial__step" data-testid="reserve-trial-progress-text">
			{index + 1} / {programme.length}
		</span>
		<button
			type="button"
			class="trial__quit"
			aria-label={text('quiz.leave') === 'quiz.leave' ? '✕' : text('quiz.leave')}
			onclick={oncancel}
			data-testid="reserve-trial-quit-btn"
		>
			✕
		</button>
	</header>

	<!--
		ДОШКА СТОЇТЬ НА СВОЇЙ ПІДКЛАДЦІ, а не просто у вікні вибору.

		Скарга автора зі знімками: «ui ux ігор дивно виглядає в режимі reserve». І
		так було: у соло дошка лежить на власній темній картці поверх фотографії, а
		тут — просто на панелі вікна, тобто на тому самому кольорі, що й усе
		навколо. «Хто численніший?» через це втрачала межу зовсім: пунктирні комірки
		висіли в порожнечі, а кнопка «Перевірити» читалася як вимкнена.

		Підкладка бере `--color-bg-surface` — той самий токен, на якому дошки стоять
		у соло. Не «трохи темніший той самий колір»: два шари одного кольору дали б
		шов на межі й нічого більше, і перша редакція саме це й дала в світлих темах.
	-->
	<div class="trial__stage">
		<!--
			`{#key}` обовʼязковий: дошка читає свій крок ОДИН раз (`untrack`), тож без
			перемонтування другий раунд показав би питання першого.
		-->
		{#key index}
			<QuizBoard {text} step={programme[index]} onanswer={answered} onnext={advance} />
		{/key}
	</div>

	<!--
		Скільки набрано й скільки треба. Без цього рядка поріг був би обіцянкою:
		людина бачила б розбір кожного раунду й однаково не знала, проходить вона
		чи ні. Знаменник росте разом із раундами, бо ціна раунду в різних іграх
		різна — і саме тому тут очки, а не «правильних із пʼяти».
	-->
	<p class="trial__score" data-testid="reserve-trial-score-text">
		{@html formatFont(careText('reserve.care.trialScore'))}: {points} / {max} ·
		{@html formatFont(careText('reserve.care.trialNeed'))}
		{Math.round(SUCCESS_SHARE * 100)}%
	</p>
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
		gap: var(--space-sm);
	}

	/* Індикатор забирає все вільне місце — число й хрестик стоять по краях. */
	.trial__rounds {
		flex: 1;
		min-width: 0;
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

	/*
	 * Підкладка дошки — САМЕ `--color-bg-surface`, і це не «якийсь темніший
	 * колір».
	 *
	 * Це той самий токен, на якому дошки стоять у соло: `MythCard` малює себе на
	 * `color-mix(--color-bg-surface, transparent 25%)` зі склом. Тобто рядок нижче
	 * не вигадує вигляд, а бере наявний — і саме тому він однаково правильний у
	 * всіх чотирьох темах, де `--color-bg-surface` і `--color-bg-panel` навмисно
	 * різні: у `dark` це #242424 проти #2a3d1d, у `winter` — світлий #e6f2ff проти
	 * синього #80b3ff.
	 *
	 * Перша редакція домішувала 12% чорного, і в світлих темах цього не було видно
	 * зовсім: вікно, підкладка й картки гри зливалися в один зелений (заміряно на
	 * знімку в `light-green`).
	 */
	.trial__stage {
		display: flex;
		justify-content: center;
		width: 100%;
		padding: var(--space-sm) var(--space-xs);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}

	.trial__score {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-xs);
		font-variant-numeric: tabular-nums;
		color: var(--color-text-on-panel);
	}
</style>
