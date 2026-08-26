<script lang="ts">
	import { onMount } from 'svelte';
	import ReserveMinimap from './ReserveMinimap.svelte';
	import SceneLoading from './SceneLoading.svelte';
	import { MapView } from './mapView.svelte';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Animal, Enclosure } from '$lib/reserve/types';

	/**
	 * Карта і все, чим по ній рухаються: сцена, мінікарта, масштаб.
	 *
	 * Тримається окремо від сторінки, бо в неї своя турбота — ПОКАЗ місця. Сторінка
	 * знає правила й команди; тут лише «куди дивимося» і «що під пальцем». Спільний
	 * стан огляду теж живе тут: обидва його користувачі — сцена й мінікарта — саме
	 * тут і зустрічаються, а сторінці про камеру знати нічого.
	 */
	interface Props {
		biome: ReserveBiome;
		/** Зерно партії: краєвид детермінований, як і все інше. */
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		/** `id` вибраної тварини; підсвічує її вольєр. */
		selectedId: number | null;
		/** `id` вибраного ВОЛЬЄРА: у нього тепер своє меню, і його теж видно. */
		selectedEnclosureId: number | null;
		/** Час іде — тварини у вольєрах ходять (`SceneBody`). */
		running: boolean;
		/**
		 * Тап по карті. Вибір один на двох: узяти водночас і вольєр, і його мешканця
		 * означало б два вікна на тому самому місці, і одне з них — під іншим.
		 */
		onSelect: (kind: 'animal' | 'enclosure', id: number) => void;
		/** Розмір вольєра, який чекає місця; `null` — звичайний режим. */
		placingSize: number | null;
		onGround: (cell: { x: number; z: number }) => void;
		/** Мінікарта зайва, коли поверх карти вже відкрита панель. */
		showMinimap: boolean;
		/** Півсторона ділянки: її дає репутація, і межа рухається разом із нею. */
		plotHalf: number;
	}

	let {
		biome,
		seed,
		enclosures,
		animals,
		selectedId,
		selectedEnclosureId,
		running,
		onSelect,
		placingSize,
		onGround,
		showMinimap,
		plotHalf
	}: Props = $props();

	/** Куди дивиться камера. Спільне для сцени й мінікарти — обидві його міняють. */
	const view = new MapView();

	/**
	 * Сцена приходить `import()`-ом, і саме тому вона не в цьому файлі.
	 *
	 * `three` важить більше, ніж увесь інший JS сайту разом. Статичний імпорт
	 * поклав би його в чанк маршруту; динамічний лишає окремим файлом, який
	 * завантажує лише той, хто в заповідник справді зайшов.
	 */
	let Scene = $state<typeof import('./ReserveScene.svelte').default | null>(null);

	/**
	 * Скільки заповідника вже стоїть: 0 → 1.
	 *
	 * Нуль означає й «рушій ще їде мережею», і «сцена ще не почалася» — для гравця
	 * це той самий стан очікування, і розділяти його двома різними смужками нема
	 * чого. Одиниця прибирає смужку.
	 */
	let built = $state(0);

	onMount(() => {
		import('./ReserveScene.svelte').then((module) => {
			Scene = module.default;
		});
	});
</script>

<!--
	Карта — ТЛО сторінки, а не рядок у стовпці.

	Доти вона стояла між шапкою й смугою кнопок і отримувала те, що лишилося: на
	320×640 це виявилося 220px, тобто третина екрана. Тепер вона розкладена на всю
	площу, а показники й кнопки лежать поверх — на телефоні це єдиний спосіб дати
	карті весь екран, не ховаючи керування.
-->
<div class="stage">
	{#if Scene}
		<Scene
			{view}
			{plotHalf}
			{biome}
			{seed}
			{enclosures}
			{animals}
			{selectedId}
			{selectedEnclosureId}
			{running}
			{onSelect}
			{placingSize}
			{onGround}
			onProgress={(done) => (built = done)}
		/>
	{/if}
</div>

<!--
	Смужка поступу живе ПОЗА `.stage`: та лежить під усім вмістом (`z-index: -1`),
	і напис у ній виявився б за картою.
-->
{#if built < 1}
	<SceneLoading done={built} />
{/if}

{#if Scene && showMinimap}
	<ReserveMinimap {view} {biome} {seed} {enclosures} {plotHalf} />
{/if}

<style>
	.stage {
		position: absolute;
		inset: 0;
		/*
		 * Відʼємний `z-index`, а не `z-index: 0` плюс `position: relative` на всіх
		 * сусідах.
		 *
		 * Той варіант тут уже був, і він мовчки ламав панель. Правило
		 * `.reserve-page > :not(.stage)` специфічніше за `.sheet`, тож
		 * `position: fixed` панелі перетворювався на `relative`: вона ставала
		 * звичайним рядком у стовпці, розпірка під нею стискалася — і смуга кнопок
		 * підстрибувала вгору щоразу, коли відкривалося меню. Карта, що йде за вміст
		 * сама, нікого сусіда не чіпає й нічого не ламає.
		 */
		z-index: -1;
	}
</style>
