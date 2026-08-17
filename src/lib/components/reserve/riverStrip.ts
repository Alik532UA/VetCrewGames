import type { RiverPath } from '$lib/reserve/water';

/**
 * Смуга русла: вершини й трикутники, з яких складається річка.
 *
 * Винесено з компонента, щоб було ЩО перевірити. Річка не малювалася зовсім —
 * при цьому на мінікарті вона була, тобто дані приходили правильні, а зникала
 * саме геометрія. Причина в намотуванні: трикутники йшли так, що лице смуги
 * дивилося ВНИЗ, а `MeshStandardMaterial` типово малює лише лице. Камера
 * дивиться згори, отже бачила виворіт — і не бачила нічого.
 *
 * Такий збій неможливо помітити оком у коді й неможливо зловити перевіркою
 * компонента: обидві сторони однакові, доки не спитати, куди дивиться нормаль.
 * Тепер це питання ставить тест.
 */
export interface Strip {
	positions: Float32Array;
	indices: number[];
}

export function riverStrip(path: RiverPath): Strip {
	const { points, width } = path;
	const positions = new Float32Array(points.length * 6);

	for (let i = 0; i < points.length; i++) {
		/*
		 * Напрямок русла в цій точці — різниця з сусідом. На кінцях беремо єдиного
		 * наявного сусіда, інакше нормаль вийшла б нульовою.
		 */
		const previous = points[Math.max(0, i - 1)];
		const next = points[Math.min(points.length - 1, i + 1)];
		const dx = next.x - previous.x;
		const dz = next.z - previous.z;
		const length = Math.hypot(dx, dz) || 1;
		// Перпендикуляр у площині землі — уздовж нього й розходяться береги.
		const nx = -dz / length;
		const nz = dx / length;

		const half = width / 2;
		positions.set(
			[
				points[i].x + nx * half,
				0,
				points[i].z + nz * half,
				points[i].x - nx * half,
				0,
				points[i].z - nz * half
			],
			i * 6
		);
	}

	/*
	 * Два трикутники на кожен проміжок між парами вершин. Порядок вершин —
	 * ПРОТИ годинникової при погляді згори: саме він робить лице смуги верхнім.
	 * Смуга будується вручну, бо `TriangleStripDrawMode` у three давно прибрали.
	 */
	const indices: number[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const a = i * 2;
		indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
	}

	return { positions, indices };
}
