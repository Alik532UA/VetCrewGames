import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import type { RoomNet } from '$lib/net/roomNet';
import type { Member, RoomInfo, RoomTransport } from '$lib/net/roomTypes';
import { gamesToConfig, ONLINE_GAMES } from '$lib/config/quizOnline';

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
const { LEAD_AFTER_MS, OVER_LEAD_AFTER_MS } = await import('./roomPolicies.svelte');
const { PairsMatch } = await import('./pairsMatch.svelte');
const { QuizMatch } = await import('./quizMatch.svelte');
const { pairsGame: realPairsGame, attachPairsPolicies } = await import('./pairsRoom.svelte');
const { QuizRoom } = await import('./quizRoom.svelte');
const { QUIZ_RULES_VERSION, PAIRS_RULES_VERSION } = await import('$lib/config/roomRules');

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

/** Та сама мініатюра, але матч — вікторина: новачок посеред партії там грає. */
const quizGame = {
	...pairsGame,
	gameId: 'quiz' as const,
	lateRole: 'player' as const,
	createMatch: (me: string, transport: RoomTransport) => new QuizMatch(me, transport)
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
		beat: vi.fn((_transport: Parameters<RoomNet['beat']>[0]) => () => {}),
		checkRules: vi.fn(async (): Promise<'fresh' | 'stale' | 'unknown'> => 'fresh')
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
function sessionFor(
	room: LocalRoom,
	peek: RoomInfo | null,
	me: string,
	game: typeof pairsGame | typeof quizGame = pairsGame
) {
	const { net, setOnline, setConnected } = fakeNet(room, peek, me);
	const { place, player, lobby } = stubs();
	let session!: Session;
	cleanup = $effect.root(() => {
		session = new RoomSession(
			game as typeof pairsGame,
			place,
			player as never,
			lobby as never,
			net
		) as Session;
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
		// Серцебиття — тим самим транспортом, що й партія, а не другим на ту саму кімнату.
		// Тотожність, а не рівність: копія того самого транспорту — це вже другий транспорт.
		expect(net.beat.mock.calls[0]?.[0]).toBe(await net.roomTransport.mock.results[0].value);
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

	/**
	 * ДОГРАНА ПАРТІЯ — ТЕ САМЕ, ЩО ЛОБІ (аудит 2026-09-25): наступна буде реваншем.
	 * Доти той, хто прийшов після першої партії, заходив глядачем назавжди, і
	 * реваншу бракувало гравців — кімната «Знайди пару» ставала глухим кутом.
	 *
	 * Зворотні експерименти: пускати в `over` у ролі гри — червоніє перший; не
	 * дозволяти ролі в `over` — другий.
	 */
	it('у дограну партію новачок заходить гравцем — реванш буде з ним', async () => {
		const over = roomInfo({ status: 'over', roster: rosterOf(members()) });
		const room = new LocalRoom(over, members());
		const { session, net } = sessionFor(room, over, 'uid-late');
		session.joinCode = '42';

		await session.enter('join');

		expect(net.joinRoom).toHaveBeenCalledWith('42', 'Гравець', undefined, '', undefined, 'player');
	});

	it('між партіями глядач може стати гравцем, а посеред партії — ні', async () => {
		const eye: Member = { uid: 'uid-eye', name: 'Око', role: 'spectator', order: 3 };
		const over = roomInfo({ status: 'over', roster: rosterOf(members()) });
		const room = new LocalRoom(over, [...members(), eye]);
		const { session, net } = sessionFor(room, over, eye.uid);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		net.joinRoom.mockClear();

		await session.setRole('player');
		expect(net.joinRoom).toHaveBeenCalledWith('42', 'Гравець', 'player', '', undefined, 'player');

		net.joinRoom.mockClear();
		await room.transport().setStatus('playing', rosterOf(members()));
		await settle();
		await session.setRole('player');
		expect(net.joinRoom, 'посеред партії роль не міняється').not.toHaveBeenCalled();
	});

	it('помилка правил — порада про правила, а не «спробуйте ще раз»', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, HOST);
		net.createRoom.mockRejectedValueOnce(new Error('rules-missing'));

		await session.enter('create');

		expect(toast.error).toHaveBeenCalledWith('pairs.rulesMissing');
	});

	/**
	 * ЗВІТ КАЖЕ, ЯКУ КІМНАТУ ЩОЙНО СТВОРИЛИ (аудит 2026-09-26): невдалий вхід стирає
	 * `code`, і доти рядок «room entry failed» після створення називав поле входу —
	 * тобто порожнечу, — а не кімнату.
	 */
	it('створена кімната, у яку не вдалося зайти, — у журналі своїм кодом', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, HOST);
		net.roomTransport.mockRejectedValueOnce(new Error('boom'));

		await session.enter('create');

		expect(logService.error).toHaveBeenCalledWith(
			'network',
			'room entry failed',
			expect.objectContaining({ code: '42' })
		);
	});
});

