import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * СПРАВЖНІЙ ТРАНСПОРТ: ЯКІ САМЕ ЗАПИСИ ВІН РОБИТЬ.
 *
 * ## Навіщо, коли є `LocalRoom`
 *
 * Правила партії перевіряються двома учасниками на підставному транспорті — і
 * саме тому розходження двох реалізацій небезпечне: тест доводить властивість,
 * якої в продакшні немає. Так і було з реваншем: `LocalRoom.restart` ставив новий
 * `startedAt`, а `rtdbRoom.restart` — ні, тож перший хід реваншу в живій грі був
 * простроченим уже на старті, а тест `pairsMatch` лишався зеленим.
 *
 * Тут SDK підмінено на межі модуля й записано КОЖЕН запис. Мережі немає, правил
 * теж — їх перевіряє `npm run check:rules`; ця перевірка каже лише, що саме
 * транспорт надсилає.
 */

/** Те, що повертає `serverTimestamp()`: мітка «час поставить сервер». */
const SERVER_TIME = { '.sv': 'timestamp' };

interface Write {
	op: 'set' | 'update' | 'remove';
	path: string;
	value?: unknown;
}

const writes: Write[] = [];

const ref = vi.fn((_db: unknown, path = '') => ({ path }));
const set = vi.fn(async (node: { path: string }, value: unknown) => {
	writes.push({ op: 'set', path: node.path, value });
});
const update = vi.fn(async (node: { path: string }, value: unknown) => {
	writes.push({ op: 'update', path: node.path, value });
});
const remove = vi.fn(async (node: { path: string }) => {
	writes.push({ op: 'remove', path: node.path });
});

vi.mock('./firebase', () => ({ connect: async () => ({ uid: 'uid-host', db: {} }) }));
vi.mock('./ownRooms', () => ({
	forgetOwnRoom: vi.fn(async () => {}),
	pruneOwnRooms: vi.fn(async () => {}),
	rememberOwnRoom: vi.fn(async () => {})
}));
vi.mock('firebase/database', () => ({
	ref,
	set,
	update,
	remove,
	get: vi.fn(),
	off: vi.fn(),
	onValue: vi.fn(() => () => {}),
	serverTimestamp: () => SERVER_TIME
}));

const { roomTransport } = await import('./rtdbRoom');

describe('rtdbRoom: записи транспорту', () => {
	beforeEach(() => {
		writes.length = 0;
	});

	/**
	 * Зворотний експеримент: повернути `update(…, { 'info/seed': seed, moves: null })`
	 * — випадок червоніє, бо в записі немає `info/startedAt`.
	 */
	it('реванш — ОДИН запис: зерно, порожній журнал і новий startedAt серверним часом', async () => {
		const transport = await roomTransport('42');
		await transport.restart(7);

		expect(writes).toEqual([
			{
				op: 'update',
				path: 'rooms/42',
				value: {
					'info/seed': 7,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					moves: null
				}
			}
		]);
	});

	it('початок партії ставить startedAt тим самим записом, що й статус', async () => {
		const transport = await roomTransport('42');
		await transport.setStatus('playing');

		expect(writes).toEqual([
			{
				op: 'update',
				path: 'rooms/42/info',
				value: { status: 'playing', startedAt: SERVER_TIME, countdownAt: null }
			}
		]);
	});

	it('хід лягає під ключ із нулями попереду, а час ставить сервер', async () => {
		const transport = await roomTransport('42');
		await transport.append({ seq: 3, by: 'uid-host', type: 'peek' });

		expect(writes).toEqual([
			{
				op: 'set',
				path: 'rooms/42/moves/000003',
				value: { seq: 3, by: 'uid-host', type: 'peek', at: SERVER_TIME }
			}
		]);
	});
});
