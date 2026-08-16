<script lang="ts">
	import { browser } from '$app/environment';
	import { Spring } from 'svelte/motion';
	import { MediaQuery } from 'svelte/reactivity';
	import { t, formatPlain } from '$lib/i18n';
	import { scrollbar } from '$lib/controllers/scrollbar.svelte';
	import { readMetrics, watchScroller } from '$lib/utils/scrollMetrics';

	/**
	 * Власна смуга прокрутки (SCROLLBAR-v8 § 4).
	 *
	 * Сама прокрутка лишається нативною: колесо, клавіатура, дотик, пошук по
	 * сторінці працюють як раніше. Компонент лише малює індикатор і дає тягнути.
	 *
	 * Прокручується тут НЕ сторінка, а `.page-transition-wrapper` — канонні
	 * `window.scrollY` і `window.scrollTo` тут не рухають нічого. Тому доріжка
	 * накриває коробку прокрутника (а не все вікно) і не лізе під шапку.
	 */

	/** Товщина у спокої та коли курсор поруч, px. */
	const REST_WIDTH = 10;
	const HOVER_WIDTH = 20;
	/** Найменша висота повзунка, щоб було за що вхопити на довгій сторінці. */
	const MIN_THUMB = 32;

	let scrollTop = $state(0);
	let scrollHeight = $state(1);
	let clientHeight = $state(1);
	/** Верх прокрутника у вікні: смуга накриває його, а не вікно. */
	let trackTop = $state(0);
	let windowWidth = $state(0);
	let mouseX = $state(Number.POSITIVE_INFINITY);
	let pointerInside = $state(false);
	let dragging = $state(false);
	/** Зсув місця захоплення від верху повзунка — щоб той не стрибав під курсор. */
	let grabOffset = 0;
	/** Верх доріжки, знятий ОДИН раз на початку жесту: rect у русі миші дорогий. */
	let dragTrackTop = 0;
	let pendingY = 0;
	let frame = 0;
	/** Хто тримає захват вказівника і для якого саме вказівника. */
	let capturedTrack: HTMLElement | null = null;
	let capturedPointerId = -1;
	/**
	 * Позиція повзунка під час жесту — прямо з курсора.
	 *
	 * Інакше виходить петля: рух → scrollTo → подія scroll → оновлення стану →
	 * перемальовування. Повзунок відстає щонайменше на кадр, і це відчувається.
	 */
	let dragThumbTop = $state(0);

	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const enabled = $derived(scrollbar.active === 'custom');
	const scrollable = $derived(scrollHeight > clientHeight + 1);
	/** Змонтована — поки обрано режим; ВИДИМА — поки є що прокручувати. */
	const visible = $derived(enabled && scrollable);

	const maxScroll = $derived(Math.max(scrollHeight - clientHeight, 1));
	/** Скільки повзунок мав би займати за поточної висоти вмісту. */
	const rawThumbHeight = $derived(
		Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB)
	);

	/**
	 * Висота повзунка пружинна: при переході між сторінками вона стрибає —
	 * коротка сторінка дає довгий повзунок і навпаки.
	 *
	 * Позиція навмисно НЕ анімується: вона мусить іти за курсором миттєво.
	 */
	const springHeight = new Spring(MIN_THUMB, { stiffness: 0.2, damping: 0.9 });
	$effect(() => {
		springHeight.target = rawThumbHeight;
	});
	const thumbHeight = $derived(springHeight.current);
	const maxThumbTop = $derived(Math.max(clientHeight - thumbHeight, 0));

	const thumbTop = $derived.by(() => {
		if (dragging) return dragThumbTop;
		return (scrollTop / maxScroll) * maxThumbTop;
	});

	const target = $derived.by(() => {
		if (!visible || reducedMotion.current) return 0;
		if (dragging) return 1;
		if (!pointerInside || !windowWidth) return 0;
		const start = 0.18 * windowWidth;
		const end = 0.02 * windowWidth;
		const distance = windowWidth - mouseX;
		if (distance > start) return 0;
		if (distance < end) return 1;
		return (start - distance) / (start - end);
	});

	const progress = new Spring(0, { stiffness: 0.05, damping: 0.4 });
	$effect(() => {
		progress.target = target;
	});

	/**
	 * Поява й зникнення. Жорсткіша за пружину наближення: тут не потрібна
	 * м'якість, потрібно швидко прибрати смугу зі сторінки, яка вся вмістилася.
	 */
	const presence = new Spring(0, { stiffness: 0.15, damping: 0.8 });
	$effect(() => {
		presence.target = visible ? 1 : 0;
	});

	const width = $derived(REST_WIDTH + (HOVER_WIDTH - REST_WIDTH) * progress.current);

	function measure() {
		const el = scrollbar.scroller;
		if (!browser || !el) return;
		({ scrollTop, scrollHeight, clientHeight, trackTop } = readMetrics(el));
	}

	$effect(() => {
		const el = scrollbar.scroller;
		if (!enabled || !el) return;
		measure();
		return watchScroller(el, measure);
	});

	/** Прокрутити так, щоб повзунок опинився під курсором. */
	function applyScroll() {
		frame = 0;
		const el = scrollbar.scroller;
		if (!el || maxThumbTop <= 0) return;
		const clamped = Math.min(Math.max(pendingY - dragTrackTop - grabOffset, 0), maxThumbTop);
		dragThumbTop = clamped;
		// `instant`, а не `auto`: `auto` бере значення з CSS `scroll-behavior`, і
		// кожен рух миші запускав би власну плавну анімацію.
		el.scrollTo({ top: (clamped / maxThumbTop) * maxScroll, behavior: 'instant' });
	}

	/** Рухи миші йдуть частіше за кадри — зайві просто відкидаємо. */
	function requestScroll(clientY: number) {
		pendingY = clientY;
		if (!frame) frame = requestAnimationFrame(applyScroll);
	}

	function onTrackPointerDown(e: PointerEvent) {
		// Гасить сумісні мишачі події, з яких браузер починає виділення, а біля
		// краю вікна виділення вмикає власний автоскрол — і два скроли б'ються.
		e.preventDefault();

		const track = e.currentTarget as HTMLElement;
		dragTrackTop = track.getBoundingClientRect().top;
		const localY = e.clientY - dragTrackTop;

		// Натиск по повзунку — тягнемо з того місця, за яке взяли. Повз нього —
		// спершу переносимо повзунок ЦЕНТРОМ під курсор.
		const onThumb = localY >= thumbTop && localY <= thumbTop + thumbHeight;
		grabOffset = onThumb ? localY - thumbTop : thumbHeight / 2;
		dragThumbTop = thumbTop;

		dragging = true;
		// Перед захватом: виняток у ньому не має проглинути початковий стрибок.
		requestScroll(e.clientY);
		try {
			track.setPointerCapture(e.pointerId);
			capturedTrack = track;
			capturedPointerId = e.pointerId;
		} catch {
			// Доріжка завширшки 10px губить курсор від найменшого зсуву вбік, тож
			// жест насправді несе слухач на `window`.
		}
	}

	/**
	 * Без аргументу: викликається і з доріжки, і з `window`, а знімати захват
	 * треба з елемента, який його взяв, а не з випадкової цілі події.
	 */
	function endDrag() {
		if (!dragging) return;
		dragging = false;
		if (frame) {
			cancelAnimationFrame(frame);
			frame = 0;
		}
		if (capturedTrack !== null) {
			try {
				capturedTrack.releasePointerCapture(capturedPointerId);
			} catch {
				// Уже знято — браузером або разом з елементом.
			}
			capturedTrack = null;
		}
	}
