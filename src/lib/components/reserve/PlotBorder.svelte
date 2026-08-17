<script lang="ts">
	import { T } from '@threlte/core';

	/**
	 * Межа ділянки — пунктирним КВАДРАТОМ.
	 *
	 * Квадрат, бо саме квадрат перевіряє ядро. Доти тут було коло, і воно
	 * розходилося з правилом двічі: будують по клітинках, а коло різало кутові
	 * навпіл, і межа рухається з репутацією, а радіус був константою. Показувати
	 * межу, якої немає, гірше, ніж не показувати жодної.
	 *
	 * Не паркан і не стіна: гравець мусить бачити, де закінчуються його права на
	 * забудову, і водночас бачити, що земля тягнеться далі.
	 *
	 * Пунктир зроблений короткими плитками, а не `LineDashedMaterial`: той вимагає
	 * `computeLineDistances()` на кожній зміні геометрії, а плитки просто лежать
	 * там, де їх порахували.
	 */
	interface Props {
		/** Півсторона ділянки у світових одиницях. Її дає репутація. */
		half: number;
	}

	let { half }: Props = $props();

	const DASH_LENGTH = 1.1;

	const dashes = $derived.by(() => {
		const step = DASH_LENGTH * 2;
		const perSide = Math.max(2, Math.round((half * 2) / step));
		const out: Array<{ key: string; x: number; z: number; turn: number }> = [];

		for (let i = 0; i < perSide; i++) {
			// Центр плитки, а не її край: інакше кут виїжджав би за межу на пів плитки.
			const along = -half + ((i + 0.5) * (half * 2)) / perSide;
			out.push({ key: `n${i}`, x: along, z: -half, turn: 0 });
			out.push({ key: `s${i}`, x: along, z: half, turn: 0 });
			out.push({ key: `w${i}`, x: -half, z: along, turn: Math.PI / 2 });
			out.push({ key: `e${i}`, x: half, z: along, turn: Math.PI / 2 });
		}
		return out;
	});
</script>

{#each dashes as dash (dash.key)}
	<T.Mesh position={[dash.x, 0.02, dash.z]} rotation.y={dash.turn}>
		<T.BoxGeometry args={[DASH_LENGTH, 0.04, 0.12]} />
		<T.MeshStandardMaterial color="#f0e6c8" />
	</T.Mesh>
{/each}
