import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { logService } from '$lib/services/logService.svelte';
import { WebVitals } from './webVitals.svelte';

/**
 * Core Web Vitals: збирає весь час, звітує ОДИН раз.
 *
 * ## Що тут головне
 *
 * Не самі числа, а те, що їх у журналі рівно по одному рядку. Доти кожен
 * спостерігач писав на КОЖНЕ спрацювання, і це ламало рівно той механізм, заради
 * якого журнал існує: кільцевий буфер тримає останню тисячу записів, а
 * `layout-shift` на прокрутці дає сотні. Через хвилину користування у звіті,
 * який людина надсилає розробникові, не лишалося б нічого, крім телеметрії, —
 * справжні помилки витіснені власним шумом застосунку.
 *
 * Тому перевіряється саме кількість рядків і те, що повторний хід ховання
 * МОВЧИТЬ. Друге — визначення метрик: CLS не рахує зсувів після дії користувача,
 * INP — це найгірша затримка, а не остання.
 *
 * ## Чому спостерігач підроблений
 *
 * `PerformanceObserver` у jsdom немає взагалі (заміряно: `'PerformanceObserver'
 * in window` — `false`). Тобто без підробки цей модуль на тесті йшов би рівно
 * одним шляхом — «браузер не вміє», — і жодна з метрик не була б перевірена.
 */

interface Init {
	type: string;
	buffered?: boolean;
	durationThreshold?: number;
}

type Entry = PerformanceEntry & { value?: number; hadRecentInput?: boolean };

/** Спостерігач, якому можна наказати спрацювати — і який умів не все. */
class FakeObserver {
	static made: FakeObserver[] = [];
	/** Типи, на які цей браузер відповідає винятком. */
	static unsupported = new Set<string>();

	init: Init | null = null;
	disconnected = false;
	readonly #callback: (list: { getEntries: () => Entry[] }) => void;

	constructor(callback: (list: { getEntries: () => Entry[] }) => void) {
		this.#callback = callback;
		FakeObserver.made.push(this);
	}

	observe(init: Init): void {
		if (FakeObserver.unsupported.has(init.type)) throw new Error(`no ${init.type}`);
		this.init = init;
	}

	disconnect(): void {
		this.disconnected = true;
	}

	emit(entries: Entry[]): void {
		this.#callback({ getEntries: () => entries });
	}
}

const entry = (over: Partial<Entry>): Entry => ({ startTime: 0, duration: 0, ...over }) as Entry;

/** Знайти спостерігача за типом: порядок створення — деталь реалізації. */
const observerFor = (type: string) => {
	const found = FakeObserver.made.find((o) => o.init?.type === type);
	if (!found) throw new Error(`спостерігача «${type}» не створили`);
	return found;
};

const reports = () =>
	logService.getLogs().filter((line) => line.message.startsWith('[Performance]'));

const install = () => {
	Object.defineProperty(window, 'PerformanceObserver', {
		value: FakeObserver,
		configurable: true,
		writable: true
	});
};

const visibility = (state: 'visible' | 'hidden') =>
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

