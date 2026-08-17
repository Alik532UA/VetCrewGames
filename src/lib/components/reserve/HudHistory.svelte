<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import type { JournalDay, MetricSet } from '$lib/reserve/types';

	/**
	 * Історія одного показника: скільком дням і на скільки він змінився.
	 *
	 * «Бюджет 34 200» не каже, чи справи йдуть добре. Каже різниця: −1 800 за день
	 * означає, що фонд проїдає запас, а +900 — що пожертв уже досить на утримання.
	 * Тому в підказці саме РІЗНИЦІ по днях, а не значення: значення вже стоїть над
	 * нею.
	 *
	 * Незакрита доба показується окремим рядком «сьогодні»: вона ще не в журналі,
	 * бо журнал міряє добу цілком, — але саме сьогоднішня зміна цікавить найбільше.
	 */
	interface Props {
		/** Яке з полів набору показувати. */
		metric: keyof MetricSet;
		journal: JournalDay[];
		/** Зміна за поточну, ще не закриту добу. */
		today: number;
		day: number;
	}

	let { metric, journal, today, day }: Props = $props();

	/**
	 * Дні з нулем не показуються.
	 *
	 * Список, у якому дванадцять рядків «0», нічого не повідомляє — його доводиться
	 * читати очима, щоб дізнатися, що нічого не сталося. Порожній список каже те
	 * саме одним словом.
	 */
	const rows = $derived(
		[...journal]
			.reverse()
			.map((entry) => ({ day: entry.day, delta: entry[metric] }))
			.filter((row) => row.delta !== 0)
	);

	/** Знак ставимо самі: `toLocaleString` плюса не малює. */
	const signed = (value: number) =>
		`${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString(settings.locale)}`;

	let panel = $state<HTMLElement>();

	/**
	 * Підказка над крайнім правим показником не має вилізати за екран.
	 *
	 * Виміряно, а не вгадано по медіазапиту: показники лежать у сітці з
	 * автозаповненням, і скільки їх у рядку — вирішує браузер. Здогадка «останній у
	 * рядку» була б неправильною рівно на тих ширинах, де сітка перебудувалася.
	 */
	$effect(() => {
		if (!panel) return;
		panel.style.transform = '';
		const overflow = panel.getBoundingClientRect().right - (window.innerWidth - 8);
		if (overflow > 0) panel.style.transform = `translateX(${-Math.round(overflow)}px)`;
	});
</script>

<div bind:this={panel} class="hist" role="tooltip" data-testid="reserve-history-tooltip">
	<b class="hist__title">{@html formatFont(t('reserve.history'))}</b>

	<dl class="hist__rows">
		<div class="hist__row hist__row--today">
			<dt>{@html formatFont(t('reserve.today'))}</dt>
			<dd class:hist__down={today < 0}>{today === 0 ? '—' : signed(today)}</dd>
		</div>

		{#each rows as row (row.day)}
			<div class="hist__row">
				<dt>{@html formatFont(t('reserve.day'))} {row.day}</dt>
				<dd class:hist__down={row.delta < 0}>{signed(row.delta)}</dd>
			</div>
		{/each}
	</dl>

	{#if rows.length === 0 && today === 0}
		<p class="hist__empty">
			{@html formatFont(day > 0 ? t('reserve.historyQuiet') : t('reserve.historyNew'))}
		</p>
	{/if}
</div>

<style>
	.hist {
		/*
		 * Підказка висить ПІД показником: шапка стоїть під самим верхом екрана, і
		 * вивести панель угору означало б вивести її за межу вікна.
		 */
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 9rem;
		max-width: 14rem;
		max-height: 14rem;
		padding: var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		box-shadow: 0 6px 20px rgb(0 0 0 / 40%);
		overflow-y: auto;
	}

	.hist__title {
		font-size: var(--font-size-sm);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.7;
	}

	.hist__rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
	}

	.hist__row {
		display: flex;
		gap: var(--space-sm);
		justify-content: space-between;
		font-size: var(--font-size-sm);
		white-space: nowrap;
	}

	/* Сьогоднішній день видно окремо: він єдиний ще може змінитися. */
	.hist__row--today {
		padding-bottom: 2px;
		border-bottom: 1px solid var(--color-border);
		font-weight: var(--font-weight-bold);
	}

	.hist__row dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.hist__down {
		color: var(--color-error);
	}

	.hist__empty {
		margin: 0;
		font-size: var(--font-size-sm);
		opacity: 0.7;
	}
</style>
