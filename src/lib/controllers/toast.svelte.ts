import type { TranslationKey } from '$lib/i18n/translations/uk';
import type { NetProblem } from '$lib/utils/netProblem';

/**
 * Тимчасові сповіщення (NOTIFICATIONS-v8 § 2).
 *
 * Контролер, а не прапорець у компоненті: тост має бути доступний звідусіль
 * одним викликом, а таймер із паузою — жити в одному місці. Копія цієї логіки
 * в секції не переноситься, і при переносі з неї губиться саме пауза.
 *
 * Повідомлення тут — КЛЮЧІ словника, а не готові рядки: сайт чотиримовний, і
 * текст, зібраний у контролері, довелося б перекладати повз `t()`.
 */
export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastAction {
	labelKey: TranslationKey;
	onAction: () => void;
}

export interface ToastMessage {
	id: number;
	type: ToastType;
	/**
	 * Ключ головного словника. Відсутній — текст уже готовий (`message`).
	 *
	 * Два поля, а не одне: ключ мусить перекладатися В МИТЬ ПОКАЗУ, бо мову можна
	 * перемкнути, поки тост на екрані. Готовий текст перекласти вже нічим — його
	 * дає той, хто тримає лінивий словник (`toast.say`).
	 */
	messageKey?: TranslationKey;
	/** Готовий текст — для рядків із лінивих словників. */
	message?: string;
	action?: ToastAction;
	/** Скільки живе. Те саме число йде і в таймер, і в анімацію смужки. */
	duration: number;
	/**
	 * Тост про причину збою (`problem()`): за цим полем новий збій ЗАМІНЮЄ старий, а
	 * новий натиск «шукати» чи «підключитися» прибирає його зовсім.
	 */
	problem?: NetProblem;
	/** Під текстом — «Скопіювати звіт» і «Звʼязатися з розробником» (`ToastReport`). */
	report?: boolean;
	/** Людина взялася за дії тоста — сам він більше не зникає (`pin`), і смужки немає. */
	pinned?: boolean;
}

interface TimerInfo {
	id: number;
	timerId: ReturnType<typeof setTimeout> | null;
	startTime: number;
	elapsed: number;
	duration: number;
	/**
	 * Скільки причин паузи активні. Лічильник, а не прапорець: миша й фокус
	 * приходять незалежно, і відведення миші при живому фокусі не має
	 * відновлювати таймер (§ 2.1).
	 */
	holds: number;
	/** Закріплений (`pin`): жодне відведення миші вже не відновлює таймера. */
	pinned: boolean;
}

/**
 * Скільки тостів на екрані водночас.
 *
 * Було три, і разом із довгими сповіщеннями заповідника (`WORLD_EVENT_MS`) це
 * давало протилежне до задуманого: стос майже завжди повний, тож нова подія
 * виштовхує НЕПРОЧИТАНУ. Пʼять — стільки, скільки подій доба заповідника
 * реально видає за раз (смерть, голод, наліт, контракт), і все ще не стіна.
 */
const MAX_TOASTS = 5;

/**
 * ПОДІЯ СВІТУ живе тридцять секунд, а не чотири.
 *
 * Прохання автора: «таймер сповіщень занадто швидкий, очікуваний результат — 30
 * секунд». Тут це не кругле число: доба заповідника на ×1 триває рівно 30 с
 * (`TICK_MS` 100 × `TICKS_PER_DAY` 300), тобто сповіщення живе стільки, скільки
 * той день, про який воно розповідає.
 *
 * Тридцять секунд НЕ на все: відмова на власний клік («у мінусі не
 * розширитися») — це відповідь на щойно натиснуту кнопку, і півхвилини вона
 * тільки займала б кут. Тому число окреме й приходить у виклик параметром — див.
 * мапу `NEWS` у `ReserveGame.svelte`.
 *
 * Пауза на наведенні й фокусі при цьому важливіша, ніж була: тридцять секунд
 * дають час прочитати, а WCAG 2.2.1 вимагає, щоб цей час можна було ще й
 * продовжити.
 */
