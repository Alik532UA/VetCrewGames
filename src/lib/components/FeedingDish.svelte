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
		place: 'left' | 'right' | 'bottom';
	}

	/**
	 * Страва на столі — і одразу кнопки «кому віддати».
	 *
	 * Без них рішення коштує два кроки з поглядом у різні кінці екрана: взяти
	 * страву тут, знайти зону там. Кнопки з'являються на наведенні, на фокусі
	 * з клавіатури й коли страву взяли — останнє потрібне сенсорному екрану,
	 * де наведення не існує (ACCESSIBILITY-v8 § 2).
	 *
	 * Стоять вони там, де на екрані стоять самі зони: тварини по боках, смітник
	 * під столом. Бокові — абсолютно, поза потоком: у потоці вони диктували б
	 * ширину страві, а колонці столу її й так обмаль. Смітник навпаки в потоці,
	 * і його висота зарезервована завжди — інакше ряд стрибав би під курсором.
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
			<img src={food.image} alt="" class="dish__image" loading="lazy" width="300" height="400" />
			<span class="dish__name">{@html formatFont(t(food.nameKey as TranslationKey))}</span>
		</button>

		{#each targets.filter((target) => target.place !== 'bottom') as target (target.id)}
			<button
				type="button"
				class="quick"
				class:quick--left={target.place === 'left'}
				class:quick--right={target.place === 'right'}
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

	{#each targets.filter((target) => target.place === 'bottom') as target (target.id)}
		<button
			type="button"
			class="quick quick--bottom"
			{disabled}
			onclick={(e) => {
				e.stopPropagation();
				onsend(target.id);
			}}
			aria-label={formatPlain(t(target.labelKey))}
			data-testid="feeding-quick-btn-{food.id}-{target.id}"
		>
			<Trash2 size={14} aria-hidden="true" />
		</button>
	{/each}
</div>

<style>
	.dish-slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	/* Опора для бокових кнопок: вони центруються по СТРАВІ, не по слоту. */
	.dish-slot__row {
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

	/*
	 * Суперeліпс, а не коло: у кола фото тварини обрізається сильніше за все,
	 * і мордочка з нього випадає. `corner-shape` дає справжню форму там, де його
	 * знають; де ні — лишається скруглений квадрат, і це теж читається.
	 *
	 * Менші за 44px тут свідомо: це скорочення, а не єдиний шлях. Ту саму дію
	 * робить кліком уся зона тварини, і вона на всю ширину (ACCESSIBILITY § 8).
	 */
	.quick {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		overflow: hidden;
		border: none;
		/*
		 * Суперeліпс |2x-1|⁴ + |2y-1|⁴ = 1 — та сама форма, що в іконок iOS.
		 * Двадцять вісім точок: на 26px крива вже гладка, а `clip-path` у
		 * відсотках масштабується разом із кнопкою.
		 *
		 * Не `corner-shape`: властивість робить те саме одним рядком, але
		 * `svelte-check` її ще не знає й дає попередження, а проєкт тримає нуль.
		 */
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

	/* Тварини — по боках страви, там-таки, де їхні зони на екрані. */
	.quick--left,
	.quick--right {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
	}

	.quick--left {
		left: -20px;
	}

	.quick--right {
		right: -20px;
	}

	/* Смітник — у потоці під стравою: так він і резервує собі місце, і стоїть
	   там, де сама зона смітника, тобто по центру внизу. */
	.quick--bottom {
		position: relative;
	}

	/*
	 * `:focus-within` тут і є доступ із клавіатури: `pointer-events: none` не
	 * заважає табуляції, тож фокус доходить до прозорої кнопки й тим-таки
	 * показує всі три. Задати `opacity` кнопці окремо не можна — вона й так на
	 * ній, тож просто перемикаємо її для всієї трійки.
	 */
	.dish-slot:hover .quick,
	.dish-slot:focus-within .quick,
	.dish-slot--picked .quick {
		opacity: 1;
		pointer-events: auto;
	}

	.quick:hover:not(:disabled) {
		filter: drop-shadow(0 0 4px var(--color-accent));
	}

	.quick--left:hover:not(:disabled),
	.quick--right:hover:not(:disabled) {
		transform: translateY(-50%) scale(1.15);
	}

	.quick--bottom:hover:not(:disabled) {
		transform: scale(1.15);
	}

	.quick__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
