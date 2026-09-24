import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ПРИБИРАННЯ ВЛАСНИХ КІМНАТ — що зноситься перед створенням наступної.
 *
 * Мережа підмінена на межі SDK: перевіряється рішення «зносити чи ні», а не сама
 * база (правила — справа `check:rules`).
 *
 * Головне тут — скінчена кімната. Відколи господар пише `over` сам, «зносити
 * скінчену одразу» прибирало б кімнату, з якої щойно почали іншу гру, ще до того,
 * як у неї ляже `nextCode`, — і решта не дізналася б, куди переїхали.
 *
 * Зворотний експеримент: повернути `info.status === 'over' ||` без перевірки
 * тиші — червоніє «скінчену, де ще є люди, не зносить».
 */

const NOW = 1_800_000_000_000;
const tree: Record<string, unknown> = {};
const removed: string[] = [];

vi.mock('./firebase', () => ({ connect: async () => ({ uid: 'uid-host', db: {} }) }));
vi.mock('firebase/database', () => ({
	ref: (_db: unknown, path = '') => ({ path }),
	get: async (node: { path: string }) => ({
		exists: () => tree[node.path] !== undefined,
		val: () => tree[node.path] ?? null
	}),
	remove: async (node: { path: string }) => {
		removed.push(node.path);
	}
}));

const { pruneOwnRooms } = await import('./ownRooms');

const room = (over: Record<string, unknown>) => ({
	status: 'over',
	hostUid: 'uid-host',
	createdAt: NOW - 60_000,
	...over
});

beforeEach(() => {
	for (const key of Object.keys(tree)) delete tree[key];
	removed.length = 0;
	vi.spyOn(Date, 'now').mockReturnValue(NOW);
	tree['myRooms/uid-host'] = { '1234': { at: NOW } };
});

describe('прибирання власних кімнат', () => {
	it('скінчену, де ще є люди, не зносить', async () => {
		tree['rooms/1234/info'] = room({ aliveAt: NOW - 10_000 });

		await pruneOwnRooms();

		expect(removed, 'кімнату, з якої щойно почали іншу гру, знесено').toEqual([]);
	});

	it('скінчену, у якій уже тихо, зносить разом із записом індексу', async () => {
		tree['rooms/1234/info'] = room({ aliveAt: NOW - 30 * 60_000 });

		await pruneOwnRooms();

		expect(removed).toEqual(['rooms/1234', 'myRooms/uid-host/1234']);
	});

	it('партію, що йде, не зносить', async () => {
		tree['rooms/1234/info'] = room({ status: 'playing', aliveAt: NOW - 30 * 60_000 });

		await pruneOwnRooms();

		expect(removed).toEqual([]);
	});
});
