// @vitest-environment node
// Розкладка й рельєф — чиста арифметика, DOM їм не потрібен.
import { describe, expect, it } from 'vitest';
import { CELL, placeEnclosures } from './sceneLayout';
import { spiralCell, worldOf } from '$lib/reserve/grid';
import { inWater, nearWater, terrainOf, WORLD_RADIUS } from '$lib/reserve/terrain';
import { RESERVE_HALF_MAX } from '$lib/reserve/constants';
import { RESERVE_BIOMES } from '$lib/reserve/species';
import { DEFAULT_ZOOM } from './isoCamera';
import type { Animal, Enclosure } from '$lib/reserve/types';

const enclosure = (id: number, size = 3): Enclosure => ({
	id,
	// Місце тепер належить вольєру: ставимо по спіралі, щоб не накладалися.
	cell: spiralCell(id - 1),
	size,
	quality: 2,
	durability: 1
});

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
		const a = worldOf(spiralCell(0));
		const b = worldOf(spiralCell(1));
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
			expect(terrainOf(biome, 1).items.length, biome).toBeGreaterThan(5);
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

	/** Рослиною тут вважається все, що росте: дерева будь-якої породи й кусти. */
	const GREENERY = new Set(['spruce', 'broadleaf', 'palm', 'bush']);
	const STONES = new Set(['pebble', 'boulder', 'cliff']);

	it('біоми виглядають по-різному: у тропіках зелені більше, ніж у тундрі', () => {
		const plants = (biome: 'rainforest' | 'tundra') =>
			terrainOf(biome, 7).items.filter((item) => GREENERY.has(item.kind)).length;
		expect(plants('rainforest')).toBeGreaterThan(plants('tundra'));
	});

	it('у тундрі каміння більше, ніж зелені', () => {
		const terrain = terrainOf('tundra', 7).items;
		const count = (set: Set<string>) => terrain.filter((item) => set.has(item.kind)).length;
		expect(count(STONES)).toBeGreaterThan(count(GREENERY));
	});

	/**
	 * Дерево, що росте крізь будівлю, читається як помилка, а не як природа.
	 * Тому клітинки під забудову лишаються чистими.
	 */
	/**
	 * Вода тут — виняток, і виняток НАВМИСНИЙ.
	 *
	 * Дерево, що росте крізь будівлю, — помилка. А річка, що протікає крізь
	 * заповідник, — навпаки: вольєр біля неї не потребує штучної водойми, тож
	 * місце під забудову стає вигіднішим саме там. Русло проходить, де хоче;
	 * обходять його рослини й каміння.
	 */
	it('рельєф не займає місць, відведених під вольєри', () => {
		const reserved = new Set(
			Array.from({ length: 24 }, (_, i) => {
				const cell = spiralCell(i);
				return `${cell.x},${cell.z}`;
			})
		);
		for (const biome of RESERVE_BIOMES) {
			for (const item of terrainOf(biome, 3).items) {
				if (item.kind === 'water') continue;
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
		const water = terrain.items.find((item) => item.kind === 'water');
		expect(water, 'у тропіках немає води — перевірка мертва').toBeDefined();
		if (!water) return;

		expect(nearWater(terrain, water.x, water.z)).toBe(true);
		expect(nearWater(terrain, water.x + 500, water.z + 500)).toBe(false);
	});
});

