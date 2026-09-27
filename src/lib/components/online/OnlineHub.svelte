<script lang="ts">
	import { CirclePlus, LogIn, Zap } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import IdentityRow from '$lib/components/pairs/IdentityRow.svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import type { HubWindowKind } from '$lib/controllers/onlineHub.svelte';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * ХАБ «ГРАТИ ОНЛАЙН» — вигляд (рішення автора 2026-09-26; розкладка — 2026-09-27).
	 *
	 * Компонент нічого не знає ні про базу, ні про кімнату — він збирає поля й кличе те, що
	 * дали; усе інше — `controllers/onlineHub.svelte.ts`. Доти на цьому місці стояла форма
	 * входу ОДНІЄЇ гри (`OnlineGate`), і в кожної гри своя: код кімнати іншої гри там давав
	 * глухий кут, а блоків було стільки, що автор назвав їх «можуть налякати гравця».
	 *
	 * ## ДВА СТОВПЦІ
	 *
	 *   1. Три дороги в гру — три кнопки, і кожна відкриває СВОЄ вікно (6-A і 7-A):
	 *      «Автоматичний пошук» (`SearchWindow`), «Створити кімнату» (`CreateWindow`),
	 *      «Підключитися» (`JoinWindow`). Доти пошук, створення й код стояли на хабі
	 *      відкритими формами, і хаб читався як анкета, а не як вибір дороги.
	 *   2. «Як вас звати?» одним рядком і «Кімнати» — те, що спільне для всіх доріг, і
	 *      вибір із того, що вже є (перелік передали сніпетом).
	 *
	 * Під кожною дорогою — рядок, що вона означає: три кнопки поруч інакше розрізнялися б
	 * лише словом. Рядок — опис (`aria-describedby`), а не частина назви: читалка каже
	 * «Автоматичний пошук, кнопка», а тоді пояснення.
	 */
	interface Props {
		/** Імʼя гравця. Двобічне: хаб його ще й памʼятає у сховищі. */
		name: string;
		/** Прапор гравця. Порожній рядок — без прапора. Двобічне. */
		country: string;
		/** Аватарка; порожньо — не вибирав. Вибір зберігає власник (`PlayerIdentity`). */
		avatar: string;
		onAvatar: (avatar: string) => void;
		/** Кубик: підставити інше імʼя (словник і зайняті імена знає власник). */
		onRandomName: () => void;
		/** Відкрити вікно дороги. */
		onOpen: (kind: HubWindowKind) => void;
		/**
		 * Дорога, чиє вікно щойно закрилося, — її кнопка бере фокус назад: доти він падав на
		 * `body` разом із вікном. `null` на першому показі сторінки: фокус там не забирають.
		 */
		returnFocus?: HubWindowKind | null;
		/** Перелік кімнат — другий стовпець. Малює СТОРІНКА: вона знає мережу. */
		roomList?: import('svelte').Snippet;
	}

	let {
		name = $bindable(),
		country = $bindable(),
		avatar,
		onAvatar,
		onRandomName,
		onOpen,
		returnFocus = null,
		roomList
	}: Props = $props();

	const ROADS: ReadonlyArray<{
		kind: HubWindowKind;
		icon: typeof Zap;
		label: TranslationKey;
		lead: TranslationKey;
	}> = [
		{ kind: 'search', icon: Zap, label: 'online.search', lead: 'online.searchLead' },
		{ kind: 'create', icon: CirclePlus, label: 'pairs.createRoom', lead: 'online.createLead' },
		{ kind: 'join', icon: LogIn, label: 'online.join', lead: 'online.joinLead' }
	];

	const refocus = (kind: HubWindowKind) => (node: HTMLElement) => {
		if (returnFocus === kind) node.focus();
	};
</script>

<!--
	ОБГОРТКА ІСНУЄ ЗАРАДИ ОДНОГО РЯДКА CSS — `container-type` на ній: стовпців стільки,
	скільки місця ДАЛИ хабу, а не скільки має екран (FLUID-SIZING-v8, `FS-CONTAINER`).
