<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { Member } from '$lib/net/roomTypes';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';

	/**
	 * ВІКНО ОЧІКУВАННЯ: кого саме немає й скільки вже немає.
	 *
	 * ## Що було замість нього
	 *
	 * Нічого. Присутність у вікторині читалася лише в лобі, а під час партії
	 * зникнення гравця не показувалося ніяк — і водночас замерзало ритм: партія
	 * чекала відповіді від того, кого вже немає, тож кожен раунд крутив таймер до
	 * кінця. Автор попросив зробити «по прикладу з MindStep», і звідти взято
	 * склад: перелік тих, кого немає, відлік і рядок про те, що буде далі.
	 *
	 * ## Чому партія НЕ СТОЇТЬ, поки це вікно висить
	 *
	 * Бо стояти немає за чим: раунд тепер закінчується, коли відповіли ПРИСУТНІ
	 * (`QuizMatch.awaited`). Вікно тут — повідомлення, а не пауза; це головна
	 * різниця з MindStep, де партія на двох без другого просто неможлива.
	 *
	 * ## Чому відлік, якщо він нічого не обриває
	 *
	 * Він відповідає на єдине питання, яке в цю мить є: чекати чи грати далі. За
	 * межею відліку вікно каже прямо, що на цього гравця більше не чекають, — і
	 * саме тоді має сенс кнопка «виключити» в лідера. Її тут немає навмисно:
	 * правило бази дозволяє писати в `members/{uid}` лише самому цьому
	 * учасникові, тож кнопка вимагає правки правил і приїде разом із нею.
	 */
	interface Props {
		/** Кого немає онлайн. Порожньо — вікна немає зовсім. */
		away: Member[];
		/** Скільки секунд лишилося з пільгового часу. `0` — вичерпано. */
		secondsLeft: number;
	}

	let { away, secondsLeft }: Props = $props();
</script>

{#if away.length > 0}
	<section class="away text-panel" role="status" data-testid="quiz-away-panel">
		<h2 class="away__title">{@html formatFont(t('quiz.awayTitle'))}</h2>

		<ul class="away__list" data-testid="quiz-away-list">
			{#each away as member (member.uid)}
				<li class="away__row" data-testid="quiz-away-{member.uid}-item">
					<Avatar avatar={member.avatar} />
					<Flag code={member.country} />
					<span class="away__name">{member.name}</span>
				</li>
			{/each}
		</ul>

		{#if secondsLeft > 0}
			<!--
				Число окремим елементом: воно змінюється щосекунди, і читалка мусить
				оголосити зміну, а не перечитувати весь абзац.
			-->
			<p class="away__note">
				{@html formatFont(t('quiz.awayWait'))}
				<b class="away__count" data-testid="quiz-away-timer-value">{secondsLeft}</b>
			</p>
		{:else}
			<p class="away__note" data-testid="quiz-away-gone-text">
				{@html formatFont(t('quiz.awayGone'))}
			</p>
		{/if}
	</section>
{/if}

<style>
	/*
	 * Вікно стоїть НАД дошкою в потоці, а не поверх неї: партія йде далі, і
	 * накривати питання повідомленням про чужу вкладку означало б заважати тому,
	 * хто ще відповідає.
	 */
	.away {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		width: 100%;
		padding: var(--space-sm) var(--space-md);
		box-sizing: border-box;
		text-align: center;
	}

	.away__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
	}

	.away__list {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.away__row {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--font-size-sm);
		/* Пригашено: це той, кого немає, і рядок не мусить читатися як активний. */
		opacity: 0.7;
	}

	.away__name {
		max-width: 12ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.away__note {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.away__count {
		font-variant-numeric: tabular-nums;
		color: var(--color-accent);
	}
</style>