describe('рельєф справді потрапляє в кадр', () => {
	/**
	 * Ізометрична проєкція точки на землі в пікселі екрана.
	 *
	 * Камера стоїть у (14, 14, 14) й дивиться в нуль, тож її праворуч-вектор —
	 * `(0.707, 0, −0.707)`, а вгору — `(−0.408, 0.816, −0.408)`. Для точки на
	 * землі (y = 0) це зводиться до двох множень.
	 */
	const project = (x: number, z: number, zoom: number) => ({
		px: 0.7071 * (x - z) * zoom,
		py: -0.4082 * (x + z) * zoom
	});

	/** Типове вікно комп'ютера: полотно 1264×630 виміряне в браузері. */
	const CANVAS = { width: 1264, height: 630 };

	const visible = (biome: (typeof RESERVE_BIOMES)[number], zoom: number) =>
		terrainOf(biome, 42).items.filter((item) => {
			const { px, py } = project(item.x, item.z, zoom);
			return Math.abs(px) <= CANVAS.width / 2 && Math.abs(py) <= CANVAS.height / 2;
		}).length;

	it('перевірка жива: проєкція ставить центр у центр', () => {
		expect(project(0, 0, DEFAULT_ZOOM)).toEqual({ px: 0, py: -0 });
	});

	/**
	 * Саме через це карта виглядала порожнім клаптиком трави: при масштабі 54 у
	 * кадр не потрапляло майже нічого, хоч рельєф і був намальований.
	 *
	 * Поріг тут третина, а не більшість, і це не поступка. Рахується він від
	 * ДІЛЯНКИ, а не від усього світу: світ тягнеться на ±60, і побачити його весь з
	 * першого погляду неможливо за визначенням — обжитим має виглядати те, на чому
	 * грають. Побачити все одразу й водночас мати що відкривати панорамуванням —
	 * вимоги, які виключають одна одну.
	 */
	it('при типовому масштабі видно щонайменше третину рельєфу ділянки', () => {
		for (const biome of RESERVE_BIOMES) {
			const onPlot = terrainOf(biome, 42).items.filter(
				(item) => Math.max(Math.abs(item.x), Math.abs(item.z)) <= RESERVE_HALF_MAX
			).length;
			const inFrame = visible(biome, DEFAULT_ZOOM);
			expect(inFrame, `${biome}: у кадрі ${inFrame} із ${onPlot} на ділянці`).toBeGreaterThan(
				onPlot / 3
			);
		}
	});

	it('старий масштаб 54 показував менше — саме те, на що скаржився користувач', () => {
		const now = visible('forest', DEFAULT_ZOOM);
		const before = visible('forest', 54);
		expect(before, `було ${before}, стало ${now}`).toBeLessThan(now);
	});

	it('навіть на найдальшому масштабі рельєф не виходить за землю', () => {
		/*
		 * Земля вчетверо ширша за радіус рельєфу, тобто ±2·WORLD_RADIUS. Числа тут
		 * ВИВЕДЕНІ, а не вписані: доти стояло «±40», і після подвоєння світу
		 * перевірка почала падати на цілком правильному рельєфі.
		 */
		for (const biome of RESERVE_BIOMES) {
			for (const item of terrainOf(biome, 42).items) {
				expect(Math.abs(item.x), biome).toBeLessThanOrEqual(WORLD_RADIUS);
				expect(Math.abs(item.z), biome).toBeLessThanOrEqual(WORLD_RADIUS);
			}
		}
	});
});

