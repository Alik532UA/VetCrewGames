import { CELL_WORLD, placeOf } from '$lib/reserve/grid';
import type { Animal, Enclosure } from '$lib/reserve/types';

/**
 * Де на сцені стоїть кожен вольєр і хто в ньому живе.
 *
 * Місце визначає `id` ВОЛЬЄРА, а не позиція тварини в масиві: будівля стоїть
 * там, де її поставили, і випуск мешканця її не рухає. Сама сітка живе в
 * `reserve/grid`, бо на неї спирається ще й рельєф — він мусить знати, які
 * клітинки лишити вільними під забудову.
 */

export const CELL = CELL_WORLD;

export interface Placed {
	enclosure: Enclosure;
	/** Хто тут живе; `null` — вольєр порожній. */
	animal: Animal | null;
	x: number;
	z: number;
}

export function placeEnclosures(enclosures: Enclosure[], animals: Animal[]): Placed[] {
	return enclosures.map((enclosure) => ({
		enclosure,
		animal: animals.find((a) => a.enclosureId === enclosure.id && a.stage !== 'released') ?? null,
		...placeOf(enclosure.id)
	}));
}
