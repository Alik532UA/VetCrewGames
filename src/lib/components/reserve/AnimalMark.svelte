<script lang="ts">
	import { T } from '@threlte/core';
	import type { Beast } from './anatomy';
	import { bone, spur, hipY, backY, headX, headY, noseX } from './figure';

	/**
	 * Прикмета виду: роги, ріг, хобот, грива, колючки, смуги, плями.
	 *
	 * Окремим файлом, бо це РІЗНІ речі з однією роллю. Пропорції тулуба ще можна
	 * звести до спільної формули — прикмету не можна: у рогів гілки, у хобота
	 * згин, у смуг крок. Разом із тулубом вони не влізли б у межу розміру файлу, і
	 * головне — заплутали б обидві частини.
	 *
	 * Саме прикмета й робить силует пізнаваним. Без неї носоріг і слон — два сірих
	 * овали, а олень і кінь відрізняються лише товщиною. Тому вона рахується від
	 * тих самих чисел, що й тулуб, а не приставляється на око.
	 */
	interface Props {
		body: Beast;
	}

	let { body }: Props = $props();

	const b = $derived(body);

	/** Роги: головна гілка вгору-назад, від неї два відростки. */
	const beam = $derived(
		spur(headX(b) - b.head * 0.2, headY(b) + b.head * 0.5, -0.3, 1, b.head * 1.9)
	);
	const tines = $derived([
		spur(beam.x, beam.y, 0.75, 0.66, b.head * 0.8),
		spur(beam.x - b.head * 0.15, beam.y + b.head * 0.6, -0.8, 0.6, b.head * 0.7)
	]);

	/** Ріг носорога росте з кінчика писка вперед і вгору. */
	const horn = $derived(
		spur(noseX(b) - b.head * 0.45, headY(b) - b.head * 0.25, 0.7, 0.72, b.head * 1.15)
	);

	/**
	 * Хобот — ланцюжок ланок, а не один конус: він мусить ЗГИНАТИСЯ, інакше це
	 * бурулька. Кожна ланка тонша за попередню; кінець лишається над землею.
	 */
	const trunkPath = $derived([
		{ x: headX(b) + b.head * 0.5, y: headY(b) - b.head * 0.1 },
		{ x: headX(b) + b.head * 0.95, y: headY(b) - b.head * 0.9 },
		{ x: headX(b) + b.head * 1.0, y: headY(b) - b.head * 1.7 },
		{ x: headX(b) + b.head * 1.3, y: headY(b) - b.head * 2.15 }
	]);
	const trunk = $derived(
		trunkPath.slice(0, -1).map((from, i) => ({
			part: bone(from.x, from.y, trunkPath[i + 1].x, trunkPath[i + 1].y),
			girth: b.head * (0.3 - i * 0.06)
		}))
	);

	/** Колючки: два ряди над спиною, кожен ряд похилений назовні. */
	const spines = [-0.3, -0.1, 0.1, 0.28].flatMap((along) =>
		[-1, 1].map((side) => ({ along, side }))
	);

	const stripes = [-0.28, 0, 0.26];

	/** Плями: п'ять на бік, по верхньому боку тулуба. */
	const spots = [
		{ x: 0.22, y: 0.3, z: 0.5 },
		{ x: 0.02, y: 0.42, z: 0.34 },
		{ x: -0.18, y: 0.34, z: 0.52 },
		{ x: -0.3, y: 0.18, z: 0.4 },
		{ x: 0.12, y: 0.16, z: 0.6 }
	];
</script>