describe('WebVitals', () => {
	beforeEach(() => {
		FakeObserver.made = [];
		FakeObserver.unsupported = new Set();
		logService.clear();
		install();
		visibility('visible');
	});

	afterEach(() => {
		Reflect.deleteProperty(window, 'PerformanceObserver');
		Reflect.deleteProperty(document, 'visibilityState');
	});

	/** Браузер без API не мусить ні падати, ні лишати по собі підписок. */
	it('без PerformanceObserver нічого не робить і віддає порожнє прибирання', () => {
		Reflect.deleteProperty(window, 'PerformanceObserver');
		const vitals = new WebVitals();

		const stop = vitals.start();
		expect(() => stop()).not.toThrow();
		expect(reports()).toHaveLength(0);
	});

	it('перевірка жива: підписується на три метрики', () => {
		const vitals = new WebVitals();
		const stop = vitals.start();

		expect(FakeObserver.made.map((o) => o.init?.type)).toEqual([
			'largest-contentful-paint',
			'layout-shift',
			'event'
		]);
		stop();
	});

	/**
	 * `durationThreshold` — опція `event`-таймінгів, і лише їх. Для решти вона не
	 * означає нічого, а зайві поля в `observe()` частина браузерів зустрічає
	 * винятком — тобто метрика тихо не збиралася б.
	 */
	it('межу тривалості отримує ЛИШЕ `event`', () => {
		const vitals = new WebVitals();
		const stop = vitals.start();

		expect(observerFor('event').init?.durationThreshold).toBe(40);
		expect(observerFor('layout-shift').init?.durationThreshold).toBeUndefined();
		expect(observerFor('largest-contentful-paint').init?.durationThreshold).toBeUndefined();
		stop();
	});

	/** Непідтриманий тип лишає попередження, а решту метрик — на місці. */
	it('тип, якого браузер не вміє, не валить решти', () => {
		FakeObserver.unsupported.add('event');
		const vitals = new WebVitals();
		const stop = vitals.start();

		const warned = logService.getLogs().filter((line) => line.message.includes('does not support'));
		expect(warned).toHaveLength(1);
		expect(observerFor('layout-shift').init).not.toBeNull();
		stop();
	});

	describe('самі метрики', () => {
		it('LCP — ОСТАННЄ значення, а не перше', () => {
			const vitals = new WebVitals();
			vitals.start();

			observerFor('largest-contentful-paint').emit([
				entry({ startTime: 400 }),
				entry({ startTime: 1200 })
			]);
			vitals.stop();

			expect(reports()[0].message).toContain('LCP: 1200ms');
		});

		it('порожнє спрацювання LCP лишає попереднє значення', () => {
			const vitals = new WebVitals();
			vitals.start();

			observerFor('largest-contentful-paint').emit([entry({ startTime: 700 })]);
			observerFor('largest-contentful-paint').emit([]);
			vitals.stop();

			expect(reports()[0].message).toContain('LCP: 700ms');
		});

		/**
		 * Зсув одразу після дії користувача — не дефект верстки, а наслідок його ж
		 * натискання; у визначенні CLS такі не рахуються.
		 */
		it('CLS складає зсуви, але НЕ ті, що після дії користувача', () => {
			const vitals = new WebVitals();
			vitals.start();

			observerFor('layout-shift').emit([
				entry({ value: 0.02, hadRecentInput: false }),
				entry({ value: 0.5, hadRecentInput: true }),
				entry({ value: 0.03, hadRecentInput: false })
			]);
			vitals.stop();

			expect(reports()[0].message).toContain('CLS: 0.0500');
		});

		it('INP — НАЙГІРША затримка, а не остання', () => {
			const vitals = new WebVitals();
			vitals.start();

			observerFor('event').emit([entry({ duration: 120 }), entry({ duration: 55 })]);
			vitals.stop();

			expect(reports()[0].message).toContain('INP: 120ms');
		});
	});

	describe('момент звіту', () => {
		/**
		 * Приховування сторінки, а не `beforeunload`: на мобільних вкладку часто
		 * вбивають без нього, і звіт просто не трапився б.
		 */
		it('приховування сторінки дає рівно один рядок', () => {
			const vitals = new WebVitals();
			vitals.start();
			observerFor('event').emit([entry({ duration: 90 })]);

			visibility('hidden');
			document.dispatchEvent(new Event('visibilitychange'));

			expect(reports()).toHaveLength(1);
			expect(reports()[0].message).toContain('INP: 90ms');
			vitals.stop();
		});

		it('повернення на сторінку нічого не звітує', () => {
			const vitals = new WebVitals();
			vitals.start();

			visibility('visible');
			document.dispatchEvent(new Event('visibilitychange'));

			expect(reports()).toHaveLength(0);
			vitals.stop();
		});

		/** `pagehide` — другий вхід: сторінку могли витіснити з bfcache. */
		it('`pagehide` теж звітує', () => {
			const vitals = new WebVitals();
			vitals.start();

			window.dispatchEvent(new Event('pagehide'));
			expect(reports()).toHaveLength(1);
			vitals.stop();
		});

		/**
		 * ГОЛОВНЕ: повторний хід ховання МОВЧИТЬ. Інакше перемикання вкладок
		 * туди-назад засипало б журнал однаковими рядками — тобто робило б рівно
		 * те, від чого цей модуль і переписували.
		 */
		it('той самий звіт удруге не пишеться', () => {
			const vitals = new WebVitals();
			vitals.start();
			observerFor('event').emit([entry({ duration: 70 })]);

			visibility('hidden');
			document.dispatchEvent(new Event('visibilitychange'));
			document.dispatchEvent(new Event('visibilitychange'));
			window.dispatchEvent(new Event('pagehide'));
			vitals.stop();

			expect(reports(), 'той самий рядок пішов у журнал більше ніж раз').toHaveLength(1);
		});

		it('нове значення після звіту дає другий рядок', () => {
			const vitals = new WebVitals();
			vitals.start();

			window.dispatchEvent(new Event('pagehide'));
			observerFor('event').emit([entry({ duration: 300 })]);
			window.dispatchEvent(new Event('pagehide'));

			expect(reports()).toHaveLength(2);
			vitals.stop();
		});
	});

	describe('stop()', () => {
		/** Демонтаж — теж кінець життя вимірювання: зібране не пропадає мовчки. */
		it('звітує, відʼєднує спостерігачів і знімає підписки', () => {
			const vitals = new WebVitals();
			const stop = vitals.start();
			observerFor('layout-shift').emit([entry({ value: 0.1, hadRecentInput: false })]);

			stop();

			expect(reports()).toHaveLength(1);
			expect(FakeObserver.made.every((o) => o.disconnected)).toBe(true);

			window.dispatchEvent(new Event('pagehide'));
			expect(reports(), 'підписка живе довше за вимірювання').toHaveLength(1);
		});

		it('повторний stop() нічого не подвоює', () => {
			const vitals = new WebVitals();
			vitals.start();

			vitals.stop();
			vitals.stop();

			expect(reports()).toHaveLength(1);
		});
	});
});
