import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, signedIn, type Connection } from './emulatorSession';
import type { LobbyRoom } from './lobby';

/**
 * ПЕРЕЛІК ПУБЛІЧНИХ КІМНАТ НАД СПРАВЖНІМ SDK (аудит 2026-09-25).
 *
 * Саме тут колись стався продакшн-дефект, якого REST-гейт не бачив: `publishRoom`
 * спершу реєструє `onDisconnect().remove()`, і Firebase перевіряє права на ЦЮ
 * реєстрацію — видалення вузла, якого ще немає. Гейт перевіряв `set`, а не
 * реєстрацію, і створення публічної кімнати падало в продакшні з
 * `PERMISSION_DENIED`. REST такого API не має — тож перевірити реєстрацію
 * по-справжньому можна лише SDK.
 *
 * Тут людина проходить увесь шлях: публікація (разом із реєстрацією), інший бачить
 * запис у переліку, лічильник гравців наздоганяє, обрив прибирає запис, повернення
 * ставить знову, зняття прибирає.
 *
 * Зворотний експеримент: прибрати з правила `lobby/$gameId/$code` гілку видалення
 * відсутнього запису — червоніє перший, на самій публікації.
 */

vi.mock('$lib/net/firebase', async () => {
	const { currentConnection } = await import('$lib/net/emulatorSession');
	return { connect: currentConnection, forget: () => {} };
});

let host: Connection;
let watcher: Connection;

beforeAll(async () => {
	host = await signedIn('lobby-host');
	watcher = await signedIn('lobby-watcher');
});

afterAll(() => closeAll([host, watcher]));

/** Останній знімок переліку очима спостерігача. */
async function watch(): Promise<{ rooms: () => LobbyRoom[]; stop: () => void }> {
	const lobby = await import('./lobby');
	let latest: LobbyRoom[] = [];
	const stop = await as(watcher, () =>
		lobby.watchLobby('pairs', {
			onRooms: (rooms) => (latest = rooms),
			onUnavailable: (reason) => {
				throw new Error(`перелік не читається: ${reason}`);
			}
		})
	);
	return { rooms: () => latest, stop };
}

const listed = (rooms: () => LobbyRoom[], code: string) => () =>
	rooms().find((room) => room.code === code) ?? null;

async function becomes<T>(read: () => T, check: (value: T) => boolean, what: string) {
	await vi.waitFor(() => expect(check(read()), what).toBe(true), { timeout: 10_000 });
}

describe('перелік публічних кімнат над справжнім SDK', () => {
	it('публікація, лічильник, обрив, повернення й зняття', async () => {
		const { goOffline, goOnline } = await import('firebase/database');
		const net = await import('./rtdbRoom');
		const lobby = await import('./lobby');
		const code = await as(host, () =>
			net.createRoom({
				gameId: 'pairs',
				rulesVersion: 3,
				seed: 1,
				config: { pairs: 4, cols: 4 },
				name: 'Господар',
				isPrivate: false
			})
		);
		const view = await watch();
		const mine = listed(view.rooms, code);

		// Реєстрація `onDisconnect` і запис — те, що падало в продакшні.
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
		await becomes(mine, (room) => room !== null, 'інший бачить кімнату в переліку');

		await as(host, () => lobby.updatePlayers('pairs', code, 2));
		await becomes(mine, (room) => room?.players === 2, 'лічильник наздогнав');

		goOffline(host.db);
		await becomes(mine, (room) => room === null, 'обрив: сервер виконав домовленість');
		goOnline(host.db);
		await becomes(mine, (room) => room?.players === 2, 'повернення: той самий запис знову');

		unlist();
		await becomes(mine, (room) => room === null, 'зняття прибирає запис');
		view.stop();
		await as(host, () => net.closeRoom(code));
	});
});
