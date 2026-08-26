<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { OrthographicCamera, Vector3 } from 'three';
	import { DEFAULT_ZOOM, isoControls } from './isoCamera';
	import type { MapView } from './mapView.svelte';
	import { CELL, placeEnclosures } from './sceneLayout';
	import { placementProblem, type PlacementProblem } from '$lib/reserve/placement';
	import { createPicker } from './picking';
	import { footprintOf, worldOf, type Cell } from '$lib/reserve/grid';
	import { terrainOf } from '$lib/reserve/terrain';
	import EnclosureShape from './EnclosureShape.svelte';
	import SceneWorld from './SceneWorld.svelte';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Animal, Enclosure } from '$lib/reserve/types';

	/**
	 * Те, з чим гравець ПРАЦЮЄ: камера, тапи, вольєри, привид майбутньої будівлі.
	 *
	 * Земля, річки й рельєф переїхали в `SceneWorld` — там немає жодного
	 * оброблювача, і саме за цією ознакою пройшов розріз. Рельєф лишається тут
	 * пропсом для обох: він потрібен і щоб намалювати ліс, і щоб знати, чи є біля
	 * вольєра вода.
	 *
	 * Усі фігури — ПРИМІТИВИ: проєкт забороняє агентові вигадувати зображення
	 * тварин. Силует мешканця складають конус, куля й циліндр — див. `anatomy.ts`.
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
		/**
		 * Скільки рельєфу вже стоїть на сцені: 0 → 1.
		 *
		 * Не косметика для смужки, а єдиний спосіб показати, що сторінка жива:
		 * рельєфу тут шістсот сімдесят фігур, і разом вони блокували головний потік
		 * на дві з половиною секунди — виміряно однією задачею на 2663 мс.
		 */
		onProgress: (done: number) => void;
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		/** `id` вибраної тварини; підсвічує її вольєр. */
		selectedId: number | null;
		/** `id` вибраного ВОЛЬЄРА: у нього тепер своє меню, і його теж видно. */
		selectedEnclosureId: number | null;
		/**
		 * Тап по карті. Вибір один на двох: узяти водночас і вольєр, і його мешканця
		 * означало б два вікна на тому самому місці, і одне з них — під іншим.
		 */
		onSelect: (kind: 'animal' | 'enclosure', id: number) => void;
	}

	let {
		biome,
		view,
		plotHalf,
		seed,
		enclosures,
		animals,
		selectedId,
		selectedEnclosureId,
		onSelect,
		placingSize,
		onGround,
		onProgress
	}: Props = $props();

	const placing = $derived(placingSize !== null);

	/**
	 * Клітинка під пальцем і те, чи можна на неї ставити.
	 *
	 * Живе тут, а не на сторінці: сторінка не знає ні про промінь, ні про полотно,
	 * а без них питання «де палець» не має відповіді.
	 */
	let hover = $state<{ cell: Cell; problem: PlacementProblem } | null>(null);

	/**
	 * ЯКА ТВАРИНА ПІД КУРСОРОМ. `null` — жодна.
	 *
	 * Потрібно рівно для одного: смужки стану над твариною стоять на 30%, а під
	 * курсором стають непрозорими (`AnimalVitals`). Тап туди ж не веде — він
	 * ВИБИРАЄ, і вибір робить те саме через `selected`, бо на телефоні наведення
	 * не існує.
	 *
	 * Живе тут, бо тут промінь: сторінка про полотно не знає.
	 */
	let hovered = $state<number | null>(null);

	/**
	 * Як часто питати промінь, поки курсор їде.
	 *
	 * `pointermove` приходить під сотню разів на секунду, а промінь шукає по всій
	 * сцені — а це шістсот сімдесят фігур рельєфу плюс вольєри. Вісімдесят
	 * мілісекунд — дванадцять запитів на секунду: людина зміни підсвітки на такій
	 * частоті не відрізняє, а роботи вдвадцятеро менше.
	 *
	 * Малюємо ж лише коли підсвітка СПРАВДІ змінилася: сцена працює в режимі
	 * on-demand (`invalidate`), і кадр без причини тут дорожчий за сам промінь.
	 */
	const HOVER_EVERY_MS = 80;
	let lastProbe = 0;

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
		const found = picker.at(clientX, clientY);
		if (found) onSelect(found.kind, found.id);
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

		/** Куди дивиться палець: у режимі розміщення — клітинка, поза ним — тварина. */
		const trace = (event: PointerEvent) => {
			if (placing) {
				const cell = picker.cellAt(event.clientX, event.clientY);
				hover = cell
					? { cell, problem: placementProblem(enclosures, cell, placingSize ?? 1, plotHalf) }
					: null;
				invalidate();
				return;
			}

			const now = performance.now();
			if (now - lastProbe < HOVER_EVERY_MS) return;
			lastProbe = now;

			const found = picker.at(event.clientX, event.clientY);
			const next = found?.kind === 'animal' ? found.id : null;
			if (next === hovered) return;
			hovered = next;
			invalidate();
		};
		const forget = () => {
			hover = null;
			hovered = null;
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
</script>

<T.OrthographicCamera
	bind:ref={camera}
	makeDefault
	position={[14, 14, 14]}
	zoom={DEFAULT_ZOOM}
	near={-200}
/>

<SceneWorld {biome} {terrain} {plotHalf} {onProgress} />

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
		enclosure={spot.enclosure}
		animal={spot.animal}
		x={spot.x}
		z={spot.z}
		span={spot.span}
		selected={spot.enclosure.id === selectedEnclosureId ||
			(spot.animal !== null && spot.animal.id === selectedId)}
		hovered={spot.animal !== null && spot.animal.id === hovered}
	/>
{/each}
