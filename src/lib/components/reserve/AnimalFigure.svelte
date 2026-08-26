<script lang="ts">
	import { T } from '@threlte/core';
	import type { Animal } from '$lib/reserve/types';
	import AnimalMark from './AnimalMark.svelte';
	import AnimalVitals from './AnimalVitals.svelte';
	import { bodyOf } from './anatomy';
	import { spur, hipY, headX, headY, neckOf, tailLength, tailOf } from './figure';

	/**
	 * Мешканець вольєра: низькополігональний силует із примітивів.
	 *
	 * Доти це була капсула — однакова для їжака й слона. Тепер вид видно з першого
	 * погляду: пропорція (в оленя ноги вищі за тулуб, у їжака ніг не видно),
	 * прикмета (роги, хобот, грива, колючки) і колір. Числа лежать у `anatomy.ts`,
	 * тут — лише збирання; так пропорції можна перевірити тестом, а не на око.
	 *
	 * Зображень тварин тут немає й бути не може: дорожня карта це забороняє. Усе
	 * складено з конуса, кулі й циліндра — тими самими примітивами, що й дерева.
	 *
	 * **Стан здоров'я переїхав на КІЛЬЦЕ під ногами.** Доти його показував колір
	 * усього тіла: зелене — здорове, руде — на лікуванні. Тепер колір тіла зайнятий
	 * видом (лис рудий, слон сірий), і другого сигналу в ньому не лишилося. Кільце
	 * на землі читається з ізометрії не гірше й не заперечує вид.
	 */
	interface Props {
		animal: Animal;
		/**
		 * Курсор на тварині або вона вибрана — смужки стану стають непрозорими.
		 *
		 * Приходить пропом, а не читається тут: хто під курсором, знає промінь у
		 * `SceneBody`, і другого відповідача на це питання бути не мусить.
		 */
		attention?: boolean;
	}

	let { animal, attention = false }: Props = $props();

	const b = $derived(bodyOf(animal.speciesId));

	/**
	 * Куди дивиться. Виводиться з `id`, а не з випадкового числа: сцена мусить
	 * бути та сама після перезавантаження, а `Math.random()` дав би нову щоразу.
	 * Без цього сусідні вольєри читаються як шеренга однакових фігур.
	 */
	const turn = $derived(((animal.id % 8) * Math.PI) / 4);

	const neck = $derived(neckOf(b));
	/** Писок сидить основою В ГОЛОВІ, щоб між ними не було щілини. */
	const snout = $derived(spur(headX(b), headY(b), 1, -0.15, b.head * 0.6 + b.muzzle));
	const beak = $derived(spur(headX(b), headY(b), 1, -0.1, b.head * 0.7 + b.muzzle));

	/**
	 * Хвіст один на всі види: куди він відходить, знає `tailOf`. Розписаний тут
	 * четвертий раз, він розійшовся б із формулою габариту, яка міряє те саме.
	 */
	const tailLen = $derived(tailLength(b));
	const tail = $derived(tailOf(b));

	/** Голова птаха світліша за тулуб — це і є прикмета орла. */
	const crest = $derived(b.trim === b.coat ? b.coat : b.trim);

	/** Кільце стану: не менше за пів метра, інакше його не намацати оком. */
	const ring = $derived(Math.max(0.32, b.len * 0.62));
	const alive = $derived(animal.stage === 'healthy');
</script>

