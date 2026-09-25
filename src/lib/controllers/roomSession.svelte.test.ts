import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import type { RoomNet } from '$lib/net/roomNet';
import type { Member, RoomInfo, RoomTransport } from '$lib/net/roomTypes';

/**
 * СЕСІЯ КІМНАТИ — оркестровка, яка доти не мала жодного тесту.
 *
 * Вхід, присутність, перелік, відлік, нагорода, дії господаря й «кімнату закрито»
 * жили копіями на двох сторінках і брали мережу напряму — перевірити їх без бази
 * було нічим (аудит 2026-09-23). Тепер мережа — інтерфейс `RoomNet`, і тут її
 * заступає кімната в памʼяті; матч — справжній `PairsMatch`.
 */

const toast = { error: vi.fn(), info: vi.fn() };
const playerData = { beginOnline: vi.fn(), endOnline: vi.fn(), awardOnline: vi.fn() };
vi.mock('./toast.svelte', () => ({ toast }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk', addScore: vi.fn() } }));
vi.mock('$lib/services/playerData.svelte', () => ({ playerData }));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { RoomSession } = await import('./roomSession.svelte');
const { logService } = await import('$lib/services/logService.svelte');
const { LEAD_AFTER_MS } = await import('./roomPolicies.svelte');
const { PairsMatch } = await import('./pairsMatch.svelte');

type Session = InstanceType<typeof RoomSession<InstanceType<typeof PairsMatch>>>;

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const roomInfo = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'pairs',
	rulesVersion: 2,
	seed: 1234,
	status: 'lobby',
	hostUid: HOST,
	config: { pairs: 4, cols: 4 },
	...over
});

