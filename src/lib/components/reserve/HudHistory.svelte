<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import type { JournalDay, JournalNote, MetricSet } from '$lib/reserve/types';

	/**
	 * Історія одного показника: коли, на скільки — і ЗА ЩО.
	 *
	 * «Бюджет 34 200» не каже, чи справи йдуть добре. Різниця каже більше: −235 за
	 * день означає, що фонд проїдає запас. Але й вона не каже, що робити: чи то штат
	 * завеликий, чи то вольєрів набудували. Тому під кожним днем стоїть розклад:
	 *
	 *     Сьогодні                    −235
	 *       Зарплата ветеринарам      −120
	 *       Зарплата доглядачам        −80
	 *       Утримання тварин           −35
	 *
	 * Причини приходять із реєстру (`ledger.ts`), а не вгадуються тут. Дні з партій,
	 * старших за формат розкладу, лишаються з самою різницею — і це правда, а не
	 * вигадана бухгалтерія: тих даних ніколи не існувало.
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
		/** Причини поточної доби: журнал їх ще не бачив. */
		todayNotes: JournalNote[];
		day: number;
		/**
		 * Чи підказку ЗАКРІПЛЕНО кліком.
		 *
		 * Закріплена не зникає від того, що курсор пішов, — і саме тоді в неї
		 * зʼявляється кнопка закриття: на дотику наведення не існує, а список
		 * причин треба гортати пальцем, який фокус із кнопки й забирає.
		 */
		pinned: boolean;
		/** Курсор зайшов у підказку: скасувати відкладене закриття. */
		onKeep: () => void;
		/** Курсор пішов: закриття знову відкладене. */
		onLeave: () => void;
		onClose: () => void;
	}

	let { metric, journal, today, todayNotes, day, pinned, onKeep, onLeave, onClose }: Props =
		$props();

	/** Лише рядки про ЦЕЙ показник, і лише ті, що не нульові. */
	const reasonsOf = (notes: JournalNote[]) =>
		notes.filter((note) => note.metric === metric && note.amount !== 0);

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
			.map((entry) => ({
				day: entry.day,
				delta: entry[metric],
				// `?? []` не про охайність: сейв із версії 1 має дні без розкладу.
				reasons: reasonsOf(entry.notes ?? [])
			}))
			.filter((row) => row.delta !== 0)
	);

	const todayReasons = $derived(reasonsOf(todayNotes));

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

<!--
	Наведення слухає САМА підказка, і без цього все інше не має сенсу: курсор
	мусить мати куди приїхати. `role="tooltip"` лишається — це підказка, просто
	така, у яку можна зайти; кнопка закриття зʼявляється лише в закріпленої.
-->
<div
	bind:this={panel}
	class="hist"
	class:hist--pinned={pinned}
	role="tooltip"
	onmouseenter={onKeep}
	onmouseleave={onLeave}
	data-testid="reserve-history-tooltip"
>
	<div class="hist__head">
		<b class="hist__title">{@html formatFont(t('reserve.history'))}</b>
		{#if pinned}
			<button
				type="button"
				class="hist__close"
				aria-label={t('common.close')}
				onclick={onClose}
				data-testid="reserve-history-close-btn">×</button
			>
		{/if}
	</div>

	<dl class="hist__rows">
		<div class="hist__row hist__row--today">
			<dt>{@html formatFont(t('reserve.today'))}</dt>
			<dd class:hist__down={today < 0}>{today === 0 ? '—' : signed(today)}</dd>
		</div>
		{#each todayReasons as note (note.reason)}
			<div class="hist__row hist__row--why">
				<dt>{@html formatFont(t(`reserve.why.${note.reason}` as const))}</dt>
				<dd class:hist__down={note.amount < 0}>{signed(note.amount)}</dd>
			</div>
		{/each}

		{#each rows as row (row.day)}
			<div class="hist__row">
				<dt>{@html formatFont(t('reserve.day'))} {row.day}</dt>
				<dd class:hist__down={row.delta < 0}>{signed(row.delta)}</dd>
			</div>
			{#each row.reasons as note (note.reason)}
				<div class="hist__row hist__row--why">
					<dt>{@html formatFont(t(`reserve.why.${note.reason}` as const))}</dt>
					<dd class:hist__down={note.amount < 0}>{signed(note.amount)}</dd>
				</div>
			{/each}
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
		top: 100%;
		left: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 11rem;
		/*
		 * Ширше й вище, ніж було: у рядку тепер стоїть причина, а «Тварину забрали
		 * браконьєри» у 14rem переносилася на три рядки. Стеля лишається — це
		 * підказка, а не звіт.
		 */
		max-width: 19rem;
		max-height: 18rem;
		padding: var(--space-sm);
		/*
		 * Відступ від показника малює РАМКА, а не проміжок.
		 *
		 * Проміжок у 4px був діркою: курсор, ідучи з кнопки в підказку, виходив за
		 * межі обох, і вікно закривалося рівно на півдорозі. Прозора рамка тримає ту
		 * саму відстань і при цьому належить самій підказці, тож курсор весь час
		 * усередині.
		 */
		border: 1px solid var(--color-border);
		border-top: 5px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		background-clip: padding-box;
		box-shadow: 0 6px 20px rgb(0 0 0 / 40%);
		overflow-y: auto;
	}

	/* Закріплену видно: інакше незрозуміло, чому вона не зникає. */
	.hist--pinned {
		border-color: var(--color-accent);
	}

	.hist__head {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
	}

	.hist__close {
		min-width: 32px;
		min-height: 32px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font-size: var(--font-size-md);
		cursor: pointer;
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

	/*
	 * Причини — з відступом і дрібніше: це РОЗКЛАД дня, а не сусідній день. Без
	 * зсуву список читався б як двадцять рівноправних рядків.
	 */
	.hist__row--why {
		padding-left: var(--space-sm);
		font-size: var(--font-size-xs);
		opacity: 0.85;
		white-space: normal;
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
