// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	AVATAR_ANIMALS,
	AVATAR_COLORS,
	AVATAR_ICONS,
	AVATAR_MAX,
	AVATAR_PLANTS,
	formatAvatar,
	hasAvatar,
	isAvatar,
	normaliseAvatar,
	parseAvatar,
	randomAvatar
} from './avatars';

/**
 * АВАТАР ЯК ЗНАЧЕННЯ — палітра 2026-09-27 (рішення автора 12-A, 13-A, 14-A): тринадцять
 * тварин і пʼять рослин, дванадцять кольорів; значки, яких більше немає, читаються
 * твариною того самого кольору.
 *
 * Зворотні експерименти: вибирати тварину для старого значка з `Math.random` — червоніє
 * «однаково на кожному пристрої»; пропустити в `normaliseAvatar` перевірку кольору —
 * червоніє «невідомий колір не рятується»; брати в `randomAvatar` індекс без `Math.min` —
 * червоніє «крайні кидки».
 */
describe('палітра', () => {
	it('перевірка жива: вісімнадцять значків і дванадцять кольорів, без повторів', () => {
		expect(AVATAR_ICONS).toHaveLength(18);
		expect(AVATAR_ANIMALS).toHaveLength(13);
		expect(AVATAR_PLANTS).toHaveLength(5);
		expect(AVATAR_COLORS).toHaveLength(12);
		expect(new Set(AVATAR_ICONS).size).toBe(AVATAR_ICONS.length);
		expect(new Set(AVATAR_COLORS).size).toBe(AVATAR_COLORS.length);
	});

	it('шести нетварин немає: людина, смайл, зірка, серце, блискавка, мішень', () => {
		for (const gone of ['user', 'smile', 'star', 'heart', 'zap', 'target']) {
			expect(AVATAR_ICONS as readonly string[]).not.toContain(gone);
		}
	});

	it('чотири нові кольори на місці: коричневий, оливковий, пурпуровий, темно-синій', () => {
		expect(AVATAR_COLORS).toEqual(expect.arrayContaining(['brown', 'olive', 'magenta', 'navy']));
	});

	it('найдовша пара вміщається в межу бази', () => {
		const longest = Math.max(
			...AVATAR_ICONS.flatMap((icon) => AVATAR_COLORS.map((color) => `${icon}:${color}`.length))
		);
		expect(longest).toBeLessThanOrEqual(AVATAR_MAX);
	});
});

describe('аватар як значення', () => {
	it('чинним є лише відома пара «значок:колір» із чинних списків', () => {
		expect(isAvatar(formatAvatar('shrimp', 'navy'))).toBe(true);
		expect(isAvatar('dragon:gold'), 'формі відповідає, а намалювати нічим').toBe(false);
		expect(isAvatar('star:red'), 'значка більше немає').toBe(false);
		expect(isAvatar('')).toBe(false);
		expect(isAvatar(null)).toBe(false);
		expect(isAvatar('a'.repeat(AVATAR_MAX + 1))).toBe(false);
	});

	it('значок, якого більше немає, — тварина того самого кольору', () => {
		const migrated = normaliseAvatar('star:red');
		const [icon, color] = migrated.split(':');
		expect(AVATAR_ANIMALS as readonly string[]).toContain(icon);
		expect(color).toBe('red');
		expect(hasAvatar('star:red'), 'показується, а не зникає').toBe(true);
	});

	it('однаково на кожному пристрої: той самий рядок — та сама тварина', () => {
		for (const old of ['user:teal', 'smile:blue', 'heart:pink', 'zap:orange', 'target:slate']) {
			expect(normaliseAvatar(old)).toBe(normaliseAvatar(old));
			expect(isAvatar(normaliseAvatar(old)), old).toBe(true);
		}
	});

	it('невідомий колір не рятується, а чинна пара лишається собою', () => {
		expect(normaliseAvatar('star:gold')).toBe('');
		expect(normaliseAvatar('dragon:red')).toBe('');
		expect(normaliseAvatar('cat:blue')).toBe('cat:blue');
		expect(hasAvatar('')).toBe(false);
		expect(hasAvatar(undefined)).toBe(false);
	});

	/** Розбір — для ВИБОРУ, де щось мусить бути позначене; «чи малювати» питає `hasAvatar`. */
	it('розбір невідомого — перший значок першого кольору, старого — його тварина', () => {
		expect(parseAvatar('dragon:gold')).toEqual({ icon: AVATAR_ICONS[0], color: AVATAR_COLORS[0] });
		expect(parseAvatar(null)).toEqual({ icon: AVATAR_ICONS[0], color: AVATAR_COLORS[0] });
		expect(formatAvatar(...(Object.values(parseAvatar('star:red')) as [never, never]))).toBe(
			normaliseAvatar('star:red')
		);
	});
});

describe('випадкова аватарка нового гравця (8-A)', () => {
	it('завжди чинна — зокрема на крайніх кидках', () => {
		expect(randomAvatar(() => 0)).toBe(formatAvatar(AVATAR_ICONS[0], AVATAR_COLORS[0]));
		expect(randomAvatar(() => 0.999999)).toBe(
			formatAvatar(AVATAR_ICONS[AVATAR_ICONS.length - 1], AVATAR_COLORS[AVATAR_COLORS.length - 1])
		);
		expect(isAvatar(randomAvatar(() => 1)), 'крайні кидки').toBe(true);
	});
});