{#if b.mark === 'antlers'}
	{#each [-1, 1] as side (side)}
		<T.Group position={[0, 0, side * b.head * 0.4]}>
			<T.Mesh position={[beam.x, beam.y, 0]} rotation.z={beam.tilt}>
				<T.CylinderGeometry args={[b.head * 0.06, b.head * 0.11, beam.length, 5]} />
				<T.MeshStandardMaterial color={b.trim} />
			</T.Mesh>
			{#each tines as tine, index (index)}
				<T.Mesh position={[tine.x, tine.y, 0]} rotation.z={tine.tilt}>
					<T.ConeGeometry args={[b.head * 0.07, tine.length, 4]} />
					<T.MeshStandardMaterial color={b.trim} />
				</T.Mesh>
			{/each}
		</T.Group>
	{/each}
{:else if b.mark === 'horn'}
	<T.Mesh position={[horn.x, horn.y, 0]} rotation.z={horn.tilt}>
		<T.ConeGeometry args={[b.head * 0.22, horn.length, 6]} />
		<T.MeshStandardMaterial color={b.trim} />
	</T.Mesh>
{:else if b.mark === 'trunk'}
	{#each trunk as link, index (index)}
		<T.Mesh position={[link.part.x, link.part.y, 0]} rotation.z={link.part.tilt}>
			<T.CylinderGeometry args={[link.girth * 0.7, link.girth, link.part.length * 1.15, 6]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>
	{/each}
	<!-- Ікла: короткі, обабіч хобота. Слон без них читається як тапір. -->
	{#each [-1, 1] as side (side)}
		<T.Mesh
			position={[headX(b) + b.head * 0.75, headY(b) - b.head * 0.7, side * b.head * 0.35]}
			rotation.z={-0.9}
		>
			<T.ConeGeometry args={[b.head * 0.09, b.head * 0.9, 5]} />
			<T.MeshStandardMaterial color="#e6e2d5" />
		</T.Mesh>
	{/each}
{:else if b.mark === 'mane'}
	<!-- Грива — сплюснута куля навколо стику шиї й голови, темніша за тіло. -->
	<T.Mesh position={[headX(b) - b.head * 0.4, headY(b) - b.head * 0.05, 0]} scale={[0.55, 1, 1]}>
		<T.SphereGeometry args={[b.head * 1.4, 9, 6]} />
		<T.MeshStandardMaterial color={b.trim} />
	</T.Mesh>
{:else if b.mark === 'spines'}
	<!--
		Спершу темна «шапка» на спині, потім самі колючки. Одні конуси читалися б
		як реп'ях: у їжака колюча вся спина, а не сім окремих голок.
	-->
	<T.Mesh position={[-b.len * 0.04, backY(b) - b.tall * 0.28, 0]} scale={[1, 0.55, 0.88]}>
		<T.SphereGeometry args={[b.len * 0.44, 9, 6]} />
		<T.MeshStandardMaterial color={b.trim} />
	</T.Mesh>
	{#each spines as spine, index (index)}
		<T.Mesh
			position={[b.len * spine.along, backY(b) + b.tall * 0.16, spine.side * b.wide * 0.3]}
			rotation.z={-spine.along * 0.6}
			rotation.x={-spine.side * 0.5}
		>
			<T.ConeGeometry args={[b.tall * 0.11, b.tall * 0.62, 4]} />
			<T.MeshStandardMaterial color={b.trim} />
		</T.Mesh>
	{/each}
{:else if b.mark === 'stripes'}
	<!--
		Смуга — той самий переріз тулуба, лише на три відсотки більший: так вона
		обіймає капсулу без кутів, які лишила б коробка.
	-->
	{#each stripes as along (along)}
		<T.Mesh
			position={[b.len * along, hipY(b), 0]}
			rotation.z={Math.PI / 2}
			scale={[1, 1, b.wide / b.tall]}
		>
			<T.CylinderGeometry args={[b.tall * 0.515, b.tall * 0.515, b.len * 0.06, 12]} />
			<T.MeshStandardMaterial color={b.trim} />
		</T.Mesh>
	{/each}
{:else if b.mark === 'spots'}
	{#each spots as spot, index (index)}
		{#each [-1, 1] as side (side)}
			<T.Mesh
				position={[b.len * spot.x, hipY(b) + b.tall * spot.y, side * b.wide * spot.z]}
				scale={[1, 0.6, 1]}
			>
				<T.IcosahedronGeometry args={[b.tall * 0.13, 0]} />
				<T.MeshStandardMaterial color={b.trim} />
			</T.Mesh>
		{/each}
	{/each}
{/if}
