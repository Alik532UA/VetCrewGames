<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { QuizPhase } from '$lib/controllers/quizMatch.svelte';
	import type { QuizStep } from '$lib/config/quizOnline';
	import QuizBoard from './QuizBoard.svelte';

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

	let { phase, step, leftMs, limitMs, answered, onanswer }: Props = $props();

	const leftPercent = $derived(limitMs === 0 ? 0 : Math.round((leftMs / limitMs) * 100));
</script>

{#if phase === 'round' && step}
	<!--
		Смуга таймера. Ширина рахується від СЕРВЕРНОГО старту раунду, тож у двох
		гравців вона в одному місці, а не в кожного своя.
	-->
	<div
		class="timer"
		role="timer"
		aria-label={t('quiz.roundTimer')}
		data-testid="quiz-round-progress"
	>
		<span class="timer__fill" style="width: {leftPercent}%"></span>
	</div>

	{#if answered}
		<!--
			Я вже відповів — дошка ховається. Лишати її означало б дати змінити
			відповідь після того, як вона пішла в журнал.
		-->
		<p class="round__wait text-panel" data-testid="quiz-answered-text">
			{@html formatFont(t('quiz.answered'))}
		</p>
	{:else}
		<!--
			`{#key}` на зерні раунду: контролер гри тримає стан, і наступний раунд для
			нього — нова партія на один раунд, а не продовження.
		-->
		{#key step.seed}
			<QuizBoard {step} {onanswer} />
		{/key}
	{/if}
{:else if phase === 'reveal'}
	<p class="round__wait text-panel" data-testid="quiz-reveal-text">
		{@html formatFont(t('quiz.nextRound'))}
	</p>
{/if}

<style>
	/*
	 * Смуга таймера: тонка, на всю ширину, без цифр.
	 *
	 * Без числа навмисно — цифра, що біжить, тягне погляд сильніше за саму смугу,
	 * а знати треба не «скільки лишилося», а «встигаю чи ні».
	 */
	.timer {
		width: 100%;
		height: 6px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-text), transparent 88%);
		overflow: hidden;
		flex-shrink: 0;
	}

	.timer__fill {
		display: block;
		height: 100%;
		background: var(--color-accent);
		/* Лінійно й без згладжування: смуга мусить показувати час, а не наздоганяти його. */
		transition: width 0.1s linear;
	}

	.round__wait {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
	}
</style>
