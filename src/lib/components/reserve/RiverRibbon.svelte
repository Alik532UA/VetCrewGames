<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferAttribute, BufferGeometry } from 'three';
	import type { RiverPath } from '$lib/reserve/water';

	/**
	 * Річка — СМУГА, а не ланцюг кіл.
	 *
	 * Доти русло складалося з водних плям, поставлених щільно одна до одної. На
	 * екрані це читалося саме тим, чим було: намистом. Береги хвилювалися
	 * півколами, ширина стрибала на кожному стику, і милуватися там було нічим.
	 *
	 * Тепер це один меш: для кожної точки русла беруться дві вершини —
	 * ліворуч і праворуч від осі на півширину, — і між ними натягується
	 * трикутна смуга. Берег виходить рівним рівно настільки, наскільки рівна сама
	 * вісь, тобто природним.
	 *
	 * Геометрія збирається руками, а не з `TubeGeometry`: труба дала б обʼємний
	 * циліндр із дном і стінками, а річка — плоска.
	 */
	interface Props {
		path: RiverPath;
		color: string;
	}

	let { path, color }: Props = $props();

	const geometry = $derived.by(() => {
		const { points, width } = path;
		const positions = new Float32Array(points.length * 6);

		for (let i = 0; i < points.length; i++) {
			// Напрямок русла в цій точці: різниця з сусідом. На кінцях беремо
			// єдиного наявного сусіда, інакше нормаль вийшла б нульовою.
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
		 * Індекси: два трикутники на кожен проміжок між парами вершин. Смуга
		 * будується вручну, бо `TriangleStripDrawMode` у three давно прибрали.
		 */
		const indices: number[] = [];
		for (let i = 0; i < points.length - 1; i++) {
			const a = i * 2;
			indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
		}

		const out = new BufferGeometry();
		out.setAttribute('position', new BufferAttribute(positions, 3));
		out.setIndex(indices);
		out.computeVertexNormals();
		return out;
	});
</script>

<!-- Трохи вище за землю: інакше площини змагаються за ті самі пікселі. -->
<T.Mesh position={[0, 0.015, 0]} {geometry}>
	<T.MeshStandardMaterial {color} />
</T.Mesh>
