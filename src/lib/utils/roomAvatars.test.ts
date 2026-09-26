// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, isCustomAvatar } from '$lib/config/avatars';
import type { Member } from '$lib/net/roomTypes';
import { ROOM_AVATARS, takenAvatars, uniqueAvatars } from './roomAvatars';

/**
 * ОДНА ПАРА «ЗНАЧОК + КОЛІР» НА КІМНАТУ (рішення автора 2026-09-26): перший лишає
 * свою, новачок отримує вільну — однакову в усіх учасників.
 *
 * Зворотний експеримент: власник за порядком масиву, а не за `order`, — червоніє
 * «перший за входом»; заміна з `Math.random` — червоніє «однаково в усіх»; заміна
 * без виключення зайнятих — червоніє «вільна».
 */

const member = (uid: string, order: number, avatar?: string): Member => ({
	uid,
	name: `імʼя ${uid}`,
	role: 'player',
	order,
	...(avatar ? { avatar } : {})
});

describe('аватарки в складі кімнати', () => {
	it('повторів немає — склад той самий масив, замін нуль', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'dog:red')];
		const out = uniqueAvatars(members, 7);

		expect(out.members).toBe(members);
		expect(out.swaps).toEqual({});
	});

	it('пару лишає перший за входом — навіть коли база віддала його другим', () => {
		// База віддає склад за ключами (алфавіт uid), а не за входом.
		const members = [member('z-newcomer', 2, 'cat:blue'), member('a-host', 1, 'cat:blue')];
		const out = uniqueAvatars(members, 7);

		expect(out.members.find((m) => m.uid === 'a-host')?.avatar).toBe('cat:blue');
		expect(Object.keys(out.swaps)).toEqual(['z-newcomer']);
	});

	it('заміна — вільна: не типова й не чиясь', () => {
		const members = [
			member('a', 1, 'cat:blue'),
			member('b', 2, 'dog:red'),
			member('c', 3, 'cat:blue'),
			member('d', 4, 'cat:blue')
		];
		const { members: shown, swaps } = uniqueAvatars(members, 7);
		const avatars = shown.map((m) => m.avatar);

		expect(new Set(avatars).size, `повтор: ${avatars.join(', ')}`).toBe(avatars.length);
		for (const swap of Object.values(swaps)) {
			expect(isCustomAvatar(swap), swap).toBe(true);
			expect(swap).not.toBe(DEFAULT_AVATAR);
		}
		expect(Object.keys(swaps).sort()).toEqual(['c', 'd']);
	});

	it('однаково в усіх: той самий склад у будь-якому порядку — ті самі заміни', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'cat:blue'), member('c', 3)];
		const one = uniqueAvatars(members, 7).swaps;
		const other = uniqueAvatars([...members].reverse(), 7).swaps;

		expect(other).toEqual(one);
	});

	it('сіль кімнати міняє заміну: та сама людина в іншій кімнаті — інша плитка', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'cat:blue')];
		const salts = [1, 2, 3, 4, 5, 6, 7, 8].map((salt) => uniqueAvatars(members, salt).swaps.b);

		expect(new Set(salts).size, salts.join(', ')).toBeGreaterThan(1);
	});

	it('записана заміна стала власною — повторів більше немає', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'cat:blue')];
		const swap = uniqueAvatars(members, 7).swaps.b;
		const healed = [member('a', 1, 'cat:blue'), member('b', 2, swap)];

		expect(uniqueAvatars(healed, 7).swaps).toEqual({});
	});

	it('типова плитка й «не вибирав» не зайняті ні в кого', () => {
		const members = [
			member('a', 1, DEFAULT_AVATAR),
			member('b', 2, DEFAULT_AVATAR),
			member('c', 3)
		];

		expect(uniqueAvatars(members, 7).swaps).toEqual({});
		expect(takenAvatars(members, 'a').size).toBe(0);
	});

	it('зайняте для вибору — чуже, з іменем власника; своє не зайняте', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'dog:red')];
		const taken = takenAvatars(members, 'a');

		expect([...taken]).toEqual([['dog:red', 'імʼя b']]);
	});

	it('пар вистачає з запасом: 111 проти 12 місць кімнати', () => {
		expect(ROOM_AVATARS).toHaveLength(111);
		expect(ROOM_AVATARS).not.toContain(DEFAULT_AVATAR);
	});
});