const members = (): Member[] => [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

/** Гра для сесії — «Знайди пару» в мініатюрі. */
const award = vi.fn();
const pairsGame = {
	gameId: 'pairs' as const,
	rulesVersion: 2,
	minPlayers: 2,
	quickSeats: 2,
	lateRole: 'spectator' as const,
	autoStartReady: (players: number) => players === 2,
	newRoom: () => ({ seed: 777, config: { pairs: 4, cols: 4 } }),
	createMatch: (me: string, transport: RoomTransport) => new PairsMatch(me, transport),
	award,
	listingExtras: vi.fn(() => ({})),
	clockEvery: () => null
};

/** Мережа кімнати в памʼяті: той самий `LocalRoom`, що в тестах правил партії. */
function fakeNet(room: LocalRoom, peek: RoomInfo | null, me: string) {
	const presence: Array<(uids: string[]) => void> = [];
	const links: Array<(connected: boolean) => void> = [];
	const net = {
		createRoom: vi.fn(async () => '42'),
		joinRoom: vi.fn(async () => {}),
		peekRoom: vi.fn(async () => peek),
		roomTransport: vi.fn(async () => room.transport()),
		closeRoom: vi.fn(async () => {}),
		me: vi.fn(async () => me),
		trackPresence: vi.fn(async () => () => {}),
		watchPresence: vi.fn(async (_code: string, onChange: (uids: string[]) => void) => {
			presence.push(onChange);
			return () => {};
		}),
		watchConnected: vi.fn(async (onChange: (connected: boolean) => void) => {
			links.push(onChange);
			onChange(true);
			return () => {};
		}),
		beat: vi.fn(() => () => {})
	} satisfies RoomNet;
	return {
		net,
		setOnline: (uids: string[]) => presence.forEach((notify) => notify(uids)),
		setConnected: (connected: boolean) => links.forEach((notify) => notify(connected))
	};
}

function stubs() {
	let url = '';
	const place = {
		urlRoom: () => url,
		remember: vi.fn(async (code: string) => {
			url = code;
		}),
		exit: vi.fn(async () => {
			url = '';
		}),
		announce: vi.fn(async () => {})
	};
	const player = {
		load: vi.fn(async () => {}),
		forEntry: vi.fn(() => 'Гравець'),
		forRoom: vi.fn(() => undefined),
		settle: vi.fn(),
		country: ''
	};
	const lobby = {
		takenNames: [] as string[],
		rooms: [],
		watch: vi.fn(() => () => {}),
		load: vi.fn(() => () => {}),
		publish: vi.fn(async () => {}),
		unpublish: vi.fn(),
		setPlayers: vi.fn(async () => {})
	};
	return { place, player, lobby };
}

let cleanup: (() => void) | null = null;

/** Сесія з поставленими політиками — як на сторінці, лише без компонента. */
function sessionFor(room: LocalRoom, peek: RoomInfo | null, me: string) {
	const { net, setOnline, setConnected } = fakeNet(room, peek, me);
	const { place, player, lobby } = stubs();
	let session!: Session;
	cleanup = $effect.root(() => {
		session = new RoomSession(pairsGame, place, player as never, lobby as never, net) as Session;
		session.attach();
	});
	return { session, net, place, lobby, setOnline, setConnected };
}

const settle = async () => {
	for (let tick = 0; tick < 6; tick += 1) await Promise.resolve();
	flushSync();
};

/** Сховище в памʼяті — той самий прийом, що в тестах `playerData` і `playerSync`. */
function memoryStorage(): Storage {
	const data: Record<string, string> = {};
	return {
		get length() {
			return Object.keys(data).length;
		},
		clear: () => Object.keys(data).forEach((key) => delete data[key]),
		getItem: (key: string) => data[key] ?? null,
		key: (index: number) => Object.keys(data)[index] ?? null,
		removeItem: (key: string) => void delete data[key],
		setItem: (key: string, value: string) => void (data[key] = String(value))
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
	cleanup?.();
	cleanup = null;
	vi.unstubAllGlobals();
});

describe('вхід у кімнату', () => {
	it('перевірка жива: створена кімната — у адресі, у переліку й під присутністю', async () => {
		// Публічна: `createRoom` пише `listed` сам, а підставка кімнату лише описує.
		// Щойно створена — з одним господарем.
		const room = new LocalRoom(roomInfo({ listed: true }), members().slice(0, 1));
		const { session, net, place, lobby } = sessionFor(room, null, HOST);

		await session.enter('create');
		await settle();

		expect(net.createRoom).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: 'pairs', rulesVersion: 2, seed: 777, isPrivate: false })
		);
		expect(place.remember).toHaveBeenCalledWith('42');
		expect(net.trackPresence).toHaveBeenCalledWith('42');
		expect(lobby.publish).toHaveBeenCalledWith(expect.objectContaining({ code: '42', players: 1 }));
		expect(playerData.beginOnline).toHaveBeenCalled();
		expect(session.match).not.toBeNull();
	});

	it('кімнати немає — не заходимо й кажемо чому', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, GUEST);
		session.joinCode = '42';

		await session.enter('join');

		expect(toast.error).toHaveBeenCalledWith('pairs.noRoom');
		expect(net.joinRoom).not.toHaveBeenCalled();
		expect(session.match).toBeNull();
	});

	it('версії за напрямком: кімната старша — «створіть нову», новіша — «оновіть сторінку»', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const older = sessionFor(room, roomInfo({ rulesVersion: 1 }), GUEST);
		older.session.joinCode = '42';
		await older.session.enter('join');
		expect(toast.error).toHaveBeenLastCalledWith('pairs.roomOlder');
		cleanup?.();

		const newer = sessionFor(room, roomInfo({ rulesVersion: 3 }), GUEST);
		newer.session.joinCode = '42';
		await newer.session.enter('join');
		expect(toast.error).toHaveBeenLastCalledWith('pairs.oldVersion');
	});

	it('у розпочату партію новачок заходить у ролі, яку дає гра', async () => {
		const room = new LocalRoom(roomInfo({ status: 'playing' }), members());
		const { session, net } = sessionFor(room, roomInfo({ status: 'playing' }), 'uid-late');
		session.joinCode = '42';

		await session.enter('join');

		expect(net.joinRoom).toHaveBeenCalledWith(
			'42',
			'Гравець',
			undefined,
			'',
			undefined,
			'spectator'
		);
	});

	it('помилка правил — порада про правила, а не «спробуйте ще раз»', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, HOST);
		net.createRoom.mockRejectedValueOnce(new Error('rules-missing'));

		await session.enter('create');

		expect(toast.error).toHaveBeenCalledWith('pairs.rulesMissing');
	});
});

