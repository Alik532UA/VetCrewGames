<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { affordableSize, enclosurePrice } from '$lib/reserve/prices';
	import { footprintOf } from '$lib/reserve/grid';
	import { MAX_ENCLOSURE_SIZE } from '$lib/reserve/species';
	import type { Quality } from '$lib/reserve/constants';

	/**
	 * Розмір вольєра: лічильник плюс пʼять заготовок.
	 *
	 * Пʼятдесят кнопок не влазять на жоден екран, а повзунок тут гірший за них
	 * обох: ловити один піксель із пʼятдесяти, щоб трапити в «сорок два», — не той
	 * жест. Тому число вписується руками, підкручується кнопками, а найчастіші
	 * значення стоять готовими.
	 *
	 * Заготовки рахуються від ГРОШЕЙ, а не від межі в пʼятдесят. Показувати «40»
	 * фондові, у якого вистачає на «9», означало б пропонувати те, чого не буде: усі
	 * пʼять кнопок ведуть до вольєра, який справді можна поставити зараз. Крайня
	 * права — рівно те, на що грошей ще досить.
	 */
	interface Props {
		size: number;
		/** Якість множить ціну, тож і найбільший доступний розмір залежить від неї. */
		quality: Quality;
		budget: number;
		onSize: (size: number) => void;
	}

	let { size, quality, budget, onSize }: Props = $props();

	const top = $derived(affordableSize(budget, quality));

	/**
	 * Пʼять чисел, рівномірно від одиниці до найбільшого доступного.
	 *
	 * Для дев’ятки виходить 1, 3, 5, 7, 9; для сотні — 1, 26, 50, 75, 100. Набір
	 * стискається `Set`, бо на маленьких межах кроки сходяться: при доступних двох
	 * кнопок буде дві, а не пʼять однакових.
	 */
	const presets = $derived.by(() => {
		/*
		 * Звичайний масив із перевіркою на повтор, а не `Set`.
		 *
		 * Правило проєкту вимагає `SvelteSet` замість мутабельного `Set` — і має
		 * рацію в реактивному стані, але тут набір збирається й одразу вмирає
		 * всередині `$derived`. Тягнути заради нього реактивну колекцію було б
		 * дорожче за один `includes` на пʼять чисел.
		 */
		const out: number[] = [1];
		for (let step = 1; step <= 4; step++) {
			const value = Math.round(1 + ((top - 1) * step) / 4);
			if (!out.includes(value)) out.push(value);
		}
		return out.sort((a, b) => a - b);
	});

	const clamp = (value: number) => Math.min(MAX_ENCLOSURE_SIZE, Math.max(1, Math.round(value)));
	const money = (value: number) => value.toLocaleString(settings.locale);

	/** Ціна вибраного разом із тим, чи вона по кишені: обидва числа — одне рішення. */
	const price = $derived(enclosurePrice(size, quality));
	const tooDear = $derived(price > budget);
</script>

<div class="picker">
	<div class="picker__row" role="group" aria-label={t('reserve.size')}>
		{#each presets as value (value)}
			<button
				type="button"
				class="chip"
				class:chip--on={size === value}
				aria-pressed={size === value}
				onclick={() => onSize(value)}
				data-testid="reserve-size-{value}-btn"
			>
				{value}
			</button>
		{/each}
	</div>

	<div class="spin">
		<button
			type="button"
			class="spin__step"
			aria-label={t('reserve.sizeDown')}
			onclick={() => onSize(clamp(size - 1))}
			data-testid="reserve-size-minus-btn">−</button
		>
		<!--
			Число вписується руками, і це головний шлях для великих значень: дійти до
			сорока двох кнопкою «плюс» — це сорок один клік.
		-->
		<input
			type="number"
			min="1"
			max={MAX_ENCLOSURE_SIZE}
			step="1"
			value={size}
			aria-label={t('reserve.size')}
			oninput={(event) => onSize(clamp(Number(event.currentTarget.value)))}
			data-testid="reserve-size-input"
		/>
		<button
			type="button"
			class="spin__step"
			aria-label={t('reserve.sizeUp')}
			onclick={() => onSize(clamp(size + 1))}
			data-testid="reserve-size-plus-btn">+</button
		>
	</div>

	<p class="picker__note" data-testid="reserve-size-note-text">
		<!-- Слід у клітинках: розмір — це не лише ціна, а й зайнята земля. -->
		{footprintOf(size)}×{footprintOf(size)} ·
		<span class:picker__over={tooDear}>{money(price)}</span>
		{#if tooDear}
			<span class="picker__over">· {@html formatFont(t('reserve.reject.no-money'))}</span>
		{/if}
	</p>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.picker__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.chip {
		min-width: 44px;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.chip--on {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.spin {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.spin__step {
		min-width: 44px;
		min-height: 44px;
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	.spin input {
		width: 5rem;
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	/*
	 * Власна підкладка, а не прозорий текст: інваріант у `src/backdrop.test.ts`
	 * вимагає її від кожного рядка з літерами, і не формально — панель може
	 * відкритися над намальованим лісом, і «2×2 · 3 600» на кронах не читається.
	 */
	.picker__note {
		align-self: flex-start;
		margin: 0;
		padding: 2px var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		font-size: var(--font-size-sm);
		font-variant-numeric: tabular-nums;
	}

	/* Не по кишені — це не помилка, а факт. Але його видно до кліку. */
	.picker__over {
		color: var(--color-error);
		opacity: 1;
	}
</style>
