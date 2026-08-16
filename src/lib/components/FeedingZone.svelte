<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import FeedingPlated from './FeedingPlated.svelte';

	/**
	 * Ціль, куди кладуть страву: тварина або смітник (концепція, гра 1).
	 *
	 * Один компонент на всі три зони, бо поводяться вони однаково — різниця
	 * лише в підписі й у тому, що в смітника немає фото. Три копії цієї
	 * розмітки розійшлися б на першій же правці.
	 */
	interface Props {
		labelKey: TranslationKey;
		/** Фото тварини; `null` — це смітник, і тоді малюється іконка. */
		image?: string | null;
		foods: Food[];
		/**
		 * Страви, які ще на столі. Показуються як натяк, поки зона порожня:
		 * без нього порожня зона нічого про себе не каже, і гравець не бачить,
		 * що сюди взагалі щось кладуть.
		 */
		hints?: Food[];
		/** Страва в руках гравця: зону підсвітити, її картку показати взятою. */
		picked: Food | null;
		disabled: boolean;
		/** Покласти сюди те, що в руках. */
		onplace: () => void;
		/** Узяти звідси — щоб перекласти в іншу зону одним рухом. */
		onpickup: (food: Food) => void;
		/** Покласти сюди конкретну страву просто з натяку. */
		onhint?: (food: Food) => void;
		/** Повернути на стіл (подвійний клік). */
		ontakeback: (food: Food) => void;
		testId: string;
	}

	let {
		labelKey,
		image = null,
		foods,
		hints = [],
		picked,
		disabled,
		onplace,
		onpickup,
		onhint,
		ontakeback,
		testId
	}: Props = $props();

	/**
	 * Клік по вже покладеній страві означає різне залежно від того, чи щось у
	 * руках: із стравою в руках будь-яке місце зони — це «поклади сюди», без
	 * неї — «візьми оцю». Так само, як зі слотами в грі про чисельність.
	 */
	function tapPlated(food: Food) {
		if (disabled) return;
		if (picked) onplace();
		else onpickup(food);
	}
</script>

<!--
	`role="button"` на зоні, бо покласти страву можна кліком, а не лише
	перетягуванням: HTML5 drag-and-drop на сенсорних екранах не працює взагалі,
	тож клік — це не запасний, а ОСНОВНИЙ шлях (ACCESSIBILITY-v8 § 2).
-->
<div
	class="zone"
	class:zone--active={picked !== null && !disabled}
	class:zone--bin={image === null}
	role="button"
	tabindex="0"
	aria-label={formatPlain(t(labelKey))}
	data-testid={testId}
	onclick={() => !disabled && onplace()}
	onkeydown={(e) => {
		if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onplace();
		}
	}}
	ondragover={(e) => {
		if (disabled) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}}
	ondrop={(e) => {
		if (disabled) return;
		e.preventDefault();
		onplace();
	}}
>
	<div class="zone__head">
		{#if image}
			<img
				src={image}
				alt={formatPlain(t(labelKey))}
				class="zone__image"
				loading="lazy"
				width="300"
				height="400"
			/>
		{:else}
			<span class="zone__icon"><Trash2 size={24} aria-hidden="true" /></span>
		{/if}
		<span class="zone__label">{@html formatFont(t(labelKey))}</span>
	</div>

	<div class="zone__plate">
		{#if foods.length === 0 && hints.length > 0 && !disabled}
			{#each hints as hint (hint.id)}
				<button
					type="button"
					class="hint"
					onclick={(e) => {
						e.stopPropagation();
						onhint?.(hint);
					}}
					aria-label={formatPlain(t(hint.nameKey as TranslationKey))}
					data-testid="{testId}-hint-btn-{hint.id}"
				>
					<img src={hint.image} alt="" class="hint__image" loading="lazy" width="300" height="400" />
				</button>
			{/each}
		{/if}
		{#each foods as food (food.id)}
			<FeedingPlated
				{food}
				{disabled}
				picked={picked?.id === food.id}
				ontap={() => tapPlated(food)}
				ontakeback={() => ontakeback(food)}
				onpickup={() => onpickup(food)}
				testId="{testId}-plated-btn-{food.id}"
			/>
		{/each}
	</div>
</div>

<style>
	/*
	 * Напрямок зони не задається ззовні й не має власного медіазапиту.
	 *
	 * Зона стоїть то на всю ширину (смітник, вузький екран), то вузькою
	 * колонкою біля столу. Замість другого числа, яке мусило б збігатися з
	 * порогом у грі, тут перенесення: `flex-wrap` плюс базис тарілки. Щойно
	 * тарілці лишається менше за базис — вона переходить під фото сама.
	 */
	.zone {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-height: 92px;
		padding: var(--space-sm);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-surface), transparent 35%);
		backdrop-filter: var(--blur-glass);
		transition: all var(--transition-fast);
		cursor: pointer;
	}

	.zone--active {
		border-style: solid;
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent), transparent 85%);
	}

	.zone--bin {
		border-color: var(--color-text-muted);
	}

	.zone__head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		/* Фото — головне в зоні, тож воно бере всю ширину колонки. Стеля потрібна
		   лише для смітника: він на всю ширину сторінки, і без неї іконка
		   роздулася б на пів екрана. */
		width: min(100%, 112px);
		flex-shrink: 0;
	}

	.zone__image {
		width: 100%;
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-bg-panel-dark);
	}

	.zone__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 70%);
		color: var(--color-text-muted);
	}

	.zone__label {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-align: center;
		color: var(--color-text);
		overflow-wrap: anywhere;
	}

	/* `minmax(0, …)`: без нього колонка не стискається менше за вміст. */
	.zone__plate {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--space-xs);
		/* Базис і є порогом перенесення: менше за 130px — тарілка йде під фото. */
		flex: 1 1 130px;
		min-width: 0;
	}

	/*
	 * Натяк — та сама картка, лише напівпрозора: 25% у спокої, 75% під курсором.
	 * Клік кладе страву сюди одразу, тобто натяк ще й найкоротший шлях.
	 */
	.hint {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		padding: 2px;
		border: 1px dashed color-mix(in srgb, var(--color-accent), transparent 50%);
		border-radius: var(--radius-sm);
		background: transparent;
		opacity: 0.25;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.hint:hover,
	.hint:focus-visible {
		opacity: 0.75;
		border-style: solid;
		border-color: var(--color-accent);
	}

	.hint__image {
		width: 100%;
		/* Дрібніше за покладену страву: натяк не має важити стільки ж, скільки
		   зроблений хід, — та й висоту зони він тоді з'їдає менше. */
		max-width: 34px;
		aspect-ratio: 1;
		height: auto;
		object-fit: contain;
	}

</style>
