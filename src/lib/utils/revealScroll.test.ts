import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { revealScroll, SETTLE_MS, WATCH_MS } from './revealScroll';

/**
 * Дію перевіряють тут, а не в браузері, і це не зручність.
 *
 * Розбір виїжджає під `transition:slide`, а Svelte крутить свої переходи через
 * `requestAnimationFrame`. У прихованій панелі черга кадрів не йде взагалі, тож
 * блок лишається нульової висоти назавжди й спостерігач за розміром не
 * спрацьовує жодного разу — тобто саме та поведінка, заради якої дію й
 * написано, там не відтворюється в принципі.
 *
 * Тому `ResizeObserver` тут підроблений: він дає СМИКНУТИ себе рукою й
 * перевірити те, що в панелі недосяжне, — що прокрутка чекає на кінець росту,
 * що вона одна, а не двадцять, і що людина її перебиває.
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

/** Один «кадр» росту блока: спостерігач помітив нову висоту. */
const grow = () => observers.filter((o) => !o.disconnected).forEach((o) => o.callback());

let node: HTMLElement;
let scrollIntoView: Mock<HTMLElement['scrollIntoView']>;

beforeEach(() => {
	vi.useFakeTimers();
	observers.length = 0;
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);
	vi.stubGlobal('matchMedia', () => ({ matches: false }));

	node = document.createElement('div');
	scrollIntoView = vi.fn<HTMLElement['scrollIntoView']>();
	node.scrollIntoView = scrollIntoView;
	document.body.appendChild(node);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	node.remove();
});

describe('revealScroll', () => {
	it('перевірка жива: без неї прокрутки не буває', () => {
		vi.advanceTimersByTime(WATCH_MS);
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	it('крутить до блока, коли той з’явився без анімації', () => {
		revealScroll(node);
		vi.advanceTimersByTime(SETTLE_MS);

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
		expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' });
	});

	/**
	 * Головне, заради чого дія існує. Блок росте 300–400мс; прокрутка до нього
	 * посеред росту веде до висоти, якої вже не буде.
	 */
	it('поки блок росте — не крутить, а після зупинки крутить один раз', () => {
		revealScroll(node);

		for (let elapsed = 0; elapsed < 400; elapsed += 16) {
			grow();
			vi.advanceTimersByTime(16);
		}
		expect(scrollIntoView, 'посеред росту — жодного разу').not.toHaveBeenCalled();

		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollIntoView, 'після зупинки — рівно один').toHaveBeenCalledTimes(1);
	});

	it('людина крутнула сама — дія відступає назавжди', () => {
		revealScroll(node);
		window.dispatchEvent(new Event('wheel'));

		grow();
		vi.advanceTimersByTime(WATCH_MS * 2);
		expect(scrollIntoView).not.toHaveBeenCalled();
	});

	/**
	 * `scroll` сюди не годиться: його шле й наша власна прокрутка, і дія
	 * зупиняла б себе першим-таки рухом.
	 */
	it('власна прокрутка дію не зупиняє', () => {
		revealScroll(node);
		window.dispatchEvent(new Event('scroll'));
		vi.advanceTimersByTime(SETTLE_MS);

		expect(scrollIntoView).toHaveBeenCalledTimes(1);
	});

	it('після стелі часу спостереження знято', () => {
		revealScroll(node);
		vi.advanceTimersByTime(WATCH_MS + 1);
		scrollIntoView.mockClear();

		grow();
		vi.advanceTimersByTime(SETTLE_MS);
		expect(scrollIntoView, 'пізній ривок — це те, чого уникаємо').not.toHaveBeenCalled();
		expect(observers.every((o) => o.disconnected)).toBe(true);
	});

	it('знищення вузла знімає спостерігача й таймери', () => {
		const handle = revealScroll(node);
		handle?.destroy();

		grow();
		vi.advanceTimersByTime(WATCH_MS);
		expect(scrollIntoView).not.toHaveBeenCalled();
		expect(observers.every((o) => o.disconnected)).toBe(true);
	});

	it('`enabled: false` не чіпає нічого — так живуть два з трьох розборів', () => {
		revealScroll(node, false);
		grow();
		vi.advanceTimersByTime(WATCH_MS);

		expect(scrollIntoView).not.toHaveBeenCalled();
		expect(observers, 'спостерігача навіть не створено').toHaveLength(0);
	});

	it('за `prefers-reduced-motion` крутить миттєво', () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		revealScroll(node);
		vi.advanceTimersByTime(SETTLE_MS);

		expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' });
	});
});