/**
 * ВХІД, ВІД ЯКОГО ВЖЕ ПІШЛИ (аудит 2026-09-26). Доти вхід скасувати було нічим:
 * «швидка гра» й одразу «назад» дописували `?room` у чужу сторінку, лишали
 * присутність-привида з серцебиттям (господар рахував його гравцем і стартував),
 * а локальний рахунок ставав на паузу до перезавантаження.
 *
 * Зворотні експерименти: не перевіряти номер входу після `peekRoom` — червоніє
 * перший; не знімати підписок застарілого входу — другий; не віддавати кнопок
 * у `dispose` або відпускати їх із застарілого входу — третій.
 */
describe('вхід, від якого вже пішли', () => {
	/** Виклик мережі, що «висить», поки тест його не відпустить. */
	function hanging<T>() {
		let release!: (value: T) => void;
		const promise = new Promise<T>((resolve) => (release = resolve));
		return { promise, release };
	}

	it('пішли, поки питали кімнату, — ні адреси, ні рядка складу', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net, place } = sessionFor(room, roomInfo(), GUEST);
		const peek = hanging<RoomInfo | null>();
		net.peekRoom.mockReturnValueOnce(peek.promise);
		session.joinCode = '42';

		const entering = session.enter('join');
		await settle();
		session.exitToGate();
		peek.release(roomInfo());
		await entering;
		await settle();

		expect(net.joinRoom, 'рядок складу від того, хто вже пішов').not.toHaveBeenCalled();
		expect(place.remember, 'код кімнати в адресі чужої сторінки').not.toHaveBeenCalled();
		expect(session.code).toBe('');
		expect(session.match).toBeNull();
	});

	it('пішли посеред підписок — усе, що встигло підписатися, знято, і гри немає', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, HOST);
		const presence = hanging<() => void>();
		const left = vi.fn();
		net.trackPresence.mockReturnValueOnce(presence.promise);

		const entering = session.enter('create');
		await vi.waitFor(() => expect(net.trackPresence).toHaveBeenCalled());
		session.dispose();
		presence.release(left);
		await entering;
		await settle();

		expect(left, 'присутність-привид лишилась').toHaveBeenCalled();
		expect(net.watchPresence, 'після виходу підписалися далі').not.toHaveBeenCalled();
		expect(playerData.beginOnline, 'рахунок став на паузу').not.toHaveBeenCalled();
		expect(session.match).toBeNull();
	});

	it('після покинутого входу кнопки вільні, а покинутий не відпускає кнопок нового', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, roomInfo(), GUEST);
		const first = hanging<RoomInfo | null>();
		const second = hanging<RoomInfo | null>();
		net.peekRoom.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		session.joinCode = '42';

		const abandoned = session.enter('join');
		await settle();
		session.exitToGate();
		expect(session.busy, 'кнопки й далі зайняті покинутим входом').toBe(false);

		const next = session.enter('join');
		await settle();
		first.release(roomInfo());
		await abandoned;
		expect(session.busy, 'покинутий вхід відпустив кнопки нового').toBe(true);

		second.release(roomInfo());
		await next;
		await settle();
		expect(session.match, 'новий вхід доїхав').not.toBeNull();
		expect(net.joinRoom).toHaveBeenCalledTimes(1);
		expect(session.busy).toBe(false);
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
		// Посеред партії правило пускає лише склад старту — він і тут.
		const started = roomInfo({ status: 'playing', roster: rosterOf(members()) });
		const room = new LocalRoom(started, members());
		const { session, setOnline } = sessionFor(room, started, GUEST);
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

	/**
	 * ПІСЛЯ ВІДМОВИ — НЕ ЩОТАКТУ (аудит 2026-09-25). Відмова означає «господар на
	 * місці» або «ведення вже взяв інший», і повтор через секунду цього не змінить;
	 * доти база отримувала три записи на кожен такт, а журнал — нічого.
	 *
	 * Зворотний експеримент: прибрати `retryAt` — червоніє.
	 */
	it('після відмови бази наступна спроба — не раніше паузи, і рядок у журналі один', async () => {
		const started = roomInfo({ status: 'playing', roster: rosterOf(members()) });
		const room = new LocalRoom(started, members());
		const { session, setOnline } = sessionFor(room, started, GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		const takeLead = vi.spyOn(session.match!, 'takeLead').mockResolvedValue(false);
		setOnline([GUEST]);
		session.clock = 1_000_000;
		flushSync();

		session.clock = 1_000_000 + LEAD_AFTER_MS;
		flushSync();
		await settle();
		session.clock += 1_000;
		flushSync();
		await settle();
		expect(takeLead, 'через секунду після відмови — ще ні').toHaveBeenCalledTimes(1);

		session.clock = 1_000_000 + 2 * LEAD_AFTER_MS;
		flushSync();
		await settle();
		expect(takeLead).toHaveBeenCalledTimes(2);
		const refusals = vi
			.mocked(logService.info)
			.mock.calls.filter(([, message]) => message === 'lead refused');
		expect(refusals).toHaveLength(1);
	});

	/**
	 * НОВАЧОК ПОСЕРЕД ВІКТОРИНИ ВЕДЕННЯ НЕ ПРОБУЄ (аудит 2026-09-25). Він грає, але
	 * правило посеред партії пускає лише склад старту: доти першим кандидатом ставав
	 * саме той, кому база відмовляє завжди, і партія лишалася без ведучого.
	 *
	 * Зворотний експеримент: ранжувати за `match.players` — червоніє.
	 */
	it('новачок посеред вікторини ведення не пробує — правило пускає лише склад', async () => {
		const late: Member = { uid: 'uid-late', name: 'Новачок', role: 'player', order: 3 };
		const started = roomInfo({
			gameId: 'quiz',
			status: 'playing',
			roster: rosterOf(members()),
			config: gamesToConfig(ONLINE_GAMES.map((game) => game.id))
		});
		const room = new LocalRoom(started, [...members(), late]);
		const { session, setOnline } = sessionFor(room, started, late.uid, quizGame);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		const takeLead = vi.spyOn(session.match!, 'takeLead').mockResolvedValue(true);
		expect(
			session.match!.players.map((player) => player.uid),
			'перевірка жива: новачок у партії'
		).toContain(late.uid);

		setOnline([late.uid]);
		session.clock = 1_000_000;
		flushSync();
		session.clock = 1_000_000 + 3 * LEAD_AFTER_MS;
		flushSync();

		expect(takeLead).not.toHaveBeenCalled();
	});

	/**
	 * ДОГРАНА ПАРТІЯ — ТЕРПІННЯ ДОВШЕ (аудит 2026-09-25): господар, що пішов
	 * створювати кімнату іншої гри, за двадцять секунд втрачав ведення.
	 *
	 * Зворотний експеримент: брати `LEAD_AFTER_MS` і для дограної — червоніє.
	 */
	it('у дограній партії ведення підхоплюють пізніше', async () => {
		const started = roomInfo({ status: 'playing', roster: rosterOf(members()) });
		const room = new LocalRoom(started, members());
		const { session, setOnline } = sessionFor(room, started, GUEST);
		session.joinCode = '42';
		await session.enter('join');
		await settle();
		const takeLead = vi.spyOn(session.match!, 'takeLead').mockResolvedValue(true);
		session.match!.endedBy = GUEST;
		setOnline([GUEST]);
		session.clock = 1_000_000;
		flushSync();
		expect(session.match!.over, 'перевірка жива: партію дограно').toBe(true);

		session.clock = 1_000_000 + LEAD_AFTER_MS;
		flushSync();
		expect(takeLead, 'звичайна межа — ще рано').not.toHaveBeenCalled();

		session.clock = 1_000_000 + OVER_LEAD_AFTER_MS;
		flushSync();
		expect(takeLead).toHaveBeenCalledTimes(1);
	});

	/**
	 * НЕВДАЛИЙ ВХІД НЕ ЛИШАЄ ПІВКІМНАТИ (аудит 2026-09-25): підписка, пауза
	 * локального рахунку, код і адреса знімаються, а людина чує, що не вийшло.
	 *
	 * Зворотний експеримент: прибрати `catch` у `#open` — червоніє.
	 */
	it('вхід, що впав посеред відкриття кімнати, прибирає за собою все', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const transport = room.transport();
		const unwatch = vi.fn();
		vi.spyOn(transport, 'watch').mockReturnValue(unwatch);
		const { session, net, place } = sessionFor(room, roomInfo(), GUEST);
		net.roomTransport.mockResolvedValue(transport);
		net.watchPresence.mockRejectedValueOnce(
			new Error('Failed to fetch dynamically imported module')
		);
		session.joinCode = '42';

		await session.enter('join');
		await settle();

		expect(unwatch, 'підписка на кімнату знята').toHaveBeenCalled();
		expect(playerData.endOnline).toHaveBeenCalled();
		expect(session.match).toBeNull();
		expect(session.code).toBe('');
		expect(place.exit).toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalled();
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
/**
 * ПРАВИЛА БАЗИ НОВІШІ ЗА СТОРІНКУ (аудит 2026-09-25). Вкладка, відкрита до
 * викладки нових правил, посеред партії не чула нічого: тапи показувалися й
 * мовчки відкочувалися. Тепер перша відмова, якої гра не пояснює, раз на сторінку
 * звіряє штамп правил, і на `stale` кімната каже оновити сторінку.
 *
 * Зворотні експерименти: не кликати `noteDenial` з `#failed` — червоніє перший;
 * прибрати політику `refused` — другий; не памʼятати знайденої причини — «вдруге
 * не звіряє»; не розпізнавати шматка збірки на вході — «нова збірка».
 */
/**
 * ДІЯ, ЯКУ ПОЧАЛА ЛЮДИНА (аудит 2026-09-25): набір ігор, темп, пауза й «граємо
 * далі» у вікторині йшли повз обробку помилок, і відмова не казала нічого.
 *
 * Зворотний експеримент: ковтати помилку в `act` без `#failed` — червоніє.
 */
describe('дія людини', () => {
	it('що не вдалася, — вголос і в журнал із кодом кімнати', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		const done = await session.act('quiz pace not changed', async () => {
			throw new Error('boom');
		});

		expect(done).toBe(false);
		expect(toast.error).toHaveBeenCalledWith('pairs.actionFailed');
		expect(logService.error).toHaveBeenCalledWith(
			'network',
			'quiz pace not changed',
			expect.objectContaining({ code: '42' })
		);
	});

	it('що вдалася, — тиша', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session } = sessionFor(room, null, HOST);
		await session.enter('create');

		expect(await session.act('quiz pace not changed', async () => {})).toBe(true);
		expect(toast.error).not.toHaveBeenCalled();
	});
});