describe('політики кімнати', () => {
	it('господар веде лічильник гравців у записі переліку', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, lobby } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		expect(lobby.setPlayers).toHaveBeenLastCalledWith('42', 2);
	});

	/**
	 * Дефект, що жив у вікторині: відлік умикався, коли гравців ставало досить, і
	 * НЕ ВИМИКАВСЯ, коли один виходив — партія починалася з одним гравцем.
	 */
	it('відлік автостарту гасне, коли гравців стало замало', async () => {
		const room = new LocalRoom(roomInfo({ autoStart: true }), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();
		expect(session.match?.countdownAt, 'двоє — відлік іде').not.toBeNull();

		room.setMembers([members()[0]]);
		await settle();
		expect(session.match?.countdownAt, 'один — відлік знято').toBeNull();
	});

	it('бали за партію — рівно раз, і після «перезавантаження» теж', async () => {
		const room = new LocalRoom(roomInfo({ status: 'playing' }), members());
		const first = sessionFor(room, null, HOST);
		await first.session.enter('create');
		await settle();
		const match = first.session.match!;
		// Партію завершено — так, як це робить хід `end`.
		match.endedBy = GUEST;
		flushSync();
		expect(award).toHaveBeenCalledTimes(1);
		cleanup?.();

		const again = sessionFor(room, null, HOST);
		await again.session.enter('create');
		await settle();
		again.session.match!.endedBy = GUEST;
		flushSync();
		expect(award, 'та сама кімната й зерно — вдруге не нараховується').toHaveBeenCalledTimes(1);
	});

	it('господаря немає досить довго — ведення підхоплює перший присутній гравець', async () => {
		const room = new LocalRoom(roomInfo({ status: 'playing' }), members());
		const { session, setOnline } = sessionFor(room, roomInfo({ status: 'playing' }), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		const takeLead = vi.spyOn(session.match!, 'takeLead').mockResolvedValue(true);

		setOnline([GUEST]);
		session.clock = 1_000_000;
		flushSync();
		expect(takeLead, 'щойно зник — ще рано').not.toHaveBeenCalled();

		session.clock = 1_000_000 + LEAD_AFTER_MS;
		flushSync();
		expect(takeLead).toHaveBeenCalledTimes(1);
	});

	it('кімнату знесли — «кімнату закрито» й геть із неї', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, place } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		room.close();
		await settle();

		expect(toast.info).toHaveBeenCalledWith('pairs.roomClosed');
		expect(place.exit).toHaveBeenCalled();
	});

	/**
	 * Доти сторінка при розмонтуванні знімала підписки, але не паузу локального
	 * рахунку: після онлайн-кімнати соло-ігри не додавали очок до перезавантаження.
	 */
	it('розмонтування знімає паузу локального рахунку', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');

		session.dispose();

		expect(playerData.endOnline).toHaveBeenCalled();
	});
});

/**
 * СКЛАД ПАРТІЇ заморожують старт і реванш, а вибулий вертається гравцем.
 *
 * Зворотні експерименти: прибрати склад зі `start()` — червоніє перший; брати
 * склад реваншу з `match.players` (тобто старий), а не з `members` — другий;
 * прибрати `inRoster` із `#join` — третій.
 */
describe('склад партії', () => {
	it('старт заморожує склад тим самим записом', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		await session.start();
		await settle();

		expect(session.match?.roster).toEqual([
			{ uid: HOST, name: 'Господар' },
			{ uid: GUEST, name: 'Гість' }
		]);
	});

	it('реванш грають ті, хто в кімнаті зараз', async () => {
		const roster = [...rosterOf(members()), { uid: 'uid-gone', name: 'Вибулий' }];
		const room = new LocalRoom(roomInfo({ status: 'playing', roster }), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		await session.rematch();
		await settle();

		expect(session.match?.roster?.map((entry) => entry.uid)).toEqual([HOST, GUEST]);
	});

	it('вибулий, що вертається посеред партії, заходить гравцем', async () => {
		const roster = [...rosterOf(members()), { uid: 'uid-back', name: 'Повернувся' }];
		const playing = roomInfo({ status: 'playing', roster });
		const room = new LocalRoom(playing, members());
		const { session, net } = sessionFor(room, playing, 'uid-back');
		session.joinCode = '42';

		await session.enter('join');

		expect(net.joinRoom).toHaveBeenCalledWith('42', 'Гравець', undefined, '', undefined, 'player');
	});
});

