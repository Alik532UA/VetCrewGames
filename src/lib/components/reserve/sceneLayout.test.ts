// @vitest-environment node
// Розкладка — чиста арифметика, DOM їй не потрібен.
import { describe, expect, it } from 'vitest';
import { CELL, placeAnimals, spiralCell } from './sceneLayout';
import type { Animal } from '$lib/reserve/types';

const animal = (id: number, stage: Animal['stage'] = 'recovering'): Animal => ({
	id,
	speciesId: 'lion',
	origin: 'rescue',
	stage,
	enclosureId: id,
	recovery: 0,
	stress: 0,
	releasable: true,
	releasedOnDay: stage === 'released' ? 1 : null
});

describe('розкладка заповідника', () => {
	it('перевірка жива: мешканці отримують місця', () => {
		const placed = placeAnimals([animal(1), animal(2), animal(3)]);
		expect(placed).toHaveLength(3);
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
		// Двадцять перших клітинок лишаються в межах кількох кілець від нуля.
		const far = Array.from({ length: 20 }, (_, i) => spiralCell(i)).map((c) =>
			Math.max(Math.abs(c.x), Math.abs(c.z))
		);
		expect(Math.max(...far)).toBeLessThanOrEqual(3);
	});

	/**
	 * Місце визначає `id`, а не позиція в масиві.
	 *
	 * Коли тварину випускають, вона зникає зі сцени — і сусіди НЕ мають
	 * зсуватися на її місце. Заповідник, у якому будівлі перестрибують після
	 * кожної події, читається як збій, а не як гра.
	 */
	it('випуск сусіда не зсуває решту', () => {
		const before = placeAnimals([animal(1), animal(2), animal(3)]);
		const after = placeAnimals([animal(1), animal(2, 'released'), animal(3)]);

		const place = (list: typeof before, id: number) => list.find((p) => p.animal.id === id);
		expect(place(after, 1)).toMatchObject({ x: place(before, 1)!.x, z: place(before, 1)!.z });
		expect(place(after, 3)).toMatchObject({ x: place(before, 3)!.x, z: place(before, 3)!.z });
	});

	it('випущені зі сцени зникають: вони в природі, а не у вольєрі', () => {
		const placed = placeAnimals([animal(1, 'released'), animal(2)]);
		expect(placed.map((p) => p.animal.id)).toEqual([2]);
	});

	it('клітинки розсунуті на крок сітки', () => {
		const placed = placeAnimals([animal(1), animal(2)]);
		const distance = Math.hypot(placed[1].x - placed[0].x, placed[1].z - placed[0].z);
		expect(distance).toBeCloseTo(CELL);
	});
});
