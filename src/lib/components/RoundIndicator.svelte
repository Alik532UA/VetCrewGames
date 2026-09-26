<script lang="ts">
	// Тип переїхав у `$lib/types/game`: контролери мусили імпортувати його
	// звідси, тобто з компонента, і залежність текла в зворотний бік
	// (SVELTE-CORE-v8 § 3.5).
	import type { RoundStatus } from '$lib/types/game';
	import { t } from '$lib/i18n';

	let {
		current,
		total,
		results = [],
		onreview,
		viewing = null
	}: {
		current: number;
		total: number;
		results?: RoundStatus[];
		/**
		 * ПЕРЕГЛЯД МИНУЛОГО ПИТАННЯ (прохання автора 2026-09-26): відповідані сегменти
		 * стають кнопками, і натиск відкриває питання цього раунду (індекс від нуля).
		 * Немає — сегменти лише показують поступ, як доти (онлайн-табло, перевірка).
		 */
		onreview?: (round: number) => void;
		/** Який раунд зараз переглядають — його сегмент позначено як натиснутий. */
		viewing?: number | null;
	} = $props();

	/** Підпис для скрінрідера: «Питання 3: правильно» — колір сам по собі не каже нічого. */
	const labelOf = (round: number, status: RoundStatus) =>
		`${t('review.question')} ${round}: ${t(`review.${status}` as 'review.correct')}`;

	const rounds = $derived(Array.from({ length: total }, (_, i) => i + 1));
</script>

<div class="round-indicator-container">
	<!--
		Кількість колонок приходить із пропа, а не зашита числом: доти в CSS
		стояло `repeat(10, 1fr)`, і компонент мовчки ламався б на будь-якому
		`total`, крім десяти — обидві гри зараз мають рівно десять раундів, тож
		помітити це було б нічим.
	-->
	<div
		class="segments-wrapper"
		data-testid="round-indicator-container"
		class:segments-wrapper--review={onreview !== undefined}
		style:--rounds={total}
	>
		{#each rounds as r (r)}
			{@const result = results[r - 1]}
			{@const status = result ? result : r === current ? 'current' : 'future'}
			{#snippet bar()}
				<div
					class="segment"
					class:status-current={status === 'current'}
					class:status-correct={status === 'correct'}
					class:status-incorrect={status === 'incorrect'}
					class:status-partial={status === 'partial'}
					class:status-future={status === 'future'}
				>
					{#if status === 'current'}
						<div class="segment-glow"></div>
					{/if}
				</div>
			{/snippet}
			{#if onreview && result}
				<!--
					Кнопка вища за смужку: 6px — не ціль для пальця. Поле дотику 44px,
					а видно ту саму смужку посередині (ACCESSIBILITY-v8 § 8).
				-->
				<button
					type="button"
					class="segment-hit"
					aria-label={labelOf(r, result)}
					aria-pressed={viewing === r - 1}
					onclick={() => onreview(r - 1)}
					data-testid="round-review-{r}-btn"
				>
					{@render bar()}
				</button>
			{:else}
				{@render bar()}
			{/if}
		{/each}
	</div>
</div>

<style>
	.round-indicator-container {
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		user-select: none;
		margin-bottom: var(--space-xs);
	}

	.segments-wrapper {
		display: grid;
		/*
		 * `minmax(0, 1fr)`, а не `1fr`: `1fr` — це `minmax(auto, 1fr)`, тобто
		 * колонка не стає вужчою за min-content вмісту. З десятьма сегментами й
		 * проміжками це дає підлогу ширини, за якою смужка розпирає сторінку на
		 * вузькому екрані (FLUID-SIZING-v8 § 1).
		 */
		grid-template-columns: repeat(var(--rounds, 10), minmax(0, 1fr));
		width: 100%;
		max-width: 300px;
		gap: 4px;
	}

	/*
	 * Сегменти-кнопки ширші за смужку: десять полів по 44px, а не десять смужок на
	 * 300px, — інакше ціль на телефоні вужча за палець.
	 */
	.segments-wrapper--review {
		max-width: calc(var(--rounds, 10) * 44px + (var(--rounds, 10) - 1) * 4px);
		align-items: center;
		/*
		 * Висота кнопки — З ПЕРШОГО ПИТАННЯ, а не з першої відповіді. Доти до першої
		 * відповіді кнопок у ряду не було, і смужка мала 6px; щойно перший сегмент ставав
		 * кнопкою (44px), дошка під нею стрибала вниз на ~38px — саме тоді, коли людина
		 * тягнулася до «Далі».
		 */
		min-height: 44px;
	}

	.segment-hit {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.segment-hit > .segment {
		flex: 1;
	}

	.segment-hit[aria-pressed='true'] > .segment {
		outline: 2px solid var(--color-text);
		outline-offset: 2px;
	}

	.segment {
		height: 6px;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 3px;
		position: relative;
		overflow: hidden;
		transition: all 0.4s ease;
	}

	.status-current {
		background: #ffffff;
		box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
	}
	.status-correct {
		background: var(--color-success);
	}
	.status-incorrect {
		background: var(--color-error);
	}
	.status-partial {
		background: var(--color-warning);
	}
	.status-future {
		background: rgba(255, 255, 255, 0.1);
	}

	.segment-glow {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent);
		animation: scan 2s infinite;
	}

	@keyframes scan {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(100%);
		}
	}
</style>