/**
 * ВІДМОВА БАЗИ НА АВТОМАТИЧНОМУ ЗАПИСІ НЕ СТАЄ КОЛОМ.
 *
 * Звіт автора 2026-09-24: новий клієнт проти опублікованих правил, що ще не знали
 * `info/roster`, — і «відлік вийшов → почати» стартував ~12 разів на секунду. SDK
 * показує свій запис одразу, а відмову приносить відкатом, і політика бачила
 * відкат як новий стан. `LocalRoom.refuseWrites` із `echo` відтворює саме це.
 *
 * Зворотний експеримент: прибрати перевірку `autoHalted` зі `start` і з політики
 * старту — червоніє «не повторюється по колу».
 */
describe('відмова бази на автоматичному записі', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('старт, який база відкинула, не повторюється по колу', async () => {
		vi.useFakeTimers();
		const { COUNTDOWN_MS } = await import('$lib/config/roomLife');
		const room = new LocalRoom(roomInfo({ autoStart: true }), members());
		room.refuseWrites(['setStatus']);
		const transport = room.transport({ echo: true });
		const setStatus = vi.spyOn(transport, 'setStatus');
		const { session, net, lobby } = sessionFor(room, null, HOST);
		net.roomTransport.mockResolvedValue(transport);

		await session.enter('create');
		await vi.advanceTimersByTimeAsync(0);
		expect(session.match?.countdownAt, 'відлік пішов').not.toBeNull();

		room.tick(COUNTDOWN_MS + 1000);
		await vi.advanceTimersByTimeAsync(COUNTDOWN_MS + 1000);
		await vi.advanceTimersByTimeAsync(3000);

		expect(setStatus, 'старт повторювався після відмови').toHaveBeenCalledTimes(1);
		expect(session.autoHalted).toBe(true);
		expect(toast.error).toHaveBeenCalledTimes(1);
		expect(lobby.unpublish, 'невдалий старт прибрав кімнату з переліку').not.toHaveBeenCalled();
	});

	/**
	 * ЗУПИНКА — ДЛЯ ТІЄЇ КІМНАТИ, а не для сторінки (аудит 2026-09-25). Доти вона
	 * переходила в кожну наступну кімнату: нова «швидка гра» не рахувала відлік, а
	 * скінчена партія не ставала `over`.
	 *
	 * Зворотний експеримент: не скидати `autoHalted` у `#open` — червоніє.
	 */
	it('наступна кімната починає з увімкненою автоматикою', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();
		session.autoHalted = true;

		session.leave();
		await session.enter('create');
		await settle();

		expect(session.autoHalted).toBe(false);
	});

	it('людина може почати й після зупинки — і почує відмову', async () => {
		const room = new LocalRoom(roomInfo(), members());
		room.refuseWrites(['setStatus']);
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		session.autoHalted = true;
		await session.start();

		expect(toast.error).toHaveBeenCalledWith('pairs.actionFailed');
		expect(room.status).toBe('lobby');
	});
});

/**
 * СКЛАД І РЕВАНШ — З ТИХ, ХТО НА ЗВʼЯЗКУ (аудит 2026-09-24).
 *
 * Рядок складу не гасне сам, тож гість, що закрив вкладку під час відліку, доти
 * потрапляв у заморожений склад — і кожна його черга коштувала решті 90 с. А
 * реванш не перевіряв мінімуму зовсім: господар сам на сам «вигравав» і отримував
 * бали на кожному реванші.
 *
 * Зворотні експерименти: у `presentPlayers` не фільтрувати за присутністю —
 * червоніють «лише ті, хто на звʼязку» і «відлік гасне»; прибрати перевірку
 * `canStart` з `rematch` — червоніє «реванш без суперника».
 */
