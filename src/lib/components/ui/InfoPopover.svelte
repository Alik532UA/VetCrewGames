<script lang="ts">
	import { Info } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	/**
	 * КНОПКА `i` — і вікно ПОВЕРХ, а не блок усередині форми.
	 *
	 * ## Що було не так
	 *
	 * Довідка розкривалася в потоці картки: форма з'їжджала вниз, картка росла на
	 * висоту чотирьох абзаців, і поля, на які людина щойно дивилася, опинялися в
	 * іншому місці екрана. Автор сказав це прямо: «відкриває блок в середині
	 * контейнера; очікуваний результат — типове вікно поверх».
	 *
	 * Тому панель тут `position: absolute`, а не частина потоку: розкладка навколо
	 * не ворушиться зовсім.
	 *
	 * ## Чому це не модальне вікно
	 *
	 * Модальне забрало б фокус, затемнило б екран і вимагало б його повернути —
	 * тобто церемонію на чотири абзаци тексту. Тут же звичайне розкриття
	 * (`disclosure`): кнопка каже `aria-expanded`, панель має `id`, на який
	 * показує `aria-controls`, і жодної пастки фокуса. Скрінрідер оголошує стан
	 * кнопки, а не «діалог».
	 *
	 * ## Закривається трьома способами, і кожен потрібен
	 *
	 * Повторний натиск (те саме місце, звідки відкрили), Escape (клавіатура) і
	 * клік поза панеллю (мишка). `pointerdown` на вікні, а не підкладка на весь
	 * екран: підкладка ловила б `pointerdown` сама, а `click` після неї доходив би
	 * до кнопки й відкривав панель знову — цей дефект уже був у `HeaderMenu`. Той
	 * самий склад, що в `CountryPicker.svelte`, разом із причиною.
	 *
	 * Фокус вертається на кнопку лише після Escape і повторного натиску: коли
	 * панель закрила мишка, фокус щойно забрала вона, і смикати його назад
	 * означало б сперечатися з тим, що зробила людина.
	 */
	interface Props {
		/** Що читає скрінрідер і що показує підказка при наведенні. */
		label: string;
		/** Основа локаторів: `auth` дає `auth-info-btn` і `auth-info-panel`. */
		scope: string;
		children: Snippet;
	}

	let { label, scope, children }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);

	function close() {
		open = false;
		trigger?.focus();
	}
</script>

<svelte:window
	onpointerdown={(event) => {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}}
	onkeydown={(event) => {
		if (open && event.key === 'Escape') close();
	}}
/>

<div class="info" bind:this={root}>
	<button
		type="button"
		class="info__btn"
		bind:this={trigger}
		aria-expanded={open}
		aria-controls="{scope}-info"
		aria-label={label}
		title={label}
		onclick={() => (open ? close() : (open = true))}
		data-testid="{scope}-info-btn"
	>
		<Info size={18} aria-hidden="true" />
	</button>

	{#if open}
		<div class="info__panel text-panel" id="{scope}-info" data-testid="{scope}-info-panel">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.info {
		/* Коробка для панелі: без цього вона віднеслася б до предка вище. */
		position: relative;
		flex-shrink: 0;
	}

	/*
	 * 44px при іконці 18px — власний стандарт сенсорної цілі
	 * (ACCESSIBILITY-v8 § 8). Тут він особливо доречний: кнопка стоїть у куті, а
	 * кут — найгірше місце для маленької цілі на телефоні.
	 *
	 * Рамки немає навмисно: обведена, кнопка читалася б як ще одна дія поруч із
	 * головними, а це довідка.
	 */
	.info__btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text);
		cursor: pointer;
	}

	@media (hover: hover) {
		.info__btn:hover {
			background: color-mix(in srgb, var(--color-text), transparent 90%);
		}
	}

	.info__btn[aria-expanded='true'] {
		background: color-mix(in srgb, var(--color-text), transparent 88%);
	}

	/*
	 * ПАНЕЛЬ ТЯГНЕТЬСЯ ВЛІВО ВІД КНОПКИ (`right: 0`), а не праворуч від неї.
	 *
	 * Кнопка стоїть у правому куті картки, тож панель, вирівняна лівим краєм,
	 * вилізла б за екран на телефоні. `width: min(…, 78vw)` лишає видимою межу
	 * картки під нею — так видно, що це вікно поверх, а не новий блок.
	 *
	 * `z-index` той самий, що в панелі вибору країни (`CountryMenu` — 9500): вище
	 * за власну смугу прокрутки (8000) і нижче за меню шапки (9501).
	 *
	 * Висота обмежена й прокручується: чотири абзаци на телефоні в ландшафті не
	 * вміщаються, а панель, що виїхала за екран, гірша за панель зі смугою.
	 */
	.info__panel {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 9500;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: min(22rem, 78vw);
		max-height: min(60vh, 26rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-surface);
		box-shadow: var(--shadow-card-hover);
		text-align: left;
	}
</style>
