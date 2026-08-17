<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { IMPACT_TO_WIN } from '$lib/reserve/constants';
	import { SPEEDS, type Speed } from '$lib/controllers/reserve.svelte';

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
		speed: Speed;
		onSpeed: (speed: Speed) => void;
	}

	let { day, budget, impact, reputation, inReserve, inWild, speed, onSpeed }: Props = $props();

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
		{ id: 'day', labelKey: 'reserve.day' as const, value: String(day), bad: false },
		{
			id: 'budget',
			labelKey: 'reserve.budget' as const,
			value: budget.toLocaleString(settings.locale),
			bad: budget < 0
		},
		{
			id: 'impact',
			labelKey: 'reserve.impact' as const,
			// Показник і мета поруч: інакше «34» нічого не каже про те, чи це багато.
			value: `${impact} / ${IMPACT_TO_WIN.toLocaleString(settings.locale)}`,
			bad: impact < 0
		},
		{
			id: 'reputation',
			labelKey: 'reserve.reputation' as const,
			value: String(reputation),
			bad: false
		},
		{
			id: 'inreserve',
			labelKey: 'reserve.inReserve' as const,
			value: String(inReserve),
			bad: false
		},
		{ id: 'inwild', labelKey: 'reserve.inWild' as const, value: String(inWild), bad: false }
	]);
</script>

<header class="hud" data-testid="reserve-hud-header">
	<dl class="hud__stats">
		{#each stats as stat (stat.id)}
			<div class="hud__stat">
				<dt>{@html formatFont(t(stat.labelKey))}</dt>
				<dd class:hud__value--bad={stat.bad} data-testid="reserve-{stat.id}-value">{stat.value}</dd>
			</div>
		{/each}
	</dl>

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
	.hud {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	/*
	 * Шість показників на 320px не вміщаються в рядок, і стискати їх не можна:
	 * бюджет у шість цифр має лишатися читабельним. Тому сітка з автозаповненням
	 * — вона сама вирішує, скільки колонок влізло.
	 */
	.hud__stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
		gap: var(--space-sm) var(--space-md);
		flex: 1 1 14rem;
		margin: 0;
	}

	.hud__stat {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hud__stat dt {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.hud__stat dd {
		margin: 0;
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}

	/* Мінус видно кольором, а не лише знаком: саме на нього гравець реагує. */
	.hud__value--bad {
		color: var(--color-error);
	}

	.hud__speeds {
		display: flex;
		gap: 4px;
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
