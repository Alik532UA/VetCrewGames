<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * ДОШКА «ЗНАЙДИ ПАРУ» — ВСЯ НА ЕКРАНІ, у соло й онлайн (прохання автора 2026-09-26).
	 *
	 * ## Що було не так
	 *
	 * Онлайн-дошка рахувала лише ШИРИНУ (`колонки × 8rem`, не ширше за 96vw), тож на
	 * iPhone із панелями Safari (≈390×664) розкладка 4×5 давала картки 90×120 і поле
	 * заввишки ≈810px — пʼятий ряд за краєм, і гратися можна лише гортаючи. Гра ж
	 * про те, щоб ПАМʼЯТАТИ, де що лежить, а половина поля за краєм цю памʼять
	 * обнуляє. Соло висоту враховувало, але сталою «190px на шапку, підказку й табло»,
	 * яку ніхто не міряв. Дві різні формули для однієї сітки.
	 *
	 * ## Що тепер
	 *
	 * Коробка дошки забирає рівно ЗАЛИШОК висоти сторінки (`flex: 1`) і стає
	 * контейнером розміру, тож дошка рахується від НЕЇ, а не від вікна: ширина — менша
	 * з двох, уся ширина коробки або та, за якої всі ряди карток 3:4 влазять у її
	 * висоту. Вимірювати нічого не треба, і сторінку дошка не розпирає: власного
	 * розміру в коробки немає (`container-type: size`).
	 *
	 * ДНО — 56px на картку: менша тварину вже не показує (від 50px проєкт відмовився,
	 * коміт 4f6fc89). Коли навіть так не влазить, вмикається чесна прокрутка — гірше
	 * гортати, ніж не впізнавати.
	 *
	 * Колонки приходять зі СТАНУ ПАРТІЇ, а не з медіазапиту: сітка, яку перебудовує
	 * ширина вікна, стирає запамʼятане. Змінюється лише РОЗМІР карток, а не їхній
	 * порядок.
	 */
	interface Props {
		cols: number;
		/** Скільки карток на дошці — з нього ряди. */
		count: number;
		testId: string;
		/** Над дошкою, рівно в її ширину: смуга часу ходу онлайн. */
		above?: Snippet;
		children: Snippet;
	}

	let { cols, count, testId, above, children }: Props = $props();

	const rows = $derived(Math.max(1, Math.ceil(count / cols)));
</script>

<div class="deck-box" style:--cols={cols} style:--rows={rows}>
	<div class="deck-stack" class:deck-stack--above={above !== undefined}>
		{#if above}{@render above()}{/if}
		<div class="deck" data-testid={testId}>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.deck-box {
		flex: 1 1 0;
		min-height: 0;
		width: 100%;
		container-type: size;
		display: flex;
		justify-content: center;
	}

	.deck-stack {
		--gap: clamp(4px, 1vw, var(--space-sm));
		/* Що стоїть над дошкою в тій самій коробці (смуга часу й проміжок до неї). */
		--above: 0px;
		--card-floor: 56px;
		/*
		 * Ширина, за якої ВСІ ряди 3:4 влазять у висоту коробки:
		 *     картка = (висота − проміжки між рядами) × 3 / (4 × ряди)
		 *     дошка  = картка × колонки + проміжки між колонками
		 */
		--fit: calc(
			(100cqh - var(--above) - (var(--rows) - 1) * var(--gap)) * 3 / (4 * var(--rows)) *
				var(--cols) + (var(--cols) - 1) * var(--gap)
		);
		--floor: calc(var(--cols) * var(--card-floor) + (var(--cols) - 1) * var(--gap));
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		/* Не ширше за коробку ніколи — горизонтальної прокрутки не буває. */
		width: min(100cqw, max(var(--floor), var(--fit)));
	}

	.deck-stack--above {
		/* Смуга часу `ui/TimerBar` — 6px заввишки, плюс проміжок стека. */
		--above: calc(6px + var(--space-sm));
	}

	.deck {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: var(--gap);
		width: 100%;
	}
</style>
