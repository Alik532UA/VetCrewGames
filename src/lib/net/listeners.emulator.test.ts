import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, signedIn, type Connection } from './emulatorSession';

/**
 * ПІСЛЯ ВІДПИСКИ — ТИША, НАД СПРАВЖНІМ SDK (аудит 2026-09-26).
 *
 * `off(ref, 'value', callback)` знімає лише ТОЙ САМИЙ колбек, що був переданий у
 * `onValue`. Код передавав туди те, що `onValue` ПОВЕРНУВ, — тобто не знімав нічого:
 * кожна відвідана кімната тягла свій журнал до кінця вкладки, а колбек присутності
 * старої кімнати писав у сесію нової. Підставний SDK модульних тестів знімав
 * слухача за шляхом і цього не бачив; тут — справжній.
 *
 * ЯК ДОВОДИТЬСЯ ТИША. Після відписки в той самий вузол лягає нове значення, і
 * СВІЖА підписка того самого застосунку його бачить. Події одного вузла SDK
 * роздає одним прогоном, тож стара, якби лишилася, почула б його не пізніше за
 * свіжу, — чекати «достатньо довго» не треба.
 *
 * Зворотний експеримент: повернути `off(…, 'value', handler)` у будь-якій із
 * підписок — червоніє її випадок.
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

let host: Connection;
let guest: Connection;
/** Дані гравця синхронізує лише акаунт — анонімові їх писати правило не дає (шостий аудит). */
let account: Connection;

beforeAll(async () => {
	host = await signedIn('listeners-host');
	guest = await signedIn('listeners-guest');
	account = await signedIn('listeners-account', { account: true });
});

afterAll(() => closeAll([host, guest, account]));

async function roomOf(who: Connection, isPrivate = true): Promise<string> {
	const net = await import('./rtdbRoom');
	return as(who, () =>
		net.createRoom({
			gameId: 'pairs',
			rulesVersion: 3,
			seed: 1,
			config: { pairs: 4, cols: 4 },
			name: 'Господар',
			isPrivate
		})
	);
}

/**
 * Підписатися, дочекатися першої події, відписатися — і повернути лічильник подій,
 * що прийшли ПІСЛЯ відписки.
 */
async function silencedAfterStop<T>(
	subscribe: (onEvent: (value: T) => void) => Promise<() => void>
): Promise<() => number> {
	let calls = 0;
	let stopped = false;
	let late = 0;
	const stop = await subscribe(() => {
		calls += 1;
		if (stopped) late += 1;
	});
	await vi.waitFor(() => expect(calls, 'перевірка жива: підписка чула').toBeGreaterThan(0), {
		timeout: 10_000
	});
	stop();
	stopped = true;
	return () => late;
}

/** Свіжа підписка того самого застосунку побачила зміну — стара мусила б теж. */
async function seenByFresh<T>(
	subscribe: (onEvent: (value: T) => void) => Promise<() => void>,
	changed: (value: T) => boolean
): Promise<void> {
	let seen = false;
	const stop = await subscribe((value) => {
		if (changed(value)) seen = true;
	});
	try {
		await vi.waitFor(() => expect(seen, 'свіжа підписка побачила зміну').toBe(true), {
			timeout: 10_000
		});
	} finally {
		stop();
	}
}

