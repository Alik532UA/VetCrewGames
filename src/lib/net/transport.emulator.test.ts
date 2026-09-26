import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, peek, signedIn, type Connection } from './emulatorSession';
import { LocalRoom } from './localRoom';
import { MOVE_SEQ_MAX } from './roomShape';
import type { Member, Move, RoomInfo, RoomSnapshot, RoomTransport, RosterEntry } from './roomTypes';

/**
 * КОНТРАКТ ТРАНСПОРТУ: `LocalRoom` проти `rtdbRoom` над емулятором.
 *
 * Уся спільна партія перевіряється на `LocalRoom`, і це правильно — правила гри
 * так видно цілком, без мережі й ключів. Але тоді `LocalRoom` мусить поводитися
 * РІВНО як справжній транспорт зі справжніми правилами бази, і доти цього не
 * доводило ніщо. Розходилися вони вже не раз: реванш без `startedAt`, відлік, що
 * не гас, хід без перевірки членства — і щоразу тести на підставці були зеленими
 * на поведінці, якої в продакшні немає.
 *
 * Тут кожен сценарій іде по ОБОХ реалізаціях з однаковим очікуванням. Розійдуться
 * — червоніє та, що бреше.
 *
 * Особа — однаково в обох: `LocalRoom` знає, хто за транспортом сидить
 * (`transport({ as })`, аудит 2026-09-26), тож «гість не починає партії» чи «хід під
 * чужим іменем» порівнюються тут так само, як решта. Доти в цьому абзаці стояло
 * протилежне — і пережило саму зміну на місяць (шостий аудит).
 *
 * Запуск — `npm run check:rules`, тим самим запуском емулятора, що й правила.
 */

/**
 * `connect()` веде туди, куди скаже тест: у емулятор і від імені вибраного
 * учасника (`emulatorSession.ts`). Справжній `net/firebase.ts` сюди не потрапляє —
 * зі своїм ключем він пішов би в ЖИВИЙ проєкт (і запобіжник
 * `emulator-only.setup.ts` це зупинить).
 */
vi.mock('$lib/net/firebase', async () => {
	const { currentConnection } = await import('$lib/net/emulatorSession');
	return {
		connect: currentConnection,
		forget: () => {},
		serverNow: () => Date.now(),
		serverTime: async () => Date.now()
	};
});

/** Перший знімок, що задовольняє умову: у базі підписка приїжджає не одразу. */
function until(
	transport: RoomTransport,
	check: (snapshot: RoomSnapshot) => boolean
): Promise<RoomSnapshot> {
	return new Promise<RoomSnapshot>((resolve, reject) => {
		let settled = false;
		let stop: (() => void) | null = null;
		const timer = setTimeout(() => {
			settled = true;
			stop?.();
			reject(new Error('знімка, що задовольняє умову, не дочекались'));
		}, 10_000);
		stop = transport.watch((snapshot) => {
			if (settled || !check(snapshot)) return;
			settled = true;
			clearTimeout(timer);
			stop?.();
			resolve(snapshot);
		});
		// `LocalRoom` віддає перший знімок синхронно — ще до того, як повернув відписку.
		if (settled) stop();
	});
}

interface Seat {
	uid: string;
	transport: RoomTransport;
}

interface Table {
	host: Seat;
	guest: Seat;
	stranger: Seat;
	/** Знімок очима господаря — перший, що задовольняє умову. */
	until(check: (snapshot: RoomSnapshot) => boolean): Promise<RoomSnapshot>;
	/** Хто на звʼязку: решта — ні. */
	present(uids: readonly string[]): Promise<void>;
	/** Знести кімнату від імені того, хто в ній господар. */
	close(by?: 'host' | 'guest'): Promise<void>;
}

interface World {
	name: string;
	/**
	 * Нова кімната в лобі: господар і гість — гравці; `spectator` — сторонній
	 * заходить глядачем, `strangerPlays` — гравцем (але в склад старту не йде).
	 * `gameId` — яка гра: у вікторини склад відкритий в один бік (`utils/roster.ts`).
	 */
	table(options?: TableOptions): Promise<Table>;
}

interface TableOptions {
	spectator?: boolean;
	strangerPlays?: boolean;
	gameId?: 'pairs' | 'quiz';
}

