import { seededRandom } from '$lib/utils/seededRandom';
import { RESERVE_RADIUS } from './constants';
import { CELL_WORLD, spiralCell } from './grid';
import { lake, river } from './water';
import type { ReserveBiome } from './species';

/**
 * Рельєф заповідника: річки, водойми, рослинність, каміння.
 *
 * Розкладка **детермінована**: та сама партія дає той самий краєвид, бо
 * вирахувана із зерна. Це не косметична дрібниця — у спільній партії двоє
 * гравців мусять бачити один і той самий заповідник, інакше «постав вольєр біля
 * озера» означає в них різні місця.
 *
 * Генератор створюється тут ЛОКАЛЬНО й ніколи не чіпає `state.rolls`: рельєф не
 * має зсувати кидки, від яких залежить доля тварин. Інакше перемальовування
 * краєвиду міняло б, кого вдасться випустити.
 *
 * Порядок побудови важливий і зворотний до інтуїції: **спершу вода, потім усе
 * інше**. Вода не обходить дерева — дерева обходять воду, бо ростуть на землі,
 * а не в ній. Перша версія сипала все одним прохідом, і дерева опинялися просто
 * посеред водойм.
 */

export type DecorKind =
	| 'water'
	| 'spruce'
	| 'broadleaf'
	| 'palm'
	| 'bush'
	| 'pebble'
	| 'boulder'
	| 'cliff';

export interface DecorItem {
	kind: DecorKind;
	x: number;
	z: number;
	/** 0.6–1.4 для рослин і каміння; для води — множник радіуса. */
	scale: number;
	/** 0–2π. Однакові фігури, повернуті по-різному, перестають бути копіями. */
	turn: number;
}

/**
 * Радіус, у якому росте рельєф. Ділянка гравця вдвічі менша (`RESERVE_RADIUS`),
 * тож ліс триває й ЗА нею: карта не обривається на паркані.
 */
export const WORLD_RADIUS = 30;

/**
 * Частка фігур, що припадає на землю ЗА межею ділянки.
 *
 * Дика природа рідша за облаштований заповідник, але не порожня: обрив на
 * паркані читався б як кінець світу, а не як межа власності.
 */
const WILD_SHARE = 0.45;

/**
 * Радіус водної плями у світових одиницях.
 *
 * Живе тут, а не в компоненті сцени, бо його читають ДВОЄ: той, хто малює, і
 * той, хто вирішує, чи можна тут посадити дерево. Розійшовшись, вони дали б
 * дерева, що стоять у воді, — рівно те, що й сталося.
 */
export const waterRadius = (scale: number) => 1.5 * scale;

/** Скільки клітинок спіралі лишаємо під забудову — там рельєфу немає. */
const RESERVED_CELLS = 24;

/** Запас між рослиною й водою: корінь не має мокнути. */
const WATER_CLEARANCE = 0.6;

interface Palette {
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
const PALETTE: Record<ReserveBiome, Palette> = {
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

/** Місця під забудову: там нічого не ставимо, щоб не росло крізь будівлю. */
function buildSites(): Set<string> {
	const out = new Set<string>();
	for (let i = 0; i < RESERVED_CELLS; i++) {
		const cell = spiralCell(i);
		out.add(`${cell.x},${cell.z}`);
	}
	return out;
}

const cellKey = (x: number, z: number) =>
	`${Math.round(x / CELL_WORLD)},${Math.round(z / CELL_WORLD)}`;

/** Чи потрапляє точка у воду (з запасом), щоб не садити дерево в річку. */
export function inWater(water: DecorItem[], x: number, z: number, clearance = WATER_CLEARANCE) {
	return water.some(
		(item) => Math.hypot(item.x - x, item.z - z) <= waterRadius(item.scale) + clearance
	);
}

/** Розсіяти `count` фігур одного роду, обходячи воду й місця під забудову. */
function scatter(
	random: () => number,
	kind: DecorKind,
	count: number,
	water: DecorItem[],
	sites: Set<string>,
	minRadius: number,
	maxRadius: number
): DecorItem[] {
	const out: DecorItem[] = [];
	// Межа спроб робить функцію завершуваною навіть коли вода залила все:
	// нескінченний цикл у детермінованому генераторі — це зависла сторінка.
	for (let attempt = 0; attempt < count * 40 && out.length < count; attempt++) {
		// Кільце, а не квадрат: рівномірність по площі дає `sqrt`, інакше все
		// збивається до внутрішнього краю.
		const angle = random() * Math.PI * 2;
		const r = Math.sqrt(
			minRadius * minRadius + random() * (maxRadius * maxRadius - minRadius * minRadius)
		);
		const x = Math.cos(angle) * r;
		const z = Math.sin(angle) * r;
		if (sites.has(cellKey(x, z)) || inWater(water, x, z)) continue;

		out.push({ kind, x, z, scale: 0.6 + random() * 0.8, turn: random() * Math.PI * 2 });
	}
	return out;
}

const SCATTERED: Array<keyof Palette> = [
	'spruce',
	'broadleaf',
	'palm',
	'bush',
	'pebble',
	'boulder',
	'cliff'
];

export function terrainOf(biome: ReserveBiome, seed: number): DecorItem[] {
	const random = seededRandom(seed ^ 0x5eed);
	const palette = PALETTE[biome];
	const sites = buildSites();

	// СПЕРШУ вода: усе інше обходить її, а не навпаки.
	const water: DecorItem[] = [];
	for (let i = 0; i < palette.rivers; i++) water.push(...river(random, WORLD_RADIUS));
	for (let i = 0; i < palette.lakes; i++) water.push(...lake(random, WORLD_RADIUS));

	/*
	 * Кожен рід сіється двічі: густо в межах ділянки й рідше за нею. Один прохід
	 * по всьому радіусу дав би однакову густину, і паркан не читався б як межа
	 * ОБЛАШТОВАНОЇ землі.
	 */
	const rest = SCATTERED.flatMap((key) => {
		const kind = key as DecorKind;
		const total = palette[key];
		const wild = Math.round(total * WILD_SHARE);
		return [
			...scatter(random, kind, total - wild, water, sites, 0, RESERVE_RADIUS),
			...scatter(random, kind, wild, water, sites, RESERVE_RADIUS, WORLD_RADIUS)
		];
	});
	return [...water, ...rest];
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
		(item) =>
			item.kind === 'water' &&
			Math.hypot(item.x - x, item.z - z) <= waterRadius(item.scale) + NEAR_WATER_DISTANCE
	);
}
