import { describe, expect, it, vi } from 'vitest';
import type { LobbyRoom } from './lobby';

/**
 * ПОРЯДОК ПЕРЕЛІКУ КІМНАТ — ЗА МИТТЮ СТВОРЕННЯ (аудит 2026-09-26).
 *
 * `at` запису переписується щоудару серцебиття, і список, упорядкований за ним,
 * переставлявся щопівхвилини: кімната, чий запис щойно оновився, стрибала вгору.
 * Тепер найновіші — за `since` (мить створення кімнати), а записи без неї —
 * за останнім оновленням. SDK підмінено на межі модуля.
 *
 * Зворотний експеримент: сортувати за `at` — червоніє.
 */
type Snapshot = { val: () => unknown };
let deliver: ((snapshot: Snapshot) => void) | null = null;

vi.mock('./firebase', () => ({ connect: async () => ({ uid: 'uid-me', db: {} }) }));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));
vi.mock('firebase/database', () => ({
	ref: (_db: unknown, path: string) => ({ path }),
	query: (node: unknown) => node,
	orderByChild: () => ({}),
	limitToLast: () => ({}),
	onValue: (_node: unknown, onSnapshot: (snapshot: Snapshot) => void) => {
		deliver = onSnapshot;
		return () => (deliver = null);
	}
}));

const { watchLobby } = await import('./lobby');

const entry = (over: Partial<LobbyRoom>): Omit<LobbyRoom, 'code'> => ({
	hostUid: 'h',
	hostName: 'Господар',
	gameId: 'quiz',
	rulesVersion: 5,
	players: 1,
	at: 0,
	...over
});

describe('перелік кімнат', () => {
	it('найновіші — за миттю створення, а не за останнім оновленням запису', async () => {
		let shown: string[] = [];
		const stop = await watchLobby('quiz', {
			onRooms: (rooms) => (shown = rooms.map((room) => room.code)),
			onUnavailable: () => {}
		});

		deliver?.({
			val: () => ({
				// Створена давно, але запис оновився щойно.
				'11': entry({ since: 100, at: 900 }),
				// Створена пізніше, запис оновився раніше.
				'22': entry({ since: 500, at: 600 }),
				// Запис старшої збірки: без мітки створення — за оновленням.
				'33': entry({ at: 300 })
			})
		});

		expect(shown).toEqual(['22', '33', '11']);
		stop();
	});
});
