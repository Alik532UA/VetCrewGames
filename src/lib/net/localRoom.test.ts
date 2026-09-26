import { describe, expect, it } from 'vitest';
import { LocalRoom } from './localRoom';
import type { Member, RoomInfo, RoomSnapshot } from './roomTypes';

/**
 * ПІДСТАВКА НЕ ЛАГІДНІША ЗА БАЗУ.
 *
 * Правила спільної партії перевіряються на `LocalRoom` — отже, чого б вона не
 * пропустила, того й тести не побачать. Аудит 2026-09-23 знайшов у ній три
 * поблажки, яких жива база не дає: хід від не-учасника, номер без меж і `lead` без
 * передачі ведення. Тут вони закріплені тими самими умовами, що в
 * `database.rules.json` (`moves/$seq`, `info/hostUid`), — і сам гейт правил
 * (`npm run check:rules`) тримає ту саму таблицю з боку бази.
 */

const HOST = 'uid-host';
const GUEST = 'uid-guest';
const WATCHER = 'uid-watcher';

const info: RoomInfo = {
	gameId: 'quiz',
	rulesVersion: 3,
	seed: 1,
	status: 'playing',
	hostUid: HOST,
	config: {},
	// Партія йде, тож склад заморожено: перехоплення ведення спирається саме на нього.
	roster: [
		{ uid: 'uid-host', name: 'Господар' },
		{ uid: 'uid-guest', name: 'Гість' }
	]
};

const members: Member[] = [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 },
	{ uid: WATCHER, name: 'Глядач', role: 'spectator', order: 3 }
];

describe('хід — як правило moves/$seq', () => {
	it('перевірка жива: учасник дописує хід', async () => {
		const room = new LocalRoom(info, members);
		expect(await room.transport().append({ seq: 1, by: GUEST, type: 'goon' })).toBe(true);
	});

	it('хід від того, кого немає в складі, не лягає', async () => {
		const room = new LocalRoom(info, members);
		expect(await room.transport().append({ seq: 1, by: 'uid-stranger', type: 'goon' })).toBe(false);
		expect(room.moves).toHaveLength(0);
	});

	it('номер поза шістьма цифрами не лягає', async () => {
		const room = new LocalRoom(info, members);
		const transport = room.transport();
		expect(await transport.append({ seq: 0, by: GUEST, type: 'goon' })).toBe(false);
		expect(await transport.append({ seq: 1_000_000, by: GUEST, type: 'goon' })).toBe(false);
		expect(await transport.append({ seq: 1.5, by: GUEST, type: 'goon' })).toBe(false);
		expect(await transport.append({ seq: 1e20, by: GUEST, type: 'goon' })).toBe(false);
	});

	it('lead звичайним ходом — лише від господаря про себе ж, тобто без передачі', async () => {
		const room = new LocalRoom(info, members);
		const transport = room.transport();
		expect(
			await transport.append({ seq: 1, by: GUEST, type: 'lead', payload: { from: HOST } }),
			'гість не забирає ведення ходом без передачі'
		).toBe(false);
	});
});

