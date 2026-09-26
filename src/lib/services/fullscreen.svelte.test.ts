import { afterEach, describe, expect, it, vi } from 'vitest';
import { canFullscreen, fullscreen, wantsHomeScreenHint } from './fullscreen.svelte';
import { logService } from '$lib/services/logService.svelte';

/**
 * Повний екран — лише там, де браузер його ВМІЄ (прохання автора 2026-09-26).
 *
 * ## Головне, що тут доводиться
 *
 * На iPhone кнопка більше НІЧОГО не вдає. Доти там вмикалася підробка —
 * атрибут на `<html>` і `position: fixed`, — яка панелей Safari не ховала: людина
 * бачила кнопку, що міняє лише власний значок, і читала це як баг сайту. Тепер
 * рішення — за можливістю (`fullscreenEnabled`), а не за моделлю, і там, де
 * можливості немає, `toggle()` не робить нічого.
 *
 * ## Чому все підмінюється властивостями документа
 *
 * Fullscreen API в jsdom немає зовсім: ні `requestFullscreen`, ні
 * `fullscreenEnabled`, ні їхніх `webkit`-двійників. Тому кожен випадок збирається
 * руками — і саме тому їх стільки: увесь сенс модуля в умовляннях із браузером,
 * у якого половини потрібного може не бути.
 */

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1';
/** iPadOS звітує як Mac — і повний екран уміє. */
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1';

/** Що саме ми домалювали до документа — щоб зняти це рівно так само. */
const patched: Array<[object, string]> = [];

function patch(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, { value, configurable: true, writable: true });
	patched.push([target, key]);
}

const ua = (value: string) => patch(navigator, 'userAgent', value);
const able = () => patch(document, 'fullscreenEnabled', true);

afterEach(() => {
	for (const [target, key] of patched.reverse()) Reflect.deleteProperty(target, key);
	patched.length = 0;
	fullscreen.active = false;
	vi.restoreAllMocks();
	vi.doUnmock('$app/environment');
	vi.resetModules();
});

describe('чи вміє браузер', () => {
	it('без жодної ознаки — не вміє (iPhone, вкладений фрейм без дозволу)', () => {
		expect(canFullscreen()).toBe(false);
	});

	it('стандартна ознака', () => {
		able();
		expect(canFullscreen()).toBe(true);
	});

	it('ознака старого WebKit', () => {
		patch(document, 'webkitFullscreenEnabled', true);
		expect(canFullscreen()).toBe(true);
	});

	it('браузер сказав «ні» — це «ні», хоч би які методи в нього були', () => {
		patch(document, 'fullscreenEnabled', false);
		patch(document.documentElement, 'requestFullscreen', vi.fn(async () => {}));
		expect(canFullscreen()).toBe(false);
	});
});

