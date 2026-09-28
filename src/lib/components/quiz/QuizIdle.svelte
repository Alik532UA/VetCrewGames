<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import type { IdleView } from '$lib/utils/idleWait';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import QuizAway from './QuizAway.svelte';

	/**
	 * «ЗАДОВГО ДУМАЄ НАД ВІДПОВІДДЮ» — вікно, яке можна відкласти (прохання автора 2026-09-28).
	 *
	 * ## Що було не так
	 *
	 * Вікно «Ще не вибрали відповідь» вилазило поверх дошки й лишалося, доки хтось не
	 * натисне «Грати далі»: той, хто відповів, більше не бачив своєї відповіді й розбору під
	 * нею — «заблокована можливість в цей момент далі продовжувати дивитися відповідь». І
	 * слова не казали, про що питають.
	 *
	 * ## Як тепер (відповідь автора A)
	 *
	 * Вікно питає прямо: хто задовго думає, і чи продовжити гру без цієї відповіді. Кнопки
	 * дві. «Продовжити» — голос не чекати, як і доти. «Чекати ще хвилину» — рішення лише для
	 * себе: вікно згортається у смугу знизу, відповідь знову видно, а за хвилину вікно
	 * питає знову. Поки смуга стоїть, у ній є й «Продовжити»: дочитав — і не треба чекати,
	 * поки вікно повернеться.
	 *
	 * Хто вже проголосував, того вікно більше не питає: свою відповідь він дав, і тримати
	 * його під вікном — те саме блокування. Лишається смуга з лічильником голосів.
	 *
	 * Відкладення — стан ЦЬОГО екрана, а не партії: у журнал воно не пише нічого, і в
	 * кожного воно своє. Тому живе тут, а не в `QuizMatch`.
	 */
	interface Props {
		/** Перекладач вікторини (лінивий словник `i18n/quiz`). */
		text: (key: string) => string;
		/** Хто думає й хто вже голосував (`utils/idleWait`, `idleView`). */
		view: IdleView;
		/** Поточний раунд: відкладення стосується лише його. */
		round: number;
		/** Годинник сесії, мс: від нього й хвилина відкладення. */
		clock: number;
		/** Партія стоїть (пауза чи «Чекаємо»): тоді це питання не ставиться зовсім. */
		hidden: boolean;
		/** Мій голос не чекати тих, хто думає. */
		onNoWait: () => void;
	}

	let { text, view, round, clock, hidden, onNoWait }: Props = $props();

	/** «Ще хвилину» — дослівно слова автора. */
	const SNOOZE_MS = 60_000;

	/** До якої миті вікно відкладене — і в якому раунді. */
	let snooze = $state<{ round: number; until: number } | null>(null);

	const snoozedMs = $derived(
		snooze !== null && snooze.round === round ? Math.max(0, snooze.until - clock) : 0
	);

	/** Що на екрані: нічого, вікно чи смуга. */
	const mode = $derived(
		!view.show || hidden ? 'none' : view.iVoted || snoozedMs > 0 ? 'strip' : 'window'
	);

	/** «0:42» — хвилини й секунди до того, як вікно спитає знову. */
	const againIn = $derived.by(() => {
		const seconds = Math.ceil(snoozedMs / 1000);
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	});
</script>

{#if mode === 'window'}
	<QuizAway
		{text}
		idle
		away={view.idle}
		secondsLeft={0}
		waiting
		voted={view.voted}
		needed={view.needed}
		iVoted={view.iVoted}
		onGoOn={onNoWait}
		onSnooze={() => (snooze = { round, until: clock + SNOOZE_MS })}
	/>
{:else if mode === 'strip'}
	<!--
		СМУГА ЗНИЗУ — вузька, поверх дошки, але не на ній: дошка під нею не зсувається, бо
		смуга стоїть окремим шаром, а не рядком у розкладці (та сама причина, що в «Забрати хід»
		у «Знайди пару»).

		Хто думає — аватарками: імʼя й прапор були у вікні хвилину тому, а пара значок+колір у
		кімнаті одна на людину. Для читалки імена лишаються текстом.
	-->
	<div class="idle-strip text-panel fill" data-testid="quiz-idle-strip-panel">
		<span class="idle-strip__who">
			{#each view.idle as member (member.uid)}
				<span class="idle-strip__face" data-testid="quiz-idle-strip-{member.uid}-item">
					<Avatar avatar={member.avatar} size={28} showDefault />
					<span class="visually-hidden">{member.name}</span>
				</span>
			{/each}
		</span>

		{#if view.iVoted}
			<span class="idle-strip__voted" data-testid="quiz-idle-strip-voted-text">
				{@html formatFont(text('quiz.awayVoted'))}
				<b class="idle-strip__count">{view.voted}/{view.needed}</b>
			</span>
		{:else}
			<button
				type="button"
				class="idle-strip__goon"
				onclick={onNoWait}
				data-testid="quiz-idle-strip-goon-btn"
			>
				{@html formatFont(text('quiz.idleGoOn'))}
				<b class="idle-strip__count">{view.voted}/{view.needed}</b>
			</button>
			<!--
				Відлік — без живого регіону: він міняється щосекунди, і читалка оголошувала б його
				щосекунди. Коли вікно повернеться, воно оголосить себе саме (`role="status"`).
			-->
			<span class="idle-strip__again" data-testid="quiz-idle-strip-timer-text">
				{@html formatFont(text('quiz.idleAgain'))}
				<b class="idle-strip__count">{againIn}</b>
			</span>
		{/if}
	</div>
{/if}

<style>
	/*
	 * Над дошкою, під шапкою (`GameHeader`, 100) — як і підкладка вікна (`ui/GameDialog`, 90):
	 * «назад» і меню лишаються досяжними. Знизу — над безпечною зоною телефона.
	 */
	.idle-strip {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-md));
		left: 50%;
		z-index: 90;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		width: max-content;
		max-width: calc(100% - 2 * var(--space-md));
		padding: var(--space-xs) var(--space-md);
		box-sizing: border-box;
		transform: translateX(-50%);
		font-size: var(--font-size-sm);
	}

	.idle-strip__who {
		display: inline-flex;
		gap: var(--space-xs);
		--avatar-box: calc(var(--fill-u) * 1.75);
	}

	.idle-strip__face {
		display: inline-flex;
	}

	/* Та сама акцентна дія, що у вікні, лише менша. 44px — дно сенсорної цілі. */
	.idle-strip__goon {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		cursor: pointer;
	}

	.idle-strip__voted,
	.idle-strip__again {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.idle-strip__count {
		font-variant-numeric: tabular-nums;
	}
</style>
