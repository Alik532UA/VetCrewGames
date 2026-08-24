import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Хто малює смугу прокрутки (SCROLLBAR-v8 § 2.1).
 *
 * Обраний режим і режим, який СПРАВДІ діє, — різні речі, і саме ця різниця тут
 * перевіряється. Власна смуга не малюється ніде, де її нема кому вести мишею: на
 * сенсорному екрані прокручують пальцем, а на сервері DOM немає зовсім. Обраний
 * режим при цьому лишається обраним — недоступність не переписує налаштування,
 * бо людина, яка вернулася за комп'ютер, мусить дістати свій вибір назад.
 *
 * ## Чому кожен випадок — це НОВИЙ екземпляр модуля
 *
 * `active` — це `$derived`, а обидві його умови (`MediaQuery.current` і
 * `settings.scrollbarMode`) приходять сюди підміненими, тобто без сигналів.
 * Похідне значення без залежностей рахується один раз і більше не міняється —
 * перемикання прапорця «на льоту» доводило б не те, що тут написано. Тому кожен
 * випадок піднімає модуль заново, і `canHover` створюється під нього.
 */

/** Чи є в цього «браузера» мишка. Читається у `MediaQuery` при створенні. */
let hoverMatches = true;

Object.defineProperty(window, 'matchMedia', {
	configurable: true,
	writable: true,
	value: (query: string) => ({
		media: query,
		get matches() {
			return hoverMatches;
		},
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		onchange: null,
		dispatchEvent: () => false
	})
});

type Mode = 'native' | 'custom';

async function load(options: { hover?: boolean; mode?: Mode; browser?: boolean } = {}) {
	vi.resetModules();
	hoverMatches = options.hover ?? true;
	vi.doMock('$lib/services/settings.svelte', () => ({
		settings: { scrollbarMode: options.mode ?? 'custom' }
	}));
	vi.doMock('$app/environment', () => ({ browser: options.browser ?? true, dev: false }));
	return (await import('./scrollbar.svelte')).scrollbar;
}

describe('scrollbar', () => {
	beforeEach(() => {
		hoverMatches = true;
	});

	afterEach(() => {
		vi.doUnmock('$lib/services/settings.svelte');
		vi.doUnmock('$app/environment');
		vi.resetModules();
	});

	describe('який режим СПРАВДІ діє', () => {
		it('мишка є і вибрано «своя» — своя', async () => {
			const scrollbar = await load({ hover: true, mode: 'custom' });
			expect(scrollbar.active).toBe('custom');
			expect(scrollbar.hidesNative).toBe(true);
		});

		it('мишка є, але вибрано «нативна» — нативна', async () => {
			const scrollbar = await load({ hover: true, mode: 'native' });
			expect(scrollbar.active).toBe('native');
			expect(scrollbar.hidesNative).toBe(false);
		});

		/** Сенсорний екран лишається з нативною: там прокручують пальцем. */
		it('без мишки «своя» не діє, хоч і вибрана', async () => {
			const scrollbar = await load({ hover: false, mode: 'custom' });
			expect(scrollbar.active).toBe('native');
			expect(scrollbar.hidesNative, 'нативну сховали, а своєї не намалювали').toBe(false);
		});

		/** На сервері немає ні мишки, ні смуги — і питати `matchMedia` нема в кого. */
		it('без браузера — завжди нативна', async () => {
			const scrollbar = await load({ browser: false, mode: 'custom' });
			expect(scrollbar.active).toBe('native');
		});
	});

	describe('register()', () => {
		/**
		 * Під час переходу існують ДВІ обгортки одночасно, і вихідна вмирає ПІСЛЯ
		 * того, як з'явилася нова. Без перевірки «воно ще наше» смуга зникала б на
		 * кожній навігації — а виглядало б це як випадковий дефект анімації.
		 */
		it('прибирання вихідної обгортки не забирає прокрутника нової', async () => {
			const scrollbar = await load();
			const first = document.createElement('div');
			const second = document.createElement('div');

			const off = scrollbar.register(first);
			expect(scrollbar.scroller).toBe(first);

			// Нова обгортка з'явилася до того, як умерла стара — саме такий порядок
			// дає перехід між сторінками.
			scrollbar.register(second);
			off.destroy();

			expect(scrollbar.scroller, 'смуга лишилася без прокрутника після навігації').toBe(second);
		});

		it('прибирання останньої обгортки знімає прокрутника', async () => {
			const scrollbar = await load();
			const node = document.createElement('div');

			const off = scrollbar.register(node);
			off.destroy();

			expect(scrollbar.scroller).toBeNull();
		});
	});

	describe('меню вибору режиму', () => {
		it('відкривається там, де натиснули, і закривається на місці', async () => {
			const scrollbar = await load();

			scrollbar.openMenu(120, 340);
			expect(scrollbar.menu).toEqual({ open: true, x: 120, y: 340 });

			scrollbar.closeMenu();
			expect(scrollbar.menu, 'координати загубилися при закриванні').toEqual({
				open: false,
				x: 120,
				y: 340
			});
		});
	});
});
