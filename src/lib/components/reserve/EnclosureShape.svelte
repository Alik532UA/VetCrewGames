<script lang="ts">
	import { T } from '@threlte/core';
	import { CELL } from './sceneLayout';
	import type { Animal } from '$lib/reserve/types';

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
		/** Чи поруч є ПРИРОДНА вода: якщо ні, усередині доводиться копати свою. */
		hasWater: boolean;
		animal: Animal | null;
		x: number;
		z: number;
		/** Сторона сліду в клітинках. */
		span: number;
		selected: boolean;
	}

	let { hasWater, animal, x, z, span, selected }: Props = $props();

	/** Півсторона паркана у світових одиницях, із невеликим відступом усередину. */
	const half = $derived((span * CELL) / 2 - 0.15);
	/** Центр сліду: клітинка — це його ЛІВИЙ ВЕРХНІЙ кут, а не середина. */
	const shift = $derived(((span - 1) * CELL) / 2);

	const POST = '#8a6f4a';
	const RAIL = '#a88a5e';

	/** Скільки стовпчиків на бік: великий вольєр не має бути голою рамкою. */
	const posts = $derived(Math.max(2, span + 1));

	const colour = $derived(selected ? '#ffd54f' : POST);
</script>

<T.Group position={[x + shift, 0, z + shift]} userData={{ animalId: animal?.id }}>
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
		<!-- Дві жердини на кожен бік: одна читалася б як лінія на землі. -->
		{#each [0.22, 0.42] as height (height)}
			<T.Mesh position={[0, height, side * half]}>
				<T.BoxGeometry args={[half * 2, 0.04, 0.04]} />
				<T.MeshStandardMaterial color={RAIL} />
			</T.Mesh>
			<T.Mesh position={[side * half, height, 0]}>
				<T.BoxGeometry args={[0.04, 0.04, half * 2]} />
				<T.MeshStandardMaterial color={RAIL} />
			</T.Mesh>
		{/each}
	{/each}

	{#each Array.from({ length: posts }, (_, i) => -half + (i * half * 2) / (posts - 1)) as offset (offset)}
		{#each [-1, 1] as side (side)}
			<T.Mesh position={[offset, 0.28, side * half]}>
				<T.BoxGeometry args={[0.08, 0.56, 0.08]} />
				<T.MeshStandardMaterial color={colour} />
			</T.Mesh>
			<T.Mesh position={[side * half, 0.28, offset]}>
				<T.BoxGeometry args={[0.08, 0.56, 0.08]} />
				<T.MeshStandardMaterial color={colour} />
			</T.Mesh>
		{/each}
	{/each}

	<!--
		Штучна водойма — лише коли природної поруч немає. У цьому й сенс того, що
		рельєф не декорація: місце під вольєр не байдуже, і видно це просто на карті.
	-->
	{#if !hasWater}
		<T.Mesh position={[half * 0.45, 0.03, half * 0.45]}>
			<T.CylinderGeometry args={[half * 0.28, half * 0.28, 0.06, 16]} />
			<T.MeshStandardMaterial color="#4a9ec4" />
		</T.Mesh>
	{/if}

	{#if animal}
		<!-- Мешканець: капсула, а не модель — зображень тварин агент не вигадує. -->
		<T.Mesh position={[0, 0.55, 0]}>
			<T.CapsuleGeometry args={[0.28, 0.5, 4, 8]} />
			<T.MeshStandardMaterial color={animal.stage === 'healthy' ? '#4caf50' : '#c98a3c'} />
		</T.Mesh>
	{/if}
</T.Group>
