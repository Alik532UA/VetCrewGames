<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrthographicCamera, Raycaster, Vector2, Vector3, type Object3D } from 'three';
	import { isoControls } from './isoCamera';
	import { placeEnclosures } from './sceneLayout';
	import { nearWater, terrainOf } from '$lib/reserve/terrain';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Animal, Enclosure } from '$lib/reserve/types';

	/**
	 * Вміст сцени: земля біома, рельєф, вольєри — і жодної моделі тварини.
	 *
	 * Фігури тут ПРИМІТИВИ навмисно, і це не заглушка з ліні: проєкт забороняє
	 * агентові вигадувати зображення тварин. Куб-вольєр і капсула на ньому чесно
	 * кажуть «тут живе мешканець», нічого не вдаючи з себе.
	 */
	interface Props {
		biome: ReserveBiome;
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let { biome, seed, enclosures, animals, selectedId, onSelect }: Props = $props();

	const { invalidate, renderer, scene } = useThrelte();

	/**
	 * Ізометрія — це поворот на 45° по горизонталі й ~35° над обрієм. Вектор
	 * (1, 1, 1) дає рівно його, тому камера й стоїть саме там.
	 *
	 * `near` відʼємний навмисно: в ортографічної камери площина відсікання
	 * рахується від самої камери, і при нулі найближчі вольєри зникали б,
	 * щойно масштаб наблизить їх до неї.
	 */
	const target = new Vector3(0, 0, 0);
	let camera: OrthographicCamera | undefined = $state();

	/**
	 * Вибір тварини — власний промінь, а не плагін `interactivity` з
	 * `@threlte/extras`.
	 *
	 * Причин дві, і перша важливіша. Плагін не відрізняє тап від перетягування:
	 * кожне панорамування закінчувалося б вибором тварини, над якою випадково
	 * відпустили палець. Друга — ще один пакет заради двадцяти рядків.
	 */
	const raycaster = new Raycaster();
	const pointer = new Vector2();

	/** Мешканця несе ГРУПА, а промінь влучає в меш — шукаємо вгору по батьках. */
	function animalIdAt(object: Object3D): number | null {
		for (let node: Object3D | null = object; node; node = node.parent) {
			const id = node.userData?.animalId;
			if (typeof id === 'number') return id;
		}
		return null;
	}

	function pick(clientX: number, clientY: number) {
		if (!camera) return;
		const box = renderer.domElement.getBoundingClientRect();
		pointer.x = ((clientX - box.left) / box.width) * 2 - 1;
		pointer.y = -((clientY - box.top) / box.height) * 2 + 1;

		raycaster.setFromCamera(pointer, camera);
		for (const hit of raycaster.intersectObjects(scene.children, true)) {
			const id = animalIdAt(hit.object);
			if (id !== null) {
				onSelect(id);
				return;
			}
		}
	}

	/**
	 * Керування чіпляється в `$effect`, а не в `onMount`: `<Canvas>` створює свої
	 * обʼєкти не одночасно з монтуванням розмітки, тож на момент `onMount` камери
	 * ще може не бути. Раніше тут стояло `if (!camera) return` — і це найгірший
	 * різновид помилки: сцена малюється, повідомлень немає, просто нічого не
	 * рухається й не натискається.
	 */
	$effect(() => {
		if (!camera) return;
		const controls = isoControls(renderer.domElement, camera, target, invalidate, pick);
		return () => controls.destroy();
	});

	const placed = $derived(placeEnclosures(enclosures, animals));
	const terrain = $derived(terrainOf(biome, seed));

	/** Колір ґрунту біома. Тундра сіра, тропіки темно-зелені. */
	const GROUND: Record<ReserveBiome, string> = {
		forest: '#6f8f5a',
		tundra: '#9aa7a8',
		savanna: '#c2a95f',
		rainforest: '#4c7a43'
	};

	const PLANT: Record<ReserveBiome, string> = {
		forest: '#3f6b34',
		tundra: '#6b7a5a',
		savanna: '#7d8a45',
		rainforest: '#2f5c2a'
	};

	/** Колір мешканця каже про стан: одужує — теплий, здорова — зелена. */
	const colorOf = (animal: Animal) => (animal.stage === 'healthy' ? '#4caf50' : '#c98a3c');
</script>

<T.OrthographicCamera bind:ref={camera} makeDefault position={[14, 14, 14]} zoom={54} near={-200} />

<T.AmbientLight intensity={1.4} />
<T.DirectionalLight position={[8, 14, 6]} intensity={2.2} />

<!--
	Земля — тонка коробка, а не площина: у площини немає боків, і на ізометрії
	заповідник виглядав би наліпкою, а не місцем.
-->
<T.Mesh position={[0, -0.55, 0]}>
	<T.BoxGeometry args={[80, 1, 80]} />
	<T.MeshStandardMaterial color={GROUND[biome]} />
</T.Mesh>

<!-- Рельєф біома. Детермінований: та сама партія — той самий краєвид. -->
{#each terrain as item, index (`${item.kind}-${index}`)}
	{#if item.kind === 'water'}
		<T.Mesh position={[item.x, -0.08, item.z]}>
			<T.CylinderGeometry args={[1.5 * item.scale, 1.5 * item.scale, 0.12, 12]} />
			<T.MeshStandardMaterial color="#3f7fa8" />
		</T.Mesh>
	{:else if item.kind === 'plant'}
		<T.Group position={[item.x, 0, item.z]}>
			<T.Mesh position={[0, 0.3 * item.scale, 0]}>
				<T.CylinderGeometry args={[0.07, 0.1, 0.6 * item.scale, 5]} />
				<T.MeshStandardMaterial color="#6b4a2f" />
			</T.Mesh>
			<T.Mesh position={[0, 0.85 * item.scale, 0]}>
				<T.ConeGeometry args={[0.55 * item.scale, 1.1 * item.scale, 7]} />
				<T.MeshStandardMaterial color={PLANT[biome]} />
			</T.Mesh>
		</T.Group>
	{:else}
		<T.Mesh position={[item.x, 0.05, item.z]}>
			<T.DodecahedronGeometry args={[0.4 * item.scale, 0]} />
			<T.MeshStandardMaterial color="#8b8b86" />
		</T.Mesh>
	{/if}
{/each}

{#each placed as { enclosure, animal, x, z } (enclosure.id)}
	{@const side = 0.6 + enclosure.size * 0.16}
	<T.Group position={[x, 0, z]} userData={{ animalId: animal?.id }}>
		<!-- Підлога вольєра: що більший розмір, то ширша. -->
		<T.Mesh position={[0, 0.1, 0]}>
			<T.BoxGeometry args={[side, 0.2, side]} />
			<T.MeshStandardMaterial color={animal && animal.id === selectedId ? '#ffd54f' : '#9a7b4f'} />
		</T.Mesh>

		<!--
			Штучна водойма. Ставиться лише тоді, коли поруч НЕМАЄ природної: у цьому
			й сенс того, що рельєф не декорація — місце під вольєр не байдуже, і
			видно це просто на карті.
		-->
		{#if !nearWater(terrain, x, z)}
			<T.Mesh position={[side * 0.28, 0.21, side * 0.28]}>
				<T.CylinderGeometry args={[side * 0.16, side * 0.16, 0.06, 10]} />
				<T.MeshStandardMaterial color="#4a9ec4" />
			</T.Mesh>
		{/if}

		{#if animal}
			<!-- Мешканець: капсула, а не модель. Див. докблок файлу. -->
			<T.Mesh position={[0, 0.65, 0]}>
				<T.CapsuleGeometry args={[0.28, 0.5, 4, 8]} />
				<T.MeshStandardMaterial color={colorOf(animal)} />
			</T.Mesh>
		{/if}
	</T.Group>
{/each}
