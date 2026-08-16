import { seededRandom } from '$lib/utils/seededRandom';
import { CELL_WORLD, spiralCell } from './grid';
import type { ReserveBiome } from './species';

/**
 * Рельєф заповідника: водойма, рослинність, каміння.
 *
 * Розкладка **детермінована**: та сама партія дає той самий краєвид, бо
 * вирахувана із зерна. Це не косметична дрібниця — у спільній партії двоє
 * гравців мусять бачити один і той самий заповідник, інакше «постав вольєр біля
 * озера» означає в них різні місця.
 *
 * Генератор створюється тут ЛОКАЛЬНО й ніколи не чіпає `state.rolls`: рельєф не
 * має зсувати кидки, від яких залежить доля тварин. Інакше перемальовування
 * краєвиду міняло б, кого вдасться випустити.
 */

export type Decor = 'water' | 'plant' | 'rock';

export interface DecorItem {
	kind: Decor;
	x: number;
	z: number;
	/** 0.6–1.4. Однакові кущі рядком читаються як текстура, а не як ліс. */
	scale: number;
}

/** Що росте й що лежить у кожному біомі, і скільки чого. */
const PALETTE: Record<ReserveBiome, { water: number; plant: number; rock: number }> = {
	// Ліс: багато дерев, струмок, трохи каміння.
	forest: { water: 4, plant: 26, rock: 6 },
	// Тундра: майже нічого не росте, зате камені й талі озерця.
	tundra: { water: 6, plant: 6, rock: 18 },
	// Савана: рідкі дерева й одна водойма, до якої сходяться всі.
	savanna: { water: 3, plant: 12, rock: 8 },
	// Тропічний ліс: суцільна зелень і волога.
	rainforest: { water: 8, plant: 34, rock: 3 }
};

/** Скільки клітинок спіралі лишаємо під забудову — там рельєф не ставимо. */
const RESERVED_CELLS = 24;

/** Радіус розсіювання декору навколо центру, у світових одиницях. */
const SPREAD = 26;

/**
 * Краєвид біома для цього зерна.
 *
 * Клітинки, зайняті вольєрами, лишаються чистими: дерево, яке росте крізь
 * будівлю, читається як помилка, а не як природа. Тому перевіряються перші
 * `RESERVED_CELLS` позицій спіралі — стільки вольєрів партія реально встигає.
 */
export function terrainOf(biome: ReserveBiome, seed: number): DecorItem[] {
	const random = seededRandom(seed ^ 0x5eed);
	const counts = PALETTE[biome];
	const items: DecorItem[] = [];

	/** Місця під забудову — сюди рельєф не ставимо. */
	const taken = new Set<string>();
	for (let i = 0; i < RESERVED_CELLS; i++) {
		const cell = spiralCell(i);
		taken.add(`${cell.x},${cell.z}`);
	}

	for (const [kind, count] of Object.entries(counts) as Array<[Decor, number]>) {
		for (let i = 0; i < count; i++) {
			const x = (random() * 2 - 1) * SPREAD;
			const z = (random() * 2 - 1) * SPREAD;
			const cell = { x: Math.round(x / CELL_WORLD), z: Math.round(z / CELL_WORLD) };
			if (taken.has(`${cell.x},${cell.z}`)) continue;

			items.push({ kind, x, z, scale: 0.6 + random() * 0.8 });
		}
	}
	return items;
}

/**
 * Чи стоїть цей вольєр біля природної води.
 *
 * Якщо ні — усередині доводиться будувати штучну водойму, і саме тому місце під
 * вольєр не байдуже. Це найдешевший спосіб зробити карту частиною гри, а не
 * малюнком за склом.
 */
export const NEAR_WATER_DISTANCE = 4;

export function nearWater(terrain: DecorItem[], x: number, z: number): boolean {
	return terrain.some(
		(item) => item.kind === 'water' && Math.hypot(item.x - x, item.z - z) <= NEAR_WATER_DISTANCE
	);
}