describe('перемикання', () => {
	/**
	 * Зворотний експеримент: повернути підробку для iPhone (атрибут на `<html>`
	 * без запиту) — червоніє тут.
	 */
	it('iPhone: не вміє — нічого не просить і нічого не вдає', () => {
		ua(IPHONE_UA);
		const request = vi.fn(async () => {});
		patch(document.documentElement, 'requestFullscreen', request);

		fullscreen.toggle();

		expect(request).not.toHaveBeenCalled();
		expect(fullscreen.active).toBe(false);
		expect(document.documentElement.getAttributeNames()).not.toContain('data-fake-fullscreen');
	});

	it('уміє — просить справжній повний екран', () => {
		ua(DESKTOP_UA);
		able();
		const request = vi.fn(async () => {});
		patch(document.documentElement, 'requestFullscreen', request);

		fullscreen.toggle();

		expect(request).toHaveBeenCalledTimes(1);
	});

	/**
	 * Старий WebKit (Safari й iPadOS до 16.4) повертає з запиту `undefined`, а не
	 * проміс. Доти на ньому стояв `.catch` — і натиск кидав `TypeError`.
	 */
	it('старий WebKit: запит без промісу не кидає', () => {
		patch(document, 'webkitFullscreenEnabled', true);
		const request = vi.fn(() => undefined);
		patch(document.documentElement, 'webkitRequestFullscreen', request);

		expect(() => fullscreen.toggle()).not.toThrow();
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('відмова браузера — у журнал, а не підробка', async () => {
		able();
		const warn = vi.spyOn(logService, 'warn').mockImplementation(() => {});
		patch(
			document.documentElement,
			'requestFullscreen',
			vi.fn(async () => {
				throw new Error('denied');
			})
		);

		fullscreen.toggle();
		await Promise.resolve();
		await Promise.resolve();

		expect(warn).toHaveBeenCalledWith('ui', 'fullscreen refused', expect.anything());
		expect(fullscreen.active).toBe(false);
		expect(document.documentElement.getAttributeNames()).not.toContain('data-fake-fullscreen');
	});

	it('уже повний екран — виходить', () => {
		able();
		patch(document, 'fullscreenElement', document.documentElement);
		const exit = vi.fn(async () => {});
		patch(document, 'exitFullscreen', exit);
		const request = vi.fn(async () => {});
		patch(document.documentElement, 'requestFullscreen', request);

		fullscreen.toggle();

		expect(exit).toHaveBeenCalledTimes(1);
		expect(request).not.toHaveBeenCalled();
	});

	it('старий WebKit: вихід без промісу не кидає', () => {
		patch(document, 'webkitFullscreenEnabled', true);
		patch(document, 'webkitFullscreenElement', document.documentElement);
		const exit = vi.fn(() => undefined);
		patch(document, 'webkitExitFullscreen', exit);

		expect(() => fullscreen.toggle()).not.toThrow();
		expect(exit).toHaveBeenCalledTimes(1);
	});
});

describe('стан', () => {
	it('подія браузера вмикає й вимикає стан', () => {
		const stop = fullscreen.watch();

		patch(document, 'fullscreenElement', document.documentElement);
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(fullscreen.active).toBe(true);

		patch(document, 'fullscreenElement', null);
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(fullscreen.active).toBe(false);

		stop();
	});

	it('префіксована подія старого WebKit', () => {
		const stop = fullscreen.watch();

		patch(document, 'webkitFullscreenElement', document.documentElement);
		document.dispatchEvent(new Event('webkitfullscreenchange'));
		expect(fullscreen.active).toBe(true);

		stop();
	});

	it('після прибирання подія стан не чіпає', () => {
		const stop = fullscreen.watch();
		stop();

		patch(document, 'fullscreenElement', document.documentElement);
		document.dispatchEvent(new Event('fullscreenchange'));
		expect(fullscreen.active).toBe(false);
	});
});

describe('підказка «на початковий екран»', () => {
	it('iPhone у браузері — так', () => {
		ua(IPHONE_UA);
		expect(wantsHomeScreenHint()).toBe(true);
	});

	it('iPhone, відкритий з початкового екрана, — ні: там уже без панелей', () => {
		ua(IPHONE_UA);
		patch(navigator, 'standalone', true);
		expect(wantsHomeScreenHint()).toBe(false);
	});

	it('iPad — ні: звітує як Mac і повний екран уміє', () => {
		ua(IPAD_UA);
		able();
		expect(wantsHomeScreenHint()).toBe(false);
	});

	it('комп’ютер — ні', () => {
		ua(DESKTOP_UA);
		able();
		expect(wantsHomeScreenHint()).toBe(false);
	});
});

/**
 * На сервері DOM немає, і звертатися до нього не можна: `document` там просто не
 * існує. Усі входи мусять тихо нічого не робити.
 */
describe('без браузера', () => {
	it('нічого не роблять і не кидають', async () => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: false, dev: false }));
		const ssr = await import('./fullscreen.svelte');

		expect(ssr.canFullscreen()).toBe(false);
		expect(ssr.wantsHomeScreenHint()).toBe(false);
		expect(() => ssr.fullscreen.toggle()).not.toThrow();
		const stop = ssr.fullscreen.watch();
		expect(() => stop()).not.toThrow();
	});
});
