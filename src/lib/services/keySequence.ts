/**
 * Серія натискань однієї клавіші як службовий жест.
 *
 * **Чому окремий модуль, а не десять рядків у компоненті.** Тому що вся суть тут
 * у ЗАХИСТАХ, а захист, який ніхто не перевіряє, — це побажання. У сусідніх
 * проєктах цей самий жест написаний двічі й по-різному: `Slovko` має всі чотири
 * обмеження, `MindStep` — жодного, і там затиснута `R` у полі пошуку витирає всі
 * локальні дані за дві секунди без запитання. Різниця не в акуратності авторів, а
 * в тому, що логіка жила всередині обробника й не мала жодного тесту.
 *
 * **Чотири обмеження, і кожне закриває реальний спосіб спрацювати випадково.**
 *
 *  1. `event.repeat` — автоповтор клавіші дає ~30 подій за секунду, тобто
 *     затиснута клавіша набирає навіть поріг у 50 менш ніж за дві секунди.
 *     Затиснута клавіша — це не «серія натискань», це одне натискання.
 *  2. Поля вводу. Обробник висить на вікні, тож він працює й тоді, коли людина
 *     друкує в пошуку чи в назві. Слово «рррр» не має нічого запускати.
 *  3. Вікно між натисканнями. Без нього лічильник живе всю сесію: набравши
 *     потрібну літеру по одному разу протягом години, людина отримує жест,
 *     якого не робила.
 *  4. Будь-яка інша клавіша скидає лічильник. Це те, що робить жест саме
 *     СЕРІЄЮ, а не сумою.
 *
 * Поріг і вікно задає той, хто створює послідовність: ціна випадкового
 * спрацювання в різних жестів різна, і однакове число для них було б збігом, а
 * не рішенням.
 */

/** Мінімум того, що потрібно від події. Тест не мусить будувати справжній `KeyboardEvent`. */
export interface KeyStroke {
	code: string;
	repeat?: boolean;
	target?: EventTarget | null;
}

export interface KeySequenceOptions {
	/** `KeyboardEvent.code`, напр. `'KeyR'` — а не `key`: `code` не залежить від розкладки. */
	code: string;
	/**
	 * Скільком натисканням поспіль завершити жест.
	 *
	 * Функцією — коли поріг залежить від стану, який жест же й змінює: показати
	 * табло в проді коштує 55 натискань, а сховати назад — 5. Числом його тут
	 * задати неможливо, бо на момент створення послідовності потрібний поріг
	 * невідомий, а перестворювати її на кожну зміну стану означало б губити
	 * половину набраної серії.
	 */
	threshold: number | (() => number);
	/** Скільки часу дається на наступне натискання. Типово дві секунди. */
	windowMs?: number;
	onComplete: () => void;
}

export interface KeySequence {
	handle(stroke: KeyStroke): void;
	/** Скільки натискань уже набрано. Читають тести й діагностика. */
	readonly count: number;
	/** Скинути лічильник і зняти таймер. Кличеться при знищенні компонента. */
	reset(): void;
}

/**
 * Чи друкує людина зараз у полі.
 *
 * `closest`, а не порівняння `tagName`: фокус може стояти на елементі всередині
 * `contenteditable`, і тоді сам `tagName` — це `SPAN`. `MindStep` перевіряє саме
 * `tagName`, тож редаговані блоки там не захищені.
 */
export function isTypingTarget(target: EventTarget | null | undefined): boolean {
	const element = target as HTMLElement | null | undefined;
	if (!element || typeof element.closest !== 'function') return false;
	return element.closest(
		'input, textarea, select, [contenteditable]:not([contenteditable="false"])'
	) !== null;
}

export function createKeySequence(options: KeySequenceOptions): KeySequence {
	const windowMs = options.windowMs ?? 2000;
	let count = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	function reset(): void {
		count = 0;
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	return {
		get count() {
			return count;
		},
		reset,
		handle(stroke: KeyStroke): void {
			// Автоповтор і набір тексту не рахуються — але й не скидають лічильник:
			// натиснути потрібну клавішу, зачепивши поле вводу, і втратити вже
			// набране було б поведінкою, якої ніхто не пояснить.
			if (stroke.repeat) return;
			if (isTypingTarget(stroke.target)) return;

			if (stroke.code !== options.code) {
				reset();
				return;
			}

			count++;
			if (timer !== undefined) clearTimeout(timer);

			// Поріг читається НА КОЖНЕ натискання: він міг змінитися від попереднього
			// спрацювання цього ж жесту.
			const threshold =
				typeof options.threshold === 'function' ? options.threshold() : options.threshold;

			if (count >= threshold) {
				reset();
				options.onComplete();
				return;
			}

			timer = setTimeout(reset, windowMs);
		}
	};
}