describe('передача ведення — як правило info/hostUid', () => {
	const lead = (by: string, from = HOST) => ({
		seq: 1,
		by,
		type: 'lead',
		payload: { from }
	});

	it('перевірка жива: гість на звʼязку підхоплює, коли господаря немає', async () => {
		const room = new LocalRoom(info, members);
		room.setPresent([GUEST]);
		expect(await room.transport().takeLead(lead(GUEST))).toBe(true);
		expect(room.moves.map((move) => move.type)).toEqual(['lead']);
	});

	it('поки присутність не задано, господар вважається на місці', async () => {
		const room = new LocalRoom(info, members);
		expect(await room.transport().takeLead(lead(GUEST))).toBe(false);
	});

	it('поки господар на звʼязку — ні', async () => {
		const room = new LocalRoom(info, members);
		room.setPresent([HOST, GUEST]);
		expect(await room.transport().takeLead(lead(GUEST))).toBe(false);
	});

	it('той, кого самого немає на звʼязку, — ні', async () => {
		const room = new LocalRoom(info, members);
		room.setPresent([WATCHER]);
		expect(await room.transport().takeLead(lead(GUEST))).toBe(false);
	});

	it('глядач — ні: вести партію може лише той, хто в ній грає', async () => {
		const room = new LocalRoom(info, members);
		room.setPresent([WATCHER]);
		expect(await room.transport().takeLead(lead(WATCHER))).toBe(false);
	});

	it('неправдивий from — ні', async () => {
		const room = new LocalRoom(info, members);
		room.setPresent([GUEST]);
		expect(await room.transport().takeLead(lead(GUEST, WATCHER))).toBe(false);
	});

	/**
	 * Роль `player` кожен пише собі сам, тож посеред партії саме склад відрізняє
	 * того, хто грає, від того, хто щойно назвав себе гравцем (аудит 2026-09-24).
	 */
	it('посеред партії — лише той, хто в складі', async () => {
		const late = { uid: 'uid-late', name: 'Пізній', role: 'player' as const, order: 4 };
		const room = new LocalRoom(info, [...members, late]);
		room.setPresent([late.uid]);
		expect(await room.transport().takeLead(lead(late.uid))).toBe(false);
	});

	it('у лобі — будь-який гравець кімнати', async () => {
		const room = new LocalRoom({ ...info, status: 'lobby', roster: undefined }, members);
		room.setPresent([GUEST]);
		expect(await room.transport().takeLead(lead(GUEST))).toBe(true);
	});
});

/**
 * СКЛАД ПАРТІЇ — ті самі умови, що правило `info/roster`: лише гравці кімнати з
 * їхніми іменами і лише при порожньому журналі. Підставка, добріша за базу,
 * доводила б тести партії на складі, якого в продакшні не записати.
 */
describe('склад партії — як правило info/roster', () => {
	const lobby: RoomInfo = { ...info, status: 'lobby' };
	const roster = [
		{ uid: HOST, name: 'Господар' },
		{ uid: GUEST, name: 'Гість' }
	];

	it('перевірка жива: старт заморожує склад', async () => {
		const room = new LocalRoom(lobby, members);
		await room.transport().setStatus('playing', roster);
		let seen: unknown;
		room.transport().watch((snapshot) => (seen = snapshot.info.roster))();
		expect(seen).toEqual(roster);
	});

	it('глядач у складі — відмова', async () => {
		const room = new LocalRoom(lobby, members);
		await expect(
			room.transport().setStatus('playing', [{ uid: WATCHER, name: 'Глядач' }])
		).rejects.toThrow();
		expect(room.status).toBe('lobby');
	});

	it('чуже імʼя у складі — відмова', async () => {
		const room = new LocalRoom(lobby, members);
		await expect(
			room.transport().setStatus('playing', [{ uid: GUEST, name: 'Лідер' }])
		).rejects.toThrow();
	});

	// Посеред партії старт із новим складом — це дубль старту, і база відкидає його
	// цілком (R9, A2): склад лишається той самий. Реванш — новим зерном — ставить новий.
	it('посеред партії склад не міняється (дубль старту відкинуто), а реванш ставить новий', async () => {
		const room = new LocalRoom(info, members);
		const transport = room.transport();
		await transport.append({ seq: 1, by: GUEST, type: 'goon' });

		await expect(transport.setStatus('playing', roster)).rejects.toThrow(/start/);
		await transport.restart(2, roster);
		expect(room.moves).toHaveLength(0);
	});

	/**
	 * РЕВАНШ СТИРАЄ ОГОЛОШЕНИЙ ПЕРЕЇЗД (аудит 2026-09-26): доти кнопка «перейти» у
	 * кімнату іншої гри висіла й над новою партією.
	 *
	 * Зворотний експеримент: не прибирати `nextCode` у `restart` — червоніє.
	 */
	it('реванш прибирає переїзд попередньої партії', async () => {
		const room = new LocalRoom({ ...info, status: 'over', nextCode: '77' }, members);
		const transport = room.transport();
		let next: string | undefined = '77';
		const stop = transport.watch((snapshot) => (next = snapshot.info.nextCode));

		await transport.restart(2, roster);

		expect(next).toBeUndefined();
		stop();
	});

	/**
	 * У лобі в журналі бувають ходи `lead` (ведення підхопили за відсутнього господаря),
	 * а старт СТИРАЄ журнал лобі тим самим записом (A2): склад лягає, журнал порожній.
	 */
	it('старт із ходом у журналі лобі — склад лягає, а журнал стерто', async () => {
		const room = new LocalRoom(lobby, members);
		const transport = room.transport();
		const laid = await transport.append({
			seq: 1,
			by: HOST,
			type: 'lead',
			payload: { from: HOST }
		});
		expect(laid, 'хід lead у лобі — законний').toBe(true);
		expect(room.moves).toHaveLength(1);

		await transport.setStatus('playing', roster);
		expect(room.status).toBe('playing');
		expect(room.moves).toHaveLength(0);
	});
});

