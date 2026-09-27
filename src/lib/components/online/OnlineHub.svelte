<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import InputTools from '$lib/components/ui/InputTools.svelte';
	import IdentityRow from '$lib/components/pairs/IdentityRow.svelte';
	import SearchBlock from './SearchBlock.svelte';
	import { CODE_MAX, CODE_MIN } from '$lib/controllers/onlineHub.svelte';
	import type { SearchPhase } from '$lib/controllers/autoSearch.svelte';
	import type { OnlineGame } from '$lib/utils/crossGame';

	/**
	 * ХАБ «ГРАТИ ОНЛАЙН» — вигляд (рішення автора 2026-09-26).
	 *
	 * Компонент нічого не знає ні про базу, ні про кімнату — він збирає поля й кличе те, що
	 * дали; усе інше — `controllers/onlineHub.svelte.ts`. Доти на цьому місці стояла форма
	 * входу ОДНІЄЇ гри (`OnlineGate`), і в кожної гри своя: код кімнати іншої гри там давав
	 * глухий кут, а блоків було стільки, що автор назвав їх «можуть налякати гравця».
	 *
	 * ## П'ЯТЬ ОКРЕМИХ БЛОКІВ, кожен на власному тлі
	 *
	 *   1. Автоматичний пошук — ігри й кнопка (`SearchBlock`)
	 *   2. Хто я             — імʼя, прапор, аватарка, спільні для всіх шляхів
	 *   3. Створити           — гра; «хто зможе зайти» питає окреме вікно (`CreateWindow`)
	 *   4. Підключитися       — код без вибору гри: гру каже сама кімната
	 *   5. Кімнати            — те, що передали сніпетом (перелік обох ігор)
	 *
	 * Між блоками видно сторінку, а не риску: вибори взаємно виключні, і риска всередині
	 * одного тла читалася б як абзац, а не як інший вибір (так сказав автор про першу
	 * редакцію форми входу).
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
		/** Код кімнати, який ввели руками. Двобічне. */
		joinCode: string;
		/** Поки хаб питає кімнату за кодом, «Підключитися» не приймає повторних натискань. */
		busy: boolean;
		searchGames: readonly OnlineGame[];
		searchPhase: SearchPhase;
		onToggleGame: (game: OnlineGame) => void;
		onSearch: () => void;
		onCancelSearch: () => void;
		onCreate: (game: OnlineGame) => void;
		onJoin: () => void;
		/** Перелік кімнат — пʼятий блок. Малює СТОРІНКА: вона знає мережу. */
		roomList?: import('svelte').Snippet;
	}

	let {
		name = $bindable(),
		country = $bindable(),
		avatar,
		onAvatar,
		onRandomName,
		joinCode = $bindable(),
		busy,
		searchGames,
		searchPhase,
		onToggleGame,
		onSearch,
		onCancelSearch,
		onCreate,
		onJoin,
		roomList
	}: Props = $props();

	let codeInput = $state<HTMLInputElement | null>(null);

	/**
	 * Код зводиться до ЦИФР одразу, у значенні, а не лише на вигляд: вставка з мессенджера
	 * приносить пробіли, дефіси й «код: », і кнопка, що дивиться на довжину, була б сірою на
	 * правильному коді. Провідні нулі зберігаються: «07» — чинний двоцифровий код.
	 */
	const normaliseCode = (raw: string) => raw.replace(/\D/g, '').slice(0, CODE_MAX);

	/** Поки пошук іде, створювати й підключатися не можна: це дві дороги в дві кімнати. */
	const searching = $derived(searchPhase !== 'idle');
</script>

<!--
	ОБГОРТКА ІСНУЄ ЗАРАДИ ОДНОГО РЯДКА CSS — `container-type` на ній: стовпців стільки,
	скільки місця ДАЛИ хабу, а не скільки має екран (FLUID-SIZING-v8, `FS-CONTAINER`).
