import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickTarget, trackClicks } from './clickTrail';
import { logService } from './logService.svelte';

/**
 * СЛІД НАТИСКІВ У ЖУРНАЛІ (прохання автора 2026-09-27): у звіті мусить бути видно, ПІСЛЯ
 * ЯКОЇ кнопки сталася помилка, — доти це показував лише стек у DevTools.
 *
 * Зворотні експерименти (прогнано): слухати без фази перехоплення — червоніє «обробник,
 * що зупиняє спливання»; писати в журнал текст кнопки замість атрибута — «ні тексту, ні
 * значення»; не ховати `uid` — «чужий uid».
 */

function mount(html: string): HTMLElement {
	const root = document.createElement('div');
	root.innerHTML = html;
	document.body.append(root);
	return root;
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
});

describe('слід натисків', () => {
	it('натиск по значку всередині кнопки — це натиск кнопки', () => {
		const root = mount('<button data-testid="online-search-btn"><svg><path></path></svg></button>');
		expect(clickTarget(root.querySelector('path'))).toEqual({ target: 'online-search-btn' });
	});

	it('не елемент керування — не пишеться: сторінку мацають, а не натискають', () => {
		const root = mount('<section data-testid="online-search-panel"><p>текст</p></section>');
		expect(clickTarget(root.querySelector('p'))).toBeNull();
		expect(clickTarget(null)).toBeNull();
	});

	it('ні тексту, ні значення: лише атрибут, а без нього — тег і місце', () => {
		const root = mount(
			'<div data-testid="online-join-panel"><button>Мудра Сова</button>' +
				'<input data-testid="online-code-input" value="12345" /></div>'
		);
		expect(clickTarget(root.querySelector('button'))).toEqual({
			target: 'button',
			within: 'online-join-panel'
		});
		expect(clickTarget(root.querySelector('input'))).toEqual({ target: 'online-code-input' });
	});

	it('чужий uid в атрибуті ховається, коротке число — ні', () => {
		const root = mount(
			'<button data-testid="account-follow-nSkFvydGblZ4nD9W1DemvaoNC7B3-btn"></button>' +
				'<button data-testid="online-room-4821-btn"></button>'
		);
		const [follow, room] = root.querySelectorAll('button');
		expect(clickTarget(follow)).toEqual({ target: 'account-follow-…-btn' });
		expect(clickTarget(room)).toEqual({ target: 'online-room-4821-btn' });
	});

	it('обробник, що зупиняє спливання, запису не забирає; після зупинки — тиша', () => {
		const info = vi.spyOn(logService, 'info');
		const root = mount('<div><button data-testid="pairs-start-btn"></button></div>');
		const button = root.querySelector('button')!;
		button.addEventListener('click', (event) => event.stopPropagation());
		const stop = trackClicks();
		button.click();
		expect(info).toHaveBeenCalledWith('ui', 'click', { target: 'pairs-start-btn' });
		stop();
		info.mockClear();
		button.click();
		expect(info).not.toHaveBeenCalled();
	});
});
