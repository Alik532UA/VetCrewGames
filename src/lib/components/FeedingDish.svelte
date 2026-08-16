<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { Food, Target } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/** Куди можна відправити страву одним рухом. */
	export interface QuickTarget {
		id: Target;
		labelKey: TranslationKey;
		/** Фото тварини; `null` — смітник, і тоді малюється іконка. */
		image: string | null;
		/** Де стоїть кнопка: біля відповідної зони на екрані. */
		place: 'left' | 'right' | 'top';
	}

	/**
	 * Страва на столі — і одразу кнопки «кому віддати».
	 *
	 * Без них рішення коштує два кроки з поглядом у різні кінці екрана: взяти
	 * страву тут, знайти зону там. Кнопки з'являються на наведенні, на фокусі
	 * з клавіатури й коли страву взяли — останнє потрібне сенсорному екрану,
	 * де наведення не існує (ACCESSIBILITY-v8 § 2).
	 *
	 * Стоять вони довкола страви: тварини по боках, смітник зверху. Усі три —
	 * накладки поза потоком, і кожна трохи налазить на картку: у потоці вони
	 * диктували б їй розмір, а колонці столу місця й так обмаль.
	 */
	interface Props {
		food: Food;
		picked: boolean;
		disabled: boolean;
		targets: QuickTarget[];
		/** У роботі інша страва — цю треба приглушити. */
		dimmed: boolean;
		onpick: () => void;
		onsend: (target: Target) => void;
	}

	let { food, picked, disabled, dimmed, targets, onpick, onsend }: Props = $props();
</script>

<div class="dish-slot" class:dish-slot--picked={picked} class:dish-slot--dimmed={dimmed}>
	<div class="dish-slot__row">
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
			<img src={food.image} alt="" class="dish__image" loading="lazy" width="390" height="520" />
			<span class="dish__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
		</button>

		{#each targets as target (target.id)}
			<button
				type="button"
				class="quick"
				class:quick--left={target.place === 'left'}
				class:quick--right={target.place === 'right'}
				class:quick--bin={target.place === 'top'}
				{disabled}
				onclick={(e) => {
					e.stopPropagation();
					onsend(target.id);
				}}
				aria-label={formatPlain(t(target.labelKey))}
				data-testid="feeding-quick-btn-{food.id}-{target.id}"
			>
				{#if target.image}
					<img src={target.image} alt="" class="quick__image" loading="lazy" width="60" height="80" />
				{:else}
					<Trash2 size={18} aria-hidden="true" />
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.dish-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		min-width: 0;
		transition: opacity var(--transition-fast);
	}

	/*
	 * Решта страв блякне, коли одна в роботі — і на дотику теж, бо там це єдина
	 * ознака вибору: швидких кнопок на сенсорному немає.
	 */
	.dish-slot--dimmed {
		opacity: 0.5;
	}

	/*
	 * Опора для всіх трьох кнопок. Розмір кнопки — змінна, бо від нього залежать
	 * три зсуви нижче: два числа, які мусять збігатися, розходяться при першій
	 * же правці.
	 */
	.dish-slot__row {
		--chip: 34px;
		/* 3:4 — та сама пропорція, що в самих файлів: у квадраті морда тварини
		   обрізалася з боків, і кнопка читалася гірше за саму зону. */
		--chip-h: calc(var(--chip) / 3 * 4);
		/* Наскільки кнопка налазить на картку. Решта її висить назовні. */
		--chip-bite: 11px;

		position: relative;
		display: flex;
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

	/*
	 * 3 / 4 — рівно пропорція самих файлів (390×520). У квадраті вони лежали
	 * «підшиті» з боків: половина коробки йшла в порожнечу, і страва здавалася
	 * дрібнішою, ніж є.
	 */
	.dish__image {
		width: 48px;
		aspect-ratio: 3 / 4;
		height: auto;
		object-fit: contain;
		border-radius: var(--radius-sm);
	}

	.dish__name {
		font-size: var(--font-size-xs);
		text-align: center;
		overflow-wrap: anywhere;
	}

	/*
	 * Суперeліпс |2x-1|⁴ + |2y-1|⁴ = 1 — та сама форма, що в іконок iOS.
	 * Двадцять вісім точок: крива вже гладка, а `clip-path` у відсотках
	 * масштабується разом із кнопкою.
	 *
	 * Не `corner-shape`: властивість робить те саме одним рядком, але
	 * `svelte-check` її ще не знає й дає попередження, а проєкт тримає нуль.
	 */
	.quick {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--chip);
		height: var(--chip-h);
		padding: 0;
		overflow: hidden;
		border: none;
		clip-path: polygon(100.0% 50.0%, 99.4% 73.6%, 97.5% 82.9%, 94.2% 89.5%, 89.5% 94.2%, 82.9% 97.5%, 73.6% 99.4%, 50.0% 100.0%, 26.4% 99.4%, 17.1% 97.5%, 10.5% 94.2%, 5.8% 89.5%, 2.5% 82.9%, 0.6% 73.6%, 0.0% 50.0%, 0.6% 26.4%, 2.5% 17.1%, 5.8% 10.5%, 10.5% 5.8%, 17.1% 2.5%, 26.4% 0.6%, 50.0% 0.0%, 73.6% 0.6%, 82.9% 2.5%, 89.5% 5.8%, 94.2% 10.5%, 97.5% 17.1%, 99.4% 26.4%);
		/* Обідок і підсвітка — фільтром, а не рамкою: рамку `clip-path` зрізав би
		   саме в кутах, тобто там, де форма й потрібна. Фільтр іде по силуету. */
		filter: drop-shadow(0 0 1.5px color-mix(in srgb, var(--color-accent), transparent 30%));
		background: var(--color-bg-surface);
		color: var(--color-text-muted);
		cursor: pointer;
		opacity: 0;
		pointer-events: none;
		transition: all var(--transition-fast);
	}

	/* Тварини — по боках страви, смітник — над нею: там-таки, де їхні зони. */
	.quick--left,
	.quick--right {
		top: 50%;
		transform: translateY(-50%);
	}

	.quick--left {
		left: calc(var(--chip-bite) - var(--chip));
	}

	.quick--right {
		right: calc(var(--chip-bite) - var(--chip));
	}

	.quick--bin {
		top: calc(var(--chip-bite) - var(--chip-h));
		left: 50%;
		transform: translateX(-50%);
	}

	/*
	 * Швидкі кнопки — лише там, де є справжній курсор.
	 *
	 * `hover: hover` замість ширини екрана: питання не в тому, скільки пікселів,
	 * а в тому, чи є чим наводити. На сенсорному вони або не з'являлися б ніколи,
	 * або з'являлися б на дотик — і перекривали б саму страву, по якій щойно
	 * тицьнули.
	 *
	 * `:focus-within` тут і є доступ із клавіатури: `pointer-events: none` не
	 * заважає табуляції, тож фокус доходить до прозорої кнопки й тим-таки
	 * показує всі три.
	 */
	@media (hover: hover) and (pointer: fine) {
		.dish-slot:hover .quick,
		.dish-slot:focus-within .quick {
			opacity: 1;
			pointer-events: auto;
		}
	}

	.quick:hover:not(:disabled) {
		filter: drop-shadow(0 0 5px var(--color-accent));
	}

	.quick--left:hover:not(:disabled),
	.quick--right:hover:not(:disabled) {
		transform: translateY(-50%) scale(1.12);
	}

	.quick--bin:hover:not(:disabled) {
		transform: translateX(-50%) scale(1.12);
	}

	.quick__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
