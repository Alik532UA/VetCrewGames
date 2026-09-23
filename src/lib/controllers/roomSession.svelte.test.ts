import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
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
	clockEvery: () => null
};

/** Мережа кімнати в памʼяті: той самий `LocalRoom`, що в тестах правил партії. */
function fakeNet(room: LocalRoom, peek: RoomInfo | null, me: string) {
	const presence: Array<(uids: string[]) => void> = [];
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
			onChange(true);
			return () => {};
		}),
		beat: vi.fn(() => () => {})
	} satisfies RoomNet;
	return { net, setOnline: (uids: string[]) => presence.forEach((notify) => notify(uids)) };
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
	const { net, setOnline } = fakeNet(room, peek, me);
	const { place, player, lobby } = stubs();
	let session!: Session;
	cleanup = $effect.root(() => {
		session = new RoomSession(pairsGame, place, player as never, lobby as never, net) as Session;
		session.attach();
	});
	return { session, net, place, lobby, setOnline };
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
		const room = new LocalRoom(roomInfo(), members());
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