/**
 * ОСОБА ТРАНСПОРТУ — ЯК `auth.uid` У ПРАВИЛАХ (аудит 2026-09-26). Доти підставка не
 * знала, хто за нею сидить, і гість на ній міняв налаштування, починав партію й
 * писав хід під чужим іменем — чого база не дає. Без `as` особа не перевіряється,
 * як у всіх тестах до появи поля.
 *
 * Зворотні експерименти: прибрати перевірку особи в ходах — червоніє перший; у
 * записах господаря — другий; у прибиранні рядка — третій.
 */
describe('особа транспорту — як auth.uid у правилах', () => {
	const lobbyRoom = (): RoomInfo => ({ ...info, status: 'lobby', roster: undefined });

	it('хід під чужим іменем не лягає, під своїм — лягає', async () => {
		// Посеред партії: у лобі ходу гри не буває зовсім (A2 — див. нижче).
		const room = new LocalRoom(info, members);
		const guest = room.transport({ as: GUEST });
		expect(await guest.append({ seq: 1, by: HOST, type: 'goon' })).toBe(false);
		expect(await guest.append({ seq: 1, by: GUEST, type: 'goon' })).toBe(true);
	});

	it('записи господаря — лише господареві', async () => {
		const room = new LocalRoom(lobbyRoom(), members);
		const guest = room.transport({ as: GUEST });
		const host = room.transport({ as: HOST });

		await expect(guest.setConfig({ pairs: 6 })).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(guest.setAutoStart(true)).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(guest.setCountdown(true)).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(guest.setStatus('over')).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(guest.restart(2, [])).rejects.toThrow(/PERMISSION_DENIED/);
		await host.setConfig({ pairs: 6 });
		expect(room.status, 'перевірка жива: господар пише').toBe('lobby');
	});

	it('свій рядок прибирає будь-хто, чужий — лише господар', async () => {
		const room = new LocalRoom(lobbyRoom(), members);
		const guest = room.transport({ as: GUEST });
		await expect(guest.removeMember(HOST)).rejects.toThrow(/PERMISSION_DENIED/);
		await guest.removeMember(GUEST);
		await room.transport({ as: HOST }).removeMember(WATCHER);
		const seen: string[][] = [];
		room.transport().watch((snapshot) => seen.push(snapshot.members.map((member) => member.uid)));
		expect(seen.at(-1)).toEqual([HOST]);
	});

	it('позначку життя пише лише учасник', async () => {
		const room = new LocalRoom(lobbyRoom(), members);
		await expect(room.transport({ as: 'uid-stranger' }).touch()).rejects.toThrow(
			/PERMISSION_DENIED/
		);
		await room.transport({ as: GUEST }).touch();
	});
});

