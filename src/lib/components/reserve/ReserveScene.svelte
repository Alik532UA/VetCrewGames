<script lang="ts">
	import { Canvas } from '@threlte/core';
	import SceneBody from './SceneBody.svelte';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Animal, Enclosure } from '$lib/reserve/types';

	/**
	 * Обгортка сцени: полотно й розмір, більше нічого.
	 *
	 * Вона існує окремо від `SceneBody`, бо саме ЦЕЙ файл вантажиться через
	 * `import()`. Усе, що він тягне — `@threlte/core` і `three`, — осідає в
	 * окремому чанку, і відвідувач, який у заповідник не заходив, тривимірного
	 * рушія не завантажує взагалі. Один статичний імпорт цього файлу з будь-якої
	 * сторінки зруйнував би розділення мовчки.
	 */
	interface Props {
		biome: ReserveBiome;
		/** Зерно партії: краєвид детермінований, як і все інше. */
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
	}

	let { biome, seed, enclosures, animals, selectedId, onSelect }: Props = $props();
</script>

<div class="scene" data-testid="reserve-scene-panel">
	<Canvas>
		<SceneBody {biome} {seed} {enclosures} {animals} {selectedId} {onSelect} />
	</Canvas>
</div>

<style>
	.scene {
		/*
		 * Висота в `dvh`, а не в пікселях: на телефоні панель браузера з'їдає
		 * частину екрана, і `vh` лишив би сцену під нею.
		 */
		width: 100%;
		height: clamp(220px, 38dvh, 460px);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		/* Полотно скруглене разом із панеллю, інакше кути стирчать. */
		overflow: hidden;
		/*
		 * Жести належать сцені, а не сторінці. Без цього перетягування пальцем
		 * прокручувало б сторінку замість того, щоб рухати заповідник.
		 */
		touch-action: none;
	}
</style>
