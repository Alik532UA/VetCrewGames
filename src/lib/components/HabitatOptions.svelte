<script lang="ts">
	import { Check, X } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { habitatImage, type HabitatMode } from '$lib/config/habitat-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Варіанти відповіді у «Де живем?»: континенти або природні зони.
	 *
	 * Правильних може бути кілька, тож це перемикачі, а не радіокнопки — і після
	 * перевірки кожен показує СВІЙ підсумок: влучив, пропустив, помилився.
	 */
	interface Props {
		options: readonly string[];
		mode: HabitatMode;
		selected: readonly string[];
		correct: readonly string[];
		checked: boolean;
		ontoggle: (option: string) => void;
	}

	let { options, mode, selected, correct, checked, ontoggle }: Props = $props();

	const optionKey = (option: string): TranslationKey =>
		(mode === 'continents'
			? `habitat.continent.${option}`
			: `habitat.biome.${option}`) as TranslationKey;
</script>

<div class="options">
	{#each options as option (option)}
		{@const isCorrect = correct.includes(option)}
		{@const isSelected = selected.includes(option)}
		<button
			type="button"
			class="option"
			class:option--selected={!checked && isSelected}
			class:option--hit={checked && isCorrect && isSelected}
			class:option--missed={checked && isCorrect && !isSelected}
			class:option--wrong={checked && !isCorrect && isSelected}
			disabled={checked}
			onclick={() => ontoggle(option)}
			data-testid="habitat-option-btn-{option}"
		>
			{#if checked && isCorrect}
				<Check size={16} aria-hidden="true" />
			{:else if checked && isSelected}
				<X size={16} aria-hidden="true" />
			{/if}
			<img
				src={habitatImage(mode, option)}
				alt=""
				class="option__image"
				loading="lazy"
				width="540"
				height="720"
			/>
			<span class="option__label">{@html formatFont(t(optionKey(option)))}</span>
		</button>
	{/each}
</div>

<style>
	/*
	 * `min(160px, 100%)`, а не гола довжина: інакше 160px стають ПІДЛОГОЮ
	 * ширини колонки, і на екрані 320px сітка розпирає сторінку
	 * (FLUID-SIZING-v8 § 1.1).
	 */
	.options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
		gap: var(--space-sm);
		width: 100%;
	}

	/*
	 * Телефон: маленьке зображення ПЕРЕД текстом, рядком. Дев'ять природних зон
	 * картками на всю ширину дали б екран заввишки в кілька прокруток, тож там
	 * зображення лишається підказкою, а не головним.
	 */
	.option {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-xs);
		/* 44px — власний стандарт проєкту для сенсорних цілей (ACCESSIBILITY § 8). */
		min-height: 44px;
		padding: var(--space-sm);
		border: 2px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.option__image {
		width: 26px;
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}

	.option__label {
		min-width: 0;
	}

	/*
	 * Комп'ютер: зображення над текстом і на всю ширину кнопки.
	 *
	 * Поріг 700px — там сторінка вже впирається у свою стелю 560px, тобто далі
	 * ширшати нема куди, і колонок стає чотири. Стеля на 84px потрібна, бо при
	 * 3:4 зображення на всю колонку (170px) було б заввишки 227, і дев'ять
	 * варіантів дали б три ряди по 280px.
	 */
	@media (min-width: 700px) {
		.option {
			flex-direction: column;
			gap: 4px;
			padding: var(--space-sm) var(--space-xs);
		}

		.option__image {
			width: min(100%, 84px);
		}
	}

	/*
	 * Від 1000px варіанти стають ОДНИМ рядом, а сторінка ширшає під нього.
	 *
	 * Сітка тут не годиться саме через кількість: варіантів завжди 7 або 9, і
	 * `auto-fit` при восьми колонках лишає сироту в другому ряду. `auto-flow:
	 * column` дає рівно стільки колонок, скільки варіантів, скільки б їх не
	 * було.
	 *
	 * Поріг узятий з ширини: щоб дев'ятьом лишалося хоч по 96px, сторінці треба
	 * 928px, тобто вікну — 967. Нижче ряд стискав би підпис «Ліс помірної зони»
	 * у стовпчик по слову, і сітка з двох рядів чесніша.
	 *
	 * Сторінку під цей ряд ширшає сама сторінка — правило там-таки, поруч зі
	 * своїм `max-width`, а не тут: ширина контейнера не справа його вмісту.
	 */
	@media (min-width: 1000px) {
		.options {
			grid-template-columns: none;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
		}
	}

	.option--selected {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent), transparent 75%);
	}

	.option--hit {
		border-color: var(--color-success);
		background: color-mix(in srgb, var(--color-success), transparent 70%);
	}

	/* Пропущену правильну показуємо пунктиром: гравець її не обирав. */
	.option--missed {
		border-style: dashed;
		border-color: var(--color-success);
	}

	.option--wrong {
		border-color: var(--color-error);
		background: color-mix(in srgb, var(--color-error), transparent 75%);
	}

	.option:disabled {
		cursor: default;
	}
</style>
