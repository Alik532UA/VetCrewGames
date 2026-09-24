import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';
import { LocalRoom } from './localRoom';
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
 * Чого тут навмисно немає: чужої особи. `LocalRoom` не знає, хто за транспортом
 * сидить (так задумано), тож «гість прибирає чужий рядок» або «хід від чужого
 * імені» тут не порівняти — це стереже `check:rules` напряму.
 *
 * Запуск — `npm run check:rules`, тим самим запуском емулятора, що й правила.
 */

interface Connection {
	uid: string;
	db: Database;
	auth: Auth;
	app: FirebaseApp;
}

/**
 * `connect()` веде туди, куди скаже тест: у емулятор і від імені вибраного
 * учасника. Справжній `net/firebase.ts` сюди не потрапляє — зі своїм ключем він
 * пішов би в ЖИВИЙ проєкт (і запобіжник `emulator-only.setup.ts` це зупинить).
 */
let current: Connection | null = null;
vi.mock('$lib/net/firebase', () => ({
	connect: async () => {
		if (!current) throw new Error('контракт: не вибрано, від чийого імені діяти');
		return current;
	},
	forget: () => {}
}));

const PROJECT = 'demo-vet-crew-games';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9010';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9109';

async function signedIn(name: string): Promise<Connection> {
	const { initializeApp } = await import('firebase/app');
	const { connectAuthEmulator, getAuth, signInAnonymously } = await import('firebase/auth');
	const { connectDatabaseEmulator, getDatabase } = await import('firebase/database');
	const app = initializeApp(
		{
			apiKey: 'demo-key',
			projectId: PROJECT,
			databaseURL: `http://${DB_HOST}?ns=${PROJECT}-default-rtdb`
		},
		name
	);
	const auth = getAuth(app);
	connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
	const db = getDatabase(app);
	const [host, port] = DB_HOST.split(':');
	connectDatabaseEmulator(db, host, Number(port));
	const { user } = await signInAnonymously(auth);
	return { uid: user.uid, db, auth, app };
}

/** Зробити щось від імені учасника. Транспорт бере підʼєднання раз, при створенні. */
async function as<T>(who: Connection, run: () => Promise<T>): Promise<T> {
	current = who;
	try {
		return await run();
	} finally {
		current = null;
	}
}

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
	close(): Promise<void>;
}

interface World {
	name: string;
	/** Нова кімната в лобі: господар і гість — гравці; `spectator` — ще й глядач. */
	table(options?: { spectator?: boolean }): Promise<Table>;
}

const CONFIG = { pairs: 4, cols: 4 };

const local: World = {
	name: 'LocalRoom',
	async table({ spectator = false } = {}) {
		const [HOST, GUEST, STRANGER] = ['uid-host', 'uid-guest', 'uid-stranger'];
		const members: Member[] = [
			{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
			{ uid: GUEST, name: 'Гість', role: 'player', order: 2 },
			...(spectator
				? [{ uid: STRANGER, name: 'Глядач', role: 'spectator' as const, order: 3 }]
				: [])
		];
		const info: RoomInfo = {
			gameId: 'pairs',
			rulesVersion: 3,
			seed: 1,
			status: 'lobby',
			hostUid: HOST,
			config: CONFIG
		};
		const room = new LocalRoom(info, members);
		const seat = (uid: string): Seat => ({ uid, transport: room.transport() });
		const host = seat(HOST);
		return {
			host,
			guest: seat(GUEST),
			stranger: seat(STRANGER),
			until: (check) => until(host.transport, check),
			close: async () => room.close()
		};
	}
};

let people: { host: Connection; guest: Connection; stranger: Connection } | null = null;

const emulator: World = {
	name: 'rtdbRoom + емулятор',
	async table({ spectator = false } = {}) {
		if (!people) throw new Error('контракт: учасники емулятора не ввійшли');
		const { host, guest, stranger } = people;
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
		if (spectator) await as(stranger, () => net.joinRoom(code, 'Глядач', 'spectator'));
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
			close: () => as(host, () => net.closeRoom(code))
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

afterAll(async () => {
	const { deleteApp } = await import('firebase/app');
	for (const who of Object.values(people ?? {})) await deleteApp(who.app);
});

const flip = (by: string, seq: number): Move => ({ seq, by, type: 'flip', payload: { index: 0 } });

const rosterOf = (table: Table): RosterEntry[] => [
	{ uid: table.host.uid, name: 'Господар' },
	{ uid: table.guest.uid, name: 'Гість' }
];

describe.each([local, emulator])('контракт транспорту: $name', (world) => {
	it('учасник дописує хід, а той самий номер удруге — ні', async () => {
		const table = await world.table();

		expect(await table.guest.transport.append(flip(table.guest.uid, 1))).toBe(true);
		expect(await table.host.transport.append(flip(table.host.uid, 1))).toBe(false);

		const snapshot = await table.until((s) => s.moves.length === 1);
		expect(snapshot.moves[0].by).toBe(table.guest.uid);
		expect(typeof snapshot.moves[0].at, 'час ходу ставить «сервер»').toBe('number');
		await table.close();
	});

	it('хід від того, кого немає в складі, не лягає', async () => {
		const table = await world.table();
		expect(await table.stranger.transport.append(flip(table.stranger.uid, 1))).toBe(false);
		await table.close();
	});

	it('номер поза шістьма цифрами не лягає', async () => {
		const table = await world.table();
		expect(await table.guest.transport.append(flip(table.guest.uid, 0))).toBe(false);
		expect(await table.guest.transport.append(flip(table.guest.uid, 1_000_000))).toBe(false);
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

	it('старт ставить статус, серверний startedAt і склад одним записом', async () => {
		const table = await world.table();

		await table.host.transport.setStatus('playing', rosterOf(table));

		const snapshot = await table.until((s) => s.info.status === 'playing');
		expect(typeof snapshot.info.startedAt).toBe('number');
		expect(snapshot.info.countdownAt, 'відлік гасне разом зі стартом').toBeUndefined();
		expect(snapshot.info.roster).toEqual(rosterOf(table));
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

	it('господар прибирає учасника — рядок зникає цілком', async () => {
		const table = await world.table();

		await table.host.transport.removeMember(table.guest.uid);

		const snapshot = await table.until(
			(s) => !s.members.some((member) => member.uid === table.guest.uid)
		);
		expect(snapshot.members.map((member) => member.uid)).toEqual([table.host.uid]);
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
