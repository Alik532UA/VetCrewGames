import { seededRandom } from '$lib/utils/seededRandom';
import { RESERVE_HALF_MAX } from './plot';
import { CELL_WORLD, spiralCell } from './grid';
import { PALETTE, SCATTERED, type Palette } from './palette';
import { lake, river, type RiverPath } from './water';
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
 * Радіус, у якому росте рельєф. Найбільша ділянка гравця (`RESERVE_HALF_MAX`)
 * менша за нього більш ніж удвічі, тож ліс триває й ЗА нею: карта не
 * обривається на паркані.
 */
export const WORLD_RADIUS = 300;

/**
 * Радіус, під який рахована таблиця густини `PALETTE`.
 *
 * Кількість фігур росте з радіусом ЛІНІЙНО, а не по площі. Світ уже впʼятеро
 * більший за той, під який писалася таблиця, — по площі це двадцять пʼять разів,
 * тобто три тисячі мешів заради узбіччя, на яке ніхто не дивиться. Ціна рішення
 * названа прямо: чим більший світ, тим рідша дика земля. Ділянки гравця це не
 * стосується — вона рахується від власної межі.
 */
const PALETTE_RADIUS = 30;

/** Множник таблиці: скільки фігур припадає на одне число палітри. */
const DENSITY = WORLD_RADIUS / PALETTE_RADIUS;

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

export interface Terrain {
	/** Річки — смугами: у них є вісь і ширина, а не набір плям. */
	rivers: RiverPath[];
	/** Водойми, рослини, каміння — усе, що стоїть у точці. */
	items: DecorItem[];
	/** Сама лише вода. Те саме, що віддає `waterOf`, — щоб не питати вдруге. */
	water: Water;
}

/**
 * Тільки ВОДА: річки й озера, без жодної рослини.
 *
 * Окремим входом, бо будівництво вольєра питає рівно це — «чи є поруч вода», — і
 * платити за таку відповідь усім рельєфом надто дорого. Заміряно: повний рельєф
 * 1.89 мс, і відколи хід `build` по нього ходив, сам хід коштував 1.67 мс замість
 * нуля. Статистичний тест на десять тисяч будівництв вибив межу часу — саме він і
 * показав ціну.
 *
 * Працює це тому, що вода в `buildTerrain` генерується ПЕРШОЮ: ті самі перші
 * виклики того самого генератора дають ту саму воду. Порядок тут — не деталь
 * реалізації, а умова; перевірено тестом, який порівнює обидва входи.
 */
export function waterOf(biome: ReserveBiome, seed: number): Water {
	return waterPart(seededRandom(seed ^ 0x5eed), PALETTE[biome]);
}

/** Річки й озера. Один і той самий код служить обом входам. */
export interface Water {
	rivers: RiverPath[];
	lakes: DecorItem[];
}

function waterPart(random: () => number, palette: Palette): Water {
	// СПЕРШУ вода: усе інше обходить її, а не навпаки.
	const rivers = Array.from({ length: palette.rivers }, () => river(random, WORLD_RADIUS));
	const lakes: DecorItem[] = [];
	for (let i = 0; i < palette.lakes; i++) lakes.push(...lake(random, WORLD_RADIUS));
	return { rivers, lakes };
}

export function terrainOf(biome: ReserveBiome, seed: number): Terrain {
	const random = seededRandom(seed ^ 0x5eed);
	const palette = PALETTE[biome];
	const sites = buildSites();

	const { rivers, lakes: water } = waterPart(random, palette);

	/*
	 * Русло теж мусить відганяти дерева, хоч і малюється смугою. Для перевірки
	 * воно розкладається на плями по осі — саме тому `inWater` і далі працює з
	 * плямами: одна функція, два джерела.
	 */
	const riverBlots: DecorItem[] = rivers.flatMap((path) =>
		path.points.map((point) => ({
			kind: 'water' as const,
			x: point.x,
			z: point.z,
			scale: path.width / 2 / 1.5,
			turn: 0
		}))
	);
	const blocking = [...water, ...riverBlots];

	/*
	 * Кожен рід сіється двічі: густо в межах ділянки й рідше за нею. Один прохід
	 * по всьому радіусу дав би однакову густину, і паркан не читався б як межа
	 * ОБЛАШТОВАНОЇ землі.
	 */
	const rest = SCATTERED.flatMap((key) => {
		const kind = key as DecorKind;
		const total = Math.round(palette[key] * DENSITY);
		const wild = Math.round(total * WILD_SHARE);
		return [
			...scatter(random, kind, total - wild, blocking, sites, 0, RESERVE_HALF_MAX),
			...scatter(random, kind, wild, blocking, sites, RESERVE_HALF_MAX, WORLD_RADIUS)
		];
	});
	return { rivers, items: [...water, ...rest], water: { rivers, lakes: water } };
}

/**
 * Чи стоїть цей вольєр біля природної води.
 *
 * Якщо ні — усередині доводиться будувати штучну водойму, і саме тому місце під
 * вольєр не байдуже. Це найдешевший спосіб зробити карту частиною гри, а не
 * малюнком за склом.
 */
export const NEAR_WATER_DISTANCE = 4;

export function nearWater(water: Water, x: number, z: number): boolean {
	const byLake = water.lakes.some(
		(item) => Math.hypot(item.x - x, item.z - z) <= waterRadius(item.scale) + NEAR_WATER_DISTANCE
	);
	if (byLake) return true;

	// Річка теж вода: вольєр на її березі штучної водойми не потребує.
	return water.rivers.some((path) =>
		path.points.some(
			(point) => Math.hypot(point.x - x, point.z - z) <= path.width / 2 + NEAR_WATER_DISTANCE
		)
	);
}

/** Те саме питання від того, у кого є лише зерно: один вхід для симуляції. */
export const waterNear = (biome: ReserveBiome, seed: number, x: number, z: number): boolean =>
	nearWater(waterOf(biome, seed), x, z);
