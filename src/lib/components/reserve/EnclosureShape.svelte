<script lang="ts">
	import { T } from '@threlte/core';
	import { CELL, innerSpan } from './sceneLayout';
	import { equipped } from '$lib/reserve/modules';
	import { effectiveQuality } from '$lib/reserve/simulation';
	import { fenceOf } from './fence';
	import { poseAt } from './animalLife';
	import AnimalFigure from './AnimalFigure.svelte';
	import type { Animal, Enclosure } from '$lib/reserve/types';

	/**
	 * Вольєр на карті: умовний прямокутник, обмежений ПАРКАНОМ.
	 *
	 * Доти це була суцільна плита, яка накривала траву, — і заповідник виглядав
	 * бетонним майданчиком, а не ділянкою природи. Тепер усередині лишається та
	 * сама земля з тим самим рельєфом, а межу тримають стовпчики з двома
	 * жердинами. Різниця не косметична: гравець мусить бачити, що він обгородив
	 * шматок лісу, а не залив його.
	 */
	interface Props {
		/**
		 * Сама будівля: з неї беруться `id` для влучання променем і СУБ-МОДУЛІ.
		 *
		 * Доти сюди приходив прапорець «поруч є вода», і водойма малювалася там, де
		 * природної не було, — тобто безкоштовно й скрізь. Тепер видно куплене: що
		 * гравець поставив, те й стоїть у вольєрі.
		 */
		enclosure: Enclosure;
		animal: Animal | null;
		x: number;
		z: number;
		/** Сторона сліду в клітинках. */
		span: number;
		selected: boolean;
		/** Курсор саме на цій тварині: смужки стану над нею стають непрозорими. */
		hovered?: boolean;
		/** Зерно партії: з нього виводиться маршрут блукання. */
		seed: number;
		/**
		 * Скільки секунд «живого» часу минуло. Стоїть — тварина стоїть.
		 *
		 * Приходить пропом, а не читається з контролера: рахує його сцена, і саме
		 * вона знає, коли час іде. Другий власник цього числа означав би двох
		 * тварин на різних фазах у тому самому вольєрі.
		 */
		phase?: number;
	}

	let {
		enclosure,
		animal,
		x,
		z,
		span,
		selected,
		hovered = false,
		seed,
		phase = 0
	}: Props = $props();
	const enclosureId = $derived(enclosure.id);

	/** Півсторона паркана у світових одиницях, із невеликим відступом усередину. */
	const half = $derived(innerSpan(span) / 2);
	/** Центр сліду: клітинка — це його ЛІВИЙ ВЕРХНІЙ кут, а не середина. */
	const shift = $derived(((span - 1) * CELL) / 2);

	/**
	 * ПАРКАН — ЗА ЯКІСТЮ, і саме за `effectiveQuality`.
	 *
	 * Доти тут стояли два числа на всі три якості, і автор це побачив: «паркан для
	 * всіх трьох якостей вольєрів виглядає нормально але однаково». Набори живуть
	 * у `fence.ts` — там же й причина, чому вони різняться чотирма параметрами, а
	 * не одним.
	 *
	 * `effectiveQuality`, а не `enclosure.quality`: над порогами зносу в
	 * `constants.ts` написано «щоб гравець БАЧИВ, що вольєр став гіршим», і доти
	 * побачити було нічим. Тепер зношена «відмінна» стоїть як «добра».
	 */
	const fence = $derived(fenceOf(effectiveQuality(enclosure)));

	/** Скільки стовпчиків на бік: великий вольєр не має бути голою рамкою. */
	const posts = $derived(Math.max(2, span + fence.extraPosts));

	const colour = $derived(selected ? '#ffd54f' : fence.post);

	/**
	 * ДЕ ЗАРАЗ ТВАРИНА Й ЩО ВОНА РОБИТЬ.
	 *
	 * Скарга автора: «тварини стоять по центру вольєра; очікуваний результат —
	 * симуляція життя». Тепер поза — чиста функція від зерна, `id` і фази
	 * (`animalLife.ts`), а не сталий центр.
	 *
	 * Набір поведінок залежить від того, що гравець КУПИВ: без водойми ніхто не
	 * плаває, без укриття нікуди не заходить. Тобто модулі стало видно просто на
	 * карті, а не лише в панелі вольєра.
	 */
	const pose = $derived(
		animal
			? poseAt(seed, animal.id, phase, {
					half,
					water: enclosure.modules.includes('water'),
					shelter: equipped(enclosure, 'shelter')
				})
			: null
	);
</script>

<!--
	Мітка вольєра — на цій групі, мітка тварини — на її власній, усередині.
	Промінь шукає вгору по батьках і знаходить глибшу першою, тому тап по звірові
	дає звіра, а тап по паркану — вольєр. Доти мітка тут була ОДНА (`animalId`), і
	порожній вольєр не можна було вибрати взагалі.
