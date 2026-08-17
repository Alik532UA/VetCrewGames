<script lang="ts">
	import { T } from '@threlte/core';
	import { WORLD_RADIUS, type Terrain } from '$lib/reserve/terrain';
	import { GROUND_COLOR } from '$lib/reserve/palette';
	import type { ReserveBiome } from '$lib/reserve/species';
	import { growInBatches } from './growInBatches.svelte';
	import DecorPiece from './DecorPiece.svelte';
	import RiverRibbon from './RiverRibbon.svelte';
	import PlotBorder from './PlotBorder.svelte';

	/**
	 * Світ, який лише МАЛЮЄТЬСЯ: земля, річки, рельєф, межа ділянки.
	 *
	 * Розділено зі `SceneBody` за ознакою взаємодії, а не за розміром файлу. Тут
	 * немає жодного оброблювача: ні промінь, ні камера, ні вибір цього не чіпають.
	 * Там — те, з чим гравець працює: вольєри, привид майбутньої будівлі, тапи.
	 * Доти обидві половини лежали разом, і читати доводилося все, щоб зрозуміти
	 * будь-що.
	 *
	 * Рельєф приходить ПРОПСОМ, а не рахується тут: його ж читає й `SceneBody`,
	 * щоб знати, чи є біля вольєра вода. Двічі порахований, він дав би дві копії
	 * шестисот сімдесяти фігур і другі шість мілісекунд ні за що.
	 */
	interface Props {
		biome: ReserveBiome;
		terrain: Terrain;
		/** Півсторона дозволеної забудови: її межу видно пунктиром. */
		plotHalf: number;
		/** Скільки рельєфу вже стоїть: 0 → 1. Смужку поступу малює сторінка. */
		onProgress: (done: number) => void;
	}

	let { biome, terrain, plotHalf, onProgress }: Props = $props();

	/**
	 * Рельєф виростає ПОРЦІЯМИ: шістсот сімдесят фігур одним махом блокували
	 * головний потік на дві з половиною секунди — див. `growInBatches`.
	 */
	const growth = growInBatches(
		() => terrain.items.length,
		(done) => onProgress(done)
	);

	/**
	 * Земля рівно така, щоб укрити рельєф із запасом на два кроки.
	 *
	 * Удвічі більша за радіус рельєфу навмисно: карта не має ОБРИВАТИСЯ на око.
	 * Природа не закінчується там, де закінчується твоя ділянка, — вона просто
	 * стає рідшою, а далі йде рівна земля до горизонту.
	 */
	const GROUND_SIDE = WORLD_RADIUS * 4;
</script>

<T.AmbientLight intensity={1.4} />
<T.DirectionalLight position={[8, 14, 6]} intensity={2.2} />

<!--
	Земля — тонка коробка, а не площина: у площини немає боків, і на ізометрії
	заповідник виглядав би наліпкою, а не місцем.
-->
<T.Mesh position={[0, -0.55, 0]}>
	<T.BoxGeometry args={[GROUND_SIDE, 1, GROUND_SIDE]} />
	<T.MeshStandardMaterial color={GROUND_COLOR[biome]} />
</T.Mesh>

<!--
	Межа ділянки — пунктиром. Не паркан і не стіна: гравець мусить бачити, де
	закінчуються його права на забудову, і водночас бачити, що земля тягнеться далі.
-->
<PlotBorder half={plotHalf} />

{#each terrain.rivers as path, index (index)}
	<RiverRibbon {path} color="#3f7fa8" />
{/each}

<!--
	Рельєф біома. Детермінований: та сама партія — той самий краєвид. Кожна фігура
	малюється `DecorPiece`: вісім родів замість одного конуса різного розміру.

	З'являється порціями — див. `growth`. Ключ від індексу лишається чинним: зріз
	тільки РОСТЕ, тож у вже поставленої фігури індекс не змінюється.
-->
{#each terrain.items.slice(0, growth.shown) as item, index (`${item.kind}-${index}`)}
	<DecorPiece {item} {biome} />
{/each}