export const WORLD_EVENT_MS = 30_000;

/**
 * Відмова на власну дію — пʼять секунд.
 *
 * Канонічна референсна реалізація дає помилці сім (більше тексту — більше часу
 * на читання). Тут інший випадок: рядки `reserve.reject.*` — це одне коротке
 * речення у відповідь на щойно натиснуту кнопку, і поруч із тридцятисекундними
 * новинами сім секунд читаються як «щось важливе». Пʼять — рішення автора.
 */
export const REJECT_MS = 5000;

/**
 * ТОСТ ПРО ЗБІЙ — ПʼЯТНАДЦЯТЬ СЕКУНД, а не сім (прохання автора 2026-09-27).
 *
 * Доти збій пошуку був сім секунд «спробуйте ще раз». Тепер текст — два-три речення з
 * причиною, а під ним дії (оновити, скопіювати звіт, написати розробнику), і семи секунд
 * не вистачає, щоб і прочитати, і вирішити. Пауза на наведенні й фокусі лишається, а
 * щойно людина взялася за дію, тост закріплюється (`pin`) — інакше він зник би, поки
 * вона вставляє звіт у месенджер.
 */
export const PROBLEM_MS = 15_000;

/**
 * ЩО СКАЗАТИ Й ЩО ЗАПРОПОНУВАТИ на кожну причину (`utils/netProblem.ts`). Оновлення —
 * лише старій сторінці; звіт і розробник — лише тому, чого людина сама не виправить.
 * «Немає звʼязку» — без дій: повтор і є ліки, а кнопка, що впала, стоїть на місці.
 */
const PROBLEM: Record<
	NetProblem,
	{ key: TranslationKey; type: ToastType; reload: boolean; report: boolean }
> = {
	offline: { key: 'problem.offline', type: 'warn', reload: false, report: false },
	reload: { key: 'problem.reload', type: 'warn', reload: true, report: false },
	mismatch: { key: 'problem.mismatch', type: 'warn', reload: true, report: true },
	rules: { key: 'problem.rules', type: 'warn', reload: false, report: true },
	code: { key: 'problem.code', type: 'error', reload: false, report: true },
	// Лише в dev: команда стоїть у самому тексті — її вставляють у термінал.
	emulator: { key: 'problem.emulator', type: 'warn', reload: false, report: false }
};

class ToastState {
	messages = $state<ToastMessage[]>([]);
	#nextId = 0;
	#timers = new Map<number, TimerInfo>();

