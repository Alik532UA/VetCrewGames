<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { FEED_PRICE, feedDays } from '$lib/reserve/larder';
	import type { ReserveCommand } from '$lib/reserve/types';

	/**
	 * Комора: скільки корму лежить, на скільки днів його вистачить і як докупити.
	 *
	 * Стоїть у панелі мешканців, а не окремою кнопкою в смузі. Корм — це про них:
	 * гравець приходить сюди дивитися, хто в нього живе, і саме тут доречно
	 * побачити, що ці двоє за чотири дні почнуть голодувати.
	 *
	 * **Заготовки міряються ДНЯМИ, а не порціями.** «Купити 30 порцій» вимагає від
	 * гравця самому поділити на кількість тварин; «на 10 днів» відповідає на те
	 * питання, яке в нього справді є. Порції лишаються в команді — правила рахують
	 * ними, бо тварин може стати більше вже завтра.
	 */
	interface Props {
		/** Скільки порцій у коморі. */
		feed: number;
		/** Скільком тваринам треба їсти: від них залежить і запас, і заготовки. */
		mouths: number;
		onCommand: (command: ReserveCommand) => void;
	}

	let { feed, mouths, onCommand }: Props = $props();

	const money = (value: number) => value.toLocaleString(settings.locale);
	const days = $derived(feedDays(feed, mouths));

	/**
	 * Три заготовки: тиждень, два й місяць.
	 *
	 * Рахуються від КІЛЬКОСТІ ТВАРИН, а не від сталого числа: десять порцій — це
	 * десять днів для одної тварини й один день для десяти. Мінімум у пʼять порцій
	 * лишає кнопки живими в порожньому заповіднику, куди тварина ще тільки їде.
	 */
	const steps = $derived([7, 14, 30].map((span) => Math.max(5, span * Math.max(1, mouths))));
</script>

<div class="larder">
	<!--
		Локатор свій, не `reserve-feed-value`: те саме ім'я вже носить плашка в шапці.
		Перевірка дублікатів дивиться в межах ФАЙЛА, тож два різні елементи в одному
		імені вона пропустила — знайшлося це виміром у браузері, де їх стало двоє.
	-->
	<p class="larder__now" data-testid="reserve-larder-value">
		{@html formatFont(t('reserve.feed'))}: {feed}
		{#if mouths > 0}
			<span class="larder__days" class:larder__days--bad={days < 3}>
				· {days}
				{@html formatFont(t('reserve.feedDays'))}
			</span>
		{/if}
	</p>

	{#if feed === 0 && mouths > 0}
		<p class="larder__alarm" role="status" data-testid="reserve-feed-warning">
			{@html formatFont(t('reserve.feedEmpty'))}
		</p>
	{/if}

	<div class="larder__row">
		{#each steps as portions (portions)}
			<button
				type="button"
				class="chip"
				onclick={() => onCommand({ type: 'restock', portions })}
				data-testid="reserve-restock-{portions}-btn"
			>
				+{portions} — {money(portions * FEED_PRICE)}
			</button>
		{/each}
	</div>
</div>

<style>
	.larder {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		margin-bottom: var(--space-md);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.larder__now {
		margin: 0;
		font-variant-numeric: tabular-nums;
	}

	.larder__days {
		font-size: var(--font-size-sm);
		opacity: 0.8;
	}

	/* Три дні до голоду — це вже привід щось зробити, а не спостерігати. */
	.larder__days--bad {
		color: var(--color-error);
		opacity: 1;
	}

	.larder__alarm {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-error);
	}

	.larder__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}
</style>
