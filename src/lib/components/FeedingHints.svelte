<script lang="ts">
	import { t, formatPlain } from '$lib/i18n';
	import type { Food } from '$lib/config/feeding-game';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Натяки в порожній зоні: що сюди взагалі можна покласти.
	 *
	 * Порожня зона без них нічого про себе не каже — рамка й підпис не
	 * показують, що це ціль. Заразом натяк — найкоротший шлях: клік по ньому
	 * кладе саме цю страву, без проміжного «взяти».
	 *
	 * Показувати їх можна ЛИШЕ з порожніми руками. Зі стравою в руках зона вже
	 * означає «поклади те, що тримаєш», і натяк усередині неї означав би
	 * протилежне — див. `showHints` у FeedingZone.
	 */
	interface Props {
		foods: Food[];
		onpick: (food: Food) => void;
		/** Префікс зони: `data-testid` натяку добудовується з нього. */
		zoneTestId: string;
	}

	let { foods, onpick, zoneTestId }: Props = $props();
</script>

<div class="hints">
	{#each foods as food (food.id)}
		<button
			type="button"
			class="hint"
			onclick={(e) => {
				// Зона під натяком теж ловить кліки: без цього спрацювали б обидва.
				e.stopPropagation();
				onpick(food);
			}}
			aria-label={formatPlain(t(food.nameKey as TranslationKey))}
			data-testid="{zoneTestId}-hint-btn-{food.id}"
		>
			<img src={food.image} alt="" class="hint__image" loading="lazy" width="300" height="400" />
		</button>
	{/each}
</div>

<style>
	/*
	 * Ряд НЕ переноситься, і це не смак.
	 *
	 * У тарілки зарезервовано 64px висоти, щоб дошка не стрибала. Три мініатюри
	 * по 34px просять 110px, а на телефоні 390×844 тарілці лишається 106.59 —
	 * бракує трьох пікселів, ряд стає двома, і тарілка виростає до 95px. Дошка
	 * через це сіпалася на 31px щоразу, коли натяки зникали.
	 *
	 * Самого `flex-shrink` мало: за `flex-wrap: wrap` браузер спершу переносить
	 * і лише потім стискає. Заборона переносу міняє порядок — мініатюри
	 * стискаються до 32.9px, на око те саме.
	 */
	.hints {
		display: flex;
		flex-wrap: nowrap;
		justify-content: center;
		align-items: center;
		gap: var(--space-xs);
		width: 100%;
		min-width: 0;
	}

	/*
	 * Натяк — та сама картка, лише напівпрозора: 25% у спокої, 75% під курсором.
	 * 34px — бажана ширина, а не тверда: за тісного ряду мініатюра стискається,
	 * і висота йде за нею через `aspect-ratio`.
	 */
	.hint {
		display: flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		flex: 0 1 34px;
		aspect-ratio: 3 / 4;
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

	/* Дрібніше за покладену страву: натяк не має важити стільки ж, скільки
	   зроблений хід. Пропорція — на коробці, зображення просто її заповнює. */
	.hint__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: calc(var(--radius-sm) - 2px);
	}
</style>
