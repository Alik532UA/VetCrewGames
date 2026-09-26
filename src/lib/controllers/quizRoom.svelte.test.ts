import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import { gamesToConfig, ONLINE_GAMES } from '$lib/config/quizOnline';

/**
 * ВІКТОРИНА ДЛЯ СЕСІЇ — адаптер, стан чекання й реакції, що доти жили в маршруті
 * (аудит 2026-09-24): оголошення раундів і пауза за відсутнім не мали жодного
 * тесту.
 *
 * Зворотні експерименти: оголошувати раунди будь-кому, а не ведучому, — червоніє
 * «не ведучий раунду не оголошує»; прибрати ефект паузи — «відсутній, що не
 * відповів, спиняє час».
 */

const playerData = { awardQuizMatch: vi.fn() };
vi.mock('$lib/services/playerData.svelte', () => ({ playerData }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { addScore: vi.fn(), locale: 'uk' } }));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { QuizMatch } = await import('./quizMatch.svelte');
const { QuizRoom, QUIZ_MIN_PLAYERS, LATE_ANNOUNCE_MS } = await import('./quizRoom.svelte');
const { QUIZ_RULES_VERSION } = await import('$lib/config/roomRules');
const { logService } = await import('$lib/services/logService.svelte');

type Match = InstanceType<typeof QuizMatch>;

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const members = (): Member[] => [
	{ uid: HOST, name: 'Лідер', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

const info = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'quiz',
	rulesVersion: QUIZ_RULES_VERSION,
	seed: 20260824,
	status: 'playing',
	roster: rosterOf(members()),
	hostUid: HOST,
	config: gamesToConfig(ONLINE_GAMES.map((game) => game.id)),
	...over
});

/** Кілька мікрозадач: запис у журнал і знімок, що його приносить. */
const settle = async () => {
	for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
	flushSync();
};

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	vi.clearAllMocks();
});

/** Сесія очима реакцій: матч, я й годинник — реактивно, як у `RoomSession`. */
function host(match: Match, me: string, clock = 0) {
	const seat = $state({ match: match as Match | null, me, clock, code: '42' });
	return seat;
}

describe('адаптер вікторини', () => {
	it('версія, мінімум і роль новачка — з гри', () => {
		const quiz = new QuizRoom(() => 0.5);
		expect(quiz.game.rulesVersion).toBe(QUIZ_RULES_VERSION);
		expect(quiz.game.minPlayers).toBe(QUIZ_MIN_PLAYERS);
		expect(quiz.game.lateRole).toBe('player');
	});

	it('нова кімната й «швидка гра» — з вибраного набору ігор', () => {
		const quiz = new QuizRoom(() => 0.5);
		const only = [ONLINE_GAMES[0].id];
		quiz.picked = only;

		expect(quiz.game.newRoom().config).toEqual(gamesToConfig(only));
		expect(quiz.game.fitsQuick?.({ games: gamesToConfig(only) } as never)).toBe(true);
	});

	/**
	 * ЗАПИС ПЕРЕЛІКУ — З НАБОРУ КІМНАТИ, а не з фільтра на формі входу (аудит
	 * 2026-09-25): перелік переоголошує й господар після перезавантаження, і новий
	 * господар після перехоплення — у обох фільтр інший, ніж у кімнаті.
	 *
	 * Зворотний експеримент: повернути `this.picked` — червоніє.
	 */
	it('запис переліку несе набір кімнати, а не фільтр', () => {
		const quiz = new QuizRoom(() => 0.5);
		const inRoom = [ONLINE_GAMES[1].id];
		const room = new LocalRoom(info({ config: gamesToConfig(inRoom) }), members());
		const match = new QuizMatch(HOST, room.transport());
		const off = match.listen();
		quiz.picked = [ONLINE_GAMES[0].id];

		expect(quiz.game.listingExtras?.(match)).toEqual({ games: gamesToConfig(inRoom) });
		off();
	});

	it('присутність іде в матч, а мить зникнення — у стан чекання', () => {
		const quiz = new QuizRoom(() => 0.5);
		const room = new LocalRoom(info(), members());
		const match = new QuizMatch(HOST, room.transport());
		const off = match.listen();

		quiz.game.onPresence?.(match, [HOST], 5_000);

		expect(match.present).toEqual([HOST]);
		expect(quiz.awaySince).toEqual({ [GUEST]: 5_000 });
		off();
	});

	it('глядачеві балів немає', () => {
		const quiz = new QuizRoom(() => 0.5);
		const eye: Member = { uid: 'uid-eye', name: 'Око', role: 'spectator', order: 3 };
		const room = new LocalRoom(info(), [...members(), eye]);
		const watcher = new QuizMatch(eye.uid, room.transport());
		const off = watcher.listen();

		quiz.game.award(watcher, eye.uid);

		expect(playerData.awardQuizMatch).not.toHaveBeenCalled();
		off();
	});
});

