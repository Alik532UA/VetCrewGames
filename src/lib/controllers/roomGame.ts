import type { GoneReason, Member, Role, RoomTransport } from '$lib/net/roomTypes';
import type { RoomEnvelope } from '$lib/utils/roomEnvelope';

/*
 * ТЕ, ЧИМ СЕСІЯ КІМНАТИ ГОВОРИТЬ ІЗ ГРОЮ Й СТОРІНКОЮ, — окремо від самої сесії.
 *
 * Самі лише типи: сесія стояла на межі розміру (`structure.test.ts`), а
 * договір між нею, матчем і сторінкою — не її логіка. Сторінки й далі беруть
 * їх із `roomSession.svelte.ts`: там вони перевидані.
 */

/**
 * Що сесії треба знати про матч — спільне для «Знайди пару» й вікторини.
 *
 * Поля кімнати — з КОНВЕРТА (`RoomEnvelope`), а не переліком тут: доти вони стояли
 * третьою копією поруч з обома матчами, і нове поле кімнати мусило не забутися в
 * кожній (шостий аудит). Обидва матчі тепер успадковують `RoomEnvelopeState`.
 */
export interface RoomMatch extends Readonly<RoomEnvelope> {
	listen(): () => void;
	readonly players: Member[];
	readonly seed: number;
	readonly over: boolean;
	readonly gone: GoneReason | null;
	/** Скільки ходів база не прийняла: перший такий — привід звірити правила. */
	readonly refused: number;
	takeLead(): Promise<boolean>;
}

/** Чим гра відрізняється від іншої гри — рівно те, чого сесія знати не може. */
export interface RoomGame<M extends RoomMatch> {
	readonly gameId: 'pairs' | 'quiz';
	readonly rulesVersion: number;
	/** Скільки гравців потрібно, щоб почати. */
	readonly minPlayers: number;
	/** Роль новачка в УЖЕ розпочатій партії. */
	readonly lateRole: Role;
	/** Чи вмикати відлік автостарту за такої кількості гравців. */
	autoStartReady(players: number): boolean;
	newRoom(): { seed: number; config: Record<string, number> };
	/**
	 * Зерно РЕВАНШУ, коли гра веде облік кімнати між партіями: вікторина кладе номер
	 * партії в старші розряди зерна (`utils/quizDeck.ts`), щоб питання не
	 * повторювалися до вичерпання пулу. Немає — реванш бере нове зерно `newRoom`.
	 */
	rematchSeed?(match: M): number;
	/**
	 * Налаштування, які старт (і реванш) пише ТИМ САМИМ записом: «Знайди пару»
	 * вибирає тут спільну сітку за найменшим екраном серед присутніх (рішення
	 * автора 2026-09-26). Немає — налаштування кімнати лишаються як є.
	 */
	startConfig?(members: readonly Member[], online: readonly string[]): Record<string, number>;
	createMatch(me: string, transport: RoomTransport): M;
	/**
	 * Позначка малого екрана для свого рядка складу (`Member.compact`): за нею старт
	 * «Знайди пару» вибирає спільну сітку. Екран читає адаптер гри, а не мережа
	 * (шостий аудит, A3). Немає — позначка не пишеться: гра нею не користується.
	 */
	compact?(): boolean;
	/**
	 * Що кладе в запис переліку понад спільне (набір ігор вікторини) — З КІМНАТИ,
	 * а не зі сторінки: перелік тепер переоголошує й господар, що повернувся, і той,
	 * хто перехопив ведення (аудит 2026-09-25).
	 */
	listingExtras?(match: M): { games?: Record<string, number> };
	/** Присутність приїхала — що з нею робить гра. */
	onPresence?(match: M, online: string[], now: number): void;
	/** Додаткові підписки на час кімнати (підсвітка наведення в парах). */
	listen?(code: string): Promise<Array<() => void>>;
	/** Бали за партію. Що їх дадуть РІВНО раз, стежить сесія. */
	award(match: M, me: string): void;
	/** Як часто цокати годиннику, мс; `null` — не цокати. */
	clockEvery(match: M): number | null;
}

/** Адреса сторінки: сесія про маршрутизацію не знає нічого. */
export interface RoomPlace {
	/** Код кімнати з адреси; порожньо — адреса без кімнати. */
	urlRoom(): string;
	/**
	 * Адреса — посилання «перейти» з кімнати ІНШОЇ гри (`?move=1`, `utils/crossGame`):
	 * група переїжджає разом, і вікна «вас запросили» їй не треба.
	 */
	moved(): boolean;
	/** Записати код у адресу КРОКОМ в історії. */
	remember(code: string): Promise<void>;
	/** Зі знесеної чи закритої кімнати — геть. */
	exit(): Promise<void>;
	/** Сказати СТАРІЙ кімнаті, куди переїхала гра (`?from` в адресі). */
	announce(code: string): Promise<void>;
	/**
	 * СТОРІНКА ГРИ БЕЗ КІМНАТИ — ЛИШЕ ДВЕРІ (хаб «Грати онлайн», рішення автора 2026-09-26).
	 * Форми входу тут більше немає: кімнату створюють і шукають на хабі, а сюди приходять
	 * уже з наміром. `?create=friends|everyone` — створити кімнату (`true` — лише друзі);
	 * `null` — такого наміру в адресі немає.
	 */
	creating(): boolean | null;
	/**
	 * `?from` без `?create`: господар переїжджає з групою в цю гру (`utils/crossGame`), і
	 * сторінка питає лише, хто зможе зайти в нову кімнату.
	 */
	choosing(): boolean;
	/** На хаб — замість адреси, де лишилися двері без наміру. */
	hub(): Promise<void>;
	/** Створити нову кімнату тут же (`?create`) — кімнату, яку нікому вести, замінити. */
	recreate(isPrivate: boolean): Promise<void>;
	/**
	 * Кімната з адреси — ІНШОЇ гри: піти на її сторінку з тим самим кодом, а не казати
	 * «ця кімната для іншої гри». `false` — гри такої не знаємо, і тоді відмова лишається.
	 */
	elsewhere(gameId: string, code: string): boolean;
}
