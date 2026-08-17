<script lang="ts">
	import { Canvas } from '@threlte/core';
	import SceneBody from './SceneBody.svelte';
	import type { ReserveBiome } from '$lib/reserve/species';
	import type { Animal, Enclosure } from '$lib/reserve/types';
	import type { MapView } from './mapView.svelte';

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
		/** Спільний стан огляду — той самий обʼєкт тримає мінікарта. */
		view: MapView;
		/** Півсторона ділянки за поточної репутації. */
		plotHalf: number;
		/** Зерно партії: краєвид детермінований, як і все інше. */
		seed: number;
		enclosures: Enclosure[];
		animals: Animal[];
		selectedId: number | null;
		onSelect: (id: number) => void;
		/** Розмір вольєра, який чекає місця; `null` — звичайний режим. */
		placingSize: number | null;
		/** Скільки рельєфу вже стоїть на сцені: 0 → 1. */
		onProgress: (done: number) => void;
		onGround: (cell: { x: number; z: number }) => void;
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
		onGround,
		onProgress
	}: Props = $props();
</script>

<div class="scene" data-testid="reserve-scene-panel">
	<Canvas>
		<SceneBody
			{biome}
			{view}
			{plotHalf}
			{seed}
			{enclosures}
			{animals}
			{selectedId}
			{onSelect}
			{placingSize}
			{onGround}
			{onProgress}
		/>
	</Canvas>
</div>

<style>
	.scene {
		/*
		 * Висота — уся, яку дав батько, а не власний `clamp`.
		 *
		 * Доти тут стояло `clamp(220px, 38dvh, 460px)`, і саме воно тримало карту
		 * смужкою: `flex: 1` на обгортці нічого не робив, бо дитина сама собі
		 * призначала висоту. Виміряно: полотно виходило 1100×274 при вікні 1280×720.
		 */
		width: 100%;
		height: 100%;
		min-height: 200px;
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