describe('генерація рельєфу', () => {
	const KINDS = ['spruce', 'broadleaf', 'palm', 'bush', 'pebble', 'boulder', 'cliff'] as const;

	/**
	 * Найгрубіша з вад, які було видно на екрані: дерево стояло просто посеред
	 * водойми. Причина була в порядку — усе сипалося одним прохідом, і вода не
	 * знала про дерева, а дерева про воду. Тепер вода перша, решта її обходить.
	 */
	it('на воді нічого не росте й не лежить', () => {
		for (const biome of RESERVE_BIOMES) {
			for (const seed of [1, 42, 777]) {
				const terrain = terrainOf(biome, seed).items;
				const water = terrain.filter((item) => item.kind === 'water');
				const onLand = terrain.filter((item) => item.kind !== 'water');

				const wet = onLand.filter((item) => inWater(water, item.x, item.z, 0));
				expect(wet.map((w) => `${w.kind} @ ${w.x.toFixed(1)},${w.z.toFixed(1)}`)).toEqual([]);
			}
		}
	});

	/** Рельєф заповнює світ, а не купку в центрі — це теж було видно оком. */
	it('рельєф розкиданий по всій карті, а не в центрі', () => {
		const terrain = terrainOf('forest', 42).items.filter((i) => i.kind !== 'water');
		const far = terrain.filter((i) => Math.hypot(i.x, i.z) > WORLD_RADIUS * 0.6);
		expect(far.length, 'усе збилося ближче за 60% радіуса').toBeGreaterThan(terrain.length * 0.2);

		// І в кожній із чотирьох четвертей щось є: інакше «по всій карті» означало
		// б смугу.
		const quadrants = new Set(terrain.map((i) => `${i.x > 0},${i.z > 0}`));
		expect(quadrants.size, 'рельєф не в усіх четвертях').toBe(4);
	});

	/**
	 * Річка тепер СМУГА, а не ланцюг плям: у неї є вісь і ширина. Ланцюг читався
	 * на екрані намистом — рівні півкола на берегах і стрибки ширини на стиках.
	 */
	it('річка — суцільний шлях від краю до краю', () => {
		for (const biome of RESERVE_BIOMES) {
			const { rivers } = terrainOf(biome, 42);
			expect(rivers.length, biome).toBeGreaterThan(0);

			for (const path of rivers) {
				expect(path.points.length, 'русло з двох точок — це відрізок').toBeGreaterThan(20);
				expect(path.width, 'русло без ширини').toBeGreaterThan(0);

				const reach = Math.max(...path.points.map((p) => Math.hypot(p.x, p.z)));
				expect(reach, biome).toBeGreaterThanOrEqual(WORLD_RADIUS * 0.9);

				// Сусідні точки стоять щільно: розрив читався б як обрив русла.
				for (let i = 1; i < path.points.length; i++) {
					const step = Math.hypot(
						path.points[i].x - path.points[i - 1].x,
						path.points[i].z - path.points[i - 1].z
					);
					expect(step, 'розрив у руслі').toBeLessThan(2);
				}
			}
		}
	});

	/** Один конус різного розміру — це не ліс, а копії. */
	it('у лісі росте кілька різних порід і є кусти', () => {
		const kinds = new Set(terrainOf('forest', 42).items.map((i) => i.kind));
		expect(kinds.has('spruce')).toBe(true);
		expect(kinds.has('broadleaf')).toBe(true);
		expect(kinds.has('bush')).toBe(true);
	});

	it('каміння теж різне: камінці, валуни й скелі', () => {
		const kinds = new Set(terrainOf('tundra', 42).items.map((i) => i.kind));
		expect(kinds.has('pebble')).toBe(true);
		expect(kinds.has('boulder')).toBe(true);
		expect(kinds.has('cliff')).toBe(true);
	});

	/**
	 * Біом — це НАБІР порід, а не той самий набір у різній кількості. Пальма в
	 * тундрі й ялина в тропіках однаково зіпсували б те, чого гра навчає.
	 */
	it('породи не збігаються між біомами', () => {
		const of = (biome: (typeof RESERVE_BIOMES)[number]) =>
			new Set(terrainOf(biome, 42).items.map((i) => i.kind));
		expect(of('tundra').has('palm'), 'пальма в тундрі').toBe(false);
		expect(of('rainforest').has('spruce'), 'ялина в тропіках').toBe(false);
		expect(of('rainforest').has('palm')).toBe(true);
	});

	it('кожна фігура має власний поворот — інакше це текстура, а не ліс', () => {
		const turns = terrainOf('forest', 42)
			.items.filter((i) => KINDS.includes(i.kind as (typeof KINDS)[number]))
			.map((i) => i.turn);
		expect(new Set(turns).size, 'усі фігури повернуті однаково').toBeGreaterThan(
			turns.length * 0.9
		);
	});

	it('краєвид лишається детермінованим після всіх змін', () => {
		expect(JSON.stringify(terrainOf('tundra', 5))).toBe(JSON.stringify(terrainOf('tundra', 5)));
	});
});
