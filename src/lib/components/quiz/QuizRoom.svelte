<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { langPath } from '$lib/i18n/routing';
	import type { Language } from '$lib/i18n/routing';
	import type { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import { Pause } from 'lucide-svelte';
	import type { WaitView } from '$lib/utils/awayWait';
	import QuizScores from './QuizScores.svelte';
	import QuizAway from './QuizAway.svelte';
	import QuizRound from './QuizRound.svelte';
	import QuizReveal from './QuizReveal.svelte';

	/**
	 * ЕКРАН КІМНАТИ: партія й підсумок. Мережі тут немає зовсім.
	 *
	 * ## Чому окремим компонентом
	 *
	 * Сторінка вийшла за межу розміру (417 при орієнтирі 400), і канон піднімати
	 * межу забороняє. Розріз проведений там, де він і так був: сторінка тримає
	 * ВХІД у кімнату — код, присутність, перелік, дії лідера, — а це компонент
	 * показу, який читає лише матч і час.
	 *
	 * ## ПІДСУМОК ОДНАКОВИЙ В УСІХ, і це виправлення, а не оформлення
	 *
	 * Доти лідер бачив соло-картку «ВАШ РАХУНОК: 98» (де «максимум» дорівнював
	 * власному результату — число без сенсу), а гість — один рядок «Чекаємо, доки
	 * лідер почне». Тобто в мить, коли партія закінчилася, гостю показували
	 * речення про те, що вона ще не починалася: він просто не дізнавався, що гра
	 * скінчилася. Автор сказав це прямо: «один з гравців взагалі не знає що гра
	 * закінчилась, просто ЖАХ».
	 *
	 * Тепер обидва бачать ТЕ САМЕ: заголовок «Гру завершено» і таблицю рахунків із
	 * місцями. Різниця лишилася рівно там, де вона є насправді, — у діях: «Зіграти
	 * ще» і «Закрити кімнату» роздає лідер, і кнопки, яка нічого не робить, у
	 * гостя немає. Замість неї рядок про те, чого він чекає.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку (`i18n/quiz`), бо
		 * головний словник вантажать усі відвідувачі. Далі він іде в дошку, табло й
		 * вікно очікування.
		 */
		text: (key: string) => string;
		match: QuizMatch;
		me: string;
		lang: Language;
		amHost: boolean;
		/** Час однією величиною — фази й смуга рахуються від нього. */
		clock: number;
		/**
		 * УСЕ ПРО ЧЕКАННЯ ОДНИМ ЗНАЧЕННЯМ: чи стоїть партія, скільки ще чекаємо,
		 * хто поставив паузу, скільки голосів треба й що можу я сам.
		 *
		 * Доти це були пʼять окремих пропів, і сторінка розбирала `wait` на частини,
		 * щоб кімната склала їх назад. Розбирати нічого: це один стан («партія
		 * стоїть, і ось чому»), а правила, що його складають, живуть у
		 * `utils/awayWait` і перевіряються без браузера.
		 */
		wait: WaitView;
		/** Хто вже проголосував «граємо далі» в цьому раунді. */
		goOn: string[];
		/** Мій голос «граємо далі». */
		onGoOn: () => void;
		/** Поставити паузу. */
		onPause: () => void;
		/** Зняти свою паузу. Кнопки не буде, поки пауза не моя (`wait.canResume`). */
		onResume: () => void;
		onanswer: (correct: number) => void;
		onRematch: () => void;
		onClose: () => void;
		/** Прибрати зниклого. Лише лідер — тобто в гостя цього немає зовсім. */
		onkick: (uid: string) => void;
	}

	let {
		text,
		match,
		me,
		lang,
		amHost,
		clock,
		wait,
		goOn,
		onGoOn,
		onPause,
		onResume,
		onanswer,
		onRematch,
		onClose,
		onkick
	}: Props = $props();
</script>

