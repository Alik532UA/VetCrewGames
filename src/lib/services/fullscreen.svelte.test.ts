import { afterEach, describe, expect, it, vi } from 'vitest';
import { fullscreen } from './fullscreen.svelte';

/**
 * Повний екран — і його підробка.
 *
 * ## Головне, що тут доводиться
 *
 * З підробки МОЖНА ВИЙТИ. Перевірка `hasAttribute` мусить іти першою, і колись
 * вона стояла всередині гілки для iOS — тоді на комп'ютері підробка була станом
 * без виходу: `fullscreenElement` при ній порожній, тож кнопка знову просила
 * справжній повний екран, діставала ту саму відмову й знову вмикала підробку.
 * Зовні це виглядає як «кнопка не працює», а не як дефект логіки, тож без тесту
 * повернути цей порядок легко.
 *
 * ## Чому все підмінюється властивостями документа
 *
 * Fullscreen API в jsdom немає зовсім: ні `requestFullscreen`, ні
 * `fullscreenElement`, ні їхніх `webkit`-двійників. Саме тому кожен випадок тут
 * збирається руками — і саме тому їх стільки: увесь сенс цього модуля в
 * умовляннях із браузером, у якого половини потрібного може не бути.
 */

/** Той самий атрибут, що в `global.css`. Модуль його не експортує. */
const FAKE = 'data-fake-fullscreen';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1';

/** Що саме ми домалювали до документа — щоб зняти це рівно так само. */
const patched: Array<[object, string]> = [];

function patch(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, { value, configurable: true, writable: true });
	patched.push([target, key]);
}

const ua = (value: string) => patch(navigator, 'userAgent', value);

afterEach(() => {
	for (const [target, key] of patched.reverse()) Reflect.deleteProperty(target, key);
	patched.length = 0;
	document.documentElement.removeAttribute(FAKE);
	fullscreen.active = false;
	vi.doUnmock('$app/environment');
	vi.resetModules();
});

