<script lang="ts">
	import { tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { ChevronDown, X } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { countryLabel } from '$lib/config/countries';
	import { settings } from '$lib/services/settings.svelte';
	import { closeOnBackdrop } from '$lib/utils/closeOnBackdrop';
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
	 * | вибірник на всю висоту екрана на телефоні | вікно (`<dialog>`) на ~94% екрана скрізь |
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
		 * КОМПАКТНИЙ РЕЖИМ КНОПКИ: видно лише прапор, і він сам є кнопкою.
		 *
		 * Лише про КНОПКУ. Вигляд панелі від цього не залежить: прапори без запиту
		 * вона малює завжди — причина в `CountryMenu.svelte`.
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
	let trigger = $state<HTMLButtonElement | null>(null);

	const chosen = $derived(
		value === '' ? t('pairs.countryNone') : countryLabel(value, settings.locale, t)
	);

	let dialog = $state<HTMLDialogElement>();

	/**
	 * ВИБІР — ОКРЕМИМ ВІКНОМ майже на весь екран (прохання автора 2026-09-29: «окреме вікно,
	 * щоб більше 90% було зайнято активністю, по прикладу вибору аватарки»). Доти тут був
	 * випадний список під кнопкою — 15–25% екрана, і 262 прапори в ньому доводилося гортати.
	 *
	 * `<dialog>` і `showModal()` — як у `AvatarChooser`: верхній шар, `Escape`, фокус у вікні
	 * й неактивна сторінка під ним. Фокус після відкриття — у полі пошуку: з нього й працює
	 * вся клавіатура меню (`CountryMenu`), а платформа поставила б його на першу кнопку.
	 */
	async function openPanel(from = '') {
		seed = from;
		open = true;
		await tick();
		if (!dialog) return;
		if (typeof dialog.showModal === 'function') dialog.showModal();
		else dialog.setAttribute('open', '');
		dialog.querySelector<HTMLInputElement>('input')?.focus();
	}

	const closePanel = () => dialog?.close();

	/** Вікно закрилося — будь-як: вибір, `Escape`, «Закрити» чи клік по тлу. Фокус — на кнопку. */
	function closed() {
		open = false;
		trigger?.focus();
	}

	/**
	 * Вікно — у `<body>`, як і вибір аватарки: предки з `zoom` (`fitToViewport` хабу й лобі)
	 * збільшили б і його, і вікно на 90% екрана вийшло б за екран.
	 */
	const toBody: Attachment<HTMLDialogElement> = (node) => {
		document.body.appendChild(node);
		return () => node.remove();
	};

	/**
	 * Клавіатура на КНОПЦІ: стрілка вниз і будь-яка літера відкривають панель.
	 *
	 * Літера відкриває панель ІЗ НЕЮ — це те, що нативний `select` робив сам, і
	 * найдешевший спосіб його не втратити: набране одразу стає запитом. Пробіл
	 * навмисно НЕ перехоплюється: ним браузер натискає кнопку, і забрати це
	 * означало б зламати кнопку заради дії, якої ніхто не чекає.
	 */
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

<div class="country" class:country--compact={compact}>
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
		aria-haspopup="dialog"
		aria-expanded={open}
		aria-controls="{scope}-dialog"
		aria-labelledby="{scope}-label {scope}-value"
		data-testid="{scope}-select"
	>
		<span class="country__mark" aria-hidden="true"><Flag code={value} height={18} /></span>
		<span class="country__value" id="{scope}-value">{@html formatFont(chosen)}</span>
		<span class="country__chevron" aria-hidden="true"><ChevronDown size={16} /></span>
	</button>

	<dialog
		bind:this={dialog}
		id="{scope}-dialog"
		class="country__dialog"
		aria-labelledby="{scope}-dialog-title"
		onclose={closed}
		{@attach toBody}
		{@attach closeOnBackdrop}
		data-testid="{scope}-modal"
	>
		{#if open}
			<div class="country__window fill" data-testid="{scope}-panel">
				<div class="country__head">
					<h2 class="country__title" id="{scope}-dialog-title">
						{@html formatFont(t('pairs.country'))}
					</h2>
					<button
						type="button"
						class="country__close btn-secondary"
						onclick={closePanel}
						aria-label={t('common.close')}
						data-testid="{scope}-close-btn"
					>
						<X size={20} aria-hidden="true" />
					</button>
				</div>
				<CountryMenu
					{value}
					{scope}
					{seed}
					onpick={(code) => {
						value = code;
						closePanel();
					}}
				/>
			</div>
		{/if}
	</dialog>
</div>

<style>
	/*
	 * `relative` тут НЕ ПОТРІБЕН: вибір живе не в цій коробці, а у вікні в `<body>` (верхній
	 * шар `<dialog>`), тож позиціювати від неї нема чого.
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
	/*
	 * ВІКНО МАЙЖЕ НА ВЕСЬ ЕКРАН (прохання автора 2026-09-29, відповідь A: так скрізь, а не лише
	 * на телефоні). `<dialog>` — лише рамка верхнього шару: без полів, рамки й тла, щоб клік по
	 * ньому означав рівно «по тлу» (`closeOnBackdrop`). Поле довкола — від меншого боку екрана,
	 * 8–24px: вікно займає понад 90% і все ж читається як вікно, а не як нова сторінка.
	 */
	.country__dialog {
		--edge: clamp(8px, 2vmin, 24px);
		width: calc(100vw - 2 * var(--edge));
		height: calc(100dvh - 2 * var(--edge));
		max-width: none;
		max-height: none;
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		overflow: visible;
	}

	.country__dialog::backdrop {
		background: rgba(0, 0, 0, 0.55);
	}

	/*
	 * Та сама поверхня й ті самі кольори, що мав випадний список (`--color-bg-surface`,
	 * `--color-text`): їх уже бачив замір контрасту в усіх чотирьох темах. Кегель росте з
	 * екраном (`.fill`), а з ним — і плитки прапорів (`--flag-tile`, `CountryOption`): на
	 * великому екрані вікно на 90% із дрібними прапорами лишалося б порожнім.
	 */
	.country__window {
		--flag-tile: max(44px, calc(var(--fill-u) * 3.25));
		--flag-h: calc(var(--flag-tile) * 0.42);
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
		height: 100%;
		padding: var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-surface);
		color: var(--color-text);
		box-shadow: var(--shadow-card-hover);
		box-sizing: border-box;
	}

	.country__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.country__title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text);
	}

	/* 44px — дно сенсорної цілі (ACCESSIBILITY-v8 § 8); далі росте з кеглем вікна. */
	.country__close {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: max(44px, calc(var(--fill-u) * 2.75));
		height: max(44px, calc(var(--fill-u) * 2.75));
		padding: 0;
		border-radius: var(--radius-sm);
	}

	/* Значок росте разом із кнопкою: 20px у квадраті на 85px (Full HD) читалися як крапка. */
	.country__close :global(svg) {
		width: calc(var(--fill-u) * 1.25);
		height: calc(var(--fill-u) * 1.25);
	}
</style>