describe('склад і реванш — з тих, хто на звʼязку', () => {
	const ghost: Member = { uid: 'uid-ghost', name: 'Привид', role: 'player', order: 3 };

	it('склад старту — лише ті, хто на звʼязку', async () => {
		const room = new LocalRoom(roomInfo(), [...members(), ghost]);
		const { session, setOnline } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();
		setOnline([HOST, GUEST]);

		await session.start();
		await settle();

		expect(session.match?.roster?.map((entry) => entry.uid)).toEqual([HOST, GUEST]);
	});

	it('реванш без суперника не починається — і бали за соло не нараховуються', async () => {
		const room = new LocalRoom(
			roomInfo({ status: 'playing', roster: rosterOf(members()) }),
			members()
		);
		const { session, setOnline } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();
		setOnline([HOST]);
		const seedBefore = session.match?.seed;

		await session.rematch();
		await settle();

		expect(toast.info).toHaveBeenCalledWith('pairs.needPlayers');
		expect(session.match?.seed, 'реванш почався сам на сам').toBe(seedBefore);
	});

	it('гість закрив вкладку під час відліку — відлік гасне', async () => {
		const room = new LocalRoom(roomInfo({ autoStart: true }), members());
		const { session, setOnline } = sessionFor(room, null, HOST);
		await session.enter('create');
		setOnline([HOST, GUEST]);
		await settle();
		expect(session.match?.countdownAt, 'двоє на звʼязку — відлік іде').not.toBeNull();

		setOnline([HOST]);
		await settle();

		expect(session.match?.countdownAt, 'рядок гостя лишився, але його немає').toBeNull();
	});
});

/**
 * СКІНЧЕНА ПАРТІЯ ЗАКРИВАЄТЬСЯ СТАТУСОМ (аудит 2026-09-24).
 *
 * Доти `over` не писав ніхто, і смуга «Вас чекають» кликала в партію, яка вже
 * дограна, — поки суперник ще дивився на підсумок.
 *
 * Зворотний експеримент: прибрати політику «партія скінчилася → over» — червоніє
 * перший випадок.
 */
describe('скінчена партія', () => {
	it('господар закриває її статусом over', async () => {
		const room = new LocalRoom(
			roomInfo({ status: 'playing', roster: rosterOf(members()) }),
			members()
		);
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		session.match!.endedBy = GUEST;
		flushSync();
		await settle();

		expect(room.status).toBe('over');
	});

	it('гість статусу не пише — це право господаря', async () => {
		const room = new LocalRoom(
			roomInfo({ status: 'playing', roster: rosterOf(members()) }),
			members()
		);
		const { session } = sessionFor(room, roomInfo({ status: 'playing' }), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();

		session.match!.endedBy = HOST;
		flushSync();
		await settle();

		expect(room.status).toBe('playing');
	});
});

/**
 * ПУБЛІЧНІСТЬ ЖИВЕ В КІМНАТІ (`info.listed`), а не на сторінці (аудит 2026-09-24).
 *
 * Доти запис у переліку робив лише вхід «створити»: після перезавантаження
 * господаря (запис гасне з вкладкою) чи перехоплення ведення публічна кімната тихо
 * ставала приватною, і швидка гра її вже не знаходила.
 *
 * Зворотний експеримент: прибрати політику «публічна кімната — у переліку» —
 * червоніють перші два випадки.
 */
describe('публічна кімната в переліку', () => {
	it('господар, що повернувся після перезавантаження, оголошує її знову', async () => {
		const room = new LocalRoom(roomInfo({ listed: true }), members());
		const { session, lobby } = sessionFor(room, roomInfo({ listed: true }), HOST);
		session.joinCode = '42';

		await session.enter('join');
		await settle();

		expect(lobby.publish).toHaveBeenCalledWith(
			// Двоє, а не «1»: кімната, куди господар повертається, уже не порожня.
			expect.objectContaining({ code: '42', hostUid: HOST, hostName: 'Господар', players: 2 })
		);
	});

	it('новий господар після перехоплення оголошує її сам', async () => {
		const room = new LocalRoom(roomInfo({ listed: true }), members());
		const { session, lobby } = sessionFor(room, roomInfo({ listed: true }), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		expect(lobby.publish, 'гість не господар — не оголошує').not.toHaveBeenCalled();

		room.setPresent([GUEST]);
		await room.transport().takeLead({ seq: 1, by: GUEST, type: 'lead', payload: { from: HOST } });
		await settle();

		expect(lobby.publish).toHaveBeenCalledWith(expect.objectContaining({ hostUid: GUEST }));
	});

	it('добавку до запису бере з матчу кімнати, а не зі сторінки', async () => {
		const room = new LocalRoom(roomInfo({ listed: true }), members().slice(0, 1));
		const { session } = sessionFor(room, null, HOST);

		await session.enter('create');
		await settle();

		expect(pairsGame.listingExtras).toHaveBeenCalledWith(session.match);
	});

	it('приватну — не оголошує', async () => {
		const room = new LocalRoom(roomInfo({ listed: false }), members());
		const { session, lobby } = sessionFor(room, null, HOST);

		await session.enter('create');
		await settle();

		expect(lobby.publish).not.toHaveBeenCalled();
	});
});

/**
 * ПРИБРАНИЙ ДІЗНАЄТЬСЯ, ЩО ЙОГО ПРИБРАЛИ (аудит 2026-09-24).
 *
 * Доти екран жив далі, а кожна відповідь падала загальним «сервер не дозволив»:
 * хід вимагає членства. А господар без звʼязку бачив кнопку «прибрати» навпроти
 * СЕБЕ — і, натиснувши, лишався присутнім, але не учасником.
 *
 * Зворотні експерименти: прибрати політику «мене прибрали» — червоніє перший;
 * прибрати перевірку `uid === this.me` у `kick` — червоніє останній.
 */
describe('прибрати учасника', () => {
	it('гість, якого прибрав господар, чує про це й опиняється на формі входу', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, place } = sessionFor(room, roomInfo(), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();

		await room.transport().removeMember(GUEST);
		await settle();

		expect(toast.info).toHaveBeenCalledWith('pairs.removed');
		expect(place.exit).toHaveBeenCalled();
	});

	it('закрита кімната — «закрито», а не «прибрали»', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, roomInfo(), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();

		room.close();
		await settle();

		expect(toast.info).toHaveBeenCalledWith('pairs.roomClosed');
		expect(toast.info).not.toHaveBeenCalledWith('pairs.removed');
	});

	it('господар прибирає іншого, але не себе', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		expect(await session.kick(GUEST)).toBe(true);
		expect(await session.kick(HOST)).toBe(false);
		await settle();

		expect(session.match?.members.map((member) => member.uid)).toEqual([HOST]);
	});
});

