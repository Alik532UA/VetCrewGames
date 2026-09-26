<script lang="ts">
	import { Check, Minus, X } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { RoundStatus } from '$lib/types/game';

	/**
	 * ПИТАННЯ ПАРТІЇ НА ЕКРАНІ ПІДСУМКУ (прохання автора 2026-09-26: переглянути
	 * можна і під час гри, і в кінці переліком усіх питань). Саме тут перегляд
	 * найкорисніший: партію дограно, і можна спокійно подивитися, де помилився.
	 *
	 * Рядок — кнопка: натиск відкриває питання тією самою дошкою, що й під час гри.
	 * Позначка стану — значком і словом для скрінрідера, а не лише кольором (WCAG
	 * 1.4.1).
	 */
	interface Props {
		results: RoundStatus[];
		/** Що написати в рядку — текст питання цієї гри. */
		label: (index: number) => string;
		onopen: (index: number) => void;
	}

	let { results, label, onopen }: Props = $props();

	const ICON = { correct: Check, incorrect: X, partial: Minus } as const;
</script>

<section class="review-list text-panel" data-testid="round-review-list">
	<h2 class="review-list__title">{@html formatFont(t('review.list'))}</h2>
	<ol class="review-list__items">
		{#each results as status, index (index)}
			{@const Icon = ICON[status as keyof typeof ICON] ?? Minus}
			<li>
				<button
					type="button"
					class="review-list__item review-list__item--{status}"
					onclick={() => onopen(index)}
					data-testid="round-review-{index + 1}-item"
				>
					<span class="review-list__mark">
						<Icon size={18} aria-hidden="true" />
						<span class="visually-hidden">{t(`review.${status}` as 'review.correct')}</span>
					</span>
					<span class="review-list__text">{@html formatFont(`${index + 1}. ${label(index)}`)}</span>
				</button>
			</li>
		{/each}
	</ol>
</section>

<style>
	.review-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		padding: var(--space-sm);
		box-sizing: border-box;
	}

	.review-list__title {
		margin: 0;
		font-size: var(--font-size-md);
		text-align: center;
	}

	.review-list__items {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.review-list__item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border: 0;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 94%);
		color: inherit;
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
	}

	.review-list__mark {
		display: inline-flex;
		flex-shrink: 0;
	}

	.review-list__item--correct .review-list__mark {
		color: var(--color-success);
	}

	.review-list__item--incorrect .review-list__mark {
		color: var(--color-error);
	}

	.review-list__item--partial .review-list__mark {
		color: var(--color-warning);
	}

	.review-list__text {
		min-width: 0;
	}
</style>
