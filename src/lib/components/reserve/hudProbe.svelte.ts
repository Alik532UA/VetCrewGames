import type { MetricSet } from '$lib/reserve/types';

/**
 * Як відкривається й ТРИМАЄТЬСЯ підказка над показником.
 *
 * Було зламано просто: `onmouseleave` кнопки закривав вікно негайно, а саме вікно
 * висіло на чотири пікселі нижче. Курсор, ідучи до нього, виходив із кнопки — і
 * підказка зникала рівно на півдорозі. Довести до неї мишу було фізично
 * неможливо, а в ній тепер розклад причин, який ще й гортається.
 *
 * Лікується у три руки, і жодної з них замало окремо:
 *
 *  1. Проміжок малює прозора рамка самої підказки (`HudHistory`), тож курсор між
 *     кнопкою й вікном не виходить нікуди.
 *  2. Наведення на підказку скасовує закриття — вона сама тримає себе відкритою.
 *  3. Закриття відкладене на чверть секунди: покриває дрижання руки на трекпаді
 *     й події, які приходять там, де рука не рухалася взагалі.
 *
 * Плюс закріплення кліком — без нього дотик лишався б ні при чому: наведення там
 * не існує, тап дає фокус, а перший же рух пальцем по списку фокус забирає.
 *
 * Живе окремим файлом, бо це РЕЖИМ РОБОТИ, а не деталь шапки: та сама потреба
 * зʼявиться в будь-якій підказці, у яку треба зайти.
 */

/** Скільки триматися після того, як курсор пішов. */
const LEAVE_MS = 260;

export type Metric = keyof MetricSet;

export interface Probe {
	/** Чия історія розкрита; `null` — жодна. */
	readonly open: Metric | null;
	/** Чи саме ця закріплена: закріплена не зникає від того, що курсор пішов. */
	pinnedOn(metric: Metric): boolean;
	show(metric: Metric): void;
	hide(): void;
	togglePin(metric: Metric): void;
	unpin(): void;
}

/**
 * Викликається під час створення компонента — тому це функція, а не клас:
 * `$effect` усередині мусить належати компонентові, який його ж і прибере.
 */
export function hudProbe(): Probe {
	let open = $state<Metric | null>(null);
	let pinned = $state<Metric | null>(null);
	let closing: ReturnType<typeof setTimeout> | null = null;

	const stop = () => {
		if (closing) clearTimeout(closing);
		closing = null;
	};

	$effect(() => {
		// Прибирання обовʼязкове: інакше таймер добіжить у вже знищеному компоненті
		// й писатиме в стан, якого немає.
		return stop;
	});

	return {
		get open() {
			return open;
		},

		pinnedOn(metric) {
			return pinned === metric;
		},

		show(metric) {
			stop();
			open = metric;
		},

		hide() {
			// Закріплене наведенням не закривається: його закриють кнопкою або Escape.
			if (pinned) return;
			stop();
			closing = setTimeout(() => {
				open = null;
				closing = null;
			}, LEAVE_MS);
		},

		togglePin(metric) {
			if (pinned === metric) {
				this.unpin();
				return;
			}
			stop();
			pinned = metric;
			open = metric;
		},

		unpin() {
			stop();
			pinned = null;
			open = null;
		}
	};
}
