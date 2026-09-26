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
});
