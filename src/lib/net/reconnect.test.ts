import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ПІСЛЯ ОБРИВУ ЗВʼЯЗКУ — ТЕ САМЕ, ЩО ДО НЬОГО.
 *
 * `onDisconnect` виконується один раз: обірвався сокет — сервер прибрав запис, і
 * домовленості більше немає. Доти і присутність, і запис кімнати в переліку
 * ставилися РАЗ на вхід, тож після першого ж обриву людина лишалася «відсутньою»
 * до перезавантаження, а кімната мовчки зникала зі списку (аудит 2026-09-23).
 *
 * Тут SDK підмінено на межі модуля, а `.info/connected` тест обриває й повертає
 * сам — рівно так, як це робить Firebase.
 *
 * Зворотний експеримент: у `onReconnect` прибрати виклик `run()` — червоніють
 * «присутність відновлюється» й «запис переліку відновлюється».
 */

const SERVER_TIME = { '.sv': 'timestamp' };

interface Op {
	op: 'set' | 'remove' | 'onDisconnect.remove';
	path: string;
	value?: unknown;
}
const ops: Op[] = [];
const listeners = new Map<string, (snapshot: { val: () => unknown }) => void>();

const ref = (_db: unknown, path = '') => ({ path });

vi.mock('./firebase', () => ({ connect: async () => ({ uid: 'uid-host', db: {} }) }));
vi.mock('firebase/database', () => ({
	ref,
	set: vi.fn(async (node: { path: string }, value: unknown) => {
		ops.push({ op: 'set', path: node.path, value });
	}),
	remove: vi.fn(async (node: { path: string }) => {
		ops.push({ op: 'remove', path: node.path });
	}),
	onDisconnect: (node: { path: string }) => ({
		remove: async () => {
			ops.push({ op: 'onDisconnect.remove', path: node.path });
		}
	}),
	onValue: (node: { path: string }, handler: (snapshot: { val: () => unknown }) => void) => {
		listeners.set(node.path, handler);
		return handler;
	},
	off: vi.fn((node: { path: string }) => listeners.delete(node.path)),
	serverTimestamp: () => SERVER_TIME
}));

const { trackPresence, watchConnected } = await import('./presence');
const { publishRoom, updatePlayers } = await import('./lobby');

/** Firebase повідомляє про стан звʼязку. */
const connection = (online: boolean) => listeners.get('.info/connected')?.({ val: () => online });

/** Дочекатися запису, запущеного з обробника: у ньому два `await`. */
const flush = async () => {
	for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
};

describe('присутність після обриву', () => {
	beforeEach(() => {
		ops.length = 0;
		listeners.clear();
	});

	it('перевірка жива: вхід домовляється про прибирання, а тоді записується', async () => {
		await trackPresence('42');
		expect(ops).toEqual([
			{ op: 'onDisconnect.remove', path: 'presence/42/uid-host' },
			{ op: 'set', path: 'presence/42/uid-host', value: { at: SERVER_TIME } }
		]);
	});

	it('перше «на звʼязку» нічого не повторює — запис уже зроблено', async () => {
		await trackPresence('42');
		ops.length = 0;
		connection(true);
		await flush();
		expect(ops).toEqual([]);
	});

	it('присутність відновлюється після кожного обриву — у тому самому порядку', async () => {
		await trackPresence('42');
		connection(true);
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops).toEqual([
			{ op: 'onDisconnect.remove', path: 'presence/42/uid-host' },
			{ op: 'set', path: 'presence/42/uid-host', value: { at: SERVER_TIME } }
		]);
	});

	it('після виходу з кімнати обрив нічого не відновлює', async () => {
		const stop = await trackPresence('42');
		connection(true);
		stop();
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops).toEqual([]);
	});

	it('стан звʼязку доходить до екрана', async () => {
		const seen: boolean[] = [];
		await watchConnected((online) => seen.push(online));
		connection(true);
		connection(false);
		expect(seen).toEqual([true, false]);
	});
});

describe('запис у переліку кімнат після обриву', () => {
	beforeEach(() => {
		ops.length = 0;
		listeners.clear();
	});

	const entry = {
		code: '42',
		hostUid: 'uid-host',
		hostName: 'Господар',
		gameId: 'quiz',
		rulesVersion: 3,
		players: 1
	};

	it('запис відновлюється — з ОСТАННІМ числом гравців, а не з першим', async () => {
		await publishRoom(entry);
		connection(true);
		await updatePlayers('quiz', '42', 3);
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops[0]).toEqual({ op: 'onDisconnect.remove', path: 'lobby/quiz/42' });
		expect(ops[1]?.op).toBe('set');
		expect(ops[1]?.path).toBe('lobby/quiz/42');
		expect(ops[1]?.value).toMatchObject({ players: 3, at: SERVER_TIME });
	});

	it('знятий із переліку запис після обриву не повертається', async () => {
		const unlist = await publishRoom(entry);
		connection(true);
		unlist();
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops.filter((op) => op.op === 'set')).toEqual([]);
	});
});