	#arm(info: TimerInfo) {
		const remaining = Math.max(0, info.duration - info.elapsed);
		info.startTime = Date.now();
		info.timerId = setTimeout(() => this.remove(info.id), remaining);
	}

	/** Поставити тост і завести його таймер. Спільне для всіх способів показати тост. */
	#push(message: Omit<ToastMessage, 'id'>): void {
		const id = this.#nextId++;
		this.messages.push({ id, ...message });
		if (this.messages.length > MAX_TOASTS) this.remove(this.messages[0].id);

		const { duration } = message;
		const info: TimerInfo = {
			id,
			timerId: null,
			startTime: 0,
			elapsed: 0,
			duration,
			holds: 0,
			pinned: false
		};
		this.#timers.set(id, info);
		this.#arm(info);
	}

	add(type: ToastType, messageKey: TranslationKey, duration: number, action?: ToastAction) {
		this.#push({ type, messageKey, action, duration });
	}

	/**
	 * ТОСТ ПРО ПРИЧИНУ ЗБОЮ (прохання автора 2026-09-27): «правила ще не викладені»,
	 * «сторінка стара», «проблема в коді» — замість «спробуйте ще раз» на все. Той самий
	 * тост, що й решта, лише текст, дії й час — від причини. Попередній такий тост
	 * замінюється: дві причини одного збою поруч лише плутали б.
	 */
	problem(problem: NetProblem): void {
		this.dismissProblems();
		const advice = PROBLEM[problem];
		this.#push({
			type: advice.type,
			messageKey: advice.key,
			duration: PROBLEM_MS,
			problem,
			report: advice.report,
			action: advice.reload
				? { labelKey: 'pairs.reload', onAction: () => location.reload() }
				: undefined
		});
	}

	/** Прибрати тости про збій: людина пробує знову, і стара причина вже нічого не каже. */
	dismissProblems(): void {
		for (const message of this.messages.filter((one) => one.problem !== undefined)) {
			this.remove(message.id);
		}
	}

	/**
	 * Закріпити тост: людина взялася за його дії (скопіювала звіт, розгорнула контакти),
	 * і зникнути посеред цього він не має права. Закрити — хрестиком.
	 */
	pin(id: number): void {
		const info = this.#timers.get(id);
		if (!info) return;
		if (info.timerId) clearTimeout(info.timerId);
		info.timerId = null;
		info.pinned = true;
		const message = this.messages.find((one) => one.id === id);
		if (message) message.pinned = true;
	}

	/**
	 * ТОСТ ІЗ ГОТОВИМ ТЕКСТОМ, а не з ключем головного словника.
	 *
	 * Потрібен тим екранам, чиї рядки лежать у ЛІНИВОМУ чанку: словник вибору
	 * «найняти / зробити самому» (`i18n/reserveCare`) не входить у головний
	 * навмисно — він коштував кілобайт у чанку, який везе кожен відвідувач, заради
	 * вікна, яке побачить лише той, хто дійшов до заповідника.
	 *
	 * Ключ тут не підійшов би за побудовою: `TranslationKey` перелічує саме
	 * головний словник, і лінивого рядка в цьому типі немає й не мусить бути.
	 *
	 * Перекладає той, хто кличе — він і тримає завантажений словник. Тост лише
	 * показує; підстановку шрифту (`formatFont`) робить сам компонент, як і для
	 * ключів.
	 */
	say(type: ToastType, message: string, duration = 4000) {
		this.#push({ type, message, duration });
	}

	// Тривалості за ERROR-HANDLING: info 3s, warn 5s, error 7s; success 4s.
	success(key: TranslationKey, duration = 4000, action?: ToastAction) {
		this.add('success', key, duration, action);
	}
	info(key: TranslationKey, duration = 3000, action?: ToastAction) {
		this.add('info', key, duration, action);
	}
	warn(key: TranslationKey, duration = 5000, action?: ToastAction) {
		this.add('warn', key, duration, action);
	}
	error(key: TranslationKey, duration = 7000, action?: ToastAction) {
		this.add('error', key, duration, action);
	}

	/** Наведення АБО фокус. Причини рахуються, а не перезаписуються. */
	pause(id: number) {
		const info = this.#timers.get(id);
		if (!info) return;
		info.holds += 1;
		if (info.holds > 1 || info.timerId === null) return;

		clearTimeout(info.timerId);
		// Запам'ятовуємо, скільки вже минуло: без цього відновлення пішло б із
		// повної тривалості, і тост жив би довше, ніж обіцяв (§ 3).
		info.elapsed = Math.min(info.elapsed + (Date.now() - info.startTime), info.duration);
		info.timerId = null;
	}

	/** Таймер іде далі лише коли зникли ВСІ причини паузи. */
	resume(id: number) {
		const info = this.#timers.get(id);
		if (!info) return;
		if (info.holds > 0) info.holds -= 1;
		if (info.holds > 0 || info.timerId !== null || info.pinned) return;
		this.#arm(info);
	}

	remove(id: number) {
		const info = this.#timers.get(id);
		if (info?.timerId) clearTimeout(info.timerId);
		this.#timers.delete(id);
		const index = this.messages.findIndex((message) => message.id === id);
		if (index !== -1) this.messages.splice(index, 1);
	}

	/** Чи вже висить такий самий: інакше кожна зміна розміру додавала б копію. */
	has(messageKey: TranslationKey): boolean {
		return this.messages.some((message) => message.messageKey === messageKey);
	}
}

export const toast = new ToastState();
