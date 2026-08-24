<script lang="ts">
	import { Users } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { LobbyRoom } from '$lib/net/lobby';
	import type { OwnRoom } from '$lib/net/ownRooms';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';

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
	 * ## КІМНАТИ ДРУЗІВ УГОРІ СПИСКУ
	 *
	 * Доти цього не було, і не через недогляд: друзі — це два акаунти, взаємно
	 * підписані один на одного, а акаунтів у грі не було ЗОВСІМ. Анонімний `uid`
	 * живе доки живе сховище браузера, тож ні підписатися, ні впізнати того
	 * самого гравця наступного дня було нічим.
	 *
	 * Тепер акаунти є (`net/account.ts`, `net/follows.ts`), і закріплення стало
	 * можливим: сюда приходить перелік `uid` друзів, а рядок кімнати вже несе
	 * `hostUid`. Порожній перелік означає «друзів немає або акаунта немає» — і в
	 * обох випадках список виглядає так, як виглядав доти.
	 */
	interface Props {
		rooms: LobbyRoom[];
		/**
		 * Мої партії, які вже йдуть, — ЗАКРІПЛЕНІ над списком.
		 *
		 * Джерело інше, ніж у `rooms`, і це головне тут: перелік читається з
		 * `lobby`, спільної гілки, а ці — з приватного індексу `myRooms/{uid}`.
		 * Тому закріплений рядок не розкриває нікому нічого: у ньому лежить код,
		 * який я й так знаю, бо це моя кімната.
		 *
		 * У `lobby` розпочатих партій немає навмисно (див. `net/lobby.ts`), і саме
		 * тому вернутися в свою було нічим: код жив лише в адресі й губився разом
		 * із вкладкою.
		 */
		resume: OwnRoom[];
		/**
		 * `uid` друзів — їхні кімнати стоять ОКРЕМОЮ групою зверху.
		 *
		 * Група, а не просто інший порядок: «кімнати друзів» — це відповідь на
		 * інше питання, ніж «які кімнати відкриті». Перемішані з рештою вони
		 * вимагали б порівнювати кожен рядок із пам’яттю про те, хто друг.
		 */
		friends: readonly string[];
		/**
		 * Чи лишилося щось за межею запиту.
		 *
		 * Не «усього N»: запит обмежений правилом бази, тож повної кількості не знає
		 * навіть клієнт (див. `net/lobby.ts`). На питання «чи все я бачу» цього
		 * досить, а числа, якого ніхто не знає, тут не вигадується.
		 */
		hasMore: boolean;
		/** Перелік не читається (правила не викладені). Показуємо чому, а не порожнечу. */
		unavailable: boolean;
		/** Поки триває вхід, кнопки не приймають повторних натискань. */
		busy: boolean;
		onEnter: (code: string) => void;
	}

	let { rooms, resume, friends, hasMore, unavailable, busy, onEnter }: Props = $props();

	/*
	 * Дві групи з одного масиву, і порядок усередині кожної НЕ міняється:
	 * перелік приїжджає впорядкованим за свіжістю (`net/lobby.ts`), і
	 * пересортувати його тут означало б дві різні відповіді на «яка кімната
	 * найновіша» на одному екрані.
	 */
	const friendly = $derived(rooms.filter((room) => friends.includes(room.hostUid)));
	const others = $derived(rooms.filter((room) => !friends.includes(room.hostUid)));

	/*
	 * Обрізку видно РЯДКОМ, а не мовчки (NO-SILENT-CAPS).
	 *
	 * Список без цього рядка читався б як «це всі кімнати», і людина, яка не
	 * знайшла потрібну, вирішила б, що її немає. Тепер це `hasMore` із мережевого
	 * шару — обчислювати тут нічого.
	 */
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
	<!--
		ЗАКРІПЛЕНІ ЗВЕРХУ — і поза `{#if unavailable}`.

		Це не косметика порядку: недоступний перелік і своя розпочата партія — різні
		джерела. `lobby` міг не прочитатися (правила, мережа), а індекс `myRooms`
		прочитався — і рядок «вернутися в партію» мусить бути там, бо саме тоді він
		найпотрібніший: список порожній, а гра йде.
	-->
	{#if resume.length > 0}
		<ul class="rooms__list rooms__list--resume" data-testid="pairs-resume-list">
			{#each resume as room (room.code)}
				<li class="rooms__item rooms__item--resume" data-testid="pairs-resume-{room.code}-item">
					<span class="rooms__who">
						<span class="rooms__host">{@html formatFont(t('pairs.resume'))}</span>
						<span class="rooms__players">{@html formatFont(t('pairs.resumeHint'))}</span>
					</span>
					<button
						type="button"
						class="rooms__enter rooms__enter--resume"
						onclick={() => onEnter(room.code)}
						aria-disabled={busy}
						aria-label="{t('pairs.resume')}: {room.code}"
						data-testid="pairs-resume-{room.code}-btn"
					>
						{@html formatFont(t('pairs.resumeOne'))}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

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
		<!--
			ДВІ ГРУПИ, а не інший порядок в одному списку.
		
			«Кімнати друзів» — відповідь на інше питання, ніж «які кімнати відкриті».
			Перемішані з рештою, вони вимагали б порівнювати кожен рядок із памʼяттю
			про те, хто друг; окремою групою з підписом це видно з одного погляду.
		
			Імʼя господаря показується БЕЗ коду кімнати. Код і так лежить у ключі
			запису, тобто його вже видно кожному, хто читає перелік; але показувати
			його рядком означало б запрошувати переписати код замість натиснути
			кнопку. Прапор стоїть ПЕРЕД імʼям: рядки скануються очима зліва, і прапор
			видно з одного погляду, а імʼя треба прочитати.
		-->
		{#if friendly.length > 0}
			<h3 class="rooms__group">{@html formatFont(t('pairs.friendsRooms'))}</h3>
			<ul class="rooms__list" data-testid="pairs-friend-rooms-list">
				{#each friendly as room (room.code)}
				<li class="rooms__item" data-testid="pairs-room-{room.code}-item">
					<span class="rooms__who">
						<span class="rooms__host">
							<Avatar avatar={room.hostAvatar} />
							<Flag code={room.hostCountry} />
							{room.hostName}
						</span>
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
		{/if}

		{#if others.length > 0}
			<ul class="rooms__list" data-testid="pairs-rooms-list">
				{#each others as room (room.code)}
				<li class="rooms__item" data-testid="pairs-room-{room.code}-item">
					<span class="rooms__who">
						<span class="rooms__host">
							<Avatar avatar={room.hostAvatar} />
							<Flag code={room.hostCountry} />
							{room.hostName}
						</span>
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
		{/if}

		{#if hasMore}
			<p class="rooms__hint" data-testid="pairs-rooms-trimmed-hint">
				{@html formatFont(t('pairs.shownNewest'))}: {rooms.length}
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

	/* Підпис групи: дрібніший за заголовок списку, але тим самим кольором. */
	.rooms__group {
		margin: var(--space-xs) 0 0;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
		text-transform: uppercase;
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
		display: flex;
		align-items: center;
		gap: 6px;
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

	/*
	 * ЗАКРІПЛЕНЕ НЕ ГОРТАЄТЬСЯ. Базовий клас має стелю висоти й прокрутку — для
	 * двадцяти чужих кімнат це правильно, для власної партії ні: рядок, у який
	 * треба вернутися, не має права поїхати під межу разом із рештою.
	 */
	.rooms__list--resume {
		max-height: none;
		overflow: visible;
	}

	/*
	 * Рамка, а не інше тло.
	 *
	 * Тло `--color-bg-card` уже перевірене на всіх чотирьох темах разом із
	 * `--color-text`; підмішати в нього акцент означало б завести пару, якої
	 * гейт контрасту ще не бачив, і завести її в чотирьох темах одночасно.
	 * Рамка виділяє рядок, не торкаючись пари «текст на тлі».
	 */
	.rooms__item--resume {
		border: 2px solid var(--color-accent);
	}

	/* Дія тут головна на всій формі — тож єдина залита акцентом. */
	.rooms__enter--resume {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	@media (hover: hover) {
		.rooms__enter--resume:hover {
			background: color-mix(in srgb, var(--color-accent), var(--color-text) 15%);
		}
	}
</style>
