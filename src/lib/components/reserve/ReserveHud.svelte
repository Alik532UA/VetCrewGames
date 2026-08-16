<script lang="ts">
	import { t } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { SPEEDS, type Speed } from '$lib/controllers/reserve.svelte';

	/**
	 * Три числа партії й керування часом.
	 *
	 * Числа саме тут, а не в шапці сайту: шапка належить усьому застосунку, а
	 * бюджет із «Користю планеті» — цій партії. Змішавши їх, довелося б чистити
	 * шапку при кожному виході зі сторінки.
	 */
	interface Props {
		day: number;
		budget: number;
		impact: number;
		speed: Speed;
		onSpeed: (speed: Speed) => void;
	}

	let { day, budget, impact, speed, onSpeed }: Props = $props();

	/** Підпис для читалки: пауза називається дією, а не значком. */
	const speedLabel = (value: Speed) =>
		value === 0 ? t('reserve.speed.pause') : t(`reserve.speed.x${value}` as const);
</script>

<header class="hud" data-testid="reserve-hud-header">
	<dl class="hud__stats">
		<div class="hud__stat">
			<dt>{t('reserve.day')}</dt>
			<dd data-testid="reserve-day-value">{day}</dd>
		</div>
		<div class="hud__stat">
			<dt>{t('reserve.budget')}</dt>
			<dd class:hud__value--bad={budget < 0} data-testid="reserve-budget-value">
				{budget.toLocaleString(settings.locale)}
			</dd>
		</div>
		<div class="hud__stat">
			<dt>{t('reserve.impact')}</dt>
			<dd class:hud__value--bad={impact < 0} data-testid="reserve-impact-value">{impact}</dd>
		</div>
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

	.hud__stats {
		display: flex;
		gap: var(--space-md);
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
		background: var(--color-bg);
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
