import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

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
/** Підписки за шляхом — щоб подати знімок так, як його подає SDK. */
const watchers = new Map<string, (snapshot: { val: () => unknown }) => void>();
/** Третій аргумент `onValue` — скасування підписки базою. */
const cancels = new Map<string, (error: Error) => void>();

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

vi.mock('./firebase', () => ({
	connect: async () => ({ uid: 'uid-host', db: {} }),
	serverNow: () => Date.now()
}));
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
	onValue: vi.fn(
		(
			node: { path: string },
			handler: (snapshot: { val: () => unknown }) => void,
			cancel?: (error: Error) => void
		) => {
			watchers.set(node.path, handler);
			if (cancel) cancels.set(node.path, cancel);
			return handler;
		}
	),
	serverTimestamp: () => SERVER_TIME
}));

const { ROOM_CAPACITY, joinRoom, roomTransport } = await import('./rtdbRoom');
const { get } = await import('firebase/database');

describe('rtdbRoom: записи транспорту', () => {
	beforeEach(() => {
		writes.length = 0;
	});

	/**
	 * Зворотний експеримент: повернути `update(…, { 'info/seed': seed, moves: null })`
	 * — випадок червоніє, бо в записі немає `info/startedAt`.
	 */
	it('реванш — ОДИН запис: зерно, порожній журнал, новий startedAt і новий склад', async () => {
		const transport = await roomTransport('42');
		await transport.restart(7, [{ uid: 'uid-host', name: 'Господар' }]);

		expect(writes).toEqual([
			{
				op: 'update',
				path: 'rooms/42',
				value: {
					'info/seed': 7,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					// Склад у базі — мапа за uid: правило питає «чи він у складі».
					'info/roster': { 'uid-host': { name: 'Господар', seat: 0 } },
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

	/**
	 * Склад заморожується ТИМ САМИМ записом, що й старт: двома записами існувала б
	 * мить, у яку партія йде, а складу ще немає, — і роздача бралася б із поточних
	 * `members`.
	 *
	 * Зворотний експеримент: прибрати `roster` з `update` у `setStatus` — червоніє.
	 */
	it('склад партії їде тим самим записом, що й старт', async () => {
		const transport = await roomTransport('42');
		const roster = [
			{ uid: 'uid-host', name: 'Господар' },
			{ uid: 'uid-guest', name: 'Гість' }
		];
		await transport.setStatus('playing', roster);

		expect(writes).toEqual([
			{
				op: 'update',
				path: 'rooms/42/info',
				value: {
					status: 'playing',
					startedAt: SERVER_TIME,
					countdownAt: null,
					roster: {
						'uid-host': { name: 'Господар', seat: 0 },
						'uid-guest': { name: 'Гість', seat: 1 }
					}
				}
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

describe('rtdbRoom: передача ведення й номер ходу', () => {
	beforeEach(() => {
		writes.length = 0;
		watchers.clear();
	});

	/**
	 * Правило `lead` читає `info/hostUid` ПІСЛЯ запису, тож господар і хід мусять
	 * лягти ОДНИМ записом. Двома — хід без господаря база відкинула б, а господар
	 * без ходу лишив би перепрогін без миті передачі.
	 */
	it('ведення підхоплюється одним записом: господар і хід lead разом', async () => {
		const transport = await roomTransport('42');
		await transport.takeLead({
			seq: 7,
			by: 'uid-guest',
			type: 'lead',
			payload: { from: 'uid-host' }
		});

		expect(writes).toEqual([
			{
				op: 'update',
				path: 'rooms/42',
				value: {
					'info/hostUid': 'uid-guest',
					// Вказівник для правила: господар міняється лише разом із САМЕ цим ходом.
					'info/leadSeq': '000007',
					'moves/000007': {
						seq: 7,
						by: 'uid-guest',
						type: 'lead',
						payload: { from: 'uid-host' },
						at: SERVER_TIME
					}
				}
			}
		]);
	});

	it('відмова правила — це false, а не помилка', async () => {
		update.mockRejectedValueOnce(new Error('PERMISSION_DENIED: Permission denied'));
		const transport = await roomTransport('42');
		expect(
			await transport.takeLead({
				seq: 7,
				by: 'uid-guest',
				type: 'lead',
				payload: { from: 'uid-host' }
			})
		).toBe(false);
	});

	/**
	 * Номер — З КЛЮЧА, а не з поля: поле в чужих руках може казати що завгодно, і
	 * порядок на різних пристроях розійшовся б разом із ним.
	 */
	it('номер ходу береться з ключа, а не з поля seq', async () => {
		const transport = await roomTransport('42');
		const seen: number[][] = [];
		transport.watch((snapshot) => seen.push(snapshot.moves.map((move) => move.seq)));

		watchers.get('rooms/42')?.({
			val: () => ({
				info: {
					gameId: 'quiz',
					rulesVersion: 3,
					seed: 1,
					status: 'playing',
					hostUid: 'h',
					config: {}
				},
				moves: {
					'000002': { seq: 1e20, by: 'x', type: 'goon', at: 1 },
					'000001': { seq: 5, by: 'y', type: 'goon', at: 1 }
				}
			})
		});

		expect(seen).toEqual([[1, 2]]);
	});
});

/**
 * ПІДПИСКА, ЯКУ СКАСУВАЛА БАЗА (аудит 2026-09-24). Доти вона гасла мовчки: дошка
 * стояла, а смуга «немає звʼязку» не зʼявлялася, бо звʼязок якраз був. Тепер це
 * `lost` — окремо від `closed`, бо «партію завершено» тут було б неправдою.
 *
 * Зворотний експеримент: прибрати третій аргумент `onValue` у `watch` — червоніє.
 */
describe('rtdbRoom: кімнати немає — і чому', () => {
	it('порожній знімок — закрита, скасована підписка — недоступна', async () => {
		const transport = await roomTransport('42');
		const gone = vi.fn();
		transport.watch(() => {}, gone);

		watchers.get('rooms/42')?.({ val: () => null });
		cancels.get('rooms/42')?.(new Error('permission_denied'));

		expect(gone.mock.calls).toEqual([['closed'], ['lost']]);
	});
});

/**
 * ПОВНА КІМНАТА — НАЗВАНА ПРИЧИНА (аудит 2026-09-24). Доти тринадцятого учасника
 * відкидало правило `order <= 12`, і людина чула «правила бази — різних версій».
 *
 * Зворотний експеримент: прибрати перевірку місткості в `joinRoom` — червоніє перший.
 */
describe('rtdbRoom: повна кімната', () => {
	const full = Object.fromEntries(
		Array.from({ length: ROOM_CAPACITY }, (_, index) => [
			`uid-${index}`,
			{ name: `Гравець ${index}`, role: 'player', order: index + 1 }
		])
	);

	it('новачка не пускає — з причиною «заповнена»', async () => {
		vi.mocked(get).mockResolvedValue({ val: () => full } as never);
		writes.length = 0;

		await expect(joinRoom('42', 'Новачок')).rejects.toThrow('room-full');
		expect(writes, 'рядок складу не записано').toEqual([]);
	});

	it('того, хто вже в складі, пускає — повторний вхід після перезавантаження', async () => {
		vi.mocked(get).mockResolvedValue({
			val: () => ({ ...full, 'uid-host': { name: 'Господар', role: 'player', order: 1 } })
		} as never);
		const withMe = Object.keys({ ...full, 'uid-host': {} }).length;
		expect(withMe, 'перевірка жива: кімната понад межу').toBeGreaterThan(ROOM_CAPACITY);

		await expect(joinRoom('42', 'Господар')).resolves.toBeUndefined();
	});

	it('місткість — те саме число, що межа `order` у правилі бази', () => {
		const rules = readFileSync('database.rules.json', 'utf8');
		expect(rules).toContain(`newData.val() >= 1 && newData.val() <= ${ROOM_CAPACITY}`);
	});
});
