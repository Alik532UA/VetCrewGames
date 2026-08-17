import type { ReserveBiome } from './species';

/**
 * Скільки чого росте й лежить у кожному біомі.
 *
 * Окремо від самої генерації, бо це ДАНІ, і вони росли з кожною правкою: спершу
 * три роди, потім вісім, далі річки й водойми окремими числами. Тримати
 * таблицю поруч з алгоритмом означало б, що файл із логікою розпухає від
 * кожного нового куста.
 */
export interface Palette {
	rivers: number;
	lakes: number;
	spruce: number;
	broadleaf: number;
	palm: number;
	bush: number;
	pebble: number;
	boulder: number;
	cliff: number;
}

/**
 * Кожен біом — це свій НАБІР порід, а не той самий набір у різній кількості.
 *
 * У тундрі не росте пальма, у тропіках немає ялини, а скелі бувають там, де
 * земля піднімається. Саме через це «всі дерева однакові» було вадою, а не
 * стилем: біом мусить пізнаватися з першого погляду.
 */
export const PALETTE: Record<ReserveBiome, Palette> = {
	forest: {
		rivers: 1,
		lakes: 2,
		spruce: 20,
		broadleaf: 16,
		palm: 0,
		bush: 18,
		pebble: 8,
		boulder: 4,
		cliff: 1
	},
	tundra: {
		rivers: 1,
		lakes: 4,
		spruce: 5,
		broadleaf: 0,
		palm: 0,
		bush: 7,
		pebble: 16,
		boulder: 10,
		cliff: 3
	},
	savanna: {
		rivers: 1,
		lakes: 1,
		spruce: 0,
		broadleaf: 9,
		palm: 4,
		bush: 12,
		pebble: 8,
		boulder: 5,
		cliff: 2
	},
	rainforest: {
		rivers: 2,
		lakes: 3,
		spruce: 0,
		broadleaf: 24,
		palm: 14,
		bush: 24,
		pebble: 4,
		boulder: 2,
		cliff: 0
	}
};

/** Роди, які просто розсіюються по карті. Вода будується інакше. */
export const SCATTERED: Array<keyof Palette> = [
	'spruce',
	'broadleaf',
	'palm',
	'bush',
	'pebble',
	'boulder',
	'cliff'
];
