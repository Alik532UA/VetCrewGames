<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { countryLabel } from '$lib/config/countries';
	import { settings } from '$lib/services/settings.svelte';
	import Flag from './Flag.svelte';
	import CountryMenu from './CountryMenu.svelte';

	/**
	 * Вибір країни: кнопка з прапором і власне меню з розділами за регіонами.
	 *
	 * ## Чому НЕ нативний `<select>`, хоч він тут і був
	 *
	 * Доти цей файл доводив протилежне: 262 пункти, прокрутка, пошук, клавіатура
	 * й фокус-пастка «вже є в нативному елементі». Усе перелічене справді є.
	 * Немає в ньому одного — ТЕМИ, і саме про це прийшла скарга: «в деяких темах
	 * світлий текст на світлому фоні».
	 *
	 * ЗАМІРЯНО В БРАУЗЕРІ, а не виведено з міркувань. Обчислений
	 * `background-color` у `<option>` — `rgba(0, 0, 0, 0)` в УСІХ чотирьох
	 * темах: жоден токен у випадний список не доїжджав, бо його малює не
	 * сторінка. Єдине, що з теми туди попадало, — успадкований `color`. Далі
	 * арифметика:
	 *
	 * | тема          | колір тексту | на світлому списку | на темному списку |
	 * | ------------- | ------------ | ------------------ | ----------------- |
	 * | dark          | `#e5e5e5`    | **1.26:1**         | 8.89:1            |
	 * | orange-purple | `#f0e6ff`    | **1.20:1**         | 9.32:1            |
	 * | light-green   | `#262626`    | 15.13:1            | **1.35:1**        |
	 * | winter        | `#1a2b4d`    | 14.03:1            | **1.25:1**        |
	 *
	 * Тобто в КОЖНІЙ темі є розфарбування списку, за якого текст на ньому давав
	 * 1,2–1,35 при потрібних 4,5 — і вибирав це розфарбування не проєкт.
	 * Десктопний Chrome бере `color-scheme` (тоді щастить), Android відкриває
	 * власний діалог, який світлий завжди (тоді щастить рівно світлим темам).
	 * Це не дефект кольору, який можна виправити кольором: тло було не наше.
	 *
	 * Гейт цього не бачив і не міг: `tests/contrast-runtime.spec.ts` міряє DOM, а
	 * випадного списку в DOM немає взагалі.
	 *
	 * ## Що втрачено разом із нативним елементом, і чим замінено
	 *
	 * | Було безкоштовно                          | Тепер                             |
	 * | ----------------------------------------- | --------------------------------- |
	 * | вибірник на всю висоту екрана на телефоні | панель на все вільне місце під кнопкою (заміряне, не `vh`) |
	 * | пошук набором літер                       | поле пошуку; літера на кнопці відкриває панель уже з нею |
	 * | стрілки, Home/End, Enter, Escape          | ті самі клавіші на полі пошуку, плюс стрілки вбік по колонках |
	 *
	 * ## Взірець
	 *
	 * Вибір мови в сусідньому `CV` (`HeaderSection.svelte`): кнопка-тригер, поле
	 * пошуку в панелі, групи в незмінному порядку, стрілки на самій панелі й
	 * розділи, розкладені в кілька колонок. Узято будову, не код, і масштаб тут
	 * інший: там чотири десятки мов, які вміщаються всі, тут 262 країни — тобто
	 * колонки колонками, а прокрутка лишається, і найбільший розділ у неї не
	 * влазить (як саме це вирішено — у стилях `CountryMenu.svelte`). Локальний
	 * родич — `components/HeaderMenu.svelte`; звідти взято ЗАМІРЯНІ там кольори
	 * станів.
	 *
	 * ## Розподіл між файлами
	 *
	 * Тут — кнопка, її підпис і стан «відкрито». Панель зі списком, пошуком і
	 * клавіатурою — `CountryMenu.svelte`; причина розділення названа в ньому.
	 */
	interface Props {
		/** Код країни. Порожній рядок — «без прапора». Двобічне. */
		value: string;
		/** Основа `data-testid`: `pairs-country` дає `pairs-country-select`. */
		scope: string;
		/**
		 * КОМПАКТНИЙ РЕЖИМ: видно лише прапор, і він сам є кнопкою.
		 *
		 * Потрібен там, де прапор стоїть ПЕРЕД ніком, а не окремим рядком: підпис
		 * «Прапор» над полем на п'ятсот пікселів ширини читався як ще одне
		 * налаштування, хоч це частина того самого підпису гравця.
		 *
		 * Підпис при цьому лишається в DOM візуально прихованим — це єдине, що
		 * називає контрол для скрінрідера; `title` його не заміняє (браузери
		 * читають `title` не завжди й не першим).
		 */
		compact?: boolean;
	}

	let { value = $bindable(), scope, compact = false }: Props = $props();

	let open = $state(false);
	/** Із чого починається пошук у щойно відкритій панелі. Див. `onTriggerKeydown`. */
	let seed = $state('');
	let root = $state<HTMLElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);

	const chosen = $derived(
		value === '' ? t('pairs.countryNone') : countryLabel(value, settings.locale, t)
	);

	function openPanel(from = '') {
		seed = from;
		open = true;
	}

	function closePanel() {
		open = false;
		trigger?.focus();
	}

	/**
	 * Клавіатура на КНОПЦІ: стрілка вниз і будь-яка літера відкривають панель.
	 *
	 * Літера відкриває панель ІЗ НЕЮ — це те, що нативний `select` робив сам, і
	 * найдешевший спосіб його не втратити: набране одразу стає запитом. Пробіл
	 * навмисно НЕ перехоплюється: ним браузер натискає кнопку, і забрати це
	 * означало б зламати кнопку заради дії, якої ніхто не чекає.
	 */
	/**
	 * Чи належить клік цьому вибірнику. ДВА місця, а не одне.
	 *
	 * Панель живе в `<body>`, а не в цьому вузлі (причина — у
	 * `utils/menuColumns.ts`), тож `root.contains` про неї не знає. Без другої
	 * перевірки клік по країні закривав би панель ДО того, як вибір дійде: сам
	 * вибір ще спрацював би (він на `click`, а це `pointerdown`), але панель
	 * блимала б, а прокрутка списку мишкою закривала б її на першому ж натиску.
	 *
	 * За `data-testid`, а не за посиланням на вузол: панель віддавати назовні
	 * нема потреби, а цей атрибут у неї є завжди — на ньому тримається весь
	 * `tests/country-menu.spec.ts`.
	 */
	function inside(target: EventTarget | null): boolean {
		const node = target as Node | null;
		if (!node) return false;
		if (root?.contains(node)) return true;
		return !!(node as Element).closest?.(`[data-testid="${scope}-menu"]`);
	}

	function onTriggerKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			openPanel();
			return;
		}
		const printable =
			event.key.length === 1 &&
			!event.ctrlKey &&
			!event.metaKey &&
			!event.altKey &&
			event.key !== ' ';
		if (printable) {
			event.preventDefault();
			openPanel(event.key);
		}
	}