describe('fullscreen', () => {
	it('перевірка жива: спочатку ні справжнього, ні підробленого', () => {
		expect(fullscreen.active).toBe(false);
		expect(document.documentElement.hasAttribute(FAKE)).toBe(false);
	});

	/** iPhone не вміє Fullscreen API для елементів узагалі — там одразу підробка. */
	it('на iPhone одразу підробка, без спроби справжнього', () => {
		ua(IPHONE_UA);
		const request = vi.fn(async () => {});
		patch(document.documentElement, 'requestFullscreen', request);

		fullscreen.toggle();

		expect(document.documentElement.hasAttribute(FAKE)).toBe(true);
		expect(fullscreen.active).toBe(true);
		expect(request, 'на iPhone попросили справжній повний екран').not.toHaveBeenCalled();
	});

	/**
	 * ГОЛОВНИЙ тест файлу: з підробки є вихід, і саме на комп'ютері.
	 *
	 * Порядок перевірок у `toggle()` тримається саме тут. Якщо `hasAttribute`
	 * знову з'їде всередину гілки для iOS, цей тест почервоніє — а екран ні.
	 */
	it('відмова вмикає підробку, і другий натиск її ВИМИКАЄ', async () => {
		ua(DESKTOP_UA);
		patch(document.documentElement, 'requestFullscreen', () =>
			Promise.reject(new Error('gesture required'))
		);
		patch(document, 'fullscreenElement', null);

		fullscreen.toggle();
		await Promise.resolve();
		await Promise.resolve();

		expect(document.documentElement.hasAttribute(FAKE), 'відмову не відпрацювали').toBe(true);
		expect(fullscreen.active).toBe(true);

		fullscreen.toggle();

		expect(document.documentElement.hasAttribute(FAKE), 'підробка — стан без виходу').toBe(false);
		expect(fullscreen.active).toBe(false);
	});

	it('справжній повний екран не лишає підробки', async () => {
		ua(DESKTOP_UA);
		const request = vi.fn(async () => {});
		patch(document.documentElement, 'requestFullscreen', request);
		patch(document, 'fullscreenElement', null);

		fullscreen.toggle();
		await Promise.resolve();

		expect(request).toHaveBeenCalledTimes(1);
		expect(document.documentElement.hasAttribute(FAKE)).toBe(false);
	});

	it('без стандартного запиту йде `webkit`-двійник', async () => {
		ua(DESKTOP_UA);
		const webkit = vi.fn(async () => {});
		patch(document.documentElement, 'webkitRequestFullscreen', webkit);
		patch(document, 'fullscreenElement', null);

		fullscreen.toggle();
		await Promise.resolve();

		expect(webkit).toHaveBeenCalledTimes(1);
		expect(document.documentElement.hasAttribute(FAKE)).toBe(false);
	});

	/** Ні того, ні того — підробка лишається єдиним, що можна дати людині. */
	it('браузер без Fullscreen API взагалі дістає підробку', () => {
		ua(DESKTOP_UA);
		patch(document, 'fullscreenElement', null);

		fullscreen.toggle();

		expect(document.documentElement.hasAttribute(FAKE)).toBe(true);
		expect(fullscreen.active).toBe(true);
	});

	it('зі справжнього повного екрана виходить стандартним викликом', () => {
		ua(DESKTOP_UA);
		const exit = vi.fn(async () => {});
		patch(document, 'fullscreenElement', document.body);
		patch(document, 'exitFullscreen', exit);

		fullscreen.active = true;
		fullscreen.toggle();

		expect(exit).toHaveBeenCalledTimes(1);
		expect(fullscreen.active).toBe(false);
	});

	it('`webkit`-повний екран виходить `webkit`-викликом', () => {
		ua(DESKTOP_UA);
		const exit = vi.fn(async () => {});
		patch(document, 'fullscreenElement', null);
		patch(document, 'webkitFullscreenElement', document.body);
		patch(document, 'webkitExitFullscreen', exit);

		fullscreen.active = true;
		fullscreen.toggle();

		expect(exit).toHaveBeenCalledTimes(1);
		expect(fullscreen.active).toBe(false);
	});

	/**
	 * Виходу немає, а стан треба зняти однаково: інакше шапка показувала б
	 * «повний екран» на сторінці, яка з нього вже вийшла.
	 */
	it('повний екран без жодного виходу все одно знімає стан', () => {
		ua(DESKTOP_UA);
		patch(document, 'fullscreenElement', null);
		patch(document, 'webkitFullscreenElement', document.body);

		fullscreen.active = true;
		fullscreen.toggle();

		expect(fullscreen.active).toBe(false);
	});

	describe('watch(): вихід ЗЗОВНІ — Esc або системна кнопка', () => {
		it('ловить справжній вихід і вхід, а після прибирання вже ні', () => {
			patch(document, 'fullscreenElement', document.body);
			const stop = fullscreen.watch();

			document.dispatchEvent(new Event('fullscreenchange'));
			expect(fullscreen.active).toBe(true);

			patch(document, 'fullscreenElement', null);
			document.dispatchEvent(new Event('fullscreenchange'));
			expect(fullscreen.active).toBe(false);

			stop();
			patch(document, 'fullscreenElement', document.body);
			document.dispatchEvent(new Event('fullscreenchange'));
			expect(fullscreen.active, 'підписка живе довше за компонент').toBe(false);
		});

		it('`webkit`-подія й `webkit`-стан теж лічаться', () => {
			patch(document, 'fullscreenElement', null);
			patch(document, 'webkitFullscreenElement', document.body);
			const stop = fullscreen.watch();

			document.dispatchEvent(new Event('webkitfullscreenchange'));
			expect(fullscreen.active).toBe(true);

			stop();
		});

		/** Підробка — теж повний екран: шапка мусить показувати те саме. */
		it('підробка лічиться повним екраном', () => {
			patch(document, 'fullscreenElement', null);
			document.documentElement.setAttribute(FAKE, 'true');
			const stop = fullscreen.watch();

			document.dispatchEvent(new Event('fullscreenchange'));
			expect(fullscreen.active).toBe(true);

			stop();
		});
	});

	/**
	 * На сервері DOM немає, і звертатися до нього не можна: `document` там просто
	 * не існує. Обидва входи мусять тихо нічого не робити.
	 */
	describe('без браузера', () => {
		it('toggle() і watch() нічого не роблять і не кидають', async () => {
			vi.resetModules();
			vi.doMock('$app/environment', () => ({ browser: false, dev: false }));
			const { fullscreen: ssr } = await import('./fullscreen.svelte');

			expect(() => ssr.toggle()).not.toThrow();
			expect(ssr.active).toBe(false);

			const stop = ssr.watch();
			expect(() => stop()).not.toThrow();
			expect(document.documentElement.hasAttribute(FAKE)).toBe(false);
		});
	});
});
