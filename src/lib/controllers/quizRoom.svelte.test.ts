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
const { AWAY_HOLD_DELAY_MS } = await import('$lib/utils/awayWait');
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

	/**
	 * НОВА КІМНАТА — НОВИЙ ВІДЛІК (аудит 2026-09-26): позначки відсутності живуть в
	 * адаптері, спільному для всіх кімнат сторінки, і той самий гравець у новій
	 * кімнаті показував би час, що почав іти ще в старій.
	 *
	 * Зворотний експеримент: не скидати `awaySince` у `createMatch` — червоніє.
	 */
	it('позначки відсутності старої кімнати в нову не переходять', () => {
		const quiz = new QuizRoom(() => 0.5);
		const first = new LocalRoom(info(), members());
		const old = quiz.game.createMatch(HOST, first.transport());
		const off = old.listen();
		quiz.game.onPresence?.(old, [HOST], 5_000);
		expect(quiz.awaySince, 'перевірка жива: позначка стоїть').toEqual({ [GUEST]: 5_000 });
		off();

		const second = new LocalRoom(info(), members());
		quiz.game.createMatch(HOST, second.transport());

		expect(quiz.awaySince).toEqual({});
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
		// Зник не щойно, а вже досить давно, щоб партія стала його чекати.
		const seat = host(lead, HOST, now + AWAY_HOLD_DELAY_MS);
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

	/**
	 * ВЕДУЧИЙ ПЕРЕЗАВАНТАЖИВСЯ ПОСЕРЕД ЧУЖОЇ ПАУЗИ (аудит 2026-09-26). Його облік
	 * паузи — від перезавантаження, а не від її початку, тож раунд для нього
	 * «прострочився» ще до зняття паузи. Доти він оголошував наступний раунд на тому
	 * самому такті, на якому паузу знято, раніше, ніж доїжджав запис того, хто
	 * простояв її всю, — і решта губила залишок раунду, обіцяний паузою.
	 *
	 * Зворотний експеримент: повернути `if (this.wait.hold) return;` без чекання
	 * після зняття — червоніє.
	 */
	it('ведучий, що перезавантажився посеред паузи, після зняття чекає чужих записів', async () => {
		const room = new LocalRoom(info(), members());
		const guest = new QuizMatch(GUEST, room.transport());
		const stopGuest = guest.listen();
		const first = new QuizMatch(HOST, room.transport());
		const stopFirst = first.listen();
		await first.startRound(0);
		stopFirst();
		// Гість став на паузу на першій секунді раунду й простояв хвилину з половиною.
		const pausedAt = room.tick(1_000);
		await guest.pause();
		guest.setHold(true, pausedAt);
		const reloadAt = room.tick(60_000);

		// Ведучий «перезавантажився»: нова партія й нові реакції, посеред паузи.
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST, GUEST], reloadAt);
		const seat = host(lead, HOST, reloadAt);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();
		expect(quiz.wait.hold, 'перевірка жива: партія стоїть на паузі').toBe(true);

		// Годинник ведучого тикає й під паузою — на мить зняття він уже свіжий.
		const resumedAt = room.tick(30_000);
		seat.clock = resumedAt;
		flushSync();
		// Гість зняв паузу.
		await guest.resume();
		await settle();
		seat.clock = resumedAt + 100;
		flushSync();
		await settle();
		expect(lead.round, 'наступний раунд — на такті зняття паузи').toBe(0);

		// Запис того, хто простояв паузу всю, доїхав: раунд іще не скінчився.
		guest.setHold(false, resumedAt);
		await settle();
		seat.clock = resumedAt + LATE_ANNOUNCE_MS;
		flushSync();
		await settle();
		expect(lead.round, 'залишок раунду, обіцяний паузою, загублено').toBe(0);
		off();
		stopGuest();
	});

	it('відсутній, що не відповів, спиняє час', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST], 1_000);
		const opened = 1_000 + AWAY_HOLD_DELAY_MS;
		const seat = host(lead, HOST, opened);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();
		expect(quiz.wait.hold, 'перевірка жива: партія чекає').toBe(true);

		seat.clock = opened + 5_000;
		flushSync();

		expect(lead.heldMs(opened + 5_000)).toBe(5_000);
		off();
	});

	/**
	 * ЧЕКАННЯ — У ЖУРНАЛ, з кодом кімнати (аудит 2026-09-25): доти звіт про «вікторина
	 * зависла» не мав з чим звіритися.
	 *
	 * Зворотний експеримент: прибрати запис у журнал — червоніє.
	 */
	/**
	 * ПРОВАЛ ПРИСУТНОСТІ, КОРОТШИЙ ЗА ДВІ СЕКУНДИ (аудит 2026-09-26), — не чекання:
	 * ні вікна, ні запису в журнал, ні надбавки до раунду.
	 *
	 * Зворотний експеримент: рахувати відсутніх без затримки — червоніє.
	 */
	it('секундний провал присутності вікна не відкриває й раунду не подовжує', async () => {
		const room = new LocalRoom(info(), members());
		const append = vi.fn(room.transport().append);
		const lead = new QuizMatch(HOST, { ...room.transport(), append });
		const off = lead.listen();
		await lead.startRound(0);
		append.mockClear();
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST], 1_000);
		const seat = host(lead, HOST, 1_000);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();

		seat.clock = 1_000 + AWAY_HOLD_DELAY_MS - 100;
		flushSync();
		expect(quiz.wait.hold, 'вікно відкрилося на провал присутності').toBe(false);
		quiz.game.onPresence?.(lead, [HOST, GUEST], seat.clock);
		seat.clock += 100;
		flushSync();
		await settle();

		expect(append, 'провал присутності записано як чекання').not.toHaveBeenCalled();
		off();
	});

	it('чекання, що почалося й скінчилося, лишає в журналі по рядку', async () => {
		const room = new LocalRoom(info(), members());
		const lead = new QuizMatch(HOST, room.transport());
		const off = lead.listen();
		await lead.startRound(0);
		const quiz = new QuizRoom(() => 0.5);
		quiz.game.onPresence?.(lead, [HOST], 1_000);
		const seat = host(lead, HOST, 1_000 + AWAY_HOLD_DELAY_MS);
		cleanup = $effect.root(() => quiz.attach(seat));
		flushSync();

		quiz.game.onPresence?.(lead, [HOST, GUEST], 2_000 + AWAY_HOLD_DELAY_MS);
		seat.clock = 2_000 + AWAY_HOLD_DELAY_MS;
		flushSync();

		const lines = vi
			.mocked(logService.info)
			.mock.calls.filter(([, message]) => String(message).startsWith('quiz hold'))
			.map(([, message, data]) => `${message}:${(data as { code: string }).code}`);
		expect(lines).toEqual(['quiz hold opened:42', 'quiz hold released:42']);
		off();
	});
});