-->
<T.Group position={[x + shift, 0, z + shift]} userData={{ enclosureId }}>
	<!--
		Невидима площина для влучання променем.
		
		Паркан тонкий, і тицьнути пальцем у жердину на телефоні неможливо. Тому
		клік ловить прозорий прямокутник у межах загорожі — видимого сліду він не
		лишає, а ціль робить пальцевою.
	-->
	<T.Mesh position={[0, 0.02, 0]} rotation.x={-Math.PI / 2}>
		<T.PlaneGeometry args={[half * 2, half * 2]} />
		<T.MeshBasicMaterial transparent opacity={selected ? 0.14 : 0.04} color="#ffffff" />
	</T.Mesh>

	{#each [-1, 1] as side (side)}
		<!-- Жердин дві або три — залежно від якості; одна читалася б як лінія на землі. -->
		{#each fence.rails as height (height)}
			<T.Mesh position={[0, height, side * half]}>
				<T.BoxGeometry args={[half * 2, fence.railThickness, fence.railThickness]} />
				<T.MeshStandardMaterial color={fence.rail} />
			</T.Mesh>
			<T.Mesh position={[side * half, height, 0]}>
				<T.BoxGeometry args={[fence.railThickness, fence.railThickness, half * 2]} />
				<T.MeshStandardMaterial color={fence.rail} />
			</T.Mesh>
		{/each}
	{/each}

	{#each Array.from({ length: posts }, (_, i) => -half + (i * half * 2) / (posts - 1)) as offset (offset)}
		{#each [-1, 1] as side (side)}
			<T.Mesh position={[offset, fence.postHeight / 2, side * half]}>
				<T.BoxGeometry args={[fence.postWidth, fence.postHeight, fence.postWidth]} />
				<T.MeshStandardMaterial color={colour} />
			</T.Mesh>
			<T.Mesh position={[side * half, fence.postHeight / 2, offset]}>
				<T.BoxGeometry args={[fence.postWidth, fence.postHeight, fence.postWidth]} />
				<T.MeshStandardMaterial color={colour} />
			</T.Mesh>
			{#if fence.cap}
				<!--
					Накривка — лише в найдорожчого паркана. Дрібниця, зате саме вона
					читається як «доглянуто», коли камера підходить близько.
				-->
				<T.Mesh position={[offset, fence.postHeight + fence.postWidth * 0.25, side * half]}>
					<T.BoxGeometry
						args={[fence.postWidth * 1.5, fence.postWidth * 0.5, fence.postWidth * 1.5]}
					/>
					<T.MeshStandardMaterial color={fence.rail} />
				</T.Mesh>
				<T.Mesh position={[side * half, fence.postHeight + fence.postWidth * 0.25, offset]}>
					<T.BoxGeometry
						args={[fence.postWidth * 1.5, fence.postWidth * 0.5, fence.postWidth * 1.5]}
					/>
					<T.MeshStandardMaterial color={fence.rail} />
				</T.Mesh>
			{/if}
		{/each}
	{/each}

	<!--
		Суб-модулі: те, що гравець КУПИВ, і те, чого виду бракує.

		Водойма малюється лише коли її поставили, — біля річки її й не поставиш
		(команда відмовляє). Тобто рельєф не декорація двічі: місце вирішує, чи
		доведеться платити, і видно це просто на карті.
	-->
	{#if enclosure.modules.includes('water')}
		<T.Mesh position={[half * 0.45, 0.03, half * 0.45]}>
			<T.CylinderGeometry args={[half * 0.28, half * 0.28, 0.06, 16]} />
			<T.MeshStandardMaterial color="#4a9ec4" />
		</T.Mesh>
	{/if}

	{#if equipped(enclosure, 'plants')}
		<!-- Насадження: три кущі по кутах, щоб не читалися як один. -->
		{#each [[-0.5, -0.5], [0.45, -0.6], [-0.6, 0.5]] as [dx, dz], index (index)}
			<T.Mesh position={[half * dx, 0.16, half * dz]} scale={[1, 0.7, 1]}>
				<T.IcosahedronGeometry args={[Math.min(0.42, half * 0.22), 0]} />
				<T.MeshStandardMaterial color="#3f6b34" />
			</T.Mesh>
		{/each}
	{/if}

	{#if equipped(enclosure, 'shelter')}
		<!-- Укриття: коробка з похилим дахом. Проста форма, зате пізнавана. -->
		{@const box = Math.min(0.7, half * 0.35)}
		<T.Group position={[-half * 0.45, 0, half * 0.5]}>
			<T.Mesh position={[0, box * 0.35, 0]}>
				<T.BoxGeometry args={[box, box * 0.7, box * 0.8]} />
				<T.MeshStandardMaterial color="#6b4a2f" />
			</T.Mesh>
			<T.Mesh position={[0, box * 0.85, 0]} rotation.y={Math.PI / 4}>
				<T.ConeGeometry args={[box * 0.75, box * 0.5, 4]} />
				<T.MeshStandardMaterial color="#8a6f4a" />
			</T.Mesh>
		</T.Group>
	{/if}

	{#if animal}
		<!--
			`selected` тут теж означає «увага»: на телефоні наведення не існує, і без
			цього смужки стану лишалися б напівпрозорими назавжди. Тап — це вибір.
		-->
		<T.Group position={[pose?.x ?? 0, 0, pose?.z ?? 0]}>
			<AnimalFigure
				{animal}
				attention={hovered || selected}
				turn={pose?.turn}
				doing={pose?.doing}
			/>
		</T.Group>
	{/if}
</T.Group>