/**
 * ЖУРНАЛ ПОЗА ПАРТІЄЮ Й СТАРТ (аудит 2026-09-26, A2) — дзеркало правил `moves`, `status`,
 * `seed`, `config`: у лобі й після партії журнал приймає лише `lead`; старт стирає журнал
 * лобі тим самим записом; дубль старту й реванш без нового зерна не стирають партію; після
 * партії налаштування міняються лише разом зі стертим журналом.
 *
 * Зворотні експерименти: прибрати перевірку статусу з `moveAllowed` — червоніє «лобі»;
 * не стирати журнал на старті — червоніє «старт»; прибрати `wipeAllowed` — червоніє
 * «дубль»; прибрати `configAllowed` — червоніє «після партії».
 */
describe('журнал поза партією й старт (A2)', () => {
	const room = (status: RoomInfo['status']) =>
		new LocalRoom(
			{ ...info, status, roster: status === 'playing' ? info.roster : undefined },
			members
		);
	const goon = (seq: number) => ({ seq, by: GUEST, type: 'goon' });

	it('у лобі й після партії хід гри не лягає', async () => {
		for (const status of ['lobby', 'over'] as const) {
			const guest = room(status).transport({ as: GUEST });
			expect(await guest.append(goon(1)), status).toBe(false);
		}
	});

	it('старт стирає журнал лобі тим самим записом', async () => {
		const lobby = room('lobby');
		lobby.setPresent([GUEST]);
		const lead = { seq: 1, by: GUEST, type: 'lead', payload: { from: HOST } };
		expect(await lobby.transport({ as: GUEST }).takeLead(lead), 'ведення в лобі — законне').toBe(
			true
		);
		const guest = lobby.transport({ as: GUEST });
		await guest.setStatus('playing', info.roster);

		// Перший знімок підписка дає одразу — підписатися й одразу відписатися.
		const snapshot = await new Promise<RoomSnapshot>((resolve) => guest.watch(resolve)());
		expect(snapshot.info.status).toBe('playing');
		expect(snapshot.moves).toEqual([]);
	});

	it('дубль старту й реванш без нового зерна партію не стирають', async () => {
		const playing = room('playing');
		const host = playing.transport({ as: HOST });
		expect(await playing.transport({ as: GUEST }).append(goon(1))).toBe(true);

		await expect(host.setStatus('playing', info.roster)).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(host.restart(info.seed, info.roster ?? [])).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(host.restart(info.seed + 1, info.roster ?? [])).resolves.toBeUndefined();
	});

	it('після партії налаштування — лише разом зі стертим журналом', async () => {
		const played = room('playing');
		expect(await played.transport({ as: GUEST }).append(goon(1))).toBe(true);
		const host = played.transport({ as: HOST });
		await host.setStatus('over');

		await expect(host.setConfig({ pairs: 6 })).rejects.toThrow(/PERMISSION_DENIED/);
		await expect(
			room('lobby').transport({ as: HOST }).setConfig({ pairs: 6 })
		).resolves.toBeUndefined();
	});
});

/**
 * ВЕДЕННЯ — ЛИШЕ УЧАСНИК КІМНАТИ (шостий аудит, дзеркало правил). Хід `lead` — такий
 * самий хід журналу, і база вимагає рядка в складі (`moves/$seq`). Доти дзеркало пускало
 * гравця ЗАМОРОЖЕНОГО складу, чий рядок уже прибрано, — тобто було мʼякшим за базу.
 *
 * Зворотний експеримент: прибрати перевірку `author` у `leadAllowed` — червоніє.
 */
describe('ведення без рядка в складі', () => {
	it('гравець складу, чий рядок прибрано, ведення не бере', async () => {
		const room = new LocalRoom(info, members);
		room.setMembers(members.filter((member) => member.uid !== GUEST));
		room.setPresent([GUEST]);
		const lead = { seq: 1, by: GUEST, type: 'lead', payload: { from: HOST } };

		expect(await room.transport({ as: GUEST }).takeLead(lead)).toBe(false);
	});
});