-->
<div class="hub-shell">
	<div class="hub">
		<!-- ── 1. Три дороги ───────────────────────────────────────────────────── -->
		<div class="hub__roads">
			{#each ROADS as road (road.kind)}
				<button
					type="button"
					class="hub__road"
					class:btn-accent={road.kind === 'search'}
					class:btn-secondary={road.kind !== 'search'}
					onclick={() => onOpen(road.kind)}
					aria-labelledby="online-{road.kind}-open-label"
					aria-describedby="online-{road.kind}-open-lead"
					data-testid="online-{road.kind}-open-btn"
					{@attach refocus(road.kind)}
				>
					<DynamicIcon icon={road.icon} size={28} aria-hidden="true" />
					<span class="hub__road-text">
						<span id="online-{road.kind}-open-label" class="hub__road-label">
							{@html formatFont(t(road.label))}
						</span>
						<span id="online-{road.kind}-open-lead" class="hub__road-lead">
							{@html formatFont(t(road.lead))}
						</span>
					</span>
				</button>
			{/each}
		</div>

		<!-- ── 2. Хто я й кімнати ──────────────────────────────────────────────── -->
		<div class="hub__side">
			<section class="hub__panel">
				<IdentityRow bind:name bind:country {avatar} {onAvatar} {onRandomName} />
			</section>
			{#if roomList}
				<section class="hub__panel">
					{@render roomList()}
				</section>
			{/if}
		</div>
	</div>
</div>

<style>
	/*
	 * Бічне поле — ТУТ, бо в сторінки його немає; контейнер оголошений на обгортці, а не на
	 * самому хабі: запит дивиться на ПРЕДКА, а ширина `.hub` — це те, що він і вирішує.
	 */
	.hub-shell {
		container-type: inline-size;
		width: 100%;
		padding-inline: var(--space-md);
		box-sizing: border-box;
	}

	/* На вузькому — стовпчик по центру; `margin-inline: auto`, бо центрує сам хаб. */
	.hub {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 26rem;
		margin-inline: auto;
	}

	/*
	 * ДВА СТОВПЦІ, щойно вміщаються: ліворуч дороги, праворуч «хто я» й перелік. Правий
	 * ширший: там імʼя одним рядком і рядки кімнат, а ліворуч — три кнопки. 48rem — два
	 * стовпці по ~20 і 28rem, тобто «хто я» ще стоїть в один рядок (`IdentityRow`, 30rem без
	 * поля панелі); `align-items: start` не тягне стовпці до найвищого.
	 */
	@container (min-width: 48rem) {
		.hub {
			display: grid;
			grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
			align-items: start;
			max-width: none;
		}
	}

	.hub__roads,
	.hub__side {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		min-width: 0;
	}

	/*
	 * Дорога — значок і два рядки: назва й що вона означає. Висота — від вмісту, а не від
	 * екрана: доти кнопки росли коробкою, і текст займав у них десяту частину (прохання
	 * автора 2026-09-27). Росте весь хаб одним масштабом (`fitToViewport`, сторінка).
	 *
	 * Вигляд — КНОПКИ, а не панелі (`.btn-accent`, `.btn-secondary` у global.css): доти
	 * «Створити кімнату» й «Підключитися» мали тло й тінь панелей «Як вас звати?» і
	 * «Кімнати», і дорогу від довідки відрізнити було нічим. Пошук — акцентом, як була
	 * «Швидка гра»: найкоротший шлях у гру читається першим.
	 */
	.hub__road {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		width: 100%;
		min-height: 64px;
		padding: var(--space-md);
		border-radius: var(--radius-md);
		font: inherit;
		text-align: start;
	}

	.hub__road-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.hub__road-label {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
	}

	/* Пояснення приглушене КЕГЛЕМ, а не прозорістю — та сама причина, що в `RoomList`. */
	.hub__road-lead {
		font-size: var(--font-size-sm);
	}

	.hub__panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
	}
</style>