</script>

<!--
	Клік ПОЗА компонентом закриває панель.

	`pointerdown` на вікні, а не підкладка на весь екран: підкладка ловила б
	`pointerdown` сама, а `click` після неї доходив би до кнопки й відкривав
	панель знову — цей дефект уже був у `HeaderMenu`. Перевірка вмісту замість
	`stopPropagation` на кнопці: так само працює й тоді, коли на сторінці стоять
	два вибірники. Фокус тут НЕ вертається на кнопку — його щойно забрала мишка, і
	смикати його назад означало б сперечатися з тим, що зробила людина.
-->
<svelte:window
	onpointerdown={(event) => {
		if (open && !inside(event.target)) open = false;
	}}
/>

<div class="country" class:country--compact={compact} bind:this={root}>
	<label class="country__label" id="{scope}-label" for="{scope}-select">
		<span>{@html formatFont(t('pairs.country'))}</span>
	</label>

	<!--
		НАЗВА КОНТРОЛУ — `aria-labelledby` із ДВОХ частин: підпис і поточне
		значення. Разом читалка вимовляє «Прапор, Україна» — те саме, що казав
		нативний `select`. Одного `for`/`id` на `<label>` для цього не досить:
		підпис перекрив би вміст кнопки, і назви країни не було б чути зовсім.
		`for` при цьому лишається — ним підпис клікається (`<button>` за
		специфікацією labelable).
	-->
	<button
		type="button"
		id="{scope}-select"
		class="country__trigger"
		bind:this={trigger}
		onclick={() => (open ? closePanel() : openPanel())}
		onkeydown={onTriggerKeydown}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-labelledby="{scope}-label {scope}-value"
		data-testid="{scope}-select"
	>
		<span class="country__mark" aria-hidden="true"><Flag code={value} height={18} /></span>
		<span class="country__value" id="{scope}-value">{@html formatFont(chosen)}</span>
		<span class="country__chevron" aria-hidden="true"><ChevronDown size={16} /></span>
	</button>

	{#if open}
		<CountryMenu
			{value}
			{scope}
			{seed}
			{compact}
			anchor={trigger}
			onpick={(code) => {
				value = code;
				closePanel();
			}}
			onclose={closePanel}
		/>
	{/if}
</div>

<style>
	/*
	 * `relative` тут БІЛЬШЕ НЕ ПОТРІБЕН і навмисно прибраний: панель більше не
	 * позиціюється від цієї коробки — вона живе в `<body>` і стоїть за заміром
	 * кнопки (`utils/menuColumns.ts`). Лишити його означало б лишити підказку, що
	 * панель усередині, — а саме це припущення й було дефектом.
	 */
	.country {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.country__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Кнопка міряється НЕ вмістом: назви країн різної довжини («Чад» і
	 * «Центральноафриканська Республіка»), і кнопка, що міряється написом,
	 * стрибала б на кожному виборі.
	 */
	.country__trigger {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		width: 100%;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		padding: 0 var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		cursor: pointer;
	}

	/* Назва обрізається, а не розпирає кнопку й не переносить рядок. */
	.country__value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	/*
	 * Місце під прапор фіксоване: `Flag` навмисно не малює нічого для порожнього
	 * й невідомого коду, і без цієї ширини напис стрибав би між станами.
	 */
	.country__mark {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 27px;
	}

	.country__chevron {
		display: flex;
		flex-shrink: 0;
		align-items: center;
	}

	/*
	 * КОМПАКТНИЙ РЕЖИМ: прапор — сама кнопка.
	 *
	 * Прапор усередині 18px, решта — область натискання, тобто ціль 44px без
	 * роздування рядка. Тла й рамки в кнопки немає: у ряду з полем імені вона
	 * мусить читатися як прапор, а не як друге поле.
	 */
	.country--compact {
		flex-direction: row;
	}

	.country--compact .country__label {
		/* Не `display: none`: підпис мусить лишитися для скрінрідера. */
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.country--compact .country__trigger {
		width: 44px;
		height: 44px;
		padding: 0;
		justify-content: center;
		gap: 0;
		border: none;
		background: none;
	}

	/*
	 * Назва країни в компактному режимі лишається в DOM, але не на екрані: вона
	 * потрібна `aria-labelledby`, щоб читалка вимовила «Прапор, Україна». Значок
	 * стрілки просто зникає — там, де кнопка це сам прапор, він зайвий.
	 */
	.country--compact .country__value {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.country--compact .country__chevron {
		display: none;
	}

	@media (hover: hover) {
		.country--compact .country__trigger:hover {
			background: color-mix(in srgb, var(--color-text), transparent 90%);
		}
	}
</style>
