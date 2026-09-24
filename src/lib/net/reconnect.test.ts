import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ПІСЛЯ ОБРИВУ ЗВʼЯЗКУ — ТЕ САМЕ, ЩО ДО НЬОГО.
 *
 * `onDisconnect` виконується один раз: обірвався сокет — сервер прибрав запис, і
 * домовленості більше немає. Доти і присутність, і запис кімнати в переліку
 * ставилися РАЗ на вхід, тож після першого ж обриву людина лишалася «відсутньою»
 * до перезавантаження, а кімната мовчки зникала зі списку (аудит 2026-09-23).
 * Потім — раз на вхід і на кожне ПОВТОРНЕ «на звʼязку», і цього було мало: обрив
 * посеред першого запису лишав вузол без домовленості, а вузол, спільний для двох
 * вкладок, зникав разом із першою закритою (аудит 2026-09-24, `keepNode`).
 *
 * Тут SDK підмінено на межі модуля, а `.info/connected` тест обриває й повертає
 * сам — рівно так, як це робить Firebase.
 *
 * Зворотні експерименти: не збільшувати номер зʼєднання — червоніють «після
 * кожного обриву» й «обрив посеред першого запису»; не слухати свій вузол —
 * «вузол зник»; не памʼятати відмову — «відмова бази без кола»; не перевіряти
 * вихід між домовленістю й записом — «вихід посеред запису».
 */

const SERVER_TIME = { '.sv': 'timestamp' };

interface Op {
	op: 'set' | 'remove' | 'onDisconnect.remove';
	path: string;
	value?: unknown;
}
const ops: Op[] = [];
type Snapshot = { val: () => unknown; exists: () => boolean };
const listeners = new Map<string, (snapshot: Snapshot) => void>();

/** Запис, що «висить»: база ще не відповіла. */
let hang: Promise<void> | null = null;
/** Домовленість про прибирання, що «висить». */
let hangDisconnect: Promise<void> | null = null;
/** Скільки наступних записів база відкине. */
let refusals = 0;

const ref = (_db: unknown, path = '') => ({ path });

vi.mock('./firebase', () => ({ connect: async () => ({ uid: 'uid-host', db: {} }) }));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('firebase/database', () => ({
	ref,
	set: vi.fn(async (node: { path: string }, value: unknown) => {
		ops.push({ op: 'set', path: node.path, value });
		if (hang) await hang;
		if (refusals > 0) {
			refusals -= 1;
			throw new Error('PERMISSION_DENIED: Permission denied');
		}
	}),
	remove: vi.fn(async (node: { path: string }) => {
		ops.push({ op: 'remove', path: node.path });
	}),
	onDisconnect: (node: { path: string }) => ({
		remove: async () => {
			ops.push({ op: 'onDisconnect.remove', path: node.path });
			if (hangDisconnect) await hangDisconnect;
		}
	}),
	onValue: (node: { path: string }, handler: (snapshot: Snapshot) => void) => {
		listeners.set(node.path, handler);
		return handler;
	},
	off: vi.fn((node: { path: string }) => listeners.delete(node.path)),
	serverTimestamp: () => SERVER_TIME
}));

const { logService } = await import('$lib/services/logService.svelte');
const { trackPresence, watchConnected } = await import('./presence');
const { publishRoom, updatePlayers } = await import('./lobby');

const MINE = 'presence/42/uid-host';

/** Firebase повідомляє про стан звʼязку. */
const connection = (online: boolean) =>
	listeners.get('.info/connected')?.({ val: () => online, exists: () => true });

/** Вузол зник на сервері: друга вкладка закрилась, і її `onDisconnect` прибрав спільний. */
const vanish = (path: string) => listeners.get(path)?.({ val: () => null, exists: () => false });

/** Дочекатися запису, запущеного з обробника: у ньому кілька `await`. */
const flush = async () => {
	for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
};

/** Дочекатися, поки підписка на стан звʼязку встане, і сказати «на звʼязку». */
const goOnline = async () => {
	await vi.waitFor(() => expect(listeners.has('.info/connected')).toBe(true));
	connection(true);
	await flush();
};

const registration = (path: string, value: unknown = { at: SERVER_TIME }) => [
	{ op: 'onDisconnect.remove', path },
	{ op: 'set', path, value }
];

