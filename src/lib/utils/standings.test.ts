// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { placesOf, rankedBy } from './standings';
import type { Member } from '$lib/net/roomTypes';

/**
 * РІВНІ БАЛИ ДІЛЯТЬ МІСЦЕ (прохання автора 2026-09-26): 1, 1, 3.
 *
 * Доти місцем був номер рядка, і двоє з 277 очками стояли першим і другим.
 *
 * Зворотний експеримент: рахувати місце як номер у відсортованому складі —
 * червоніють «рівні ділять» і «наступний іде через них».
 */

const member = (uid: string, order: number): Member =>
	({ uid, name: uid, role: 'player', order }) as Member;

const score = (points: Record<string, number>) => (uid: string) => points[uid] ?? 0;

describe('місця за рахунком', () => {
	it('рівні бали ділять одне місце', () => {
		const players = [member('a', 1), member('b', 2)];
		expect(placesOf(players, score({ a: 277, b: 277 }))).toEqual({ a: 1, b: 1 });
	});

	it('наступний іде через них: 1, 1, 3', () => {
		const players = [member('a', 1), member('b', 2), member('c', 3)];
		expect(placesOf(players, score({ a: 300, b: 300, c: 120 }))).toEqual({ a: 1, b: 1, c: 3 });
	});

	it('нічия посередині: 1, 2, 2, 4', () => {
		const players = [member('a', 1), member('b', 2), member('c', 3), member('d', 4)];
		expect(placesOf(players, score({ a: 90, b: 50, c: 50, d: 10 }))).toEqual({
			a: 1,
			b: 2,
			c: 2,
			d: 4
		});
	});

	it('місце не залежить від порядку входу', () => {
		const early = [member('a', 1), member('b', 2), member('c', 3)];
		const late = [member('c', 1), member('b', 2), member('a', 3)];
		const points = score({ a: 10, b: 30, c: 30 });
		expect(placesOf(late, points)).toEqual(placesOf(early, points));
	});

	it('гравець без запису в рахунку — з нулем, а не поза таблицею', () => {
		const players = [member('a', 1), member('b', 2)];
		expect(placesOf(players, score({ a: 5 }))).toEqual({ a: 1, b: 2 });
	});
});

describe('порядок рядків', () => {
	it('більший рахунок вище, рівних розводить порядок входу', () => {
		const players = [member('x', 3), member('y', 1), member('z', 2)];
		expect(rankedBy(players, score({ x: 7, y: 7, z: 9 })).map((p) => p.uid)).toEqual([
			'z',
			'y',
			'x'
		]);
	});

	it('склад не мутує', () => {
		const players = [member('a', 2), member('b', 1)];
		rankedBy(players, score({ a: 1, b: 2 }));
		expect(players.map((p) => p.uid)).toEqual(['a', 'b']);
	});
});
