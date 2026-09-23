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
	config: {}
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
});