<T.Group rotation.y={turn} userData={{ animalId: animal.id }}>
	<!--
		Кільце стану лежить на землі, а не висить над твариною: підпис у повітрі
		довелося б повертати за камерою, а кільце з будь-якого боку однакове.
	-->
	<T.Mesh position={[0, 0.05, 0]} rotation.x={-Math.PI / 2}>
		<T.TorusGeometry args={[ring, 0.035, 5, 20]} />
		<T.MeshStandardMaterial color={alive ? '#4caf50' : '#c98a3c'} />
	</T.Mesh>

	{#if b.stance === 'two'}
		<!-- Птах: тулуб СТОЇТЬ яйцем, ноги дві, замість писка дзьоб. -->
		<T.Mesh position={[0, b.leg + b.len / 2, 0]} scale={[b.tall / b.len, 1, b.wide / b.len]}>
			<T.SphereGeometry args={[b.len / 2, 8, 6]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>

		<T.Mesh position={[headX(b), headY(b), 0]}>
			<T.SphereGeometry args={[b.head, 8, 6]} />
			<T.MeshStandardMaterial color={crest} />
		</T.Mesh>

		<T.Mesh position={[beak.x, beak.y, 0]} rotation.z={beak.tilt}>
			<T.ConeGeometry args={[b.head * 0.38, beak.length, 5]} />
			<T.MeshStandardMaterial color="#d9a53c" />
		</T.Mesh>

		<!-- Крила складені: пласкі краплі по боках, а не розкрита розмашка. -->
		{#each [-1, 1] as side (side)}
			<T.Mesh
				position={[-b.tall * 0.04, b.leg + b.len * 0.56, side * b.wide * 0.46]}
				scale={[0.8, 1, 0.2]}
			>
				<T.SphereGeometry args={[b.len * 0.42, 7, 5]} />
				<T.MeshStandardMaterial color={b.coat} />
			</T.Mesh>
			<T.Mesh position={[0, b.leg / 2, side * b.wide * 0.2]}>
				<T.CylinderGeometry args={[b.shin, b.shin, b.leg, 5]} />
				<T.MeshStandardMaterial color="#c8a24a" />
			</T.Mesh>
		{/each}

		<!-- Хвіст віялом: тонкий по вертикалі, широкий по горизонталі. -->
		<T.Mesh position={[tail.x, tail.y, 0]} rotation.z={tail.tilt} scale={[0.3, 1, 1]}>
			<T.ConeGeometry args={[b.len * 0.26, tailLen, 4]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>

		{#if b.ear === 'tuft'}
			<!-- Пір'яні «вушка» сови: вона з них і пізнається. -->
			{#each [-1, 1] as side (side)}
				<T.Mesh
					position={[headX(b) - b.head * 0.1, headY(b) + b.head * 0.85, side * b.head * 0.45]}
					rotation.z={side * 0.2}
				>
					<T.ConeGeometry args={[b.head * 0.22, b.head * 0.7, 4]} />
					<T.MeshStandardMaterial color={b.coat} />
				</T.Mesh>
			{/each}
		{/if}
	{:else}
		<!--
			Тулуб — капсула, ПОКЛАДЕНА вздовж X.

			Після повороту на 90° навколо Z місцева вісь Y стає світовою X, а місцева
			Z лишається світовою Z. Тому ширину задає саме `scale.z`: масштаб у
			матриці застосовується ДО повороту, у місцевих осях.
		-->
		<T.Mesh position={[0, hipY(b), 0]} rotation.z={Math.PI / 2} scale={[1, 1, b.wide / b.tall]}>
			<T.CapsuleGeometry args={[b.tall / 2, Math.max(0.02, b.len - b.tall), 3, 7]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>

		<!-- Шия трохи довша за відстань: інакше на згині лишається щілина. -->
		<T.Mesh position={[neck.x, neck.y, 0]} rotation.z={neck.tilt}>
			<T.CylinderGeometry args={[b.tall * 0.2, b.tall * 0.28, neck.length + b.tall * 0.3, 6]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>

		<T.Mesh position={[headX(b), headY(b), 0]} scale={[1.15, 1, 1]}>
			<T.SphereGeometry args={[b.head, 8, 6]} />
			<T.MeshStandardMaterial color={b.coat} />
		</T.Mesh>

		{#if b.muzzle > 0}
			<T.Mesh position={[snout.x, snout.y, 0]} rotation.z={snout.tilt}>
				<T.ConeGeometry args={[b.head * 0.5, snout.length, 6]} />
				<T.MeshStandardMaterial color={b.coat} />
			</T.Mesh>
		{/if}

		<!--
			Ноги лишень тоді, коли їх видно. У їжака вони 6 см при тулубі 45 —
			чотири циліндри висотою в піксель нікому нічого не кажуть.
		-->
		{#if b.leg > 0.1}
			{#each [0.31, -0.29] as along (along)}
				{#each [-1, 1] as side (side)}
					<T.Mesh position={[b.len * along, b.leg / 2, side * b.wide * 0.32]}>
						<T.CylinderGeometry args={[b.shin / 2, b.shin / 2, b.leg, 5]} />
						<T.MeshStandardMaterial color={b.coat} />
					</T.Mesh>
				{/each}
			{/each}
		{/if}

		{#each [-1, 1] as side (side)}
			{#if b.ear === 'pointed'}
				<T.Mesh
					position={[headX(b) - b.head * 0.25, headY(b) + b.head * 0.7, side * b.head * 0.5]}
					rotation.z={-0.15}
				>
					<T.ConeGeometry args={[b.head * 0.3, b.head * 0.85, 4]} />
					<T.MeshStandardMaterial color={b.coat} />
				</T.Mesh>
			{:else if b.ear === 'round'}
				<T.Mesh position={[headX(b) - b.head * 0.15, headY(b) + b.head * 0.6, side * b.head * 0.7]}>
					<T.IcosahedronGeometry args={[b.head * 0.32, 0]} />
					<T.MeshStandardMaterial color={b.coat} />
				</T.Mesh>
			{:else if b.ear === 'wide'}
				<!-- Слонові вуха: пласкі й на пів голови. Без них він просто сірий валун. -->
				<T.Mesh
					position={[headX(b) - b.head * 0.45, headY(b) + b.head * 0.1, side * b.head * 0.7]}
					scale={[0.12, 1, 1]}
				>
					<T.IcosahedronGeometry args={[b.head * 0.6, 0]} />
					<T.MeshStandardMaterial color={b.trim} />
				</T.Mesh>
			{/if}
		{/each}

		{#if b.tail === 'bushy'}
			<T.Mesh position={[tail.x, tail.y, 0]} rotation.z={tail.tilt}>
				<T.ConeGeometry args={[b.tall * 0.26, tailLen, 6]} />
				<T.MeshStandardMaterial color={b.coat} />
			</T.Mesh>
		{:else if b.tail === 'flat'}
			<!-- Бобровий хвіст плаский ГОРИЗОНТАЛЬНО, тому тонкий саме по місцевій X. -->
			<T.Mesh position={[tail.x, tail.y, 0]} rotation.z={tail.tilt}>
				<T.BoxGeometry args={[0.05, tailLen, b.wide * 0.85]} />
				<T.MeshStandardMaterial color="#4e3826" />
			</T.Mesh>
		{:else if b.tail === 'stub'}
			<T.Mesh position={[tail.x, tail.y, 0]} rotation.z={tail.tilt}>
				<T.ConeGeometry args={[b.tall * 0.12, tailLen, 5]} />
				<T.MeshStandardMaterial color={b.coat} />
			</T.Mesh>
		{/if}
	{/if}

	<AnimalMark body={b} />

	<!--
		СМУЖКИ СТАНУ НЕ ПОВЕРТАЮТЬСЯ РАЗОМ ІЗ ТВАРИНОЮ.

		Ця група має `rotation.y = turn` — куди тварина дивиться. Смужка мусить
		читатися однаково, куди б вона не дивилася, тож поворот тут ГАСИТЬСЯ: свій
		власний, потрібний для читання, `AnimalVitals` додає сам.

		Гасіння, а не виніс за межі групи: `turn` колись стане рухомим (тварина
		почне ходити), і віднімання лишиться правильним само, тоді як другий
		вузол-сусід довелося б синхронізувати руками.
	-->
	<T.Group rotation.y={-turn}>
		<AnimalVitals body={b} health={animal.health} stress={animal.stress} {attention} />
	</T.Group>
</T.Group>
