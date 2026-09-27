// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { hasAvatar, normaliseAvatar } from '$lib/config/avatars';
import type { Member } from '$lib/net/roomTypes';
import { ROOM_AVATARS, takenAvatars, uniqueAvatars } from './roomAvatars';

/**
 * У КІМНАТІ НЕ ПОВТОРЮЄТЬСЯ НІ ЗНАЧОК, НІ КОЛІР (рішення автора 2026-09-26 і 2026-09-27):
 * акаунт лишає свою завжди, далі перший за входом, новачок отримує вільну — однакову в
 * усіх учасників; лише в лобі.
 *
 * Зворотні експерименти: власник за порядком масиву, а не за `order`, — червоніє
 * «перший за входом»; заміна з `Math.random` — червоніє «однаково в усіх»; заміна
 * без виключення зайнятих — червоніє «вільна»; порівнювати лише пари — червоніє «той
 * самий колір»; не пропускати акаунти — червоніє «акаунт лишає свою»; не зважати на
 * `frozen` — червоніє «посеред партії».
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

	it('заміна — вільна: не порожня й не чиясь', () => {
		const members = [
			member('a', 1, 'cat:blue'),
			member('b', 2, 'dog:red'),
			member('c', 3, 'cat:blue'),
			member('d', 4, 'cat:blue')
		];
		const { members: shown, swaps } = uniqueAvatars(members, 7);
		const avatars = shown.map((m) => m.avatar);

		expect(new Set(avatars).size, `повтор: ${avatars.join(', ')}`).toBe(avatars.length);
		for (const swap of Object.values(swaps)) expect(hasAvatar(swap), swap).toBe(true);
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

	it('рядок без аватарки чи з зіпсованою не займає нічого', () => {
		const members = [member('a', 1), member('b', 2, 'dragon:gold'), member('c', 3)];

		expect(uniqueAvatars(members, 7).swaps).toEqual({});
		expect(takenAvatars(members, 'a').size).toBe(0);
	});

	/**
	 * Значок, якого більше немає (`star:red` зі старшої збірки), показується твариною того
	 * самого кольору — і дві такі плитки в складі теж повтор (рішення автора 13-A).
	 */
	it('старий значок порівнюється тим, що показують', () => {
		const shown = normaliseAvatar('star:red');
		const members = [member('a', 1, 'star:red'), member('b', 2, shown)];

		expect(Object.keys(uniqueAvatars(members, 7).swaps)).toEqual(['b']);
		expect(takenAvatars(members, 'b').has(shown)).toBe(true);
	});

	it('той самий колір з іншим значком — теж повтор, і той самий значок з іншим кольором', () => {
		const members = [
			member('a', 1, 'cat:blue'),
			member('b', 2, 'dog:blue'),
			member('c', 3, 'cat:red')
		];
		const { members: shown, swaps } = uniqueAvatars(members, 7);

		expect(Object.keys(swaps).sort()).toEqual(['b', 'c']);
		const icons = shown.map((m) => m.avatar?.split(':')[0]);
		const colors = shown.map((m) => m.avatar?.split(':')[1]);
		expect(new Set(icons).size, icons.join(', ')).toBe(3);
		expect(new Set(colors).size, colors.join(', ')).toBe(3);
	});

	/** Акаунт — профільна аватарка, та сама на кожному пристрої: її не міняють (10-A). */
	it('акаунт лишає свою — навіть коли зайшов пізніше; повтор між акаунтами дозволено', () => {
		const members = [
			member('anon', 1, 'cat:blue'),
			{ ...member('acc1', 2, 'cat:red'), account: true },
			{ ...member('acc2', 3, 'cat:red'), account: true }
		];
		const { swaps } = uniqueAvatars(members, 7);

		expect(Object.keys(swaps)).toEqual(['anon']);
	});

	/** «Посеред партії ніколи» (9-A): плитка на табло не міняється від того, що хтось зайшов. */
	it('посеред партії не міняється нічого', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'cat:blue')];

		expect(uniqueAvatars(members, 7, true)).toEqual({ members, swaps: {} });
	});

	/**
	 * ЗАПАСНІ ЩАБЛІ. У справжній кімнаті (12 місць, 12 кольорів) вільний колір є завжди:
	 * одинадцять інших тримають щонайбільше одинадцять. Тож тут тринадцять — більше, ніж
	 * вміщає кімната, — і саме на такий випадок щаблі й існують: спершу вільний значок.
	 */
	it('коли кольори скінчилися — вільний значок, а не повтор пари', () => {
		const accounts = [
			'red',
			'orange',
			'brown',
			'olive',
			'green',
			'teal',
			'blue',
			'navy',
			'violet',
			'magenta',
			'pink'
		].map((color, at) => ({ ...member(`acc${at}`, at + 1, `cat:${color}`), account: true }));
		const members = [...accounts, member('last', 12, 'cat:slate'), member('extra', 13, 'dog:red')];
		const { swaps } = uniqueAvatars(members, 7);
		const iconOf = (avatar: string) => avatar.split(':')[0];

		expect(iconOf(swaps.last), 'кота вже тримають — інший значок').not.toBe('cat');
		expect(swaps.last, 'сірий ще вільний — узято й значок, і колір').toMatch(/:slate$/);
		expect([iconOf(swaps.extra)], 'кольори скінчилися — хоч значок вільний').not.toContain('cat');
		expect(iconOf(swaps.extra)).not.toBe(iconOf(swaps.last));
	});

	it('зайняте для вибору — чужий значок і чужий колір, з іменем власника; своє — ні', () => {
		const members = [member('a', 1, 'cat:blue'), member('b', 2, 'dog:red')];
		const taken = takenAvatars(members, 'a');

		expect(taken.get('dog:blue'), 'значок b').toBe('імʼя b');
		expect(taken.get('cat:red'), 'колір b').toBe('імʼя b');
		expect(taken.has('cat:blue'), 'своє').toBe(false);
		expect(taken.size, '12 кольорів пса й 18 червоних значків, пес червоний — один').toBe(29);
	});

	it('пар вистачає з запасом: 216 проти 12 місць кімнати', () => {
		expect(ROOM_AVATARS).toHaveLength(216);
		expect(ROOM_AVATARS.every(hasAvatar)).toBe(true);
	});
});
