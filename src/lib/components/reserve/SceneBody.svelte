<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3, type Object3D } from 'three';
	import { DEFAULT_ZOOM, isoControls } from './isoCamera';
	import { placeEnclosures } from './sceneLayout';
	import { RESERVE_RADIUS } from '$lib/reserve/constants';
	import { cellOf } from '$lib/reserve/grid';
	import { nearWater, terrainOf, WORLD_RADIUS } from '$lib/reserve/terrain';
	import DecorPiece from './DecorPiece.svelte';
	import EnclosureShape from './EnclosureShape.svelte';
	import RiverRibbon from './RiverRibbon.svelte';
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
		/** Увімкнено режим розміщення: наступний тап по землі ставить вольєр. */
		placing: boolean;
		onGround: (cell: { x: number; z: number }) => void;
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let { biome, seed, enclosures, animals, selectedId, onSelect, placing, onGround }: Props =
		$props();

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
	/** Площина землі: промінь шукає перетин саме з нею, а не з мешем. */
	const GROUND_PLANE = new Plane(new Vector3(0, 1, 0), 0);

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

		/*
		 * У режимі розміщення тап означає МІСЦЕ, а не вибір. Дві різні відповіді
		 * на один жест — саме те, чого гравець і чекає: спершу «куди», потім «кого».
		 */
		if (placing) {
			const cell = groundCellAt(clientX, clientY);
			if (cell) onGround(cell);
			return;
		}
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
	/**
	 * Куди на землі влучив палець, у клітинках сітки.
	 *
	 * Промінь перетинається з площиною y = 0, а не з мешем землі: земля — тонка
	 * коробка, і промінь, що прийшов збоку, влучив би в її бік, а не у верх.
	 */
	function groundCellAt(clientX: number, clientY: number) {
		if (!camera) return null;
		const box = renderer.domElement.getBoundingClientRect();
		pointer.x = ((clientX - box.left) / box.width) * 2 - 1;
		pointer.y = -((clientY - box.top) / box.height) * 2 + 1;
		raycaster.setFromCamera(pointer, camera);

		const hit = raycaster.ray.intersectPlane(GROUND_PLANE, new Vector3());
		return hit ? cellOf(hit.x, hit.z) : null;
	}

	$effect(() => {
		if (!camera) return;
		const controls = isoControls(renderer.domElement, camera, target, invalidate, pick);
		return () => controls.destroy();
	});

	/**
	 * Пунктир по колу межі: рівні проміжки, кожна плитка повернута по дотичній.
	 *
	 * Коло, а не квадрат, бо саме коло й перевіряє ядро (`hypot > RESERVE_RADIUS`).
	 * Малювати квадрат означало б показувати межу, якої немає.
	 */
	const DASH_LENGTH = 1.1;
	const dashes = $derived.by(() => {
		const circumference = 2 * Math.PI * RESERVE_RADIUS;
		const count = Math.round(circumference / (DASH_LENGTH * 2));
		return Array.from({ length: count }, (_, i) => {
			const angle = (i / count) * Math.PI * 2;
			return {
				key: i,
				x: Math.cos(angle) * RESERVE_RADIUS,
				z: Math.sin(angle) * RESERVE_RADIUS,
				// Плитка лежить уздовж кола: дотична — це кут плюс 90°.
				turn: -angle
			};
		});
	});

	const placed = $derived(placeEnclosures(enclosures, animals));
	const terrain = $derived(terrainOf(biome, seed));

	/**
	 * Земля рівно така, щоб укрити рельєф із запасом на два кроки.
	 *
	 * Удвічі більша за радіус рельєфу навмисно: карта не має ОБРИВАТИСЯ на око.
	 * Природа не закінчується там, де закінчується твоя ділянка, — вона просто
	 * стає рідшою, а далі йде рівна земля до горизонту.
	 */
	const GROUND_SIDE = WORLD_RADIUS * 4;

	/** Колір ґрунту біома. Тундра сіра, тропіки темно-зелені. */
	const GROUND: Record<ReserveBiome, string> = {
		forest: '#6f8f5a',
		tundra: '#9aa7a8',
		savanna: '#c2a95f',
		rainforest: '#4c7a43'
	};
</script>

<T.OrthographicCamera
	bind:ref={camera}
	makeDefault
	position={[14, 14, 14]}
	zoom={DEFAULT_ZOOM}
	near={-200}
/>

<T.AmbientLight intensity={1.4} />
<T.DirectionalLight position={[8, 14, 6]} intensity={2.2} />

<!--
	Земля — тонка коробка, а не площина: у площини немає боків, і на ізометрії
	заповідник виглядав би наліпкою, а не місцем.
-->
<T.Mesh position={[0, -0.55, 0]}>
	<T.BoxGeometry args={[GROUND_SIDE, 1, GROUND_SIDE]} />
	<T.MeshStandardMaterial color={GROUND[biome]} />
</T.Mesh>

<!--
	Межа ділянки — пунктиром.

	Не паркан і не стіна: гравець мусить БАЧИТИ, де закінчуються його права на
	забудову, і водночас бачити, що земля тягнеться далі. Пунктир зроблений
	короткими плитками, а не `LineDashedMaterial`: тому вимагає
	`computeLineDistances()` на кожній зміні геометрії, а плитки просто лежать
	там, де порахували.
-->
{#each dashes as dash (dash.key)}
	<T.Mesh position={[dash.x, 0.02, dash.z]} rotation.y={dash.turn}>
		<T.BoxGeometry args={[DASH_LENGTH, 0.04, 0.12]} />
		<T.MeshStandardMaterial color="#f0e6c8" />
	</T.Mesh>
{/each}

<!--
	Рельєф біома. Детермінований: та сама партія — той самий краєвид.
	Кожна фігура малюється `DecorPiece`: вісім родів замість одного конуса
	різного розміру.
-->
{#each terrain.rivers as path, index (index)}
	<RiverRibbon {path} color="#3f7fa8" />
{/each}

{#each terrain.items as item, index (`${item.kind}-${index}`)}
	<DecorPiece {item} {biome} />
{/each}

{#each placed as spot (spot.enclosure.id)}
	<EnclosureShape
		hasWater={nearWater(terrain, spot.x, spot.z)}
		animal={spot.animal}
		x={spot.x}
		z={spot.z}
		span={spot.span}
		selected={spot.animal !== null && spot.animal.id === selectedId}
	/>
{/each}