describe('реакції вікторини', () => {
	it('ведучий оголошує перший раунд, щойно партія почалася', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		const quiz = new QuizRoom(() => 0.5);
		const seat = host(lead, HOST);
		cleanup = $effect.root(() => quiz.attach(seat));

		await settle();

		expect(lead.round).toBe(0);
		off();
	});

	it('не ведучий раунду не оголошує', async () => {
		const room = new LocalRoom(info(), members());
		// Не лише «раунду немає»: такий хід перепрогін однаково відкинув би. Ходу не
		// мусить бути зовсім — інакше кожен гість писав би сміття щотакту.
		const append = vi.fn(room.transport().append);
		const guest = new QuizMatch(GUEST, { ...room.transport(), append });
		const off = guest.listen();
		const quiz = new QuizRoom(() => 0.5);
		const seat = host(guest, GUEST);
		cleanup = $effect.root(() => quiz.attach(seat));

		await settle();

		expect(guest.round).toBe(-1);
		expect(append).not.toHaveBeenCalled();
		off();
	});

	/**
	 * ПАРТІЯ ЧЕКАЄ — І МІЖ РАУНДАМИ ТЕЖ (аудит 2026-09-25). Доти раунд, у якому всі
	 * присутні вже відповіли, кінчався, і ведучий оголошував наступний під вікном
	 * «Чекаємо» на весь екран.
	 *
	 * Зворотний експеримент: прибрати умову `wait.hold` — червоніє.
	 */
	it('поки партія чекає, наступного раунду не оголошують', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		await lead.answer(1);
		const quiz = new QuizRoom(() => 0.5);
		const now = room.tick(0);
		quiz.game.onPresence?.(lead, [HOST], now);
		const seat = host(lead, HOST, now);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();
		expect(quiz.wait.hold, 'перевірка жива: гість не відповів і зник').toBe(true);

		// Далеко за табло: без умови ведучий уже оголосив би наступний.
		seat.clock = now + 120_000;
		flushSync();
		await settle();

		expect(lead.round).toBe(0);
		off();
	});

	/**
	 * ЗАСТАВ РАУНД ПРОСТРОЧЕНИМ — ДАТИ ДОЇХАТИ ЧУЖИМ ПАУЗАМ (аудит 2026-09-25).
	 * Ведучий, що перезавантажився, доти оголошував наступний раунд на першому ж
	 * такті, раніше, ніж доїжджали записи паузи тих, хто стояв через нього.
	 *
	 * Зворотний експеримент: прибрати `LATE_ANNOUNCE_MS` — червоніє «одразу — ні».
	 */
	it('ведучий, що застав раунд уже простроченим, чекає, а тоді оголошує', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		// Десять хвилин по тому: я не дивився, коли раунд скінчився.
		const late = room.tick(0) + 600_000;
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST, GUEST], late);
		const seat = host(lead, HOST, late);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();
		await settle();
		expect(lead.round, 'одразу — ні').toBe(0);

		seat.clock = late + LATE_ANNOUNCE_MS;
		flushSync();
		await settle();

		expect(lead.round).toBe(1);
		off();
	});

	it('відсутній, що не відповів, спиняє час', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST], 1_000);
		const seat = host(lead, HOST, 1_000);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();
		expect(quiz.wait.hold, 'перевірка жива: партія чекає').toBe(true);

		seat.clock = 6_000;
		flushSync();

		expect(lead.heldMs(6_000)).toBe(5_000);
		off();
	});

	/**
	 * ЧЕКАННЯ — У ЖУРНАЛ, з кодом кімнати (аудит 2026-09-25): доти звіт про «вікторина
	 * зависла» не мав з чим звіритися.
	 *
	 * Зворотний експеримент: прибрати запис у журнал — червоніє.
	 */
	it('чекання, що почалося й скінчилося, лишає в журналі по рядку', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST], 1_000);
		const seat = host(lead, HOST, 1_000);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();

		quiz.game.onPresence?.(lead, [HOST, GUEST], 2_000);
		seat.clock = 2_000;
		flushSync();

		const lines = vi
			.mocked(logService.info)
			.mock.calls.filter(([, message]) => String(message).startsWith('quiz hold'))
			.map(([, message, data]) => `${message}:${(data as { code: string }).code}`);
		expect(lines).toEqual(['quiz hold opened:42', 'quiz hold released:42']);
		off();
	});
});