-->
<div class="hub-shell">
	<div class="hub">
		<!-- ── 1. Автоматичний пошук ─────────────────────────────────────────────── -->
		<div class="hub__search">
			<SearchBlock
				games={searchGames}
				phase={searchPhase}
				onToggle={onToggleGame}
				onStart={onSearch}
				onCancel={onCancelSearch}
			/>
		</div>

		<!-- ── 2. Хто я ─────────────────────────────────────────────────────────── -->
		<section class="hub__panel hub__panel--name">
			<IdentityRow bind:name bind:country {avatar} {onAvatar} {onRandomName} />
		</section>

		<!-- ── 3. Створити ──────────────────────────────────────────────────────── -->
		<section class="hub__panel hub__panel--create">
			<h2 class="hub__title">{@html formatFont(t('pairs.createRoom'))}</h2>
			<div class="hub__games">
				<button
					type="button"
					class="btn-primary hub__game"
					onclick={() => onCreate('quiz')}
					aria-disabled={searching}
					data-testid="online-create-quiz-btn"
				>
					{@html formatFont(t('menu.quiz'))}
				</button>
				<button
					type="button"
					class="btn-primary hub__game"
					onclick={() => onCreate('pairs')}
					aria-disabled={searching}
					data-testid="online-create-pairs-btn"
				>
					{@html formatFont(t('menu.game.memory'))}
				</button>
			</div>
		</section>

		<!-- ── 4. Підключитися ──────────────────────────────────────────────────── -->
		<section class="hub__panel hub__panel--join">
			<label class="hub__label" for="online-code">
				<span>{@html formatFont(t('pairs.roomCode'))}</span>
			</label>
			<!--
				`inputmode="numeric"` — цифрова клавіатура на телефоні. Не `type="number"`: той
				ковтає провідні нулі й приймає `e` та мінус, а код — рядок цифр, а не число.
			-->
			<div class="field-shell has-input-tools">
				<input
					id="online-code"
					type="text"
					bind:this={codeInput}
					bind:value={joinCode}
					oninput={() => (joinCode = normaliseCode(joinCode))}
					maxlength={CODE_MAX}
					class="hub__code"
					inputmode="numeric"
					pattern="[0-9]*"
					autocomplete="off"
					spellcheck="false"
					data-testid="online-code-input"
				/>
				<InputTools
					bind:value={joinCode}
					input={codeInput}
					scope="online-code"
					fieldLabel={t('pairs.roomCode')}
					onchange={(raw) => (joinCode = normaliseCode(raw))}
				/>
			</div>
			<button
				type="button"
				class="btn-primary"
				onclick={onJoin}
				aria-disabled={busy || searching || joinCode.trim().length < CODE_MIN}
				data-testid="online-join-btn"
			>
				{@html formatFont(t('online.join'))}
			</button>
		</section>

		<!-- ── 5. Кімнати ───────────────────────────────────────────────────────── -->
		{#if roomList}
			<section class="hub__panel hub__panel--rooms">
				{@render roomList()}
			</section>
		{/if}
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
		max-width: 22rem;
		margin-inline: auto;
	}

	/*
	 * ТРИ СТОВПЦІ НА ШИРОКОМУ — та сама розкладка, що була в форми входу: ліворуч дії
	 * (підключитися, створити), у центрі — найкоротший шлях у гру й «хто я», праворуч —
	 * вибір із того, що вже є. `grid-template-areas` розставляє ті самі вузли, не
	 * торкаючись розмітки, тож вузький екран лишається в порядку розмітки. 64rem — три
	 * стовпці по 20rem і два проміжки; `align-items: start` не тягне панелі до найвищої.
	 */
	@container (min-width: 64rem) {
		.hub {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			grid-template-areas:
				'join search rooms'
				'create name rooms';
			align-items: start;
			max-width: none;
		}

		.hub__search {
			grid-area: search;
		}

		.hub__panel--name {
			grid-area: name;
		}

		.hub__panel--create {
			grid-area: create;
		}

		.hub__panel--join {
			grid-area: join;
		}

		.hub__panel--rooms {
			grid-area: rooms;
		}
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

	.hub__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
		text-transform: uppercase;
	}

	/* Дві гри — поруч, поки вміщаються, і одна під одною, коли ні. */
	.hub__games {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-sm);
	}

	.hub__game {
		flex: 1 1 8rem;
	}

	.hub__label {
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/* Код диктують уголос і вводять великими: так його й показуємо. */
	.hub__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
	}
</style>
