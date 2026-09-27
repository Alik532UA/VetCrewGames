/**
 * Дія: під час гри тримати екран ПРОКРУЧЕНИМ ДОНИЗУ.
 *
 * Прохання автора 2026-09-28: «якщо є скрол, то скролиться тільки коли показує відповідь →
 * завжди скролити донизу, бо зверху елементи, які менш важливі, ніж ті, що знизу». Угорі
 * екрана гри — смужка раундів і картинка, унизу — варіанти й кнопка відповіді. Коли екран
 * не вміщається навіть на дні масштабу (`fitToViewport`), новий раунд відкривався згори, і
 * до кнопки треба було гортати самому. Прокручувала лише `revealScroll` — у мить розбору.
 *
 * ## Ключ — питання, на яке ще не відповіли
 *
 * На кожен НОВИЙ ключ дія притискає прокрутку донизу й тримає її там, поки екран осідає:
 * вантажаться картинки, масштаб підбирає своє число, розкладка росте. `null` вимикає її —
 * так сторінки гасять її на час розбору відповіді, підсумку й перегляду минулих питань.
 * Розбір показує `revealScroll`, і дві прокрутки навперегін дали б ривок.
 *
 * ## Людина головніша
 *
 * Прокрутила вгору сама — дія відпускає, доки не прийде новий ключ; повернулася донизу —
 * знову тримає. Чия прокрутка, видно з часу: власна триває до `OWN_SCROLL_MS` після
 * виклику, а решта — людини. Або браузера, що підрізав прокрутку під менший вміст, — але
 * тоді позиція й так унизу, і дія лишається притиснутою.
 *
 * Ввід людини (коліщатко, палець, клавіша) це вікно ЗАКРИВАЄ одразу. Без цього прокрутка
 * вгору в першу секунду після власної вважалася б власною — і дія тягла б людину назад на
 * найближчу ж зміну розміру. Так тест цієї дії спершу й проходив без самої дії: прокрутка
 * вгору влучала саме в це вікно.
 *
 * ## Прокрутник шукається, а не вгадується
 *
 * Найближчий предок, що прокручується (`overflow-y: auto | scroll`), а без такого —
 * документ. Сторінки ігор лежать у `.page-transition-wrapper`, але дія про нього не знає:
 * та сама сторінка стоїть і в інших обгортках (перегляд, кімната).
 */

/** Ключ питання: номер раунду, поки на нього ще не відповіли. `null` — не тримати. */
export type PinKey = string | number | null;

/**
 * Скільки тиші в розмірах чекати, перш ніж крутити. Те саме число, що в `fitToViewport`:
 * спершу осідає масштаб, і лише тоді відомо, де низ.
 */
export const SETTLE_MS = 140;

/** «Унизу» — з цим запасом: дробові пікселі масштабу не мусять вважатися прокруткою вгору. */
export const BOTTOM_SLACK_PX = 8;

/**
 * Скільки після власного виклику прокрутка вважається СВОЄЮ. Плавна прокрутка браузера
 * триває до ~0,5 с; події посеред неї — не людина, і на них дія не мусить себе відпускати.
 */
export const OWN_SCROLL_MS = 1000;

/** Ввід, за яким прокрутку веде людина. `pointerdown` — лише по самому прокрутнику: смуга. */
const USER_INPUT = ['wheel', 'touchstart', 'keydown'] as const;

function scrollParent(node: HTMLElement): HTMLElement {
	for (let el = node.parentElement; el; el = el.parentElement) {
		const overflow = getComputedStyle(el).overflowY;
		if (overflow === 'auto' || overflow === 'scroll') return el;
	}
	return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

export function pinToBottom(node: HTMLElement, key: PinKey) {
	if (typeof ResizeObserver === 'undefined') return;

	const scroller = scrollParent(node);
	// Документ шле `scroll` на `window`, а не на свій елемент.
	const events: EventTarget = scroller === document.scrollingElement ? window : scroller;
	const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let current = key;
	let pinned = key !== null;
	let ownUntil = 0;
	let pending: ReturnType<typeof setTimeout> | null = null;

	const atBottom = () =>
		scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= BOTTOM_SLACK_PX;

	function pin() {
		pending = null;
		if (current === null || !pinned || atBottom()) return;
		ownUntil = Date.now() + OWN_SCROLL_MS;
		scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
	}

	function schedule() {
		if (current === null) return;
		if (pending) clearTimeout(pending);
		pending = setTimeout(pin, SETTLE_MS);
	}

	function onScroll() {
		if (current === null || Date.now() < ownUntil) return;
		pinned = atBottom();
	}

	function onInput() {
		ownUntil = 0;
	}

	function onPointer(event: Event) {
		if (event.target === scroller) ownUntil = 0;
	}

	/*
	 * Розмір СТОРІНКИ й ПРОКРУТНИКА: перша росте разом із вмістом, коли він не вміщається
	 * (`flex: 1` не дає їй бути меншою за екран, але не тримає більшою), другий міняється
	 * разом із вікном.
	 */
	const sizes = new ResizeObserver(schedule);
	sizes.observe(node);
	sizes.observe(scroller);
	events.addEventListener('scroll', onScroll, { passive: true });
	for (const name of USER_INPUT) window.addEventListener(name, onInput, { passive: true });
	scroller.addEventListener('pointerdown', onPointer, { passive: true });
	schedule();

	return {
		update(next: PinKey) {
			if (next === current) return;
			current = next;
			pinned = next !== null;
			if (next !== null) {
				schedule();
				return;
			}
			if (pending) clearTimeout(pending);
			pending = null;
		},
		destroy() {
			if (pending) clearTimeout(pending);
			sizes.disconnect();
			events.removeEventListener('scroll', onScroll);
			for (const name of USER_INPUT) window.removeEventListener(name, onInput);
			scroller.removeEventListener('pointerdown', onPointer);
		}
	};
}