const CONFIG = { pairs: 4, cols: 4 };
/** Налаштування кімнати для гри: у вікторини — набір ігор. */
const configOf = (gameId: 'pairs' | 'quiz') => (gameId === 'quiz' ? { game_myths: 1 } : CONFIG);

const local: World = {
	name: 'LocalRoom',
	async table({ spectator = false, strangerPlays = false, gameId = 'pairs' } = {}) {
		const [HOST, GUEST, STRANGER] = ['uid-host', 'uid-guest', 'uid-stranger'];
		const members: Member[] = [
			{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
			{ uid: GUEST, name: 'Гість', role: 'player', order: 2 },
			...(spectator
				? [{ uid: STRANGER, name: 'Глядач', role: 'spectator' as const, order: 3 }]
				: []),
			...(strangerPlays
				? [{ uid: STRANGER, name: 'Сторонній', role: 'player' as const, order: 3 }]
				: [])
		];
		const info: RoomInfo = {
			gameId,
			rulesVersion: 3,
			seed: 1,
			status: 'lobby',
			hostUid: HOST,
			config: configOf(gameId)
		};
		const room = new LocalRoom(info, members);
		// Особа — як `auth.uid` у справжньої бази: кожен пише лише від себе.
		const seat = (uid: string): Seat => ({ uid, transport: room.transport({ as: uid }) });
		const host = seat(HOST);
		return {
			host,
			guest: seat(GUEST),
			stranger: seat(STRANGER),
			until: (check) => until(host.transport, check),
			present: async (uids) => room.setPresent(uids),
			close: async () => room.close()
		};
	}
};

let people: { host: Connection; guest: Connection; stranger: Connection } | null = null;

const emulator: World = {
	name: 'rtdbRoom + емулятор',
	async table({ spectator = false, strangerPlays = false, gameId = 'pairs' } = {}) {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host, guest, stranger } = people;
		const net = await import('./rtdbRoom');
		const code = await as(host, () =>
			net.createRoom({
				gameId,
				rulesVersion: 3,
				seed: 1,
				config: configOf(gameId),
				name: 'Господар',
				isPrivate: true
			})
		);
		await as(guest, () => net.joinRoom(code, 'Гість'));
		if (spectator) await as(stranger, () => net.joinRoom(code, 'Глядач', 'spectator'));
		if (strangerPlays) await as(stranger, () => net.joinRoom(code, 'Сторонній', 'player'));
		const seat = async (who: Connection): Promise<Seat> => ({
			uid: who.uid,
			transport: await as(who, () => net.roomTransport(code))
		});
		const hostSeat = await seat(host);
		return {
			host: hostSeat,
			guest: await seat(guest),
			stranger: await seat(stranger),
			until: (check) => until(hostSeat.transport, check),
			present: async (uids) => {
				const { ref, remove, serverTimestamp, set } = await import('firebase/database');
				for (const who of [host, guest, stranger]) {
					const node = ref(who.db, `presence/${code}/${who.uid}`);
					if (uids.includes(who.uid)) await set(node, { at: serverTimestamp() });
					else await remove(node);
				}
			},
			close: (by = 'host') => as(by === 'host' ? host : guest, () => net.closeRoom(code))
		};
	}
};

beforeAll(async () => {
	people = {
		host: await signedIn('host'),
		guest: await signedIn('guest'),
		stranger: await signedIn('stranger')
	};
});

afterAll(() => closeAll(Object.values(people ?? {})));

const flip = (by: string, seq: number): Move => ({ seq, by, type: 'flip', payload: { index: 0 } });

const rosterOf = (table: Table): RosterEntry[] => [
	{ uid: table.host.uid, name: 'Господар' },
	{ uid: table.guest.uid, name: 'Гість' }
];

/**
 * Почати партію складом «господар і гість». Хід гри тепер лягає ЛИШЕ посеред партії
 * (аудит 2026-09-26, A2): сценарії про хід без старту відкидалися б правилом статусу,
 * а не тим, яке перевіряють, — тобто проходили б за чужою причиною.
 */
const started = async (table: Table) => table.host.transport.setStatus('playing', rosterOf(table));

