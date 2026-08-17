<script lang="ts">
	import { T } from '@threlte/core';
	import type { DecorItem } from '$lib/reserve/terrain';
	import { waterRadius } from '$lib/reserve/terrain';
	import type { ReserveBiome } from '$lib/reserve/species';

	/**
	 * Одна фігура рельєфу: дерево, куст, камінь, скеля або пляма води.
	 *
	 * Вісім родів, а не один із різним масштабом. Це не оздоба: біом мусить
	 * пізнаватися з першого погляду, а тундра з ялинок і скель виглядає тундрою
	 * лише тоді, коли ялинка не така сама, як пальма. Кожна фігура ще й
	 * повернута на власний кут — інакше однакові конуси рядком читаються як
	 * текстура, а не як ліс.
	 *
	 * Усе — примітиви. Проєкт забороняє агентові вигадувати зображення тварин, а
	 * для рослин і каміння вистачає конуса, сфери й багатогранника: вони чесно
	 * кажуть «тут ліс», нічого не вдаючи з себе.
	 */
	interface Props {
		item: DecorItem;
		biome: ReserveBiome;
	}

	let { item, biome }: Props = $props();

	/** Крона: у тропіках темніша, у тундрі вигоріла. */
	const LEAF: Record<ReserveBiome, string> = {
		forest: '#3f6b34',
		tundra: '#5e6e4f',
		savanna: '#7d8a45',
		rainforest: '#2f5c2a'
	};

	const TRUNK = '#6b4a2f';
	const STONE = '#8b8b86';

	const s = $derived(item.scale);
</script>

{#if item.kind === 'water'}
	<!-- 24 сегменти, а не 12: на 12 берег читався як правильний десятикутник. -->
	<T.Mesh position={[item.x, -0.06, item.z]}>
		<T.CylinderGeometry args={[waterRadius(s), waterRadius(s), 0.12, 24]} />
		<T.MeshStandardMaterial color="#3f7fa8" />
	</T.Mesh>
{:else if item.kind === 'spruce'}
	<!-- Ялина: три яруси, що звужуються догори. -->
	<T.Group position={[item.x, 0, item.z]} rotation.y={item.turn}>
		<T.Mesh position={[0, 0.25 * s, 0]}>
			<T.CylinderGeometry args={[0.06 * s, 0.09 * s, 0.5 * s, 5]} />
			<T.MeshStandardMaterial color={TRUNK} />
		</T.Mesh>
		{#each [0, 1, 2] as tier (tier)}
			<T.Mesh position={[0, (0.55 + tier * 0.42) * s, 0]}>
				<T.ConeGeometry args={[(0.62 - tier * 0.16) * s, 0.7 * s, 7]} />
				<T.MeshStandardMaterial color={LEAF[biome]} />
			</T.Mesh>
		{/each}
	</T.Group>
{:else if item.kind === 'broadleaf'}
	<!-- Листяне: округла крона на кривому стовбурі. -->
	<T.Group position={[item.x, 0, item.z]} rotation.y={item.turn}>
		<T.Mesh position={[0, 0.4 * s, 0]} rotation.z={0.06}>
			<T.CylinderGeometry args={[0.08 * s, 0.12 * s, 0.8 * s, 6]} />
			<T.MeshStandardMaterial color={TRUNK} />
		</T.Mesh>
		<T.Mesh position={[0, 1.15 * s, 0]} scale={[1, 0.82, 1]}>
			<T.IcosahedronGeometry args={[0.62 * s, 0]} />
			<T.MeshStandardMaterial color={LEAF[biome]} />
		</T.Mesh>
	</T.Group>
{:else if item.kind === 'palm'}
	<!--
		Пальма: високий стовбур і листя, що РОЗХОДИТЬСЯ віялом.

		Кожен лист лежить у власній групі, повернутій по Y, і вже ВСЕРЕДИНІ неї
		хилиться по Z. Перша версія задавала обидва повороти одному мешу —
		`rotation={[0.9, кут, 0]}` — і в порядку XYZ поворот по Y крутив уже
		похилений конус разом із його нахилом. Тож усі листки лягали в один бік, і
		пальма виглядала мітлою.
	-->
	<T.Group position={[item.x, 0, item.z]} rotation.y={item.turn}>
		<T.Mesh position={[0, 0.9 * s, 0]} rotation.z={0.1}>
			<T.CylinderGeometry args={[0.07 * s, 0.11 * s, 1.8 * s, 7]} />
			<T.MeshStandardMaterial color="#7d6238" />
		</T.Mesh>
		{#each [0, 1, 2, 3, 4, 5] as frond (frond)}
			<T.Group position={[0, 1.8 * s, 0]} rotation.y={(frond * Math.PI * 2) / 6}>
				<T.Mesh position={[0.5 * s, -0.12 * s, 0]} rotation.z={-1.15} scale={[1, 1, 0.35]}>
					<T.ConeGeometry args={[0.2 * s, 1.3 * s, 4]} />
					<T.MeshStandardMaterial color={LEAF[biome]} />
				</T.Mesh>
			</T.Group>
		{/each}
	</T.Group>
{:else if item.kind === 'bush'}
	<!-- Куст: дві сфери без стовбура, низько над землею. -->
	<T.Group position={[item.x, 0, item.z]} rotation.y={item.turn}>
		<T.Mesh position={[0, 0.22 * s, 0]} scale={[1, 0.7, 1]}>
			<T.IcosahedronGeometry args={[0.34 * s, 0]} />
			<T.MeshStandardMaterial color={LEAF[biome]} />
		</T.Mesh>
		<T.Mesh position={[0.22 * s, 0.16 * s, 0.14 * s]} scale={[1, 0.7, 1]}>
			<T.IcosahedronGeometry args={[0.24 * s, 0]} />
			<T.MeshStandardMaterial color={LEAF[biome]} />
		</T.Mesh>
	</T.Group>
{:else if item.kind === 'pebble'}
	<T.Mesh
		position={[item.x, 0.04 * s, item.z]}
		rotation={[item.turn, item.turn * 0.7, 0]}
		scale={[1, 0.6, 1]}
	>
		<T.DodecahedronGeometry args={[0.22 * s, 0]} />
		<T.MeshStandardMaterial color={STONE} />
	</T.Mesh>
{:else if item.kind === 'boulder'}
	<!-- Валун: більший і кутастіший за камінець, помітно вищий за траву. -->
	<T.Mesh
		position={[item.x, 0.3 * s, item.z]}
		rotation={[item.turn * 0.4, item.turn, 0]}
		scale={[1.2, 0.85, 1]}
	>
		<T.IcosahedronGeometry args={[0.55 * s, 0]} />
		<T.MeshStandardMaterial color="#7e7c76" />
	</T.Mesh>
{:else}
	<!-- Скеля: три уламки, що спираються один на одного. -->
	<T.Group position={[item.x, 0, item.z]} rotation.y={item.turn}>
		{#each [{ p: [0, 0.9 * s, 0] as [number, number, number], r: 1.5 * s, tilt: 0.08 }, { p: [0.7 * s, 0.55 * s, 0.3 * s] as [number, number, number], r: 1 * s, tilt: -0.18 }, { p: [-0.5 * s, 0.4 * s, -0.4 * s] as [number, number, number], r: 0.75 * s, tilt: 0.22 }] as shard, index (index)}
			<T.Mesh position={shard.p} rotation={[shard.tilt, index * 1.1, shard.tilt]}>
				<T.OctahedronGeometry args={[shard.r, 0]} />
				<T.MeshStandardMaterial color="#6f6d68" />
			</T.Mesh>
		{/each}
	</T.Group>
{/if}