describe('кімната недоступна', () => {
	/**
	 * Читати кімнату більше не дають (вийшов з акаунта в іншій вкладці): це не
	 * «партію завершено», і слово мусить бути інше (аудит 2026-09-24).
	 *
	 * Зворотний експеримент: показувати 'pairs.roomClosed' на обидві причини — червоніє.
	 */
	it('скасована підписка — «недоступна», і назад на форму входу', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, place } = sessionFor(room, roomInfo(), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();

		room.cutOff();
		await settle();

		expect(toast.info).toHaveBeenCalledWith('pairs.roomLost');
		expect(toast.info).not.toHaveBeenCalledWith('pairs.roomClosed');
		expect(place.exit).toHaveBeenCalled();
	});
});

/**
 * ЩО СТАЛОСЯ З КІМНАТОЮ — У ЖУРНАЛ, із кодом (аудит 2026-09-24): обрив і
 * повернення звʼязку, перехід ведення. Доти звіт зі значка сервісу цього не знав
 * зовсім, і «гра зависла» не мала з чим звіритися.
 *
 * Зворотний експеримент: прибрати `journal(session)` з політик — червоніють обидва.
 */
describe('журнал кімнати', () => {
	it('обрив і повернення звʼязку — з кодом кімнати', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, setConnected } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		setConnected(false);
		await settle();
		setConnected(true);
		await settle();

		expect(logService.info).toHaveBeenCalledWith('network', 'connection lost', { code: '42' });
		expect(logService.info).toHaveBeenCalledWith('network', 'connection restored', { code: '42' });
	});

	it('ведення перейшло — хто від кого', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, roomInfo(), GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();

		room.setPresent([GUEST]);
		await room.transport().takeLead({ seq: 1, by: GUEST, type: 'lead', payload: { from: HOST } });
		await settle();

		expect(logService.info).toHaveBeenCalledWith('network', 'host changed', {
			code: '42',
			from: HOST,
			to: GUEST
		});
	});
});
