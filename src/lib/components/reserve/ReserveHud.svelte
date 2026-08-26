<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { deltaOf } from '$lib/reserve/journal';
	import type { JournalDay, JournalNote, MetricSet } from '$lib/reserve/types';
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
		/** Порції корму в коморі: нуль означає голод, і його видно кольором. */
		feed: number;
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
	}

	let {
		day,
		budget,
		feed,
		impact,
		reputation,
		inReserve,
		inWild,
		manySites,
		journal,
		todayNotes,
		dayStart
	}: Props = $props();

	/**
	 * Відкриття підказки живе окремо (`hudProbe`): наведення, відкладене закриття
	 * й закріплення кліком — це режим роботи, а не деталь шапки.
	 */
	const probe = hudProbe();

	/** Зміна за поточну добу — та, якої ще немає в журналі. */
	const today = $derived(
		deltaOf({ budget, feed, impact, reputation, inReserve, inWild }, dayStart)
	);

	const stats = $derived(
		hudStats(
			{ day, budget, feed, impact, reputation, inReserve, inWild, manySites },
			settings.locale
		)
	);
	/**
	 * СПОВІЩЕННЯ НЕ МУСЯТЬ НАКРИВАТИ ЦІ САМІ ПОКАЗНИКИ.
	 *
	 * Тости стоять зверху ПРАВОРУЧ (прохання автора; доти було ліворуч), а ця
	 * панель — зверху ліворуч. На широкому екрані вони вже не сусіди, але на
	 * вузькому показники переносяться в кілька рядів і доходять до правого краю:
	 * заміряно 55px висоти на 1100px і 178px на 420px. Тобто фіксованим
	 * відступом це не розвʼязується — на телефоні тост ліг би на числа, які
	 * щойно змінилися через ту саму подію.
	 *
	 * Тому висота МІРЯЄТЬСЯ і віддається тостам змінною. Через `:root`, а не
	 * каскадом: `Toast` живе в кореневому layout, поза деревом цієї сторінки, і
	 * звичайне успадкування до нього не дістає.
	 *
	 * Прибирання обовʼязкове: без нього тости лишалися б опущеними на всіх
	 * сторінках, куди гравець пішов далі, — і причини цього не було б видно
	 * ніде.
	 */
	let hudHeight = $state(0);

	$effect(() => {
		const root = document.documentElement;
		root.style.setProperty('--toast-top', `${hudHeight}px`);
		return () => root.style.removeProperty('--toast-top');
	});
</script>

<header class="hud" data-testid="reserve-hud-header" bind:clientHeight={hudHeight}>
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

	/* `opacity: 0.75` давало 3.95:1 — див. `.biome__facts` у `BiomePicker`. */
	.hud__label {
		font-size: var(--font-size-sm);
	}

	.hud__value {
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}

	/* Мінус видно кольором, а не лише знаком: саме на нього гравець реагує. */
	.hud__value--bad {
		color: var(--color-error);
	}

	/*
	 * Керування часом ЗВІДСИ ПІШЛО — у `ReserveSpeeds`, униз праворуч (прохання
	 * автора). Тут лишилися показники, і `justify-content: space-between` вище
	 * тепер розпирає лише їх — тобто нічого, бо вони один блок. Правило лишається
	 * навмисно: воно тримає вирівнювання, якщо в шапці колись зʼявиться друга
	 * група.
	 */
</style>
