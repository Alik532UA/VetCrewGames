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
type Listener = (snapshot: Snapshot) => void;
/** Підписки за шляхом — кілька на шлях, як у SDK: `.info/connected` слухають усі. */
const listeners = new Map<string, Set<Listener>>();
/** Подати знімок усім підпискам шляху — так, як це робить SDK. */
const emit = (path: string, snapshot: Snapshot) => {
	for (const listener of [...(listeners.get(path) ?? [])]) listener(snapshot);
};
/** Скільки підписок на шляху досі живі. */
const live = (path: string) => listeners.get(path)?.size ?? 0;

/** Запис, що «висить»: база ще не відповіла. */
let hang: Promise<void> | null = null;
/** Домовленість про прибирання, що «висить». */
let hangDisconnect: Promise<void> | null = null;
/** Скільки наступних записів база відкине. */
let refusals = 0;

const ref = (_db: unknown, path = '') => ({ path });

vi.mock('./firebase', () => ({
	connect: async () => ({ uid: 'uid-host', db: {} }),
	serverNow: () => Date.now()
}));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('firebase/database', () => ({
	ref,
	child: (node: { path: string }, path: string) => ({ path: `${node.path}/${path}` }),
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
	/*
	 * ВІДПИСКА — ТЕ, ЩО ПОВЕРНУВ `onValue`, і знімає вона САМЕ цю підписку (аудит
	 * 2026-09-26). Доти підставка повертала сам обробник, а `off` знімав усе за
	 * шляхом, — і продакшн-код `off(ref, 'value', відписка)`, який у справжньому
	 * SDK не знімав нічого, тут виглядав робочим. `off` — як у SDK: лише за тим
	 * самим колбеком.
	 */
	onValue: (node: { path: string }, handler: Listener) => {
		const set = listeners.get(node.path) ?? new Set<Listener>();
		set.add(handler);
		listeners.set(node.path, set);
		return () => void listeners.get(node.path)?.delete(handler);
	},
	off: (node: { path: string }, _type: string, callback: Listener) =>
		void listeners.get(node.path)?.delete(callback),
	serverTimestamp: () => SERVER_TIME
}));

const { logService } = await import('$lib/services/logService.svelte');
const { trackPresence, watchConnected } = await import('./presence');
const { publishRoom, updatePlayers } = await import('./lobby');
const { ROOM_BEAT_MS } = await import('$lib/config/roomLife');

const MINE = 'presence/42/uid-host';

/** Firebase повідомляє про стан звʼязку. */
const connection = (online: boolean) =>
	emit('.info/connected', { val: () => online, exists: () => true });

/** Вузол зник на сервері: друга вкладка закрилась, і її `onDisconnect` прибрав спільний. */
const vanish = (path: string) => emit(path, { val: () => null, exists: () => false });

/** Дочекатися запису, запущеного з обробника: у ньому кілька `await`. */
const flush = async () => {
	for (let tick = 0; tick < 10; tick += 1) await Promise.resolve();
};