describe.each([local, emulator])('контракт транспорту: $name', (world) => {
	it('учасник дописує хід, а той самий номер удруге — ні', async () => {
		const table = await world.table();
		await started(table);

		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);
		expect(await table.host.transport.append(flip(table.host.uid, 1))).toBe(false);

		const snapshot = await table.until((s) => s.moves.length === 1);
		expect(snapshot.moves[0].by).toBe(table.guest.uid);
		expect(typeof snapshot.moves[0].at, 'час ходу ставить «сервер»').toBe('number');
		await table.close();
	});

	it('хід від того, кого немає в складі, не лягає', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.stranger.transport.append(flip(table.stranger.uid, 1))).toBe(false);
		await table.close();
	});

	it('номер поза межею не лягає, а на самій межі — лягає', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.guest.transport.append(flip(table.guest.uid, 0))).toBe(false);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1_000_000))).toBe(false);
		// Межа — 9 999, а не мільйон (аудит 2026-09-26, `MOVE_SEQ_MAX`).
		expect(await table.guest.transport.append(flip(table.guest.uid, MOVE_SEQ_MAX + 1))).toBe(false);
		expect(await table.guest.transport.append(flip(table.guest.uid, MOVE_SEQ_MAX))).toBe(true);
		await table.close();
	});

	it('lead звичайним ходом від гостя не лягає', async () => {
		const table = await world.table();
		const lead: Move = {
			seq: 1,
			by: table.guest.uid,
			type: 'lead',
			payload: { from: table.host.uid }
		};
		expect(await table.guest.transport.append(lead)).toBe(false);
		await table.close();
	});

	it('хід лише з відомими полями: чуже поле чи частка понад одиницю не лягають', async () => {
		const table = await world.table();
		await started(table);
		const by = table.guest.uid;
		expect(
			await table.guest.transport.append({ seq: 1, by, type: 'say', payload: { word: 'кіт' } })
		).toBe(false);
		expect(
			await table.guest.transport.append({
				seq: 1,
				by,
				type: 'answer',
				payload: { round: 0, correct: 2 }
			})
		).toBe(false);
		expect(
			await table.guest.transport.append({
				seq: 1,
				by,
				type: 'answer',
				payload: { round: 0, correct: 1 }
			})
		).toBe(true);
		await table.close();
	});

	it('старт ставить статус, серверний startedAt і склад одним записом', async () => {
		const table = await world.table();

		await table.host.transport.setStatus('playing', rosterOf(table));

		const snapshot = await table.until((s) => s.info.status === 'playing');
		expect(typeof snapshot.info.startedAt).toBe('number');
		expect(snapshot.info.countdownAt, 'відлік гасне разом зі стартом').toBeUndefined();
		expect(snapshot.info.roster).toEqual(rosterOf(table));
		await table.close();
	});

	/**
	 * РОЗКЛАДКА ТИМ САМИМ ЗАПИСОМ, що й старт (рішення автора 2026-09-26: сітку
	 * «Знайди пару» вибирає найменший екран серед присутніх — у мить старту).
	 * Окремим записом існувала б мить, у яку партія вже йде зі старою сіткою.
	 */
	it('старт і реванш пишуть розкладку тим самим записом', async () => {
		const table = await world.table();

		await table.host.transport.setStatus('playing', rosterOf(table), { pairs: 10, cols: 4 });
		let snapshot = await table.until((s) => s.info.status === 'playing');
		expect(snapshot.info.config).toEqual({ pairs: 10, cols: 4 });

		await table.host.transport.restart(778, rosterOf(table), { pairs: 14, cols: 7 });
		snapshot = await table.until((s) => s.info.seed === 778);
		expect(snapshot.info.config).toEqual({ pairs: 14, cols: 7 });
		await table.close();
	});

	it('глядач у складі — відмова всього запису', async () => {
		const table = await world.table({ spectator: true });

		await expect(
			table.host.transport.setStatus('playing', [{ uid: table.stranger.uid, name: 'Глядач' }])
		).rejects.toThrow();

		const snapshot = await table.until(() => true);
		expect(snapshot.info.status, 'відмова мусить скасувати й статус').toBe('lobby');
		await table.close();
	});

	it('чуже імʼя у складі — відмова', async () => {
		const table = await world.table();
		await expect(
			table.host.transport.setStatus('playing', [{ uid: table.guest.uid, name: 'Лідер' }])
		).rejects.toThrow();
		await table.close();
	});

	it('посеред партії склад не міняється, а реванш ставить новий із порожнім журналом', async () => {
		const table = await world.table();
		await table.host.transport.setStatus('playing', rosterOf(table));
		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);

		await expect(
			table.host.transport.setStatus('playing', [{ uid: table.host.uid, name: 'Господар' }])
		).rejects.toThrow();

		await table.host.transport.restart(777, rosterOf(table));
		const snapshot = await table.until((s) => s.info.seed === 777);
		expect(snapshot.moves).toEqual([]);
		expect(snapshot.info.status).toBe('playing');
		expect(snapshot.info.roster).toEqual(rosterOf(table));
		await table.close();
	});

	it('ведення підхоплює гравець складу, коли господаря немає, — одним записом із ходом lead', async () => {
		const table = await world.table();
		await table.host.transport.setStatus('playing', rosterOf(table));
		await table.present([table.guest.uid]);

		const lead: Move = {
			seq: 1,
			by: table.guest.uid,
			type: 'lead',
			payload: { from: table.host.uid }
		};
		expect(await table.guest.transport.takeLead(lead)).toBe(true);

		const snapshot = await table.until((s) => s.info.hostUid === table.guest.uid);
		expect(snapshot.moves.map((move) => move.type)).toEqual(['lead']);
		await table.close('guest');
	});

	/**
	 * ПОСЕРЕД ПАРТІЇ «ЗНАЙДИ ПАРУ» ХІД ПИШЕ ЛИШЕ СКЛАД (аудит 2026-09-25): доти глядач
	 * займав наступні номери сміттям раніше за гравців, і партія стояла.
	 */
	it('посеред партії «Знайди пару» хід того, кого немає в складі, не лягає', async () => {
		const table = await world.table({ spectator: true });
		await table.host.transport.setStatus('playing', rosterOf(table));

		expect(await table.stranger.transport.append(flip(table.stranger.uid, 1))).toBe(false);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);
		await table.close();
	});

	it('посеред партії ведення не бере той, кого немає в складі', async () => {
		const table = await world.table({ strangerPlays: true });
		await table.host.transport.setStatus('playing', rosterOf(table));
		await table.present([table.stranger.uid]);

		const lead: Move = {
			seq: 1,
			by: table.stranger.uid,
			type: 'lead',
			payload: { from: table.host.uid }
		};
		expect(await table.stranger.transport.takeLead(lead)).toBe(false);
		await table.close();
	});

	/**
	 * ВІКТОРИНА ПОСЕРЕД ПАРТІЇ (аудит 2026-09-26): склад у неї відкритий в один бік —
	 * пізній гравець дописує ходи, але ведення не бере; гравець складу — бере. Доти
	 * контракт знав лише «Знайди пару», і виняток вікторини в правилі ходів не
	 * перевірявся ні тут, ні в гейті.
	 */
	it('посеред вікторини хід пише й пізній гравець, якого немає в складі', async () => {
		const table = await world.table({ strangerPlays: true, gameId: 'quiz' });
		await table.host.transport.setStatus('playing', rosterOf(table));

		expect(await table.stranger.transport.append(flip(table.stranger.uid, 1))).toBe(true);
		await table.close();
	});

	it('посеред вікторини пізній гравець ведення не бере, а гравець складу — бере', async () => {
		const table = await world.table({ strangerPlays: true, gameId: 'quiz' });
		await table.host.transport.setStatus('playing', rosterOf(table));
		await table.present([table.guest.uid, table.stranger.uid]);
		const lead = (who: Seat): Move => ({
			seq: 1,
			by: who.uid,
			type: 'lead',
			payload: { from: table.host.uid }
		});

		expect(await table.stranger.transport.takeLead(lead(table.stranger)), 'пізній').toBe(false);
		expect(await table.guest.transport.takeLead(lead(table.guest)), 'зі складу').toBe(true);
		await table.close('guest');
	});

	/**
	 * ОСОБА ТРАНСПОРТУ (аудит 2026-09-26): гість не пише за господаря — ні
	 * налаштувань, ні старту, ні ходу під чужим іменем, — а свій рядок прибирає сам.
	 * Доти `LocalRoom` не знала, хто за нею сидить, і пускала все це.
	 */
	it('гість не міняє налаштувань і не починає партію', async () => {
		const table = await world.table();
		await expect(table.guest.transport.setConfig({ pairs: 6, cols: 4 })).rejects.toThrow();
		await expect(table.guest.transport.setStatus('playing', rosterOf(table))).rejects.toThrow();
		await table.close();
	});

	it('хід під чужим іменем не лягає', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.guest.transport.append(flip(table.host.uid, 1))).toBe(false);
		await table.close();
	});

	it('гість прибирає лише себе, а не господаря', async () => {
		const table = await world.table();
		await expect(table.guest.transport.removeMember(table.host.uid)).rejects.toThrow();
		await table.guest.transport.removeMember(table.guest.uid);

		const snapshot = await table.until(
			(s) => !s.members.some((member) => member.uid === table.guest.uid)
		);
		expect(snapshot.members.map((member) => member.uid)).toEqual([table.host.uid]);
		await table.close();
	});

	it('господар прибирає учасника — рядок зникає цілком', async () => {
		const table = await world.table();

		await table.host.transport.removeMember(table.guest.uid);

		const snapshot = await table.until(
			(s) => !s.members.some((member) => member.uid === table.guest.uid)
		);
		expect(snapshot.members.map((member) => member.uid)).toEqual([table.host.uid]);
		await table.close();
	});

	/*
	 * ДІЇ ГОСПОДАРЯ НАД КІМНАТОЮ — той самий результат в обох реалізаціях (аудит
	 * 2026-09-24). Доти контракт їх не торкався зовсім, і вони вже розходились:
	 * `LocalRoom` гасив відлік на кінці партії, справжня база — ні.
	 */
	it('відлік: увімкнено — серверне число, скасовано — поля немає', async () => {
		const table = await world.table();

		await table.host.transport.setCountdown(true);
		const on = await table.until((s) => typeof s.info.countdownAt === 'number');
		expect(on.info.countdownAt).toBeGreaterThan(0);

		await table.host.transport.setCountdown(false);
		await table.until((s) => s.info.countdownAt === undefined);
		await table.close();
	});

	it('зміна режиму старту гасить відлік тим самим записом', async () => {
		const table = await world.table();
		await table.host.transport.setCountdown(true);
		await table.until((s) => typeof s.info.countdownAt === 'number');

		await table.host.transport.setAutoStart(true);

		const snapshot = await table.until((s) => s.info.autoStart === true);
		expect(snapshot.info.countdownAt).toBeUndefined();
		await table.close();
	});

	it('налаштування пишуться цілком', async () => {
		const table = await world.table();

		await table.host.transport.setConfig({ pairs: 6, cols: 4 });

		const snapshot = await table.until((s) => s.info.config.pairs === 6);
		expect(snapshot.info.config).toEqual({ pairs: 6, cols: 4 });
		await table.close();
	});

	it('позначка життя — серверний час', async () => {
		const table = await world.table();

		await table.host.transport.touch();

		const snapshot = await table.until((s) => typeof s.info.aliveAt === 'number');
		expect(snapshot.info.aliveAt).toBeGreaterThan(0);
		await table.close();
	});

	it('кінець партії статусом over гасить відлік', async () => {
		const table = await world.table();
		await table.host.transport.setStatus('playing', rosterOf(table));
		await table.host.transport.setCountdown(true);
		await table.until((s) => typeof s.info.countdownAt === 'number');

		await table.host.transport.setStatus('over');

		const snapshot = await table.until((s) => s.info.status === 'over');
		expect(snapshot.info.countdownAt).toBeUndefined();
		await table.close();
	});

	/**
	 * ЖУРНАЛ ПОЗА ПАРТІЄЮ Й СТАРТ (аудит 2026-09-26, A2): у лобі й після партії хід гри
	 * не лягає; старт стирає журнал лобі тим самим записом (там лежить законний `lead`);
	 * дубль старту журналу партії не чіпає.
	 */
	it('у лобі й після партії хід гри не лягає', async () => {
		const table = await world.table();
		expect(await table.guest.transport.append(flip(table.guest.uid, 1)), 'лобі').toBe(false);
		await started(table);
		await table.host.transport.setStatus('over');
		expect(await table.guest.transport.append(flip(table.guest.uid, 1)), 'після').toBe(false);
		await table.close();
	});

	it('старт стирає журнал лобі тим самим записом', async () => {
		const table = await world.table();
		await table.present([table.guest.uid]);
		const lead: Move = {
			seq: 1,
			by: table.guest.uid,
			type: 'lead',
			payload: { from: table.host.uid }
		};
		expect(await table.guest.transport.takeLead(lead), 'ведення в лобі').toBe(true);
		await table.until((s) => s.moves.length === 1 && s.info.hostUid === table.guest.uid);

		await table.guest.transport.setStatus('playing', rosterOf(table));

		const snapshot = await table.until((s) => s.info.status === 'playing' && s.moves.length === 0);
		expect(snapshot.info.hostUid).toBe(table.guest.uid);
		await table.close('guest');
	});

	it('дубль старту партію не стирає', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);

		await expect(started(table)).rejects.toThrow();

		const snapshot = await table.until((s) => s.moves.length === 1);
		expect(snapshot.info.status).toBe('playing');
		await table.close();
	});

	/**
	 * РЕВАНШ ТИМ САМИМ ЗЕРНОМ ПОСЕРЕД ПАРТІЇ — ДУБЛЬ (R9) і НАЛАШТУВАННЯ ПІСЛЯ ПАРТІЇ
	 * ЛИШЕ ЗІ СТЕРТИМ ЖУРНАЛОМ (R4) — однаково в обох реалізаціях (шостий аудит: доти
	 * цих сценаріїв у контракті не було, і дзеркало могло розійтися з базою мовчки).
	 */
	it('реванш тим самим зерном посеред партії журналу не стирає, а новим — стирає', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);

		await expect(table.host.transport.restart(1, rosterOf(table))).rejects.toThrow();
		await table.until((s) => s.moves.length === 1);
		await table.host.transport.restart(2, rosterOf(table));
		await table.until((s) => s.moves.length === 0 && s.info.seed === 2);
		await table.close();
	});

	it('після партії налаштування — лише разом зі стертим журналом', async () => {
		const table = await world.table();
		await started(table);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);
		await table.host.transport.setStatus('over');

		await expect(table.host.transport.setConfig({ pairs: 6, cols: 4 })).rejects.toThrow();
		await table.close();
	});

	it('кімнату закрито — підписка чує «кімнати немає»', async () => {
		const table = await world.table();
		const gone = vi.fn();
		const stop = table.guest.transport.watch(() => {}, gone);

		await table.close();

		await vi.waitFor(() => expect(gone).toHaveBeenCalled(), { timeout: 10_000 });
		stop();
	});
});

