import { describe, expect, it } from 'vitest';
import { PLAYABLE_ROUTES, pickRandomRoute, pickHabitatMode, armHabitatMode, takeHabitatMode } from './randomGame';
import { LANGUAGE_ROUTES } from '$lib/i18n/routing';

describe('випадкова гра', () => {
	/**
	 * Перелік виводиться з маршрутів — другий список розійшовся б із першим на
	 * наступній грі. Перевірка стежить саме за цим, а не за кількістю.
	 */
	it('до переліку входить кожен ігровий маршрут і жодного зайвого', () => {
		const routes = Object.keys(LANGUAGE_ROUTES).filter((route) => route !== '');
		expect([...PLAYABLE_ROUTES].sort()).toEqual(routes.sort());
		expect(PLAYABLE_ROUTES, 'головна — не гра').not.toContain('');
	});

	it('випадає лише те, що є в переліку', () => {
		for (const value of [0, 0.5, 0.999]) {
			expect(PLAYABLE_ROUTES).toContain(pickRandomRoute(() => value));
		}
	});

	it('кожен маршрут досяжний', () => {
		const seen = new Set(
			PLAYABLE_ROUTES.map((_, i) => pickRandomRoute(() => i / PLAYABLE_ROUTES.length))
		);
		expect(seen.size).toBe(PLAYABLE_ROUTES.length);
	});

	it('обидва підрежими «Де живем?» випадають', () => {
		expect(pickHabitatMode(() => 0.1)).toBe('continents');
		expect(pickHabitatMode(() => 0.9)).toBe('biomes');
	});

	/** Одноразовість — головна властивість: інакше режим нав'язався б і вдруге. */
	it('намір щодо режиму спрацьовує рівно один раз', () => {
		expect(takeHabitatMode(), 'без наміру — нічого').toBeNull();
		armHabitatMode('biomes');
		expect(takeHabitatMode()).toBe('biomes');
		expect(takeHabitatMode(), 'другий раз уже порожньо').toBeNull();
	});
});
