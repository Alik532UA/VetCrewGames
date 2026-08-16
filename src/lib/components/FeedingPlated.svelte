<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Страва, яку вже поклали в зону.
	 *
	 * Поводиться як картка в слоті гри про чисельність: її можна взяти назад,
	 * перекласти в іншу зону одним рухом і перетягнути. Раніше клік по ній
	 * повертав страву на стіл — і зміна рішення коштувала три кроки.
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
	data-testid={testId}
>
	<img src={food.image} alt="" class="plated__image" loading="lazy" width="390" height="520" />
	<span class="plated__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
</button>

<style>
	/* Ширина — рівно зображення: інакше картка розтягується на комірку й підпис
	   тягне її вбік від фото. */
	.plated {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		width: 48px;
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

	/* 3 / 4 — рівно пропорція файлів (390×520). У квадраті страва лежала
	   «підшита» з боків і здавалася дрібнішою, ніж є. */
	.plated__image {
		width: 100%;
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}

	/*
	 * Два рядки під підпис завжди. «Fish» уміщається в один, «Avocado» — у два,
	 * і через це картка міняла висоту разом із зоною: після відповіді смітник
	 * підстрибував. Порожній рядок дешевший за рух.
	 */
	.plated__name {
		font-size: var(--font-size-xs);
		line-height: 1.25;
		min-height: 2.5em;
		overflow-wrap: anywhere;
	}
</style>
