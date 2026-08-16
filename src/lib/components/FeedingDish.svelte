<script lang="ts">
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { Food, Target } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/** Кому можна віддати страву одним рухом. Порядок — як зони на екрані. */
	export interface QuickTarget {
		id: Target;
		labelKey: TranslationKey;
		image: string;
	}

	/**
	 * Страва на столі — і одразу кнопки «кому віддати».
	 *
	 * Без них рішення коштує два кроки з поглядом у різні кінці екрана: взяти
	 * страву тут, знайти зону там. Кнопки з'являються на наведенні, на фокусі
	 * з клавіатури й коли страву взяли — останнє потрібне сенсорному екрану,
	 * де наведення не існує (ACCESSIBILITY-v8 § 2).
	 *
	 * Місце під них зарезервоване завжди: інакше ряд стрибав би під курсором.
	 */
	interface Props {
		food: Food;
		picked: boolean;
		disabled: boolean;
		targets: QuickTarget[];
		onpick: () => void;
		onsend: (target: Target) => void;
	}

	let { food, picked, disabled, targets, onpick, onsend }: Props = $props();
</script>

<div class="dish-slot" class:dish-slot--picked={picked}>
	<button
		type="button"
		class="dish"
		class:dish--picked={picked}
		draggable={!disabled}
		{disabled}
		onclick={(e) => {
			// Стіл над нами теж слухає клік — інакше «взяв» одразу стало б «поклав назад».
			e.stopPropagation();
			onpick();
		}}
		ondragstart={(e) => {
			onpick();
			if (e.dataTransfer) {
				e.dataTransfer.setData('text/plain', food.id);
				e.dataTransfer.effectAllowed = 'move';
			}
		}}
		data-testid="feeding-dish-btn-{food.id}"
	>
		<img src={food.image} alt="" class="dish__image" loading="lazy" width="300" height="400" />
		<span class="dish__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
	</button>

	<div class="quick" aria-hidden={disabled}>
		{#each targets as target (target.id)}
			<button
				type="button"
				class="quick__btn"
				{disabled}
				onclick={(e) => {
					e.stopPropagation();
					onsend(target.id);
				}}
				aria-label={formatPlain(t(target.labelKey))}
				data-testid="feeding-quick-btn-{food.id}-{target.id}"
			>
				<img src={target.image} alt="" class="quick__image" loading="lazy" width="60" height="80" />
			</button>
		{/each}
	</div>
</div>

<style>
	.dish-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}

	.dish {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-width: 44px;
		min-height: 44px;
		padding: var(--space-xs);
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 20%);
		color: var(--color-text);
		font: inherit;
		cursor: grab;
		transition: all var(--transition-fast);
	}

	.dish:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-accent), transparent 50%);
	}

	.dish--picked {
		border-color: var(--color-accent);
		transform: translateY(-3px);
		box-shadow: var(--shadow-glow-accent);
	}

	.dish:disabled {
		cursor: default;
	}

	.dish__image {
		width: 48px;
		aspect-ratio: 1;
		height: auto;
		object-fit: contain;
	}

	.dish__name {
		font-size: var(--font-size-xs);
		text-align: center;
		overflow-wrap: anywhere;
	}

	.quick {
		display: flex;
		justify-content: center;
		gap: 3px;
		width: 100%;
		opacity: 0;
		pointer-events: none;
		transition: opacity var(--transition-fast);
	}

	/*
	 * `:focus-within` тут і є доступ із клавіатури: `pointer-events: none` не
	 * заважає табуляції, тож фокус доходить до прозорої кнопки й тим-таки
	 * показує весь ряд. Задати `opacity` самій кнопці не можна — прозорість
	 * батька дитина не переб'є.
	 */
	.dish-slot:hover .quick,
	.dish-slot:focus-within .quick,
	.dish-slot--picked .quick {
		opacity: 1;
		pointer-events: auto;
	}

	/*
	 * Кнопки стискаються разом зі стравою й ніколи не ширші за неї. Інакше
	 * ряд диктував би ширину страви, а в трьох колонках її й так обмаль — і
	 * ряди сусідніх страв налазили б один на одний.
	 *
	 * Менші за 44px тут свідомо: це скорочення, а не єдиний шлях. Ту саму дію
	 * робить кліком уся зона тварини, і вона на всю ширину (ACCESSIBILITY § 8).
	 */
	.quick__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 1 22px;
		min-width: 18px;
		aspect-ratio: 1;
		padding: 0;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--color-accent), transparent 40%);
		border-radius: 50%;
		background: var(--color-bg-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.quick__btn:hover:not(:disabled) {
		border-color: var(--color-accent);
		transform: scale(1.15);
	}

	.quick__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
