<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { IMPACT_TO_WIN } from '$lib/reserve/constants';
	import { deltaOf } from '$lib/reserve/journal';
	import type { JournalDay, MetricSet } from '$lib/reserve/types';
	import { SPEEDS, type Speed } from '$lib/controllers/reserve.svelte';
	import HudHistory from './HudHistory.svelte';

	/**
	 * Показники партії й керування часом.
	 *
	 * Числа саме тут, а не в шапці сайту: шапка належить усьому застосунку, а
	 * бюджет із репутацією — цій партії. Змішавши їх, довелося б чистити шапку
	 * при кожному виході зі сторінки.
	 *
	 * Дві шкали стоять поруч навмисно. «Користь планеті» — це те, що фонд
	 * НАСПРАВДІ зробив, і єдина умова програшу; репутація — те, що про нього
	 * знають, і саме вона приносить гроші. Розходяться вони там, де це щось
	 * означає: узяв хвору тварину без ветеринара — репутація впала, а планеті
	 * ти таки допоміг.
	 */
	interface Props {
		day: number;
		budget: number;
		impact: number;
		reputation: number;
		inReserve: number;
		inWild: number;
		/**
		 * Чи заселено більше однієї ділянки.
		 *
		 * Від цього залежить лише підпис: «У заповіднику» проти «У заповідниках».
		 * Множина зʼявляється тоді, коли вона ПРАВДИВА, а не тоді, коли ділянок
		 * чотири: у фонду з однією заселеною землею заповідник справді один.
		 */
		manySites: boolean;
		/** Історія змін по днях — саме її показує підказка над показником. */
		journal: JournalDay[];
		/** Зріз на початку доби: різниця з живими числами і є «сьогодні». */
		dayStart: MetricSet;
		speed: Speed;
		onSpeed: (speed: Speed) => void;
	}

	let {
		day,
		budget,
		impact,
		reputation,
		inReserve,
		inWild,
		manySites,
		journal,
		dayStart,
		speed,
		onSpeed
	}: Props = $props();

	/**
	 * Показник, чия історія розкрита. Один за раз: дві підказки поруч перекрили б
	 * і карту, і одна одну.
	 */
	let open = $state<keyof MetricSet | null>(null);

	/** Зміна за поточну добу — та, якої ще немає в журналі. */
	const today = $derived(deltaOf({ budget, impact, reputation, inReserve, inWild }, dayStart));

	/** Підпис для читалки: пауза називається дією, а не значком. */
	const speedLabel = (value: Speed) =>
		value === 0 ? t('reserve.speed.pause') : t(`reserve.speed.x${value}` as const);

	/**
	 * Показники несуть КЛЮЧ підпису, а не готовий рядок.
	 *
	 * Так треба, бо інваріант у `src/i18n-font.test.ts` читає розмітку: підпис,
	 * зібраний тут через `t()`, проходив би крізь перевірку непоміченим — і саме
	 * так тут спершу й опинилася кирилична «і», яку шрифт не має чим малювати.
	 * Форматування лишається в розмітці навмисно.
	 *
	 * Значення форматувати не треба: це числа, а цифри в шрифті є.
	 */
	const stats = $derived([
		{
			id: 'day',
			labelKey: 'reserve.day' as const,
			value: String(day),
			bad: false,
			metric: null
		},
		{
			id: 'budget',
			labelKey: 'reserve.budget' as const,
			value: budget.toLocaleString(settings.locale),
			bad: budget < 0,
			metric: 'budget' as const
		},
		{
			id: 'impact',
			labelKey: 'reserve.impact' as const,
			// Показник і мета поруч: інакше «34» нічого не каже про те, чи це багато.
			value: `${impact} / ${IMPACT_TO_WIN.toLocaleString(settings.locale)}`,
			bad: impact < 0,
			metric: 'impact' as const
		},
		{
			id: 'reputation',
			labelKey: 'reserve.reputation' as const,
			value: String(reputation),
			// Мінус тут значить, що громада забирає землю, — це варто побачити кольором.
			bad: reputation < 0,
			metric: 'reputation' as const
		},
		{
			id: 'inreserve',
			labelKey: (manySites ? 'reserve.inReserves' : 'reserve.inReserve') as
				| 'reserve.inReserve'
				| 'reserve.inReserves',
			value: String(inReserve),
			bad: false,
			metric: 'inReserve' as const
		},
		{
			id: 'inwild',
			labelKey: 'reserve.inWild' as const,
			value: String(inWild),
			bad: false,
			metric: 'inWild' as const
		}
	]);