beforeEach(() => {
	ops.length = 0;
	listeners.clear();
	hang = null;
	hangDisconnect = null;
	refusals = 0;
	vi.clearAllMocks();
});

describe('присутність після обриву', () => {
	it('перевірка жива: на звʼязку — домовляється про прибирання, а тоді записується', async () => {
		await trackPresence('42');
		await goOnline();
		expect(ops).toEqual(registration(MINE));
	});

	it('до першого «на звʼязку» не пише нічого: домовлятися нема з ким', async () => {
		await trackPresence('42');
		await flush();
		expect(ops).toEqual([]);
	});

	it('присутність відновлюється після кожного обриву — у тому самому порядку', async () => {
		await trackPresence('42');
		await goOnline();
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops).toEqual(registration(MINE));
	});

	/**
	 * ПРИВИД. Домовленість лягла, запис ще їде — і тут обрив: сервер виконав
	 * домовленість (прибрати ще нічого), а запис доїде вже в новому зʼєднанні, без
	 * жодної домовленості. Такий вузол не зникне ніколи.
	 */
	it('обрив посеред першого запису — у новому зʼєднанні все знову', async () => {
		let release!: () => void;
		hang = new Promise<void>((resolve) => (release = resolve));
		await trackPresence('42');
		await goOnline();

		connection(false);
		connection(true);
		await flush();
		hang = null;
		release();
		await flush();

		expect(ops).toEqual([...registration(MINE), ...registration(MINE)]);
	});

	it('вузол зник, а я на звʼязку — ставлю знову', async () => {
		await trackPresence('42');
		await goOnline();
		ops.length = 0;

		vanish(MINE);
		await flush();

		expect(ops).toEqual(registration(MINE));
	});

	/**
	 * SDK показує свій запис одразу й відкочує, коли база відмовила, — а відкат це
	 * «вузол зник». Без памʼяті про відмову це було б коло з частотою мережі.
	 */
	it('відмова бази — без кола: до наступного зʼєднання тиша', async () => {
		refusals = 1;
		await trackPresence('42');
		await goOnline();
		expect(logService.warn).toHaveBeenCalledWith(
			'network',
			'presence not registered',
			expect.objectContaining({ code: '42' })
		);
		ops.length = 0;

		vanish(MINE);
		await flush();
		expect(ops, 'відкат відмови не мусить запускати запис знову').toEqual([]);

		connection(false);
		connection(true);
		await flush();
		expect(ops, 'нове зʼєднання — нова спроба').toEqual(registration(MINE));
	});

	it('вихід посеред запису — вузол після виходу не зʼявляється', async () => {
		let release!: () => void;
		hangDisconnect = new Promise<void>((resolve) => (release = resolve));
		const stop = await trackPresence('42');
		await goOnline();

		stop();
		hangDisconnect = null;
		release();
		await flush();

		const left = ops.findLastIndex((op) => op.op === 'remove');
		expect(left, 'перевірка жива: вихід прибрав вузол').toBeGreaterThan(-1);
		expect(ops.slice(left + 1), 'запис ліг ПІСЛЯ виходу').toEqual([]);
	});

	it('після виходу з кімнати обрив нічого не відновлює', async () => {
		const stop = await trackPresence('42');
		await goOnline();
		stop();
		ops.length = 0;

		connection(false);
		connection(true);
		vanish(MINE);
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
	const entry = {
		code: '42',
		hostUid: 'uid-host',
		hostName: 'Господар',
		gameId: 'quiz',
		rulesVersion: 3,
		players: 1
	};

	it('запис відновлюється — з ОСТАННІМ числом гравців, а не з першим', async () => {
		const published = publishRoom(entry);
		await goOnline();
		await published;
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
		const published = publishRoom(entry);
		await goOnline();
		const unlist = await published;
		unlist();
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops.filter((op) => op.op === 'set')).toEqual([]);
	});

	it('перший запис відхилено — кидає, і далі кімнату в перелік не пише', async () => {
		refusals = 1;
		const published = publishRoom(entry);
		await goOnline();
		await expect(published).rejects.toThrow('PERMISSION_DENIED');
		ops.length = 0;

		connection(false);
		connection(true);
		await flush();

		expect(ops.filter((op) => op.op === 'set')).toEqual([]);
	});
});
