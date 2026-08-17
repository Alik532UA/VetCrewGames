<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrthographicCamera, Vector3 } from 'three';
	import { DEFAULT_ZOOM, isoControls } from './isoCamera';
	import type { MapView } from './mapView.svelte';
	import { CELL, placeEnclosures } from './sceneLayout';
	import { placementProblem, type PlacementProblem } from '$lib/reserve/placement';
	import { createPicker } from './picking';
	import PlotBorder from './PlotBorder.svelte';

	import { footprintOf, worldOf, type Cell } from '$lib/reserve/grid';
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
		/** Спільний стан огляду: сцена його звітує, мінікарта читає й наказує. */
		view: MapView;
		/** Півсторона ділянки: її дає репутація, і межа рухається разом із нею. */
		plotHalf: number;
		/**
		 * Розмір вольєра, який чекає місця; `null` — звичайний режим.
		 *
		 * Саме РОЗМІР, а не «так чи ні»: привид під пальцем мусить бути тієї
		 * величини, яка справді стане на землю, інакше він обіцяв би не те, що
		 * поставиться.
		 */
		placingSize: number | null;
		onGround: (cell: { x: number; z: number }) => void;
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let {
		biome,
		view,
		plotHalf,
		seed,
		enclosures,
		animals,
		selectedId,
		onSelect,
		placingSize,
		onGround
	}: Props = $props();

	const placing = $derived(placingSize !== null);

	/**
	 * Клітинка під пальцем і те, чи можна на неї ставити.
	 *
	 * Живе тут, а не на сторінці: сторінка не знає ні про промінь, ні про полотно,
	 * а без них питання «де палець» не має відповіді.
	 */
	let hover = $state<{ cell: Cell; problem: PlacementProblem } | null>(null);

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
	 * Хто й що під пальцем — питає `picking.ts`, а тут лишається лише РІШЕННЯ.
	 *
	 * Камера передається функцією: `<Canvas>` створює її не одночасно з розміткою,
	 * і посилання, взяте один раз, лишилося б `undefined` назавжди.
	 */
	const picker = createPicker(renderer.domElement as HTMLCanvasElement, scene, () => camera);

	function pick(clientX: number, clientY: number) {
		/*
		 * У режимі розміщення тап означає МІСЦЕ, а не вибір. Дві різні відповіді
		 * на один жест — саме те, чого гравець і чекає: спершу «куди», потім «кого».
		 */
		if (placing) {
			const cell = picker.cellAt(clientX, clientY);
			if (cell) onGround(cell);
			return;
		}
		const id = picker.animalAt(clientX, clientY);
		if (id !== null) onSelect(id);
	}

	/*
	 * Привид зникає, щойно режим розміщення скінчився.
	 *
	 * Без цього він лишався б висіти на карті після поставленого вольєра — а
	 * зелений квадрат, який ні на що не реагує, читається як поломка.
	 */
	$effect(() => {
		if (!placing) hover = null;
	});

	$effect(() => {
		const lens = camera;
		if (!lens) return;
		const canvas = renderer.domElement;

		/** Куди дивиться палець у режимі розміщення. Поза ним нічого не рахуємо. */
		const trace = (event: PointerEvent) => {
			if (!placing) return;
			const cell = picker.cellAt(event.clientX, event.clientY);
			hover = cell
				? { cell, problem: placementProblem(enclosures, cell, placingSize ?? 1, plotHalf) }
				: null;
			invalidate();
		};
		const forget = () => {
			hover = null;
			invalidate();
		};
		canvas.addEventListener('pointermove', trace);
		canvas.addEventListener('pointerleave', forget);

		/*
		 * Розмір вікна ділиться на масштаб ТУТ, а не в мінікарті: скільки пікселів
		 * має полотно, знає лише сцена. Мінікарта отримує вже світові одиниці й
		 * лишається чистою від рушія.
		 */
		const report = () =>
			view.report(
				target.x,
				target.z,
				lens.zoom,
				canvas.clientWidth / lens.zoom,
				canvas.clientHeight / lens.zoom
			);

		const controls = isoControls(
			canvas,
			lens,
			target,
			() => {
				invalidate();
				report();
			},
			pick
		);

		// Наказ ізвідти: мінікарта не чіпає камеру сама, вона просить сцену.
		const detach = view.attach((x: number, z: number, zoom: number) => {
			target.x = x;
			target.z = z;
			lens.zoom = zoom;
			controls.apply();
		});

		// Вікно змінило розмір — рамка на мінікарті мусить змінитися разом із ним.
		window.addEventListener('resize', report);
		report();

		return () => {
			canvas.removeEventListener('pointermove', trace);
			canvas.removeEventListener('pointerleave', forget);
			window.removeEventListener('resize', report);
			detach();
			controls.destroy();
		};
	});

	const placed = $derived(placeEnclosures(enclosures, animals));

	/** Слід привида у світі: центр і сторона рахуються як у справжнього вольєра. */
	const ghost = $derived.by(() => {
		if (!hover || placingSize === null) return null;
		const span = footprintOf(placingSize);
		const spot = worldOf(hover.cell);
		const shift = ((span - 1) * CELL) / 2;
		return {
			x: spot.x + shift,
			z: spot.z + shift,
			side: span * CELL - 0.3,
			// Колір — це та сама причина, з якою потім прийшла б відмова.
			colour: hover.problem ? '#e0574c' : '#7bd66f'
		};
	});
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
	Межа ділянки — пунктиром. Не паркан і не стіна: гравець мусить бачити, де
	закінчуються його права на забудову, і водночас бачити, що земля тягнеться далі.
-->
<PlotBorder half={plotHalf} />

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

<!--
	Привид майбутнього вольєра.

	Поки палець їздить по карті, видно і РОЗМІР сліду, і те, чи місце вільне. Доти
	гравець тицяв навмання й дізнавався про відмову тостом уже після дотику — тобто
	після того, як рішення ухвалене.
-->
{#if ghost}
	<T.Mesh position={[ghost.x, 0.04, ghost.z]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[ghost.side, ghost.side]} />
		<T.MeshBasicMaterial transparent opacity={0.35} color={ghost.colour} />
	</T.Mesh>
{/if}

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
