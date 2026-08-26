<script lang="ts">
	import { T } from '@threlte/core';
	import type { Animal } from '$lib/reserve/types';
	import type { Doing } from './animalLife';
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
		/**
		 * Куди дивиться, у радіанах. Немає — виводиться з `id`, як було доти.
		 *
		 * Проп, а не розрахунок тут: напрямок тепер знає той, хто рахує рух
		 * (`animalLife.poseAt`), і два джерела одного числа дали б тварину, що
		 * дивиться не туди, куди йде.
		 */
		turn?: number;
		/**
		 * Що робить: іде, стоїть, плаває чи зайшла в укриття.
		 *
		 * `swim` опускає фігуру — ноги йдуть під воду. `shelter` ХОВАЄ тіло зовсім,
		 * і це рішення: тварина в укритті не видна, зате смужки стану над ним
		 * лишаються. Інакше «зайшла в укриття» означало б «зникла разом зі своїм
		 * здоровʼям», а стан тут і є те, за чим дивляться.
		 */
		doing?: Doing;
	}

	let { animal, attention = false, turn: facing, doing = 'rest' }: Props = $props();

	const b = $derived(bodyOf(animal.speciesId));

	/**
	 * Куди дивиться. Виводиться з `id`, а не з випадкового числа: сцена мусить
	 * бути та сама після перезавантаження, а `Math.random()` дав би нову щоразу.
	 * Без цього сусідні вольєри читаються як шеренга однакових фігур.
	 */
	const turn = $derived(facing ?? ((animal.id % 8) * Math.PI) / 4);

	/**
	 * На скільки фігура сідає в землю. Плаває — ноги під водою.
	 *
	 * Глибше пірнати не варто: тулуб мусить лишатися видним, інакше у вольєрі
	 * просто нікого немає.
	 */
	const sink = $derived(doing === 'swim' ? -b.leg * 0.7 : 0);

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

<T.Group position.y={sink} userData={{ animalId: animal.id }}>
	<!--
		ТІЛО — В УКРИТТІ ЙОГО НЕМА.

		Смужки стану при цьому лишаються (нижче, поза цією гілкою): «зайшла в
		укриття» не мусить означати «зникла разом зі своїм здоровʼям».

		Поворот стоїть саме тут, а не на зовнішній групі: смужки не мусять
		крутитися разом із твариною, а мітка для променя мусить лишатися на
		зовнішній — інакше тварину в укритті не можна було б вибрати тапом.
	-->
	{#if doing !== 'shelter'}
		<T.Group rotation.y={turn}>
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
						<T.Mesh
							position={[headX(b) - b.head * 0.15, headY(b) + b.head * 0.6, side * b.head * 0.7]}
						>
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
		</T.Group>
	{/if}

	<!--
		СМУЖКИ СТАНУ ПОЗА ПОВОРОТОМ, і саме тому вони тут, а не всередині.

		Тварина ходить і повертається; смужка мусить читатися однаково, куди б вона
		не дивилася. Свій власний поворот, потрібний для читання з ізометрії,
		`AnimalVitals` додає сам.
	-->
	<AnimalVitals body={b} health={animal.health} stress={animal.stress} {attention} />
</T.Group>