/**
 * ПУБЛІЧНІСТЬ — У КІМНАТІ (аудит 2026-09-24).
 *
 * Лише тут, а не в контракті вище: `LocalRoom` бере `info` готовим, тож без
 * емулятора нічим не видно, що справжнє створення поле пише, а правило бази його
 * пропускає. Зворотний експеримент: прибрати `listed` із `createRoom` — червоніють
 * обидві (приватна теж несе явне `false`); прибрати правило `info/listed` — теж
 * обидві, бо тоді `$other` відмовляє всьому створенню.
 */
describe('rtdbRoom + емулятор: створення кімнати', () => {
	it.each([
		{ isPrivate: false, listed: true },
		{ isPrivate: true, listed: false }
	])('приватна — $isPrivate, у кімнаті listed — $listed', async ({ isPrivate, listed }) => {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host } = people;
		const net = await import('./rtdbRoom');
		const code = await as(host, () =>
			net.createRoom({
				gameId: 'pairs',
				rulesVersion: 3,
				seed: 1,
				config: CONFIG,
				name: 'Господар',
				isPrivate
			})
		);

		const info = await as(host, () => net.peekRoom(code));

		expect(info?.listed).toBe(listed);
		await as(host, () => net.closeRoom(code));
	});

	/**
	 * ТЕЛЕФОН ПОЗНАЧАЄ СЕБЕ В РЯДКУ СКЛАДУ (`Member.compact`), і правила це поле
	 * НАЗИВАЮТЬ: інакше `$other: false` відкинув би вхід із телефона цілком — не
	 * «сітка не та», а «не вдалося зайти».
	 *
	 * Зворотний експеримент: прибрати `compact` із правил — червоніє.
	 */
	/**
	 * СКЛАД ДО ВХОДУ — для вікна «вас запросили» (рішення автора 2026-09-26): не
	 * учасник бачить, хто вже в кімнаті (і які аватарки зайняті), а після входу — і
	 * себе серед них. Кімнати немає — `null`, а не порожній склад.
	 */
	it('склад до входу: хто вже тут — і я серед них після входу', async () => {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host, guest } = people;
		const net = await import('./rtdbRoom');
		const code = await as(host, () =>
			net.createRoom({
				gameId: 'pairs',
				rulesVersion: 3,
				seed: 1,
				config: CONFIG,
				name: 'Господар',
				avatar: 'cat:blue',
				isPrivate: true
			})
		);

		const before = await as(guest, () => net.peekMembers(code));
		expect(before?.map((member) => member.uid)).toEqual([host.uid]);
		expect(before?.[0]?.avatar, 'зайняту аватарку видно до входу').toBe('cat:blue');

		await as(guest, () => net.joinRoom(code, 'Гість'));
		const after = await as(guest, () => net.peekMembers(code));
		expect(after?.map((member) => member.uid).sort()).toEqual([host.uid, guest.uid].sort());
		expect(await as(guest, () => net.peekMembers('99999')), 'кімнати немає').toBeNull();
		await as(host, () => net.closeRoom(code));
	});

	it('гість із телефона заходить і позначає малий екран', async () => {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host, guest } = people;
		const net = await import('./rtdbRoom');
		const code = await as(host, () =>
			net.createRoom({
				gameId: 'pairs',
				rulesVersion: 3,
				seed: 1,
				config: CONFIG,
				name: 'Господар',
				isPrivate: true
			})
		);

		vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
		try {
			await as(guest, () => net.joinRoom(code, 'Гість'));
		} finally {
			vi.unstubAllGlobals();
		}

		const { get, ref } = await import('firebase/database');
		const row = await get(ref(guest.db, `rooms/${code}/members/${guest.uid}`));
		expect(row.val()?.compact).toBe(true);
		await as(host, () => net.closeRoom(code));
	});
});

