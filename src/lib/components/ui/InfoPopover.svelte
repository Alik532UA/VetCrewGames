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
	 * ## Чому платформа, а не саморобка
	 *
	 * Доти тут стояли три власні механізми: `$state` на відкритість, обробник
	 * `Escape` на вікні, обробник `pointerdown` на вікні — і `z-index: 9500`,
	 * підібраний між смугою прокрутки (8000) і меню шапки (9501). Кожен із них —
	 * рядок, який може розійтися з сусідами; разом вони й дали той дефект, що вже
	 * ловився в проєкті: панель, яку видно НЕ поверх усього.
	 *
	 * `popover="auto"` віддає все це браузерові (UI-ELEMENTS-v8 § 1A.2):
	 *
	 *  * **верхній шар** — поверх усього без жодного `z-index`, тож гонка чисел
	 *    зникає як явище, а не виграється черговою дев'яткою;
	 *  * **Escape** і **клік поза межами** — вбудовані, причому «легке
	 *    відхилення» закриває ОДИН шар, а не всі одразу, як зробив би власний
	 *    обробник на вікні;
	 *  * **фокус** повертається на кнопку сам;
	 *  * `popovertarget` на кнопці знімає давню пастку повторного натиску: клік по
	 *    тлу закрив би панель, а `click`, що дійшов до кнопки, відкрив би її знову.
	 *    Браузер знає свого викликача й другого відкриття не робить. Саме цей
	 *    дефект колись був у `HeaderMenu`.
	 *
	 * ## Чому це не модальне вікно
	 *
	 * Модальне забрало б фокус, затемнило б екран і вимагало б його повернути —
	 * тобто церемонію на чотири абзаци тексту. `popover="auto"` навмисно НЕ
	 * модальний: фон лишається доступним, пастки фокуса немає. Для справжньої
	 * модалки був би `dialog` із `showModal()`.
	 *
	 * ## Місце панелі — задача коду, а не API
	 *
	 * Popover API не позиціює нічого. Тут це роблять CSS-якорі: кнопка оголошує
	 * `anchor-name`, панель тягнеться від неї вліво-вниз. Жодного JS і жодного
	 * вимірювання — а отже, нічого, що доводиться перераховувати на прокрутку.
	 *
	 * Там, де якорів ще немає, `anchor()` недійсний, і вся група властивостей
	 * відпадає — лишається типова поведінка браузера: панель посеред екрана. Тому
	 * запасний варіант оголошений САМЕ так — через `@supports`, а не поверх нього:
	 * якби `margin: 0` стояло без умови, панель без якорів розтяглася б на все
	 * вікно. Довідка посеред екрана — це нормально; довідка на весь екран — ні.
	 */
	interface Props {
		/** Що читає скрінрідер і що показує підказка при наведенні. */
		label: string;
		/** Основа локаторів: `auth` дає `auth-info-btn` і `auth-info-panel`. */
		scope: string;
		children: Snippet;
	}

	let { label, scope, children }: Props = $props();

	/*
	 * Стан тут ЛИШЕ для `aria-expanded` — самим показом керує браузер.
	 *
	 * Обчислювати `aria-expanded` для викликача з `popovertarget` браузери вже
	 * вміють, але не всі й не однаково, а стан кнопки — це те, що скрінрідер
	 * оголошує вголос. Один рядок надійніше за припущення про версію.
	 */
	let open = $state(false);
</script>

<div class="info">
	<button
		type="button"
		class="info__btn"
		popovertarget="{scope}-info"
		aria-expanded={open}
		aria-controls="{scope}-info"
		aria-label={label}
		title={label}
		data-testid="{scope}-info-btn"
	>
		<Info size={18} aria-hidden="true" />
	</button>

	<div
		class="info__panel text-panel"
		id="{scope}-info"
		popover="auto"
		ontoggle={(event) => (open = event.newState === 'open')}
		data-testid="{scope}-info-panel"
	>
		{@render children()}
	</div>
</div>

<style>
	.info {
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
		/* Ім'я якоря — те, за що чіпляється панель у верхньому шарі. */
		anchor-name: --info-trigger;
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
	 * Вигляд панелі — спільний для обох випадків; місце задає блок `@supports`
	 * нижче. `z-index` тут немає й бути не може: верхній шар вище за будь-яке
	 * число, і саме тому цей компонент більше не бере участі в гонці 8000/9500/9501.
	 *
	 * Висота обмежена й прокручується: чотири абзаци на телефоні в ландшафті не
	 * вміщаються, а панель, що виїхала за екран, гірша за панель зі смугою.
	 */
	.info__panel {
		/*
		 * `display: none` у базі — і саме воно робить компонент безпечним там, де
		 * Popover API ще немає: селектор `:popover-open` у такому браузері
		 * НЕДІЙСНИЙ, отже правило нижче відпадає цілком, і панель просто не
		 * зʼявляється. Без цього вона висіла б у картці розгорнутою завжди — тобто
		 * рівно той дефект, заради якого компонент і писався.
		 */
		display: none;
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
		opacity: 0;
		translate: 0 -8px;
		/*
		 * `display` і `overlay` у переході обовʼязкові разом із `allow-discrete`:
		 * без них браузер знімає `display: none` і виводить елемент із верхнього
		 * шару миттєво, і ЗНИКНЕННЯ не анімується взагалі — при тому, що поява
		 * виглядає правильно, тож дефект помічають пізно (UI-ELEMENTS-v8 § 1A.1).
		 */
		transition:
			opacity 160ms ease,
			translate 160ms ease,
			overlay 160ms allow-discrete,
			display 160ms allow-discrete;
	}

	.info__panel:popover-open {
		display: flex;
		opacity: 1;
		translate: 0 0;
	}

	/* Стан, ІЗ якого йде перехід у момент появи. Без нього переходу не буде зовсім:
	   щойно доданий у верхній шар елемент не має «попереднього» стану, тож і
	   переходити нема звідки. Обхід через `requestAnimationFrame` тут не потрібен. */
	@starting-style {
		.info__panel:popover-open {
			opacity: 0;
			translate: 0 -8px;
		}
	}

	/*
	 * ПАНЕЛЬ ТЯГНЕТЬСЯ ВЛІВО ВІД КНОПКИ, а не праворуч від неї: кнопка стоїть у
	 * правому куті картки, тож панель, вирівняна лівим краєм, вилізла б за екран
	 * на телефоні.
	 *
	 * `position-area` замість пари `top`/`right` — щоб `position-try-fallbacks`
	 * мав що перевертати: коли внизу місця немає, панель сама стає над кнопкою.
	 * Доти цього не було зовсім, і панель просто зрізало краєм екрана.
	 */
	@supports (anchor-name: --probe) {
		/*
		 * Імʼя якоря видиме лише всередині свого компонента. Без цього дві довідки
		 * на одній сторінці ділили б одне імʼя, і друга панель чіплялася б до чужої
		 * кнопки — дефект, який зʼявився б не зараз, а від наступного використання.
		 */
		.info {
			anchor-scope: --info-trigger;
		}

		.info__panel {
			position: fixed;
			inset: auto;
			margin: 0;
			position-anchor: --info-trigger;
			position-area: block-end span-inline-start;
			margin-block-start: 6px;
			position-try-fallbacks: flip-block;
		}
	}
</style>
