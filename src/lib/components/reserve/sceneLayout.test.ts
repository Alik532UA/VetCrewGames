// @vitest-environment node
// Розкладка й рельєф — чиста арифметика, DOM їм не потрібен.
import { describe, expect, it } from 'vitest';
import { CELL, placeEnclosures } from './sceneLayout';
import { placeOf, spiralCell } from '$lib/reserve/grid';
import { nearWater, terrainOf } from '$lib/reserve/terrain';
import { RESERVE_BIOMES } from '$lib/reserve/species';
import type { Animal, Enclosure } from '$lib/reserve/types';

const enclosure = (id: number, size = 3): Enclosure => ({ id, size, quality: 2, durability: 1 });

const animal = (
	id: number,
	enclosureId: number,
	stage: Animal['stage'] = 'recovering'
): Animal => ({
	id,
	speciesId: 'lion',
	origin: 'rescue',
	stage,
	enclosureId,
	recovery: 0,
	stress: 0,
	releasable: true,
	releasedOnDay: stage === 'released' ? 1 : null
});

describe('сітка заповідника', () => {
	it('перевірка жива: вольєри отримують місця', () => {
		const placed = placeEnclosures([enclosure(1), enclosure(2)], []);
		expect(placed).toHaveLength(2);
		expect(placed[0]).toMatchObject({ x: 0, z: 0 });
	});

	it('перший вольєр стоїть у центрі — там, куди дивиться камера', () => {
		expect(spiralCell(0)).toEqual({ x: 0, z: 0 });
	});

	it('вольєри не накладаються один на одного', () => {
		const seen = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(spiralCell(i))));
		expect(seen.size).toBe(40);
	});

	it('заповідник росте від центру, а не вбік', () => {
		const far = Array.from({ length: 20 }, (_, i) => spiralCell(i)).map((c) =>
			Math.max(Math.abs(c.x), Math.abs(c.z))
		);
		expect(Math.max(...far)).toBeLessThanOrEqual(3);
	});

	it('клітинки розсунуті на крок сітки', () => {
		const a = placeOf(1);
		const b = placeOf(2);
		expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(CELL);
	});

	/**
	 * Місце визначає `id` ВОЛЬЄРА, а не позиція тварини в масиві.
	 *
	 * Коли тварину випускають, вольєр лишається стояти там, де стояв. Заповідник,
	 * у якому будівлі перестрибують після кожної події, читається як збій.
	 */
	it('випуск мешканця не рухає жодної будівлі', () => {
		const houses = [enclosure(1), enclosure(2), enclosure(3)];
		const before = placeEnclosures(houses, [animal(1, 2)]);
		const after = placeEnclosures(houses, [animal(1, 2, 'released')]);

		expect(after.map((p) => [p.x, p.z])).toEqual(before.map((p) => [p.x, p.z]));
	});

	it('випущений мешканець зникає з вольєра, а вольєр лишається', () => {
		const placed = placeEnclosures([enclosure(1)], [animal(1, 1, 'released')]);
		expect(placed).toHaveLength(1);
		expect(placed[0].animal, 'випущений усе ще сидить у вольєрі').toBeNull();
	});
});

describe('рельєф біома', () => {
	it('перевірка жива: у кожному біомі щось є', () => {
		for (const biome of RESERVE_BIOMES) {
			expect(terrainOf(biome, 1).length, biome).toBeGreaterThan(5);
		}
	});

	/**
	 * Краєвид детермінований — інакше в спільній партії «постав вольєр біля
	 * озера» означало б у двох гравців різні місця.
	 */
	it('та сама партія дає той самий краєвид', () => {
		expect(JSON.stringify(terrainOf('forest', 42))).toBe(JSON.stringify(terrainOf('forest', 42)));
	});

	it('різні зерна дають різні краєвиди', () => {
		expect(JSON.stringify(terrainOf('forest', 1))).not.toBe(JSON.stringify(terrainOf('forest', 2)));
	});

	it('біоми виглядають по-різному: у тропіках зелені більше, ніж у тундрі', () => {
		const plants = (biome: 'rainforest' | 'tundra') =>
			terrainOf(biome, 7).filter((item) => item.kind === 'plant').length;
		expect(plants('rainforest')).toBeGreaterThan(plants('tundra'));
	});

	it('у тундрі каміння більше, ніж дерев', () => {
		const terrain = terrainOf('tundra', 7);
		const count = (kind: string) => terrain.filter((item) => item.kind === kind).length;
		expect(count('rock')).toBeGreaterThan(count('plant'));
	});

	/**
	 * Дерево, що росте крізь будівлю, читається як помилка, а не як природа.
	 * Тому клітинки під забудову лишаються чистими.
	 */
	it('рельєф не займає місць, відведених під вольєри', () => {
		const reserved = new Set(
			Array.from({ length: 24 }, (_, i) => {
				const cell = spiralCell(i);
				return `${cell.x},${cell.z}`;
			})
		);
		for (const biome of RESERVE_BIOMES) {
			for (const item of terrainOf(biome, 3)) {
				const cell = `${Math.round(item.x / CELL)},${Math.round(item.z / CELL)}`;
				expect(reserved.has(cell), `${biome}: ${item.kind} стоїть на місці вольєра`).toBe(false);
			}
		}
	});

	/**
	 * Це і є те, що робить карту частиною гри: місце під вольєр не байдуже, бо
	 * поза водоймою доводиться будувати штучну.
	 */
	it('близькість до води залежить від місця, а не від настрою', () => {
		const terrain = terrainOf('rainforest', 11);
		const water = terrain.find((item) => item.kind === 'water');
		expect(water, 'у тропіках немає води — перевірка мертва').toBeDefined();
		if (!water) return;

		expect(nearWater(terrain, water.x, water.z)).toBe(true);
		expect(nearWater(terrain, water.x + 500, water.z + 500)).toBe(false);
	});
});
