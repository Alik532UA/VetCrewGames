// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { riverStrip } from './riverStrip';
import { river } from '$lib/reserve/water';
import { WORLD_RADIUS } from '$lib/reserve/terrain';
import { seededRandom } from '$lib/utils/seededRandom';

/**
 * Річка мусить бути ВИДНОЮ, і це перевіряється нормалями.
 *
 * Її не було на сцені при цілих даних: на мінікарті русло малювалося, а в грі —
 * ні. Причина була в намотуванні трикутників — лице смуги дивилося вниз, а
 * матеріал типово малює лише лице. Око такого в коді не бачить: обидві сторони
 * складаються з тих самих чисел.
 */

/** Нормаль трикутника за трьома вершинами. Права трійка, як у three. */
function normalOf(p: Float32Array, a: number, b: number, c: number) {
	const v = (i: number) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]] as const;
	const [ax, ay, az] = v(a);
	const [bx, by, bz] = v(b);
	const [cx, cy, cz] = v(c);
	const ux = bx - ax;
	const uy = by - ay;
	const uz = bz - az;
	const wx = cx - ax;
	const wy = cy - ay;
	const wz = cz - az;
	return {
		x: uy * wz - uz * wy,
		y: uz * wx - ux * wz,
		z: ux * wy - uy * wx
	};
}

const path = (seed: number) => river(seededRandom(seed), WORLD_RADIUS);

describe('смуга русла', () => {
	it('перевірка жива: смуга має по дві вершини на точку русла', () => {
		const source = path(1);
		const strip = riverStrip(source);
		expect(source.points.length).toBeGreaterThan(40);
		expect(strip.positions.length).toBe(source.points.length * 6);
		expect(strip.indices.length).toBe((source.points.length - 1) * 6);
	});

	/**
	 * Головна перевірка файлу: КОЖЕН трикутник дивиться вгору.
	 *
	 * Зворотний дослід очевидний — досить поміняти два індекси місцями, і всі
	 * нормалі стануть відʼємними; саме в такому стані річки й не було видно.
	 */
	it('усі трикутники дивляться вгору, а не в землю', () => {
		for (const seed of [1, 7, 42, 1000]) {
			const strip = riverStrip(path(seed));
			for (let i = 0; i < strip.indices.length; i += 3) {
				const normal = normalOf(
					strip.positions,
					strip.indices[i],
					strip.indices[i + 1],
					strip.indices[i + 2]
				);
				expect(normal.y, `зерно ${seed}, трикутник ${i / 3}`).toBeGreaterThan(0);
			}
		}
	});

	/** Береги розходяться на всю ширину — інакше річка була б лінією. */
	it('ширина смуги збігається із шириною русла', () => {
		const source = path(3);
		const strip = riverStrip(source);
		const [lx, , lz] = strip.positions.slice(0, 3);
		const [rx, , rz] = strip.positions.slice(3, 6);
		expect(Math.hypot(lx - rx, lz - rz)).toBeCloseTo(source.width, 5);
	});

	/**
	 * Річка приходить із-за краю світу й виходить за нього.
	 *
	 * Русло, що починається й кінчається всередині карти, — це не річка, а довге
	 * озеро: у нього видно обидва кінці.
	 */
	it('обидва кінці лежать за межею намальованого світу', () => {
		for (const seed of [1, 7, 42]) {
			const { points } = path(seed);
			const first = points[0];
			const last = points[points.length - 1];
			expect(Math.hypot(first.x, first.z), `зерно ${seed}`).toBeGreaterThan(WORLD_RADIUS);
			expect(Math.hypot(last.x, last.z), `зерно ${seed}`).toBeGreaterThan(WORLD_RADIUS);
		}
	});
});
