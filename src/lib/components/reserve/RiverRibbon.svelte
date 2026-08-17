<script lang="ts">
	import { T } from '@threlte/core';
	import { BufferAttribute, BufferGeometry } from 'three';
	import { riverStrip } from './riverStrip';
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
	 * циліндр із дном і стінками, а річка — плоска. Самі вершини рахує
	 * `riverStrip` — окремий модуль, бо саме там жила помилка, через яку річки не
	 * було видно взагалі, і тепер її стереже тест.
	 */
	interface Props {
		path: RiverPath;
		color: string;
	}

	let { path, color }: Props = $props();

	const geometry = $derived.by(() => {
		const { positions, indices } = riverStrip(path);
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
