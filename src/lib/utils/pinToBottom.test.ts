import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { OWN_SCROLL_MS, pinToBottom, SETTLE_MS } from './pinToBottom';

/**
 * Дію перевіряють тут, а не в браузері, з тієї самої причини, що й `revealScroll`: розміри
 * й прокрутка в прихованій панелі не рухаються, тож «чекає, поки осяде» й «відпускає, коли
 * людина крутнула сама» там не відтворити. `ResizeObserver` підроблений і смикається рукою,
 * а висоти прокрутника задані числами.
 */

type RoCallback = () => void;
const observers: { callback: RoCallback; disconnected: boolean }[] = [];

class FakeResizeObserver {
	#entry: { callback: RoCallback; disconnected: boolean };
	constructor(callback: RoCallback) {
		this.#entry = { callback, disconnected: false };
		observers.push(this.#entry);
	}
	observe() {}
	disconnect() {
		this.#entry.disconnected = true;
	}
}

/** Сторінка змінила розмір: спостерігач це помітив. */
const resize = () => observers.filter((o) => !o.disconnected).forEach((o) => o.callback());

const metrics = { scrollHeight: 2000, clientHeight: 600, scrollTop: 0 };
let scroller: HTMLElement;
let node: HTMLElement;
let scrollTo: Mock<(options: ScrollToOptions) => void>;
let reducedMotion = false;

/** Людина (чи браузер) прокрутила до `top`. */
function scrollBy(top: number) {
	metrics.scrollTop = top;
	scroller.dispatchEvent(new Event('scroll'));
}

const BOTTOM = () => metrics.scrollHeight - metrics.clientHeight;

beforeEach(() => {
	vi.useFakeTimers();
	observers.length = 0;
	reducedMotion = false;
	Object.assign(metrics, { scrollHeight: 2000, clientHeight: 600, scrollTop: 0 });
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);
	vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));

	// Прокрутник — НЕ прямий батько: дія мусить знайти його сама.
	scroller = document.createElement('div');
	scroller.style.overflowY = 'auto';
	for (const name of ['scrollHeight', 'clientHeight'] as const) {
		Object.defineProperty(scroller, name, { get: () => metrics[name], configurable: true });
	}
	Object.defineProperty(scroller, 'scrollTop', {
		get: () => metrics.scrollTop,
		set: (value: number) => (metrics.scrollTop = value),
		configurable: true
	});
	scrollTo = vi.fn<(options: ScrollToOptions) => void>();
	scroller.scrollTo = scrollTo as unknown as HTMLElement['scrollTo'];

	const wrapper = document.createElement('div');
	node = document.createElement('div');
	wrapper.append(node);
	scroller.append(wrapper);
	document.body.append(scroller);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	scroller.remove();
});

describe('pinToBottom', () => {
	it('перевірка жива: без дії прокрутки не буває', () => {
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('новий раунд — донизу, один раз, коли все осіло', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS - 1);
		expect(scrollTo).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(scrollTo).toHaveBeenCalledTimes(1);
		expect(scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' });
	});

	/** Поки масштаб і картинки ще рухаються, низ ще не там, де буде. */
	it('поки сторінка росте — не крутить, а після зупинки крутить один раз', () => {
		pinToBottom(node, 1);
		for (let elapsed = 0; elapsed < 400; elapsed += 16) {
			resize();
			vi.advanceTimersByTime(16);
		}
		expect(scrollTo).not.toHaveBeenCalled();

		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	it('коли вже внизу — не крутить', () => {
		metrics.scrollTop = BOTTOM();
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('без ключа (розбір, підсумок, перегляд) — не крутить зовсім', () => {
		pinToBottom(node, null);
		resize();
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('людина прокрутила вгору — дія відпускає, і ріст сторінки її не повертає', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		scrollBy(BOTTOM());
		scrollTo.mockClear();

		vi.advanceTimersByTime(OWN_SCROLL_MS);
		scrollBy(300);
		resize();
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('людина повернулася донизу — дія знову тримає', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS + OWN_SCROLL_MS);
		scrollBy(300);
		scrollBy(BOTTOM());
		scrollTo.mockClear();

		metrics.scrollHeight = 2400;
		resize();
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).toHaveBeenCalledWith({ top: 2400, behavior: 'smooth' });
	});

	/** Плавна прокрутка шле події посеред руху — це не людина, і відпускати не можна. */
	it('події посеред власної прокрутки не відпускають дію', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		scrollBy(500);
		scrollTo.mockClear();

		metrics.scrollHeight = 2400;
		resize();
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	/**
	 * Дефект, який знайшов e2e цієї дії: прокрутка вгору в першу секунду після власної
	 * вважалася власною, і дія тягла людину назад. Ввід людини це вікно закриває.
	 */
	it('людина крутнула посеред власної прокрутки — це вже її прокрутка', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		scrollTo.mockClear();

		window.dispatchEvent(new Event('wheel'));
		scrollBy(0);
		metrics.scrollHeight = 2400;
		resize();
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('натиск на саму смугу прокрутки — теж ввід людини, а натиск на кнопку в сторінці — ні', () => {
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		node.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		scrollBy(500);
		scrollTo.mockClear();
		metrics.scrollHeight = 2400;
		resize();
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo, 'натиск у сторінці не мусить відпускати').toHaveBeenCalledTimes(1);

		scroller.dispatchEvent(new Event('pointerdown'));
		scrollBy(500);
		scrollTo.mockClear();
		resize();
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo, 'смугу тягне людина').not.toHaveBeenCalled();
	});

	it('новий ключ притискає знову, навіть якщо людина прокрутила вгору', () => {
		const action = pinToBottom(node, 1)!;
		vi.advanceTimersByTime(SETTLE_MS + OWN_SCROLL_MS);
		scrollBy(100);
		scrollTo.mockClear();

		action.update(2);
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).toHaveBeenCalledTimes(1);
	});

	it('той самий ключ нічого не перезапускає', () => {
		const action = pinToBottom(node, 1)!;
		vi.advanceTimersByTime(SETTLE_MS + OWN_SCROLL_MS);
		scrollBy(100);
		scrollTo.mockClear();

		action.update(1);
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('`null` скасовує прокрутку, що вже чекала', () => {
		const action = pinToBottom(node, 1)!;
		action.update(null);
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
	});

	it('без руху — миттєво, а не плавно', () => {
		reducedMotion = true;
		pinToBottom(node, 1);
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'auto' });
	});

	it('після знищення не слухає й не крутить', () => {
		const action = pinToBottom(node, 1)!;
		action.destroy();
		resize();
		scrollBy(0);
		vi.advanceTimersByTime(SETTLE_MS * 4);
		expect(scrollTo).not.toHaveBeenCalled();
		expect(observers.every((o) => o.disconnected)).toBe(true);
	});
});