/**
 * ПІТИ НАЗОВСІМ (аудит 2026-09-24): посеред партії — рядок складу й хід `leave`
 * ОДНИМ записом, у лобі — лише рядок. Лише тут, бо `leaveRoom` (`net/leave.ts`) — справжня мережа:
 * правило ходу читає склад ДО запису, і саме це дозволяє прибрати себе й
 * дописати хід разом.
 *
 * Зворотний експеримент: прибрати хід із `leaveRoom` — червоніє перший.
 */
describe('rtdbRoom + емулятор: піти назовсім', () => {
	async function roomWithGuest() {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host, guest } = people;
		const net = await import('./rtdbRoom');
		const code = await as(host, () =>
			net.createRoom({
				gameId: 'pairs',
				rulesVersion: 3,
				seed: 1,
				config: CONFIG,
				name: 'Господар',
				isPrivate: true
			})
		);
		await as(guest, () => net.joinRoom(code, 'Гість'));
		const transport = await as(host, () => net.roomTransport(code));
		return { net, code, host, guest, transport };
	}

	it('посеред партії — рядок складу й хід leave одним записом', async () => {
		const { net, code, host, guest, transport } = await roomWithGuest();
		await transport.setStatus('playing', [
			{ uid: host.uid, name: 'Господар' },
			{ uid: guest.uid, name: 'Гість' }
		]);
		expect(await transport.append(flip(host.uid, 1))).toBe(true);
		const index = `myRooms/${guest.uid}/${code}`;
		expect(await peek(guest, index), 'перевірка жива: вхід записав індекс').not.toBeNull();

		const { leaveRoom } = await import('./leave');
		await as(guest, () => leaveRoom(code));

		const snapshot = await until(
			transport,
			(s) => !s.members.some((member) => member.uid === guest.uid)
		);
		expect(snapshot.moves.at(-1)).toMatchObject({ seq: 2, by: guest.uid, type: 'leave' });
		// І свій індекс — тим самим викликом: інакше «вас чекають» кликало б назад.
		expect(await peek(guest, index)).toBeNull();
		await as(host, () => net.closeRoom(code));
	});

	it('у лобі — лише рядок складу, без ходу', async () => {
		const { net, code, guest, transport } = await roomWithGuest();

		const { leaveRoom } = await import('./leave');
		await as(guest, () => leaveRoom(code));

		const snapshot = await until(
			transport,
			(s) => !s.members.some((member) => member.uid === guest.uid)
		);
		expect(snapshot.moves).toEqual([]);
		await as(people!.host, () => net.closeRoom(code));
	});
});
