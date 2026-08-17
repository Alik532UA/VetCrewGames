import { CELL_WORLD, footprintOf, worldOf } from '$lib/reserve/grid';
import type { Animal, Enclosure } from '$lib/reserve/types';

/**
 * Де на сцені стоїть кожен вольєр і хто в ньому живе.
 *
 * Місце тепер лежить у самому вольєрі: його вибрав ГРАВЕЦЬ. Доти воно виводилося
 * з `id` по спіралі, і питання «де будувати» просто не існувало — заповідник
 * укладався сам. Випуск мешканця будівлю не рухає ні тоді, ні тепер.
 */

export const CELL = CELL_WORLD;

export interface Placed {
	enclosure: Enclosure;
	/** Хто тут живе; `null` — вольєр порожній. */
	animal: Animal | null;
	x: number;
	z: number;
	/** Сторона сліду в клітинках: паркан має бути такий, як займана земля. */
	span: number;
}

export function placeEnclosures(enclosures: Enclosure[], animals: Animal[]): Placed[] {
	return enclosures.map((enclosure) => ({
		enclosure,
		animal: animals.find((a) => a.enclosureId === enclosure.id && a.stage !== 'released') ?? null,
		...worldOf(enclosure.cell),
		span: footprintOf(enclosure.size)
	}));
}
