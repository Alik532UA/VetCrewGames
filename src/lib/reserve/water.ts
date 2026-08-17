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
export function river(random: () => number, worldRadius: number): DecorItem[] {
	const angle = random() * Math.PI * 2;
	const from = { x: Math.cos(angle) * worldRadius, z: Math.sin(angle) * worldRadius };
	const to = { x: -from.x + (random() * 2 - 1) * 8, z: -from.z + (random() * 2 - 1) * 8 };

	const width = 0.7 + random() * 0.5;
	const bendAmount = 3 + random() * 5;
	const phase = random() * Math.PI * 2;

	const dx = to.x - from.x;
	const dz = to.z - from.z;
	const length = Math.hypot(dx, dz) || 1;
	// Перпендикуляр до русла — уздовж нього й гуляє звивина.
	const nx = -dz / length;
	const nz = dx / length;

	const steps = Math.max(20, Math.round(length / 1.2));
	const out: DecorItem[] = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const bend = Math.sin(t * Math.PI * 2 + phase) * bendAmount * Math.sin(t * Math.PI);
		out.push({
			kind: 'water',
			x: from.x + dx * t + nx * bend,
			z: from.z + dz * t + nz * bend,
			scale: width,
			turn: 0
		});
	}
	return out;
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
