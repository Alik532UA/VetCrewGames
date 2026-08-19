<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Страва, яку вже поклали в зону.
	 *
	 * Поводиться як картка в слоті гри про чисельність: її можна взяти назад,
	 * перекласти в іншу зону одним рухом і перетягнути. Раніше клік по ній
	 * повертав страву на стіл — і зміна рішення коштувала три кроки.
	 *
	 * Це саме ЗОБРАЖЕННЯ, без підпису й без коробки навколо. Підпис робив картку
	 * втричі вищою за ширину — і вищою по-різному, бо «Fish» уміщався в рядок, а
	 * «Avocado» ні. Назву й так видно на самій страві, а для читалок вона
	 * лишилася в `aria-label`.
	 */
	interface Props {
		food: Food;
		picked: boolean;
		disabled: boolean;
		/** Клік: узяти цю або покласти сюди те, що вже в руках — вирішує зона. */
		ontap: () => void;
		/** Подвійний клік — назад на стіл. */
		ontakeback: () => void;
		/** Початок перетягування: страва мусить опинитися в руках. */
		onpickup: () => void;
		testId: string;
	}

	let { food, picked, disabled, ontap, ontakeback, onpickup, testId }: Props = $props();
</script>

<button
	type="button"
	class="plated"
	class:plated--picked={picked}
	{disabled}
	draggable={!disabled}
	onclick={(e) => {
		e.stopPropagation();
		ontap();
	}}
	ondblclick={(e) => {
		e.stopPropagation();
		if (!disabled) ontakeback();
	}}
	ondragstart={(e) => {
		if (disabled) return;
		onpickup();
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', food.id);
			e.dataTransfer.effectAllowed = 'move';
		}
	}}
	aria-label={t(food.nameKey as TranslationKey)}
	data-testid={testId}
>
	<img src={food.image} alt="" class="plated__image" loading="lazy" width="390" height="520" />
</button>

<style>
	/*
	 * Пропорція задана САМІЙ коробці, а не лише зображенню.
	 *
	 * Доти 3:4 було на зображенні, а рамка додавалася зверху — і коробка виходила
	 * 48×61, тобто 0.78. Різниця мала, але саме коробку й видно: у неї фон, рамка
	 * й скруглення.
	 */
	.plated {
		display: block;
		box-sizing: border-box;
		width: 48px;
		aspect-ratio: 3 / 4;
		min-width: 0;
		padding: 2px;
		border: 2px solid transparent;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		cursor: grab;
		transition: all var(--transition-fast);
	}

	.plated:hover:not(:disabled) {
		border-color: color-mix(in srgb, var(--color-accent), transparent 50%);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 40%);
	}

	.plated--picked {
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent), transparent 80%);
	}

	.plated:disabled {
		cursor: default;
	}

	.plated__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: calc(var(--radius-sm) - 2px);
	}

</style>