describe('правила бази новіші за сторінку', () => {
	it('відмова дії господаря звіряє правила, і на «stale» кімната каже оновити сторінку', async () => {
		const room = new LocalRoom(roomInfo(), members());
		room.refuseWrites(['setStatus']);
		const { session, net } = sessionFor(room, null, HOST);
		net.checkRules.mockResolvedValue('stale');
		await session.enter('create');
		await settle();

		await session.start();
		await settle();
		expect(net.checkRules).toHaveBeenCalledTimes(1);
		expect(session.reload.reason).toBe('rules');

		await session.start();
		await settle();
		expect(net.checkRules, 'знайдену причину вдруге не звіряє').toHaveBeenCalledTimes(1);
	});

	it('хід, якого база не прийняла, — теж привід звірити, а свіжі правила смуги не дають', async () => {
		const started = roomInfo({ status: 'playing', roster: rosterOf(members()) });
		const room = new LocalRoom(started, members());
		const { session, net } = sessionFor(room, null, HOST);
		await session.enter('create');
		await settle();

		session.match!.refused = 1;
		flushSync();
		await settle();

		expect(net.checkRules).toHaveBeenCalledTimes(1);
		expect(session.reload.reason).toBeNull();
	});

	/**
	 * НОВА ЗБІРКА НА СЕРВЕРІ (аудит 2026-09-26): вкладка, відкрита до викладки, не
	 * може завантажити шматок мережевого шару, і доти чула «спробуйте ще раз» на
	 * кожну спробу, аж до ручного оновлення.
	 */
	it('вхід, що впав на відсутньому шматку збірки, — смуга «оновити» й окреме повідомлення', async () => {
		const room = new LocalRoom(roomInfo(), members());
		const { session, net } = sessionFor(room, null, HOST);
		net.roomTransport.mockRejectedValueOnce(
			new TypeError('Failed to fetch dynamically imported module: https://x/rtdbRoom.js')
		);

		await session.enter('create');

		expect(session.reload.reason).toBe('build');
		expect(toast.error).toHaveBeenCalledWith('pairs.newBuild');
	});
});

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

		session.exitToGate();
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