</script>

<header class="hud" data-testid="reserve-hud-header">
	<!--
		Показники — КНОПКИ, а не список визначень.
		
		Кожен із них тепер відкриває історію, тобто це орган керування, а не підпис.
		Наведення мишею й фокус роблять одне й те саме: на телефоні наведення не
		існує, а тап дає саме фокус.
	-->
	<div class="hud__stats">
		{#each stats as stat (stat.id)}
			<div class="hud__cell">
				{#if stat.metric}
					{@const metric = stat.metric}
					<button
						type="button"
						class="hud__stat hud__stat--probe"
						aria-expanded={open === metric}
						onmouseenter={() => (open = metric)}
						onmouseleave={() => (open = null)}
						onfocus={() => (open = metric)}
						onblur={() => (open = null)}
						data-testid="reserve-{stat.id}-history-btn"
					>
						<span class="hud__label">{@html formatFont(t(stat.labelKey))}</span>
						<span
							class="hud__value"
							class:hud__value--bad={stat.bad}
							data-testid="reserve-{stat.id}-value">{stat.value}</span
						>
					</button>

					{#if open === metric}
						<HudHistory {metric} {journal} today={today[metric]} {day} />
					{/if}
				{:else}
					<div class="hud__stat">
						<span class="hud__label">{@html formatFont(t(stat.labelKey))}</span>
						<span class="hud__value" data-testid="reserve-{stat.id}-value">{stat.value}</span>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="hud__speeds" role="group" aria-label={t('reserve.speed.x1')}>
		{#each SPEEDS as value (value)}
			<button
				type="button"
				class="hud__speed"
				class:hud__speed--on={speed === value}
				aria-pressed={speed === value}
				aria-label={speedLabel(value)}
				onclick={() => onSpeed(value)}
				data-testid="reserve-speed-{value}-btn"
			>
				{value === 0 ? '⏸' : `×${value}`}
			</button>
		{/each}
	</div>
</header>

<style>
	/*
	 * Сама шапка — ПРОЗОРА смуга, а не панель.
	 *
	 * Доти всі показники сиділи в одному тлі на всю ширину екрана, і на широкому
	 * вікні воно виглядало як порожня перекладина: шість коротких чисел і півтори
	 * тисячі пікселів фарби. Тепер тло має кожен показник окремо, а між ними
	 * видно карту — тобто те, що під шапкою й лежить.
	 */
	.hud {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: flex-start;
		justify-content: space-between;
		width: 100%;
	}

	/*
	 * Плашки, а не сітка: ширина кожної залежить від ЇЇ тексту. Рівні колонки
	 * давали «Бюджет 50 000» і «На волі 0» однакове поле, і друга виглядала
	 * порожньою. Перенос лишається — на 320px шість плашок в один рядок не влазять.
	 */
	.hud__stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		margin: 0;
	}

	/*
	 * Клітинка — і власне тло показника, і якір підказки: та висить абсолютно й
	 * чіпляється саме за неї.
	 */
	.hud__cell {
		position: relative;
		padding: 4px var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
	}

	.hud__stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		text-align: left;
	}

	/* Кнопка не має виглядати кнопкою: це показник, у якого є що розповісти. */
	.hud__stat--probe {
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: help;
	}

	.hud__label {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.hud__value {
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}

	/* Мінус видно кольором, а не лише знаком: саме на нього гравець реагує. */
	.hud__value--bad {
		color: var(--color-error);
	}

	/* Керування часом — теж окрема плашка: це інша річ, ніж показники. */
	.hud__speeds {
		display: flex;
		gap: 4px;
		padding: 4px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
	}

	.hud__speed {
		/* 44px — найменша ціль, у яку впевнено влучає палець (ACCESSIBILITY-v8). */
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.hud__speed--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}
</style>
