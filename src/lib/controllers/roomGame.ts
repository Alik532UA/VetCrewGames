import type { LobbyRoom } from '$lib/net/lobby';
import type {
	GoneReason,
	Member,
	Role,
	RoomStatus,
	RoomTransport,
	RosterEntry
} from '$lib/net/roomTypes';

/*
 * ТЕ, ЧИМ СЕСІЯ КІМНАТИ ГОВОРИТЬ ІЗ ГРОЮ Й СТОРІНКОЮ, — окремо від самої сесії.
 *
 * Самі лише типи: сесія стояла на межі розміру (`structure.test.ts`), а
 * договір між нею, матчем і сторінкою — не її логіка. Сторінки й далі беруть
 * їх із `roomSession.svelte.ts`: там вони перевидані.
 */

/** Що сесії треба знати про матч — спільне для «Знайди пару» й вікторини. */
export interface RoomMatch {
	listen(): () => void;
	readonly members: Member[];
	readonly players: Member[];
	/** Заморожений склад: на нього спирається правило перехоплення ведення. */
	readonly roster: readonly RosterEntry[] | null;
	readonly status: RoomStatus;
	readonly hostUid: string;
	readonly countdownAt: number | null;
	readonly autoStart: boolean;
	readonly listed: boolean;
	/** Коли кімнату створено; `null` — кімната старша за поле. */
	readonly createdAt: number | null;
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
	/** Кімната «вільна» для швидкої гри, поки гравців менше. */
	readonly quickSeats: number;
	/** Роль новачка в УЖЕ розпочатій партії. */
	readonly lateRole: Role;
	/** Чи вмикати відлік автостарту за такої кількості гравців. */
	autoStartReady(players: number): boolean;
	newRoom(): { seed: number; config: Record<string, number> };
	/**
	 * Зерно РЕВАНШУ, коли гра веде облік кімнати між партіями: вікторина кладе номер
	 * партії в старші розряди зерна (`config/quizDeck.ts`), щоб питання не
	 * повторювалися до вичерпання пулу. Немає — реванш бере нове зерно `newRoom`.
	 */
	rematchSeed?(match: M): number;
	createMatch(me: string, transport: RoomTransport): M;
	/**
	 * Що кладе в запис переліку понад спільне (набір ігор вікторини) — З КІМНАТИ,
	 * а не зі сторінки: перелік тепер переоголошує й господар, що повернувся, і той,
	 * хто перехопив ведення (аудит 2026-09-25).
	 */
	listingExtras?(match: M): { games?: Record<string, number> };
	fitsQuick?(room: LobbyRoom): boolean;
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
	/** Записати код у адресу КРОКОМ в історії. */
	remember(code: string): Promise<void>;
	/** Зі знесеної чи закритої кімнати — геть. */
	exit(): Promise<void>;
	/** Сказати СТАРІЙ кімнаті, куди переїхала гра (`?from` в адресі). */
	announce(code: string): Promise<void>;
}
