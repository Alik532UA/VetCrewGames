<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import FeedingPlated from './FeedingPlated.svelte';
	import FeedingHints from './FeedingHints.svelte';

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
		 *
		 * Зникають, щойно страва опиняється в руках, — див. `showHints`.
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
	 * Натяки зникають, щойно страва в руках.
	 *
	 * Доти вони лишалися, і зона мала ДВА значення водночас: «поклади сюди те,
	 * що тримаєш» на всій площі — і «поклади оцю» на 12.8% площі, зайнятих
	 * мініатюрами. Заміряно на телефоні 390×844: тримаєш «Горіхи», влучаєш у
	 * мініатюру «Риба» — лягає риба, а горіхи мовчки випадають із рук. Дві
	 * помилки одним дотиком, і жодна не пояснена.
	 *
	 * Мініатюра має сенс лише з порожніми руками: тоді вона робить рівно те, що
	 * намальовано. З повними руками вибір уже зроблено, і пропонувати інший —
	 * значить питати вдруге про те саме.
	 *
	 * Висота зони від цього не змінюється: тарілка тримає 64px, а ряд натяків
	 * нижчий і НЕ переноситься — див. FeedingHints, де це й доводиться. Доти
	 * переносився, і зона сіпалася на 31px щоразу, коли натяки зникали.
	 */
	const showHints = $derived(foods.length === 0 && hints.length > 0 && !disabled && !picked);

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
	class:zone--done={disabled}
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
		{#if showHints}
			<FeedingHints foods={hints} onpick={(food) => onhint?.(food)} zoneTestId={testId} />
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
	/* Зона — стовпчик: голова зверху, тарілка під нею. */
	.zone {
		display: flex;
		flex-direction: column;
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

	/*
	 * Смітник — рядок, а не стовпчик: він на всю ширину сторінки, і викинуте під
	 * іконкою лишало б порожнім увесь правий бік. Зонам тварин рядок не годиться
	 * з протилежної причини — вони вузькі колонки.
	 */
	.zone--bin {
		flex-direction: row;
		align-items: center;
		border-color: var(--color-text-muted);
	}

	.zone--bin .zone__head {
		width: auto;
		min-width: 88px;
	}

	.zone--bin .zone__plate {
		flex: 1;
	}

	.zone__head {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		/* Рівно ширина зони: фото — головне, що в ній є. */
		width: 100%;
		flex-shrink: 0;
	}

	.zone__image {
		/*
		 * Стеля — на фото, а не на голові: голова мусить бути завширшки з зону,
		 * а от саме фото в широкій зоні розростається. При 3:4 зона на 560px дала
		 * б висоту 747 — пів екрана під одну тварину в стовпчиковому розборі.
		 */
		width: min(100%, 200px);
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: cover;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-bg-panel-dark);
	}

	/*
	 * Телефон, стан розбору: фото меншає до 100px.
	 *
	 * Після відповіді фото вже нічого не вирішує — воно лише нагадує, про кого
	 * мова, і поруч із ним стоїть розбір, заради якого все й затівалося. У повний
	 * зріст воно давало зону на 379px, тобто пів екрана під одну картинку;
	 * зі стелею в 100px рядок «тварина + розбір» стає вдвічі нижчим.
	 *
	 * `disabled` тут і означає «раунд зіграно»: зони вимикають саме тоді.
	 */
	@media (max-width: 639px) {
		.zone--done .zone__image {
			width: min(100%, 100px);
		}
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

	/*
	 * Ряд по центру, а не сітка на три колонки: сітка ставила єдину покладену
	 * страву в ЛІВУ комірку, а решту смуги лишала порожньою.
	 */
	.zone__plate {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		/*
		 * `center`, а не типове `stretch`. Тарілка має зарезервовану висоту в
		 * 68px, і `stretch` тягнув до неї КОЖНУ картку: натяк завширшки 34px
		 * ставав 34×68, тобто вдвічі вищим за ширину. Зображення всередині при
		 * цьому лишалося 3:4 — і саме тому дефект було видно лише на коробці.
		 */
		align-items: center;
		gap: var(--space-xs);
		width: 100%;
		min-width: 0;
		/*
		 * Місце під ряд карток зарезервоване завжди — 64px це висота покладеної
		 * страви: коробка 48px завширшки при пропорції 3:4.
		 *
		 * Без цього зона змінювала висоту від того, що в ній: три натяки нижчі за
		 * одну покладену страву, і після відповіді вся дошка стрибала. Порожнє
		 * місце тут дешевше за рух.
		 */
		min-height: 64px;
	}

</style>
