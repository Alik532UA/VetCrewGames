import { afterEach, describe, expect, it, vi } from 'vitest';
import { touchDrag } from './touchDrag';

/**
 * ПЕРЕТЯГУВАННЯ ПАЛЬЦЕМ — правила дії без браузера (`utils/touchDrag.ts`).
 *
 * Саме перетягування в «Що їмо?» перевіряє `tests/touch-drag.spec.ts` справжніми подіями
 * дотику. Тут — те, що там не видно: торкання без руху НЕ кидає нічого (інакше кожне торкання
 * страви натискало б зону під пальцем), а після перетягування клік погашено. У Chrome після
 * руху за межу торкання кліку й так немає, тож e2e цього не ловить; інші браузери — інакші.
 *
 * Зворотні експерименти: кидати й без перетягування — червоніє «торкання — не кидок»; не гасити
 * клік — «клік після перетягування погашено»; не прибирати копію — «копію прибрано».
 */

type Point = { clientX: number; clientY: number };

/** Подія дотику з потрібними полями: у jsdom немає `TouchEvent` із точками. */
function touch(type: string, point: Point | null, target: HTMLElement) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	const list = point ? [point] : [];
	Object.defineProperty(event, 'touches', { value: type === 'touchend' ? [] : list });
	Object.defineProperty(event, 'changedTouches', { value: list });
	target.dispatchEvent(event);
	return event;
}

function setup(params: { disabled?: boolean } = {}) {
	const node = document.createElement('button');
	const zone = document.createElement('div');
	zone.dataset.dropZone = 'zone-a';
	const inside = document.createElement('span');
	zone.append(inside);
	document.body.append(node, zone);
	// jsdom не розкладає сторінку: «що під пальцем» підставляємо самі.
	document.elementFromPoint = vi.fn(() => inside);

	const onstart = vi.fn();
	const ondrop = vi.fn();
	const action = touchDrag(node, { ...params, onstart, ondrop });
	return { node, zone, onstart, ondrop, action };
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('перетягування пальцем', () => {
	it('перевірка жива: рух за поріг бере, відпускання кидає в зону під пальцем', () => {
		const { node, zone, onstart, ondrop } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 40, clientY: 10 }, node);
		expect(onstart).toHaveBeenCalledTimes(1);
		expect(zone.classList.contains('drop-zone--over'), 'зона під пальцем підсвічена').toBe(true);

		touch('touchend', { clientX: 40, clientY: 10 }, node);
		expect(ondrop).toHaveBeenCalledWith(zone);
		expect(zone.classList.contains('drop-zone--over')).toBe(false);
	});

	it('торкання — не кидок: без руху ні `onstart`, ні `ondrop`', () => {
		const { node, onstart, ondrop } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		const end = touch('touchend', { clientX: 10, clientY: 10 }, node);
		expect(onstart).not.toHaveBeenCalled();
		expect(ondrop).not.toHaveBeenCalled();
		expect(end.defaultPrevented, 'клік торкання лишається').toBe(false);
	});

	it('рух у межах порогу — ще торкання', () => {
		const { node, onstart } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 15, clientY: 13 }, node);
		expect(onstart).not.toHaveBeenCalled();
	});

	it('клік після перетягування погашено, і сторінка під пальцем не гортається', () => {
		const { node } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		const move = touch('touchmove', { clientX: 40, clientY: 10 }, node);
		const end = touch('touchend', { clientX: 40, clientY: 10 }, node);
		expect(move.defaultPrevented).toBe(true);
		expect(end.defaultPrevented).toBe(true);
	});

	it('копія їде за пальцем і зникає, щойно відпустили', () => {
		const { node } = setup();
		node.dataset.testid = 'dish';
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 40, clientY: 10 }, node);
		const clone = document.querySelector('.touch-drag-clone');
		expect(clone).not.toBeNull();
		expect(clone?.hasAttribute('data-testid'), 'локатор не двоїться').toBe(false);

		touch('touchend', { clientX: 40, clientY: 10 }, node);
		expect(document.querySelector('.touch-drag-clone'), 'копію прибрано').toBeNull();
	});

	it('скасований дотик — кидок нікуди', () => {
		const { node, ondrop } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 40, clientY: 10 }, node);
		touch('touchcancel', null, node);
		expect(ondrop).toHaveBeenCalledWith(null);
		expect(document.querySelector('.touch-drag-clone')).toBeNull();
	});

	it('коли тягнути не можна — нічого', () => {
		const { node, onstart, ondrop } = setup({ disabled: true });
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 40, clientY: 10 }, node);
		touch('touchend', { clientX: 40, clientY: 10 }, node);
		expect(onstart).not.toHaveBeenCalled();
		expect(ondrop).not.toHaveBeenCalled();
	});

	it('знищення посеред перетягування прибирає копію й підсвітку', () => {
		const { node, zone, action } = setup();
		touch('touchstart', { clientX: 10, clientY: 10 }, node);
		touch('touchmove', { clientX: 40, clientY: 10 }, node);
		action.destroy();
		expect(document.querySelector('.touch-drag-clone')).toBeNull();
		expect(zone.classList.contains('drop-zone--over')).toBe(false);
	});
});