</script>

<svelte:window
	bind:innerWidth={windowWidth}
	onpointermove={(e) => {
		// Під час жесту рух несе цей слухач, а не обробник доріжки: 10px ширини
		// губляться від найменшого зсуву вбік, і захвату може не бути взагалі.
		if (dragging) {
			requestScroll(e.clientY);
			return;
		}
		mouseX = e.clientX;
		pointerInside = true;
	}}
	onpointerup={endDrag}
	onpointercancel={endDrag}
	onpointerleave={() => (pointerInside = false)}
	onresize={measure}
/>

<!-- Умова — `enabled`, а не `visible`: інакше зникнення нічим анімувати. -->
{#if enabled}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="page-scrollbar"
		class:dragging
		class:page-scrollbar--hidden={presence.current < 0.01}
		style="top: {trackTop}px; height: {clientHeight}px; width: {width}px;
			opacity: {presence.current}; transform: translateX({(1 - presence.current) * width}px);"
		aria-label={formatPlain(t('scrollbar.title'))}
		data-testid="page-scrollbar-container"
		oncontextmenu={(e) => {
			e.preventDefault();
			scrollbar.openMenu(e.clientX, e.clientY);
		}}
		onpointerdown={onTrackPointerDown}
		onpointerup={endDrag}
		onpointercancel={endDrag}
	>
		<div
			class="page-scrollbar__thumb"
			style="top: {thumbTop}px; height: {thumbHeight}px;"
			data-testid="page-scrollbar-thumb-status"
		></div>
	</div>
{/if}

<style>
	.page-scrollbar {
		position: fixed;
		right: 0;
		/* Верх і висота — зі скрипта: смуга накриває прокрутник, а не вікно. */
		z-index: 8000;
		background: color-mix(in srgb, var(--color-scrollbar-track), transparent 30%);
		/* Тінь обов'язкова: без неї накладка зливається зі сторінкою, бо тло в неї
		   майже те саме. Тінь читається на будь-якій темі, на відміну від
		   світлішого або темнішого тла. */
		box-shadow: -6px 0 18px rgba(0, 0, 0, 0.22);
		cursor: pointer;
		touch-action: none;
		/* Успадковується повзунком: натиск на доріжці не має починати виділення,
		   бо біля краю вікна воно вмикає автоскрол браузера. */
		user-select: none;
		-webkit-user-select: none;
	}

	/* Поїхала за край — не перехоплює натиски й не читається читалками. */
	.page-scrollbar--hidden {
		pointer-events: none;
		visibility: hidden;
	}

	.page-scrollbar__thumb {
		position: absolute;
		left: 2px;
		right: 2px;
		background: var(--color-scrollbar-thumb);
		border-radius: 999px;
		/* Індикатор, не ціль: натиск мусить долітати до доріжки, яка й веде жест.
		   Інакше натиск по повзунку й повз нього починаються на різних елементах. */
		pointer-events: none;
		transition: background var(--transition-fast);
	}

	.page-scrollbar:hover .page-scrollbar__thumb,
	.page-scrollbar.dragging .page-scrollbar__thumb {
		background: var(--color-accent);
	}

	@media print {
		.page-scrollbar {
			display: none;
		}
	}
</style>
