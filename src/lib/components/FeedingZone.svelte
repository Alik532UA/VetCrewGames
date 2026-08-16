<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

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
		/** Страва в руках гравця: зону підсвітити, її картку показати взятою. */
		picked: Food | null;
		disabled: boolean;
		/** Покласти сюди те, що в руках. */
		onplace: () => void;
		/** Узяти звідси — щоб перекласти в іншу зону одним рухом. */
		onpickup: (food: Food) => void;
		/** Повернути на стіл (подвійний клік). */
		ontakeback: (food: Food) => void;
		testId: string;
	}

	let {
		labelKey,
		image = null,
		foods,
		picked,
		disabled,
		onplace,
		onpickup,
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
		{#each foods as food (food.id)}
			<button
				type="button"
				class="plated"
				class:plated--picked={picked?.id === food.id}
				{disabled}
				draggable={!disabled}
				onclick={(e) => {
					e.stopPropagation();
					tapPlated(food);
				}}
				ondblclick={(e) => {
					e.stopPropagation();
					if (!disabled) ontakeback(food);
				}}
				ondragstart={(e) => {
					if (disabled) return;
					onpickup(food);
					if (e.dataTransfer) {
						e.dataTransfer.setData('text/plain', food.id);
						e.dataTransfer.effectAllowed = 'move';
					}
				}}
				data-testid="{testId}-plated-btn-{food.id}"
			>
				<img src={food.image} alt="" class="plated__image" loading="lazy" width="300" height="400" />
				<span class="plated__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.zone {
		display: flex;
		align-items: center;
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
		width: 72px;
		flex-shrink: 0;
	}

	.zone__image {
		width: 56px;
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
		flex: 1;
		min-width: 0;
	}

	.plated {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
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
		max-width: 44px;
		aspect-ratio: 1;
		height: auto;
		object-fit: contain;
	}

	.plated__name {
		font-size: var(--font-size-xs);
		overflow-wrap: anywhere;
	}
</style>
