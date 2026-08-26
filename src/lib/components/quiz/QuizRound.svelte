<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { QuizPhase } from '$lib/controllers/quizMatch.svelte';
	import type { QuizStep } from '$lib/config/quizOnline';
	import QuizBoard from './QuizBoard.svelte';
	import TimerBar from '$lib/components/ui/TimerBar.svelte';

	/**
	 * Один раунд спільної вікторини: таймер, дошка, табло між раундами.
	 *
	 * ## Чому окремим компонентом
	 *
	 * Сторінка кімнати вийшла за межу розміру (429 рядків при орієнтирі 400), і
	 * межу канон піднімати забороняє. Фаза раунду — природний розріз: усе, що
	 * всередині, залежить лише від фази, кроку й часу, і жодного мережевого стану
	 * не читає.
	 *
	 * ## Час приходить ЧИСЛАМИ, а не годинником
	 *
	 * `leftMs` і `limitMs` — це вже порахований стан із контролера, який виводить
	 * їх із СЕРВЕРНИХ позначок часу в журналі. Свій `setInterval` тут дав би
	 * другий годинник, і смуга в двох гравців розійшлася б саме тому, що кожен
	 * рахував би від власного `Date.now()`.
	 */
	interface Props {
		/**
		 * Перекладач вікторини: її рядки лежать у ЛІНИВОМУ чанку
		 * (`i18n/quiz`), бо головний словник вантажать усі відвідувачі.
		 */
		text: (key: string) => string;
		phase: QuizPhase;
		/** Крок програми для цього раунду. `null` — раунду ще немає. */
		step: QuizStep | null;
		/** Скільки лишилося в раунді, мс. */
		leftMs: number;
		/** Скільки триває раунд, мс. Нуль — раунду немає. */
		limitMs: number;
		/** Чи я вже відповів у цьому раунді. */
		answered: boolean;
		onanswer: (correct: number) => void;
	}

	let { text, phase, step, leftMs, limitMs, answered, onanswer }: Props = $props();

</script>

{#if phase === 'round' && step}
	<!--
		Смуга таймера. Ширина рахується від СЕРВЕРНОГО старту раунду, тож у двох
		гравців вона в одному місці, а не в кожного своя.
	-->
	<TimerBar {leftMs} {limitMs} label={text('quiz.roundTimer')} testId="quiz-round-progress" />

	<!--
		ДОШКА ЛИШАЄТЬСЯ ПІСЛЯ ВІДПОВІДІ, і це виправлення, а не смак.

		Тут стояло `{#if answered}` навколо дошки, тобто відповівши, гравець бачив
		замість неї один рядок: питання, власна відповідь і розбір зникали разом.
		Автор сказав це прямо: «нічого не зникає, а на місці „далі“ ставимо
		„чекаємо на решту“».

		Змінити відповідь це не дає: `QuizMatch.answer()` відкидає повторну
		(`iAnswered`), і правило журналу — теж (один хід на раунд). Тобто заборона
		тримається журналом, а не тим, що дошку прибрали з екрана.

		`{#key}` на зерні раунду: контролер гри тримає стан, і наступний раунд для
		нього — нова партія на один раунд, а не продовження.
	-->
	{#key step.seed}
		<QuizBoard {text} {step} {onanswer} />
	{/key}

	{#if answered}
		<!-- На місце кнопки «Далі», яку в кімнаті ховає сама дошка (`hideNext`). -->
		<p class="round__wait text-panel" data-testid="quiz-answered-text">
			{@html formatFont(text('quiz.answered'))}
		</p>
	{/if}
{/if}

<!--
	ФАЗУ ТАБЛА ТУТ БІЛЬШЕ НЕМА: її малює `QuizReveal` — панель посередині з
	набором балів. Тут стояв рядок «Наступний раунд», і він був усім, що людина
	бачила між раундами.
-->

<style>
	/* Вигляд смуги переїхав у `ui/TimerBar.svelte`: та сама смуга тепер і в парах. */
	.round__wait {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
	}
</style>
