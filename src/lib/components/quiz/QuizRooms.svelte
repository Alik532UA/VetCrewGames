<script lang="ts">
	import { SlidersHorizontal } from 'lucide-svelte';
	import { formatFont } from '$lib/i18n';
	import { ONLINE_GAMES, roomFitsGames } from '$lib/config/quizOnline';
	import type { LobbyRoom } from '$lib/net/lobby';
	import type { OwnRoom } from '$lib/net/ownRooms';
	import RoomList from '$lib/components/pairs/RoomList.svelte';
	import QuizGamePicker from './QuizGamePicker.svelte';

	/**
	 * ПЕРЕЛІК КІМНАТ ВІКТОРИНИ — список плюс фільтр за іграми.
	 *
	 * ## Навіщо окремий компонент над спільним `RoomList`
	 *
	 * `RoomList` спільний із «Знайди пару», а наборів ігор там немає ЗОВСІМ: одна
	 * дошка, одні правила. Учити його про ігри означало б нести вікторину в чужу
	 * гру; тримати фільтр на сторінці означало б тримати його там, де вже 399
	 * рядків із чотирьохсот дозволених. Тому фільтр живе тут, а список лишається
	 * спільним і про фільтр не знає — він отримує вже відсіяний масив.
	 *
	 * ## Набір ігор ПЕРЕЇХАВ у фільтр, і це прохання автора
	 *
	 * Доти він стояв окремою панеллю над списком і був НАЛАШТУВАННЯМ майбутньої
	 * кімнати: єдине, що він робив, — задавав `config` тій кімнаті, яку ти
	 * створиш. Автор сказав про це прямо: «тут не треба ці налаштування, треба
	 * помістити в фільтр під кнопку фільтра», а міняти набір — «саме тут, у
	 * кімнаті».
	 *
	 * Тобто той самий вибір відповідає на інше питання: не «які ігри будуть у моїй
	 * кімнаті», а «У ЩО Я ХОЧУ ГРАТИ». І відповідь тепер робить дві речі: сіє
	 * список чужих кімнат і лишається набором для своєї. Друге не зникло — воно
	 * просто перестало бути єдиним, і саме тому підказка під набором каже про
	 * обидві.
	 *
	 * ## `<details>`, а не своя кнопка зі станом
	 *
	 * Розкриття вміє браузер: клавіатура, скрінрідер, `Enter`/`Space` і стан
	 * «відкрито» — усе це вже є в `<summary>`. Своя кнопка з `$state` дала б те
	 * саме гіршим коштом, і на неї довелося б самому вішати `aria-expanded`.
	 */
	interface Props {
		/** Перекладач вікторини: її рядки лежать у лінивому чанку (`i18n/quiz`). */
		text: (key: string) => string;
		rooms: LobbyRoom[];
		resume: OwnRoom[];
		friends: readonly string[];
		hasMore: boolean;
		unavailable: boolean;
		busy: boolean;
		/** У що я хочу грати. Він же — набір для кімнати, яку створю. */
		picked: readonly string[];
		onPick: (games: string[]) => void;
		onEnter: (code: string) => void;
		onClose?: (code: string) => void;
	}

	let {
		text,
		rooms,
		resume,
		friends,
		hasMore,
		unavailable,
		busy,
		picked,
		onPick,
		onEnter,
		onClose
	}: Props = $props();

	const fitting = $derived(rooms.filter((room) => roomFitsGames(room.games, picked)));

	/*
	 * СКІЛЬКИ КІМНАТ ПРИХОВАВ ФІЛЬТР — і це число їде в список.
	 *
	 * Без нього звужений фільтр давав би «Відкритих кімнат поки немає» — напис, який
	 * не бреше про факт і веде до хибного висновку: кімнати є, просто не ті. Це той
	 * самий різновид помилки, що вже виправляли в `unavailable` (див. `LobbyWatcher`),
	 * і той самий канон: обрізку видно, а не мовчки (NO-SILENT-CAPS).
	 */
	const hidden = $derived(rooms.length - fitting.length);
</script>

<div class="quiz-rooms">
	<details class="quiz-rooms__filter">
		<summary class="quiz-rooms__toggle" data-testid="quiz-games-filter-toggle">
			<SlidersHorizontal size={16} aria-hidden="true" />
			{@html formatFont(text('quiz.gamesFilter'))}
			<!--
				ЧИСЛО ВИБРАНОГО ВИДНО ЗАКРИТИМ, і це головне тут: складене розкриття
				інакше приховувало б сам факт, що фільтр звужений. «6 з 6» читається як
				«нічого не відсіюється» без жодного натиску.
			-->
			<span class="quiz-rooms__count">{picked.length}/{ONLINE_GAMES.length}</span>
		</summary>
		<QuizGamePicker
			{text}
			selected={picked}
			editable={true}
			onchange={onPick}
			legendKey="quiz.gamesWanted"
		/>
		<p class="quiz-rooms__hint" data-testid="quiz-games-filter-hint">
			{@html formatFont(text('quiz.gamesFilterHint'))}
		</p>
	</details>

	<RoomList
		rooms={fitting}
		{resume}
		{friends}
		{hasMore}
		{unavailable}
		{busy}
		{hidden}
		{onEnter}
		{onClose}
	/>
</div>

<style>
	.quiz-rooms {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	/* Рамка, а не тло: панель під нами вже є (`.gate__panel`), і другий шар того
	   самого кольору дав би шов на межі. */
	.quiz-rooms__filter {
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 82%);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
	}

	.quiz-rooms__toggle {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: 44px;
		color: var(--color-text-on-panel);
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	/* Число вибраного тримається праворуч, а не тулиться до підпису. */
	.quiz-rooms__count {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}

	/*
	 * Підказка приглушена КЕГЛЕМ, а не прозорістю — те саме рішення й та сама
	 * причина, що в `.gate__hint`: прозорість тут дає 3.75:1 при потрібних 4.5.
	 */
	.quiz-rooms__hint {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}
</style>