/** Дочекатися, поки підписка на стан звʼязку встане, і сказати «на звʼязку». */
const goOnline = async () => {
	await vi.waitFor(() => expect(live('.info/connected')).toBeGreaterThan(0));
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

	/**
	 * СВІЖИЙ `at` ЗА РОЗКЛАДОМ (аудит 2026-09-25): доти він писався раз на зʼєднання,
	 * і прибиральник стирав живу присутність того, хто довго сидить на звʼязку.
	 * Лише поле — інакше зникала б підсвітка наведення; лише живого вузла — інакше
	 * частковий запис лишився б без домовленості про прибирання.
	 *
	 * Зворотні експерименти: не ставити розкладу — червоніє перший; писати й без
	 * вузла — другий.
	 */
	it('живий вузол оновлює лише свій `at` тим самим ритмом, що й серцебиття', async () => {
		vi.useFakeTimers();
		try {
			const stop = await trackPresence('42');
			await goOnline();
			emit(MINE, { val: () => ({ at: 1 }), exists: () => true });
			ops.length = 0;

			await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);

			expect(ops).toEqual([{ op: 'set', path: `${MINE}/at`, value: SERVER_TIME }]);
			stop();
			expect(vi.getTimerCount(), 'розклад знято разом із присутністю').toBe(0);
		} finally {
			vi.useRealTimers();
		}
	});

	it('вузла немає — поле окремо не пишеться: без домовленості воно стало б привидом', async () => {
		vi.useFakeTimers();
		try {
			const stop = await trackPresence('42');
			await goOnline();
			hang = new Promise(() => {}); // повторна реєстрація «висить»: вузла ще немає
			vanish(MINE);
			await flush();
			ops.length = 0;

			await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);

			expect(ops.filter((op) => op.path === `${MINE}/at`)).toEqual([]);
			stop();
		} finally {
			hang = null;
			vi.useRealTimers();
		}
	});

	it('стан звʼязку доходить до екрана', async () => {
		const seen: boolean[] = [];
		await watchConnected((online) => seen.push(online));
		connection(true);
		connection(false);
		expect(seen).toEqual([true, false]);
	});

	/**
	 * ПІСЛЯ ВИХОДУ НЕ ЛИШАЄТЬСЯ ЖОДНОЇ ПІДПИСКИ (аудит 2026-09-26). Доти `stop()`
	 * кликав `off` із тим, що повернув `onValue`, і не знімав нічого: кожен вхід у
	 * кімнату додавав слухача стану звʼязку й свого вузла, і жоден не зникав.
	 *
	 * Зворотний експеримент: повернути `off(status, 'value', onStatus)` у `keepNode`
	 * — червоніє перший; `off(status, 'value', handler)` у `watchConnected` — другий.
	 */
	it('вихід знімає обидві підписки присутності', async () => {
		const stop = await trackPresence('42');
		await goOnline();
		expect(live('.info/connected'), 'перевірка жива: підписки стоять').toBe(1);
		expect(live(MINE), 'перевірка жива: свій вузол слухається').toBe(1);

		stop();

		expect(live('.info/connected'), 'стан звʼязку досі слухається').toBe(0);
		expect(live(MINE), 'свій вузол досі слухається').toBe(0);
	});

	it('відписка від стану звʼязку знімає саме її', async () => {
		const seen: boolean[] = [];
		const stop = await watchConnected((online) => seen.push(online));
		stop();
		connection(true);
		expect(seen, 'після відписки подія дійшла').toEqual([]);
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

	/**
	 * ЗАПИС ПЕРЕЛІКУ ПЕРЕПИСУЄТЬСЯ ЗА РОЗКЛАДОМ (аудит 2026-09-25): домовленість
	 * старого сокета сервер виконує, коли помітить його смерть, — бува, вже після
	 * того, як нове зʼєднання запис поставило. Читати свій запис правило не дає, тож
	 * почути зникнення нічим, і без розкладу кімната зникала зі списку мовчки.
	 *
	 * Зворотний експеримент: не передати `refreshMs` із `publishRoom` — червоніє.
	 */
	it('запис переліку переписується тим самим ритмом, що й серцебиття кімнати', async () => {
		vi.useFakeTimers();
		try {
			const published = publishRoom(entry);
			await goOnline();
			const unlist = await published;
			ops.length = 0;

			await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);
			await flush();

			expect(ops.filter((op) => op.op === 'set').map((op) => op.path)).toEqual(['lobby/quiz/42']);
			unlist();
			expect(vi.getTimerCount(), 'розклад знято разом із записом').toBe(0);
			ops.length = 0;
			await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);
			expect(
				ops.filter((op) => op.op === 'set'),
				'знятий — не переписується'
			).toEqual([]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('знятий із переліку запис після обриву не повертається', async () => {
		const published = publishRoom(entry);
		await goOnline();
		const unlist = await published;
		unlist();
		expect(live('.info/connected'), 'зняття лишило підписку на стан звʼязку').toBe(0);
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
