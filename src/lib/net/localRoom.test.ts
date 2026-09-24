import { describe, expect, it } from 'vitest';
import { LocalRoom } from './localRoom';
import type { Member, RoomInfo } from './roomTypes';

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

	it('посеред партії склад не міняється, а реванш ставить новий', async () => {
		const room = new LocalRoom(info, members);
		const transport = room.transport();
		await transport.append({ seq: 1, by: GUEST, type: 'goon' });

		await expect(transport.setStatus('playing', roster)).rejects.toThrow();
		await transport.restart(2, roster);
		expect(room.moves).toHaveLength(0);
	});

	/**
	 * У лобі в журналі вже бувають ходи `lead` (ведення підхопили за відсутнього
	 * господаря). Умова — ПЕРЕХІД у `playing`, а не порожній журнал: інакше старт
	 * такої кімнати відкидався б.
	 */
	it('старт із ходом у журналі лобі — склад лягає', async () => {
		const room = new LocalRoom(lobby, members);
		const transport = room.transport();
		await transport.append({ seq: 1, by: HOST, type: 'lead', payload: { from: HOST } });

		await transport.setStatus('playing', roster);
		expect(room.status).toBe('playing');
	});
});