{#if match.over}
	<section class="over text-panel" data-testid="quiz-over-panel">
		<h2 class="over__title">{@html formatFont(t('common.gameOver'))}</h2>

		<!--
			Відсутні позначені й у підсумку, а не лише під час партії: рядок «хто зник»
			і є відповідь на питання, чому в когось менше очок.
		-->
		<QuizScores
			players={match.players}
			answered={match.answered}
			scores={match.scores}
			withScores
			layout="table"
			away={match.away.map((player) => player.uid)}
			{me}
		/>

		{#if amHost}
			<div class="over__actions">
				<button
					type="button"
					class="btn-primary"
					onclick={onRematch}
					data-testid="quiz-play-again-btn"
				>
					{@html formatFont(t('common.playAgain'))}
				</button>
				<button type="button" class="chip" onclick={onClose} data-testid="quiz-close-btn">
					{@html formatFont(t('pairs.closeRoom'))}
				</button>
			</div>
		{:else}
			<p class="over__wait" data-testid="quiz-waiting-host-text">
				{@html formatFont(t('pairs.waitingHost'))}
			</p>
		{/if}

		<!--
			Вихід у меню — посиланням, а не кнопкою: це навігація, і «відкрити в новій
			вкладці» мусить працювати.
		-->
		<a href={langPath(lang)} class="chip" data-testid="quiz-main-menu-link">
			{@html formatFont(t('common.mainMenu'))}
		</a>
	</section>
{:else}
	<!--
		Вікно очікування ІСНУЄ, лише поки партія чекає. Ухвалене рішення прибирає
		його: питати вже нема чого, а хто саме офлайн — видно сірим рядком у
		переліку гравців.
	-->
	<QuizAway
		{text}
		away={match.away}
		secondsLeft={wait.left}
		waiting={wait.hold}
		voted={goOn.length}
		needed={wait.needed}
		iVoted={goOn.includes(me)}
		{onGoOn}
		pausedBy={wait.pausedBy}
		onResume={wait.canResume ? onResume : undefined}
		onkick={amHost ? onkick : undefined}
	/>

	{@const phase = match.phase(clock)}
	{#if phase === 'reveal'}
		<!--
			ТАБЛО МІЖ РАУНДАМИ — і смуга гравців зверху на цей час ЗНИКАЄ.

			Дві таблиці одночасно (смуга вгорі й панель посередині) показували б ті
			самі числа двічі, а очі тим часом шукали б, котра з них головна. Автор
			попросив рівно це: «панель по центру екрана на час табла, рядок зверху на
			цей час ховається».
		-->
		<QuizReveal
			{text}
			players={match.players}
			scores={match.scores}
			gains={match.roundGains}
			away={match.away.map((player) => player.uid)}
			{me}
		/>
	{:else}
		<!--
			ФАЗА ВИРІШУЄ, ЩО НА ЕКРАНІ, і рахунок під час раунду не показується.

			Це вимога автора й вона слушна: цифри поруч із питанням тягнуть увагу саме
			тоді, коли вона потрібна на питанні. Під час раунду видно лише склад
			гравців із позначкою «вже відповів».
		-->
		<!--
			КНОПКА ПАУЗИ — ТУТ, поруч зі смугою гравців, а не в дошці.
			
			Смуга — це все про кімнату: хто грає, хто відповів, кого немає. Пауза
			належить туди ж: вона про партію, а не про питання. У дошці вона стояла б
			поруч із відповідями й читалася б як одна з них.

			Поки пауза стоїть, кнопки немає: зняти її можна у вікні, яке її й показує.
		-->
		<div class="room__strip">
			<QuizScores
				players={match.players}
				answered={match.answered}
				scores={match.scores}
				withScores={false}
				away={match.away.map((player) => player.uid)}
				{me}
			/>

			{#if wait.pausedBy === null}
				<button
					type="button"
					class="room__pause text-panel"
					disabled={!wait.canPause}
					onclick={onPause}
					data-testid="quiz-pause-btn"
				>
					<Pause size={16} aria-hidden="true" />
					{@html formatFont(text('quiz.pause'))}
				</button>
			{/if}
		</div>

		<QuizRound
			{text}
			{phase}
			step={match.step}
			leftMs={match.leftMs(clock)}
			limitLeftMs={match.limitLeftMs(clock)}
			limitMs={match.limitMs}
			answered={match.iAnswered}
			{onanswer}
		/>
	{/if}
{/if}

<style>
	/* Смуга гравців і кнопка паузи — один рядок: обидві про кімнату. */
	.room__strip {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		width: 100%;
	}

	/*
	 * Кнопка ТИХА: пауза потрібна рідко, а гучна кнопка поруч із питанням тягла б
	 * увагу на себе саме тоді, коли вона потрібна на відповіді.
	 */
	/*
	 * Підкладка — глобальний `.text-panel`, а не прозоре тло: кнопка стоїть НЕ в
	 * панелі, а просто над фотографією теми, і текст на ній інакше читається
	 * залежно від того, що саме опинилося під ним. Це стежить `backdrop.test.ts`, і
	 * саме він і показав промах у першій редакції.
	 */
	.room__pause {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		color: var(--color-text-on-panel);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	/*
	 * Витримка після своєї паузи видна саме так: кнопка на місці, але не приймає
	 * натиску. Прибрати її означало б, що людина шукає зникле, а не бачить «ще ні».
	 */
	.room__pause:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/*
	 * ПІДСУМОК ВУЗЬКИЙ, хоч стовпець під партію й широкий: це таблиця з кількох
	 * рядків, і на 1100px вона перетворюється на рядок, який око не проходить за
	 * раз. Те саме число, що в соло-підсумках ігор.
	 */
	.over {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		max-width: var(--measure-feeding);
		padding: var(--space-md);
		box-sizing: border-box;
	}

	.over__title {
		margin: 0;
		font-size: var(--font-size-xl);
		text-align: center;
	}

	/*
	 * Дії — рядком, що переноситься: на телефоні дві кнопки поруч не вміщаються, а
	 * обрізана кнопка гірша за дві в стовпчик.
	 */
	.over__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
	}

	.over__wait {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		text-decoration: none;
		cursor: pointer;
	}
</style>
