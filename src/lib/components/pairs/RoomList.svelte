<script lang="ts">
	import { Users } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { LobbyRoom } from '$lib/net/lobby';

	/**
	 * Перелік відкритих кімнат — четвертий блок форми входу.
	 *
	 * ## Навіщо
	 *
	 * Доти зайти в спільну партію можна було ЛИШЕ за пʼятилітерним кодом, який
	 * хтось мусив продиктувати. Тобто гра з незнайомцем була неможлива в принципі
	 * — і не через недогляд: код кімнати і є її пароль, тому правила бази прямо
	 * забороняють перелічувати `rooms`. Ціна й механіка окремої гілки описані в
	 * `net/lobby.ts`; тут — лише те, що видно.
	 *
	 * ## Компонент не знає мережі
	 *
	 * Він отримує масив і кличе те, що дали. Тому список перевіряється без бази, а
	 * сторінка лишається єдиним місцем, яке знає про Firebase.
	 *
	 * ## ЧОГО ТУТ НЕМАЄ: кімнат ДРУЗІВ угорі списку
	 *
	 * Автор просив закріпити їхні кімнати над іншими — замість окремої сторінки
	 * «грати з друзями». Зробити цього НЕ ВИЙДЕ, і причина не в списку.
	 *
	 * Друзі — це два акаунти, взаємно підписані один на одного (як у сусідньому
	 * `Slovko`: `users/{uid}/following/{targetUid}` плюс дзеркальні `followers`).
	 * А тут акаунтів немає ЗОВСІМ: `net/firebase.ts` робить `signInAnonymously`,
	 * тобто `uid` живе рівно доки живе сховище браузера. Ні підписатися, ні
	 * впізнати того самого гравця наступного дня, ні навіть відрізнити його від
	 * себе на іншому пристрої — нічим.
	 *
	 * Тому «закріплені кімнати друзів» вимагають спершу акаунтів (реєстрація,
	 * профіль, пошук людей, взаємна підписка) — тобто окремої роботи, більшої за
	 * весь онлайн-режим. Порожньої «затички під друзів» тут навмисно немає: сорт,
	 * що завжди повертає порожню групу, читається як зроблена робота.
	 */
	interface Props {
		rooms: LobbyRoom[];
		/** Скільки кімнат у переліку взагалі — щоб обрізку було видно. */
		total: number;
		/** Перелік не читається (правила не викладені). Показуємо чому, а не порожнечу. */
		unavailable: boolean;
		/** Поки триває вхід, кнопки не приймають повторних натискань. */
		busy: boolean;
		onEnter: (code: string) => void;
	}

	let { rooms, total, unavailable, busy, onEnter }: Props = $props();

	/**
	 * Обрізку видно РЯДКОМ, а не мовчки (NO-SILENT-CAPS).
	 *
	 * Список без цього рядка читався б як «це всі кімнати», і людина, яка не
	 * знайшла потрібну, вирішила б, що її немає.
	 */
	const hidden = $derived(Math.max(0, total - rooms.length));
</script>

<section class="rooms">
	<h2 class="rooms__title">{@html formatFont(t('pairs.rooms'))}</h2>

	<!--
		ШВИДКОЇ ГРИ ТУТ БІЛЬШЕ НЕМА — вона переїхала на самий верх форми входу й
		лишилася без панелі (`OnlineGate`). Причина в тому, що вона не є одним із
		рівноправних варіантів: вона робить те саме, що всі блоки разом, тільки без
		вибору. Усередині панелі зі списком вона читалася б як «спосіб зайти в
		кімнату зі списку», хоч вона й кімнату створить, коли списку немає.
	-->
	{#if unavailable}
		<p class="rooms__hint" data-testid="pairs-rooms-unavailable-hint">
			{@html formatFont(t('pairs.roomsUnavailable'))}
		</p>
	{:else if rooms.length === 0}
		<p class="rooms__empty" data-testid="pairs-rooms-empty-hint">
			{@html formatFont(t('pairs.noRooms'))}
		</p>
		<p class="rooms__hint">{@html formatFont(t('pairs.noRoomsHint'))}</p>
	{:else}
		<ul class="rooms__list" data-testid="pairs-rooms-list">
			{#each rooms as room (room.code)}
				<li class="rooms__item" data-testid="pairs-room-{room.code}-item">
					<span class="rooms__who">
						<!--
							Імʼя господаря — БЕЗ коду кімнати на екрані.

							Код і так лежить у ключі запису, тобто його вже видно кожному, хто
							читає перелік; але показувати його рядком означало б запрошувати
							переписати код замість натиснути кнопку. Кнопка робить те саме
							надійніше.
						-->
						<span class="rooms__host">{room.hostName}</span>
						<span class="rooms__players">
							<Users size={14} aria-hidden="true" />
							{@html formatFont(t('pairs.players'))}: {room.players}
						</span>
					</span>
					<button
						type="button"
						class="rooms__enter"
						onclick={() => onEnter(room.code)}
						aria-disabled={busy}
						aria-label="{t('pairs.enter')}: {room.hostName}"
						data-testid="pairs-room-{room.code}-btn"
					>
						{@html formatFont(t('pairs.enter'))}
					</button>
				</li>
			{/each}
		</ul>

		{#if hidden > 0}
			<p class="rooms__hint" data-testid="pairs-rooms-trimmed-hint">
				{@html formatFont(t('pairs.shown'))}: {rooms.length} / {total}
			</p>
		{/if}
	{/if}
</section>

<style>
	.rooms {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rooms__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
		text-transform: uppercase;
	}

	/*
	 * Підказки — КЕГЛЕМ, а не прозорістю.
	 *
	 * `opacity` на тексті цієї панелі опускає пару під 4.5:1, і жодне значення
	 * прозорості її не рятує: заміряно `tests/contrast-runtime.spec.ts`. Те саме
	 * міркування записане в `OnlineGate` і в `reserve/BiomePicker`.
	 */
	.rooms__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.rooms__empty {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
	}

	.rooms__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
		/*
		 * Список гортається САМ, а не розтягує сторінку.
		 *
		 * Стеля в `net/lobby.ts` — 20 записів, і двадцять рядків по 44px дають 880px,
		 * тобто більше за вікно телефона. Без цієї межі форма входу переставала
		 * вміщатися, а кнопка «створити кімнату» виїжджала за екран — саме тому межа
		 * тут, а не «на майбутнє».
		 */
		max-height: 40svh;
		overflow-y: auto;
	}

	.rooms__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.rooms__who {
		display: flex;
		flex-direction: column;
		/* Довге імʼя стискається, а не розпирає рядок і не виштовхує кнопку. */
		min-width: 0;
	}

	.rooms__host {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.rooms__players {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: var(--font-size-xs);
		font-variant-numeric: tabular-nums;
	}

	.rooms__enter {
		flex-shrink: 0;
		min-height: 36px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
		color: var(--color-text);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	@media (hover: hover) {
		.rooms__enter:hover {
			background: color-mix(in srgb, var(--color-text), transparent 80%);
		}
	}
</style>