/**
 * СЕСІЯ ЗІ СПРАВЖНІМИ АДАПТЕРАМИ ІГОР — і з тією самою проводкою, що на сторінках
 * (аудит 2026-09-25). Решта файлу — на мініатюрі гри, щоб кермувати годинником і
 * нагородою вручну; а дві останні знахідки аудиту (склад вікторини, набір ігор у
 * переліку) були саме про стик сесії з адаптером — і проводку сторінки
 * (`quiz.attach(session)`, `attachPairsPolicies`) не брав жоден тест.
 *
 * Зворотні експерименти: не кликати `quiz.attach` у проводці — червоніє вікторина;
 * адаптер «Знайди пару» без `listen` — червоніє його випадок.
 */
describe('сесія зі справжніми адаптерами ігор', () => {
	/** Мережа, заглушки й сесія — як на сторінці: `attach` плюс реакції самої гри. */
	function wired<M extends InstanceType<typeof PairsMatch> | InstanceType<typeof QuizMatch>>(
		room: LocalRoom,
		me: string,
		game: ConstructorParameters<typeof RoomSession<M>>[0],
		wire: (session: InstanceType<typeof RoomSession<M>>) => void
	) {
		const { net, setOnline } = fakeNet(room, null, me);
		const { place, player, lobby } = stubs();
		let session!: InstanceType<typeof RoomSession<M>>;
		cleanup = $effect.root(() => {
			session = new RoomSession(game, place, player as never, lobby as never, net);
			session.attach();
			wire(session);
		});
		return { session, setOnline };
	}

	it('«Знайди пару»: підсвітка слухається з кімнатою, а старт заморожує склад із присутніх', async () => {
		const room = new LocalRoom(roomInfo({ rulesVersion: PAIRS_RULES_VERSION }), members());
		const beam = { listen: vi.fn(async () => () => {}), clear: vi.fn() };
		const game = realPairsGame(
			beam,
			() => 0.5,
			() => ({ pairs: 4, cols: 4 })
		);
		const { session, setOnline } = wired(room, HOST, game, (s) => attachPairsPolicies(s, beam));

		await session.enter('create');
		await settle();
		setOnline([HOST, GUEST]);
		await session.start();
		await settle();

		expect(beam.listen).toHaveBeenCalledWith('42');
		expect(session.match?.status).toBe('playing');
		expect(session.match?.roster?.map((entry) => entry.uid)).toEqual([HOST, GUEST]);
	});

	it('вікторина: з проводкою сторінки ведучий сам оголошує перший раунд', async () => {
		const room = new LocalRoom(
			roomInfo({
				gameId: 'quiz',
				rulesVersion: QUIZ_RULES_VERSION,
				config: gamesToConfig(ONLINE_GAMES.map((entry) => entry.id))
			}),
			members()
		);
		const quiz = new QuizRoom(() => 0.5);
		const { session, setOnline } = wired(room, HOST, quiz.game, (s) => quiz.attach(s));

		await session.enter('create');
		await settle();
		setOnline([HOST, GUEST]);
		await session.start();
		await settle();

		expect(session.match?.status).toBe('playing');
		expect(session.match?.round, 'перший раунд оголошено').toBe(0);
	});
});