describe('після відписки колбек не приходить', () => {
	it('кімната (`transport.watch`)', async () => {
		const net = await import('./rtdbRoom');
		const code = await roomOf(host);
		const transport = await as(host, () => net.roomTransport(code));
		type Seen = { autoStart?: boolean };
		const subscribe = async (onEvent: (value: Seen) => void) =>
			transport.watch((snapshot) => onEvent({ autoStart: snapshot.info.autoStart }));

		const late = await silencedAfterStop(subscribe);
		await as(host, () => transport.setAutoStart(true));
		await seenByFresh(subscribe, (value) => value.autoStart === true);

		expect(late(), 'стара підписка кімнати досі чує').toBe(0);
		await as(host, () => net.closeRoom(code));
	});

	it('опис кімнати (`watchRoomInfo`)', async () => {
		const net = await import('./rtdbRoom');
		const code = await roomOf(host);
		const transport = await as(host, () => net.roomTransport(code));
		type Seen = { autoStart?: boolean } | null;
		const subscribe = (onEvent: (value: Seen) => void) =>
			as(host, () => net.watchRoomInfo(code, (info) => onEvent(info)));

		const late = await silencedAfterStop(subscribe);
		await as(host, () => transport.setAutoStart(true));
		await seenByFresh(subscribe, (value) => value?.autoStart === true);

		expect(late(), 'стара підписка опису досі чує').toBe(0);
		await as(host, () => net.closeRoom(code));
	});

	it('присутність (`watchPresence`) і «хто ще тут» (`watchOthers`)', async () => {
		const net = await import('./rtdbRoom');
		const presence = await import('./presence');
		const code = await roomOf(host);
		await as(guest, () => net.joinRoom(code, 'Гість'));

		const who = (onEvent: (online: string[]) => void) =>
			as(host, () => presence.watchPresence(code, onEvent));
		const others = (onEvent: (count: number) => void) =>
			as(host, () => presence.watchOthers(code, onEvent));

		const lateWho = await silencedAfterStop(who);
		const lateOthers = await silencedAfterStop(others);
		const leave = await as(guest, () => presence.trackPresence(code));
		await seenByFresh(who, (online) => online.includes(guest.uid));
		await seenByFresh(others, (count) => count === 1);

		expect(lateWho(), 'стара підписка присутності досі чує').toBe(0);
		expect(lateOthers(), 'стара підписка «хто ще тут» досі чує').toBe(0);
		leave();
		await as(host, () => net.closeRoom(code));
	});

	it('наведення (`watchHovers`)', async () => {
		const net = await import('./rtdbRoom');
		const presence = await import('./presence');
		const code = await roomOf(host);
		await as(guest, () => net.joinRoom(code, 'Гість'));
		// Наведення живе у вузлі присутності: без нього поле окремо не пишеться.
		const leave = await as(guest, () => presence.trackPresence(code));
		const hovers = (onEvent: (byUid: Record<string, number>) => void) =>
			as(host, () => presence.watchHovers(code, onEvent));
		await seenByFresh(
			(onEvent: (online: string[]) => void) => as(host, () => presence.watchPresence(code, onEvent)),
			(online) => online.includes(guest.uid)
		);

		const late = await silencedAfterStop(hovers);
		await as(guest, () => presence.setHover(code, 3));
		await seenByFresh(hovers, (byUid) => byUid[guest.uid] === 3);

		expect(late(), 'стара підписка наведення досі чує').toBe(0);
		leave();
		await as(host, () => net.closeRoom(code));
	});

	it('стан звʼязку (`watchConnected`)', async () => {
		const { goOffline, goOnline } = await import('firebase/database');
		const presence = await import('./presence');
		const connected = (onEvent: (online: boolean) => void) =>
			as(host, () => presence.watchConnected(onEvent));

		const late = await silencedAfterStop(connected);
		goOffline(host.db);
		try {
			await seenByFresh(connected, (online) => online === false);
		} finally {
			goOnline(host.db);
		}

		expect(late(), 'стара підписка звʼязку досі чує').toBe(0);
	});

	it('перелік кімнат (`watchLobby`)', async () => {
		const net = await import('./rtdbRoom');
		const lobby = await import('./lobby');
		const code = await roomOf(host, false);
		const rooms = (onEvent: (codes: string[]) => void) =>
			as(guest, () =>
				lobby.watchLobby('pairs', {
					onRooms: (list) => onEvent(list.map((room) => room.code)),
					onUnavailable: (reason) => {
						throw new Error(`перелік не читається: ${reason}`);
					}
				})
			);

		const late = await silencedAfterStop(rooms);
		const unlist = await as(host, () =>
			lobby.publishRoom({
				code,
				hostUid: host.uid,
				hostName: 'Господар',
				gameId: 'pairs',
				rulesVersion: 3,
				players: 1
			})
		);
		await seenByFresh(rooms, (codes) => codes.includes(code));

		expect(late(), 'стара підписка переліку досі чує').toBe(0);
		unlist();
		await as(host, () => net.closeRoom(code));
	});

	it('дані гравця (`watchPlay`)', async () => {
		const play = await import('./play');
		type Seen = { score: number } | null;
		const data = (onEvent: (value: Seen) => void) => as(account, () => play.watchPlay(onEvent));

		const late = await silencedAfterStop(data);
		await as(account, () => play.writePlay({ score: 7, games: {} }));
		await seenByFresh(data, (value) => value?.score === 7);

		expect(late(), 'стара підписка даних гравця досі чує').toBe(0);
	});
});
