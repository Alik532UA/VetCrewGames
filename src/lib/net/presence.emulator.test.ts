import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, peek, sameUserTwice, signedIn, type Connection } from './emulatorSession';

/**
 * ПРИСУТНІСТЬ НАД СПРАВЖНІМ SDK (аудит 2026-09-24).
 *
 * `reconnect.test.ts` перевіряє порядок викликів на підставці; тут — те, чого
 * підставка довести не може: що справжній `onDisconnect` справжнього зʼєднання
 * прибирає вузол, а `keepNode` ставить його знову, і що вузол, спільний для двох
 * вкладок однієї людини, переживає закриття однієї з них.
 *
 * Зворотні експерименти: не збільшувати номер зʼєднання в `keepNode` — червоніє
 * перший (вузол після повернення не зʼявляється); не слухати свій вузол — другий.
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
let watcher: Connection;
let tabs: [Connection, Connection];

beforeAll(async () => {
	host = await signedIn('presence-host');
	watcher = await signedIn('presence-watcher');
	tabs = await sameUserTwice('presence-tabs');
});

afterAll(() => closeAll([host, watcher, ...tabs]));

/** Кімната, у якій `who` — учасник: присутність пишеться лише учасником. */
async function roomOf(who: Connection): Promise<string> {
	const net = await import('./rtdbRoom');
	return as(who, () =>
		net.createRoom({
			gameId: 'pairs',
			rulesVersion: 3,
			seed: 1,
			config: { pairs: 4, cols: 4 },
			name: 'Господар',
			isPrivate: true
		})
	);
}

const presentIn = (code: string, uid: string) => () =>
	peek(watcher, `presence/${code}/${uid}`).then((node) => node !== null);

async function becomes(check: () => Promise<boolean>, expected: boolean, what: string) {
	await vi.waitFor(async () => expect(await check(), what).toBe(expected), { timeout: 10_000 });
}

describe('присутність над справжнім SDK', () => {
	it('обрив прибирає вузол, повернення ставить знову — і знову з домовленістю', async () => {
		const { goOffline, goOnline } = await import('firebase/database');
		const { trackPresence } = await import('./presence');
		const code = await roomOf(host);
		const here = presentIn(code, host.uid);

		const stop = await as(host, () => trackPresence(code));
		await becomes(here, true, 'перевірка жива: присутність встала');

		goOffline(host.db);
		await becomes(here, false, 'обрив: сервер виконав домовленість');
		goOnline(host.db);
		await becomes(here, true, 'повернення: вузол поставлено знову');

		// Домовленість теж нова: другий обрив так само прибирає вузол.
		goOffline(host.db);
		await becomes(here, false, 'другий обрив: домовленість відновлена разом із вузлом');
		goOnline(host.db);
		await becomes(here, true, 'і знову на місці');

		stop();
		await becomes(here, false, 'вихід прибирає вузол');
	});

	it('дві вкладки однієї людини: закрилась одна — друга ставить вузол знову', async () => {
		const { goOffline } = await import('firebase/database');
		const { trackPresence } = await import('./presence');
		const [first, second] = tabs;
		expect(second.uid, 'перевірка жива: це та сама людина').toBe(first.uid);
		const code = await roomOf(first);
		const here = presentIn(code, first.uid);

		await as(first, () => trackPresence(code));
		const stop = await as(second, () => trackPresence(code));
		await becomes(here, true, 'перевірка жива: присутність встала');

		// Що бачить третій: зникнення й повернення — окремими подіями.
		const { onValue, ref } = await import('firebase/database');
		const seen: boolean[] = [];
		const off = onValue(ref(watcher.db, `presence/${code}/${first.uid}`), (node) =>
			seen.push(node.exists())
		);
		await vi.waitFor(() => expect(seen).toEqual([true]));

		// Перша вкладка «закрилась»: її `onDisconnect` прибирає СПІЛЬНИЙ вузол.
		goOffline(first.db);
		await vi.waitFor(() => expect(seen, 'перевірка жива: вузол таки зникав').toContain(false), {
			timeout: 10_000
		});
		await vi.waitFor(() => expect(seen.at(-1), 'друга вкладка поставила вузол знову').toBe(true), {
			timeout: 10_000
		});

		off();
		stop();
	});
});
