import { describe, expect, it } from 'vitest';
import { envelopeOf } from './roomEnvelope';
import type { RoomSnapshot } from '$lib/net/roomTypes';

/**
 * СПІЛЬНІ ПОЛЯ КІМНАТИ — одним розкладом на обидві гри (аудит 2026-09-25).
 *
 * Відсутнє поле — значення «за замовчуванням», а не `undefined`: матч тримає
 * `null` і `false`, і сторінка звіряє саме їх.
 */
const snapshot = (info: Partial<RoomSnapshot['info']>): RoomSnapshot => ({
	info: {
		gameId: 'pairs',
		rulesVersion: 4,
		seed: 1,
		status: 'lobby',
		hostUid: 'uid-host',
		config: {},
		...info
	},
	members: [],
	moves: []
});

describe('спільні поля кімнати', () => {
	it('відсутні поля — `null` і `false`, а не `undefined`', () => {
		expect(envelopeOf(snapshot({}))).toEqual({
			members: [],
			avatarSwaps: {},
			roster: null,
			status: 'lobby',
			hostUid: 'uid-host',
			countdownAt: null,
			autoStart: false,
			listed: false,
			nextCode: null,
			createdAt: null
		});
	});

	it('присутні — як є', () => {
		const envelope = envelopeOf(
			snapshot({
				countdownAt: 5,
				autoStart: true,
				listed: true,
				nextCode: '42',
				status: 'over',
				createdAt: 7
			})
		);
		expect(envelope).toMatchObject({
			countdownAt: 5,
			autoStart: true,
			listed: true,
			nextCode: '42',
			status: 'over',
			createdAt: 7
		});
	});
	/**
	 * Повтор аватарки розвʼязує КОНВЕРТ — одне місце на обидві гри: інакше лобі,
	 * табло й дошка кожен розвʼязували б його по-своєму, або не розвʼязували зовсім.
	 * Зворотний експеримент: віддати `snapshot.members` як є — червоніє цей випадок.
	 */
	it('повтор аватарки в складі розвʼязано: перший лишає, другого замінено', () => {
		const envelope = envelopeOf({
			...snapshot({ createdAt: 7 }),
			members: [
				{ uid: 'uid-host', name: 'Господар', role: 'player', order: 1, avatar: 'cat:blue' },
				{ uid: 'uid-guest', name: 'Гість', role: 'player', order: 2, avatar: 'cat:blue' }
			]
		});

		expect(envelope.members[0].avatar).toBe('cat:blue');
		expect(envelope.members[1].avatar).not.toBe('cat:blue');
		expect(envelope.avatarSwaps).toEqual({ 'uid-guest': envelope.members[1].avatar });
	});
});
