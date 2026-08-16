<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrthographicCamera, Raycaster, Vector2, Vector3, type Object3D } from 'three';
	import { isoControls } from './isoCamera';
	import { placeAnimals } from './sceneLayout';
	import type { Animal } from '$lib/reserve/types';

	/**
	 * Вміст сцени: земля, вольєри, світло — і жодної моделі тварини.
	 *
	 * Фігури тут ПРИМІТИВИ навмисно, і це не заглушка з ліні: проєкт забороняє
	 * агентові вигадувати зображення тварин. Куб-вольєр і капсула на ньому чесно
	 * кажуть «тут живе мешканець», нічого не вдаючи з себе.
	 */
	interface Props {
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let { animals, selectedId, onSelect }: Props = $props();

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
	 * відпустили палець. Це рівно та поведінка, яка на телефоні відчувається як
	 * «гра сама щось натискає». Друга — ще один пакет заради двадцяти рядків.
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
	 * Керування чіпляється в `$effect`, а не в `onMount`.
	 *
	 * `<Canvas>` створює свої обʼєкти не одночасно з монтуванням розмітки, тож
	 * на момент `onMount` камери ще може не бути. Раніше тут стояло
	 * `if (!camera) return` — і це найгірший різновид помилки: сцена малюється,
	 * жодного повідомлення немає, просто нічого не рухається й не натискається.
	 * Ефект чекає, доки камера зʼявиться, скільки б це не зайняло.
	 */
	$effect(() => {
		if (!camera) return;
		const controls = isoControls(renderer.domElement, camera, target, invalidate, pick);
		return () => controls.destroy();
	});

	const placed = $derived(placeAnimals(animals));

	/** Колір каже про стан: одужує — теплий, здорова — зелена. */
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
	<T.BoxGeometry args={[60, 1, 60]} />
	<T.MeshStandardMaterial color="#6f8f5a" />
</T.Mesh>

{#each placed as { animal, x, z } (animal.id)}
	<T.Group position={[x, 0, z]} userData={{ animalId: animal.id }}>
		<T.Mesh position={[0, 0.1, 0]}>
			<T.BoxGeometry args={[1.8, 0.2, 1.8]} />
			<T.MeshStandardMaterial color={animal.id === selectedId ? '#ffd54f' : '#9a7b4f'} />
		</T.Mesh>

		<!-- Мешканець: капсула, а не модель. Див. докблок файлу. -->
		<T.Mesh position={[0, 0.65, 0]}>
			<T.CapsuleGeometry args={[0.28, 0.5, 4, 8]} />
			<T.MeshStandardMaterial color={colorOf(animal)} />
		</T.Mesh>
	</T.Group>
{/each}
