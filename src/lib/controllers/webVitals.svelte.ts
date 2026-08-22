import { browser } from '$app/environment';
import { logService } from '$lib/services/logService.svelte';

/**
 * Core Web Vitals (OBSERVABILITY-v8 § 2.1).
 *
 * **Збирає весь час, звітує один раз — коли сторінку ховають.**
 *
 * Доти кожен спостерігач писав у журнал на КОЖНЕ спрацювання, і це ламало
 * рівно той механізм, заради якого журнал існує. Кільцевий буфер тримає
 * останню тисячу записів; `layout-shift` на сторінці з прокруткою дає сотні
 * спрацювань, `event` — по одному на кожну взаємодію довшу за 40 мс. Тобто
 * через хвилину користування у звіті, який людина надсилає розробником через
 * службове табло, не лишалося б НІЧОГО, крім телеметрії: справжні помилки
 * витіснені власним шумом застосунку.
 *
 * Друга причина та сама, але з боку самих метрик: CLS і INP визначені як
 * ПІДСУМКОВІ величини за час життя сторінки — сукупний зсув і найгірша
 * затримка. Проміжне значення CLS не означає нічого: воно лише менше за
 * справжнє. Записуючи кожне, журнал заповнювався числами, жодне з яких не є
 * тією метрикою, яку вони називають.
 *
 * Момент звіту — приховування сторінки (`visibilitychange` → `hidden`), а не
 * `beforeunload`: на мобільних вкладку часто вбивають без нього, і звіт
 * просто не трапився б. `pagehide` лишається другим входом для випадків, коли
 * сторінку витісняють із bfcache.
 */
export class WebVitals {
	#observers: PerformanceObserver[] = [];
	#detach: Array<() => void> = [];
	#lcp = 0;
	#cls = 0;
	#inp = 0;
	/** Підпис останнього надісланого звіту: повторний хід ховання мовчить. */
	#reported = '';

	start(): () => void {
		if (!browser || !('PerformanceObserver' in window)) {
			return () => {};
		}

		this.#observe('largest-contentful-paint', (entries) => {
			const last = entries.at(-1);
			if (last) this.#lcp = last.startTime;
		});

		this.#observe('layout-shift', (entries) => {
			const shifts = entries as unknown as Array<
				PerformanceEntry & { value: number; hadRecentInput: boolean }
			>;
			for (const entry of shifts) {
				// Зсув одразу після дії користувача — не дефект верстки, а наслідок
				// його ж натискання; у визначенні CLS такі не рахуються.
				if (!entry.hadRecentInput) this.#cls += entry.value;
			}
		});

		/*
		 * `durationThreshold` передається ЛИШЕ сюди. Це опція `event`-таймінгів;
		 * для `largest-contentful-paint` і `layout-shift` вона не означає нічого,
		 * а зайві поля в `observe()` частина браузерів зустрічає винятком.
		 */
		this.#observe(
			'event',
			(entries) => {
				// Цикл, а не `Math.max(...entries)`: розгортання масиву в аргументи
				// на довгій сесії впирається в межу стека, і замість метрики виходить
				// виняток усередині спостерігача.
				for (const entry of entries) {
					if (entry.duration > this.#inp) this.#inp = entry.duration;
				}
			},
			40
		);

		const onVisibility = () => {
			if (document.visibilityState === 'hidden') this.#report();
		};
		const onPageHide = () => this.#report();

		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', onPageHide);
		this.#detach.push(() => document.removeEventListener('visibilitychange', onVisibility));
		this.#detach.push(() => window.removeEventListener('pagehide', onPageHide));

		return () => this.stop();
	}

	stop() {
		// Звіт перед від'єднанням: демонтаж — теж кінець життя вимірювання, і
		// зібране за нього не має пропадати мовчки.
		this.#report();
		for (const observer of this.#observers) observer.disconnect();
		this.#observers = [];
		for (const detach of this.#detach) detach();
		this.#detach = [];
	}

	#report() {
		const line = `[Performance] LCP: ${this.#lcp.toFixed(0)}ms, CLS: ${this.#cls.toFixed(4)}, INP: ${this.#inp.toFixed(0)}ms`;
		if (line === this.#reported) return;
		this.#reported = line;
		logService.info('app', line);
	}

	#observe(
		type: string,
		handler: (entries: PerformanceEntry[]) => void,
		durationThreshold?: number
	) {
		try {
			const observer = new PerformanceObserver((list) => handler(list.getEntries()));
			observer.observe({
				type,
				buffered: true,
				...(durationThreshold === undefined ? {} : { durationThreshold })
			} as unknown as PerformanceObserverInit);
			this.#observers.push(observer);
		} catch {
			logService.warn('app', `PerformanceObserver does not support "${type}"`);
		}
	}
}

export const webVitals = new WebVitals();
