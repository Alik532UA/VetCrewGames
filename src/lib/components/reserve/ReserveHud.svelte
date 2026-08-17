<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { deltaOf } from '$lib/reserve/journal';
	import type { JournalDay, JournalNote, MetricSet } from '$lib/reserve/types';
	import { SPEEDS, type Speed } from '$lib/controllers/reserve.svelte';
	import HudHistory from './HudHistory.svelte';
	import { hudProbe } from './hudProbe.svelte';
	import { hudStats } from './hudStats';

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
		/** Причини змін ПОТОЧНОЇ доби: журнал побачить їх лише на її межі. */
		todayNotes: JournalNote[];
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
		todayNotes,
		dayStart,
		speed,
		onSpeed
	}: Props = $props();

	/**
	 * Відкриття підказки живе окремо (`hudProbe`): наведення, відкладене закриття
	 * й закріплення кліком — це режим роботи, а не деталь шапки.
	 */
	const probe = hudProbe();

	/** Зміна за поточну добу — та, якої ще немає в журналі. */
	const today = $derived(deltaOf({ budget, impact, reputation, inReserve, inWild }, dayStart));

	/** Підпис для читалки: пауза називається дією, а не значком. */
	const speedLabel = (value: Speed) =>
		value === 0 ? t('reserve.speed.pause') : t(`reserve.speed.x${value}` as const);

	const stats = $derived(
		hudStats({ day, budget, impact, reputation, inReserve, inWild, manySites }, settings.locale)
	);
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
						aria-expanded={probe.open === metric}
						onmouseenter={() => probe.show(metric)}
						onmouseleave={() => probe.hide()}
						onfocus={() => probe.show(metric)}
						onblur={() => probe.hide()}
						onclick={() => probe.togglePin(metric)}
						onkeydown={(event) => {
							if (event.key === 'Escape') probe.unpin();
						}}
						data-testid="reserve-{stat.id}-history-btn"
					>
						<span class="hud__label">{@html formatFont(t(stat.labelKey))}</span>
						<span
							class="hud__value"
							class:hud__value--bad={stat.bad}
							data-testid="reserve-{stat.id}-value">{stat.value}</span
						>
					</button>

					{#if probe.open === metric}
						<HudHistory
							{metric}
							{journal}
							today={today[metric]}
							{todayNotes}
							{day}
							pinned={probe.pinnedOn(metric)}
							onKeep={() => probe.show(metric)}
							onLeave={() => probe.hide()}
							onClose={() => probe.unpin()}
						/>
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
