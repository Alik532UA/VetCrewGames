import type { DecorItem } from './terrain';

/**
 * Вода на карті: річки й водойми.
 *
 * Окремо від решти рельєфу, бо вода будується ПЕРШОЮ й за іншими правилами:
 * річка тягнеться від краю до краю, водойма розтікається плямами, і жодна з них
 * не питає, чи вільне місце. Усе інше — рослини й каміння — обходить уже готову
 * воду. Перша версія сипала все одним прохідом, і дерева опинялися посеред
 * водойм.
 */

/**
 * Річка — ланцюг водних плям від краю до краю, а не пляма.
 *
 * Звивина гасне на обох кінцях (`sin(t·π)`), тож річка приходить із-за краю
 * карти й виходить за нього, а не починається калюжею посеред поля.
 */
export interface RiverPath {
	points: Array<{ x: number; z: number }>;
	width: number;
}

/**
 * На скільки русло вилазить за межу намальованого світу.
 *
 * Річка, що починається й кінчається всередині карти, — це не річка, а довге
 * озеро: у нього видно обидва кінці. Пʼятнадцять відсотків радіуса виносять
 * витік і устя за землю, тож видимого початку не лишається.
 */
const RIVER_OVERSHOOT = 1.15;

/** Ширина русла як частка радіуса світу: 2–3.5%. */
const RIVER_WIDTH_SHARE = [0.02, 0.015] as const;

/** Розмах звивини — теж частка радіуса, інакше на великій карті русло — лінійка. */
const RIVER_BEND_SHARE = [0.05, 0.07] as const;

export function river(random: () => number, worldRadius: number): RiverPath {
	const reach = worldRadius * RIVER_OVERSHOOT;
	const angle = random() * Math.PI * 2;
	const from = { x: Math.cos(angle) * reach, z: Math.sin(angle) * reach };
	// Протилежний край із невеликим зсувом: русло не мусить іти точно через центр.
	const drift = worldRadius * 0.13;
	const to = {
		x: -from.x + (random() * 2 - 1) * drift,
		z: -from.z + (random() * 2 - 1) * drift
	};

	/*
	 * Ширина й звивина — ЧАСТКИ радіуса, а не абсолютні числа.
	 *
	 * Доти тут стояло «3 плюс до пʼяти одиниць». Поки світ мав радіус 30, це була
	 * повноводна річка; після зростання світу впʼятеро та сама трійка стала ниткою
	 * з непомітним вигином — і на екрані читалася як тріщина, а не як вода.
	 */
	const width = worldRadius * (RIVER_WIDTH_SHARE[0] + random() * RIVER_WIDTH_SHARE[1]);
	const bendAmount = worldRadius * (RIVER_BEND_SHARE[0] + random() * RIVER_BEND_SHARE[1]);
	const phase = random() * Math.PI * 2;

	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const length = Math.hypot(dx, dz) || 1;
	// Перпендикуляр до русла — уздовж нього й гуляє звивина.
	const nx = -dz / length;
	const nz = dx / length;

	/*
	 * Кроків рівно стілько, щоб берег був плавним, і не більше.
	 *
	 * Крок у частках довжини, а не в світових одиницях: на карті радіусом 300
	 * «кожні 0.6 одиниці» дало б тисячу точок, тобто дві тисячі вершин на одну
	 * річку — заради вигину, який на екрані займає пʼять пікселів.
	 */
	const steps = 200;
	const points: Array<{ x: number; z: number }> = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const bend = Math.sin(t * Math.PI * 2 + phase) * bendAmount * Math.sin(t * Math.PI);
		points.push({ x: from.x + dx * t + nx * bend, z: from.z + dz * t + nz * bend });
	}
	return { points, width };
}

/**
 * Водойма — кілька плям, що перекриваються, а не один правильний десятикутник.
 *
 * Одна пляма читалася саме як десятикутник: рівні краї, видно кількість
 * сегментів. Три-пʼять зсунутих дають нерівний берег без жодної додаткової
 * геометрії.
 */
export function lake(random: () => number, worldRadius: number): DecorItem[] {
	const cx = (random() * 2 - 1) * worldRadius * 0.8;
	const cz = (random() * 2 - 1) * worldRadius * 0.8;
	const blobs = 3 + Math.floor(random() * 3);

	return Array.from({ length: blobs }, () => ({
		kind: 'water' as const,
		x: cx + (random() * 2 - 1) * 1.8,
		z: cz + (random() * 2 - 1) * 1.8,
		scale: 0.9 + random() * 0.8,
		turn: 0
	}));
}
