<script lang="ts">
	import { tick } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import YouTag from '$lib/components/ui/YouTag.svelte';
	import Flag from '$lib/components/ui/Flag.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import GameDialog from '$lib/components/ui/GameDialog.svelte';
	import type { CrossGameLinks } from '$lib/utils/crossGame';
	import type { PairsMatch } from '$lib/controllers/pairsMatch.svelte';

	/**
	 * ПІДСУМОК СПІЛЬНОЇ «ЗНАЙДИ ПАРУ» — вікном поверх карток (прохання автора 2026-09-28).
	 *
	 * ## Що було не так
	 *
	 * Підсумок стояв рядком над табло й дошкою: заголовок, кнопки різних розмірів і рахунок
	 * гравців — три блоки, що ділили екран із картками. Автор назвав це «дивний скомканий не
	 * структурований UX» і попросив: картки — на тлі, а результати й кнопки — у вікні поверх
	 * них, результати над кнопками.
	 *
	 * ## Як тепер
	 *
	 * Вікно (`ui/GameDialog`, те саме, що «Чекаємо» у вікторині): як скінчилася партія, хто
	 * скільки пар зібрав — від більшого рахунку, — скільки було ходів, а під ними дії. Картки
	 * лишаються під підкладкою.
	 *
	 * «ПОДИВИТИСЯ НА КАРТКИ» (відповідь автора A): після партії на картки дивляться — «а де ж
	 * була та друга сова», — і вікно поверх них не мусить цьому заважати. Воно ховається, а
	 * кнопка «Підсумок» внизу повертає його. Сховане стосується лише ЦІЄЇ партії: реванш
	 * приходить із новим зерном, і його підсумок знову показується вікном.
	 */
	interface Props {
		match: PairsMatch;
		/** Хто я: позначка «ви» у своєму рядку. */
		me: string;
		/** Нова партія; `undefined` — я не господар або пари немає. */
		onRematch?: () => void;
		/** Закрити кімнату назовсім — лише господар. */
		onClose?: () => void;
		/** Я дивився — і хочу грати наступну. `undefined` — я вже гравець. */
		onPlayNext?: () => void;
		/** Чи я господар: лише він створює кімнату іншої гри. */
		amHost?: boolean;
		/** Адреси переїзду в другу гру (будує сторінка). */
		cross: CrossGameLinks;
	}

	let { match, me, onRematch, onClose, onPlayNext, amHost = false, cross }: Props = $props();

	/** Скільки пар зібрав кожен: рахунок живе в правилах, не в кімнаті. */
	const scoreOf = (uid: string) => match.game.players.find((p) => p.id === uid)?.score ?? 0;
	const memberOf = (uid: string) => match.members.find((m) => m.uid === uid);

	/** Хто переміг. `null` — нічия. Відповідь дає матч: те саме число йде в нагороди. */
	const winner = $derived(match.players.find((player) => player.uid === match.winnerUid) ?? null);

	/** Від більшого рахунку до меншого; рівні — у порядку складу (сортування стабільне). */
	const ranked = $derived([...match.players].sort((a, b) => scoreOf(b.uid) - scoreOf(a.uid)));

	/** Для якої партії підсумок сховано, щоб роздивитися картки (за зерном). */
	let cardsFor = $state<number | null>(null);
	const showingCards = $derived(cardsFor === match.seed);

	let cardsButton = $state<HTMLButtonElement>();
	let resultButton = $state<HTMLButtonElement>();

	/*
	 * Фокус іде за кнопкою, що замінила натиснуту: інакше після натиску він падав би на
	 * `body`, і з клавіатури довелося б шукати дорогу назад від початку сторінки.
	 */
	async function showCards() {
		cardsFor = match.seed;
		await tick();
		resultButton?.focus();
	}

	async function showResult() {
		cardsFor = null;
		await tick();
		cardsButton?.focus();
	}
</script>

{#if showingCards}
	<button
		type="button"
		class="result__back fill"
		bind:this={resultButton}
		onclick={showResult}
		data-testid="pairs-show-result-btn"
	>
		{@html formatFont(t('pairs.showResult'))}
	</button>
{:else}
	<GameDialog testId="pairs-result-backdrop">
		<!--
			`role="status"`: кінець партії оголошує саме вікно — рядок черги над дошкою під час
			партії про це мовчить, щоб не казати того самого двічі.
		-->
		<section
			class="result text-panel fill fill-window"
			role="status"
			data-testid="pairs-result-panel"
		>
			<!--
				ЯК партія скінчилася — окремим рядком, і він тут не для повноти. «Перемога: Аня 4:2»
				над тим, хто пішов на другому ході, — правда про рахунок і неправда про партію.
			-->
			{#if match.endedBy !== null}
				<span class="result__hint" data-testid="pairs-ended-early-hint">
					{@html formatFont(t('pairs.endedEarly'))}
				</span>
			{/if}
			<!--
				«Перемога: Аня», а не «Аня перемогла»: імʼя тут вільний рядок, і роду ми не знаємо.
			-->
			<b class="result__title" data-testid="pairs-result-text">
				{#if winner}
					{@html formatFont(t('pairs.won'))}: {winner.name}{#if winner.uid === me}
						<YouTag />
					{/if}
				{:else}
					{@html formatFont(t('pairs.draw'))}
				{/if}
			</b>

			<!-- РЕЗУЛЬТАТИ НАД КНОПКАМИ — дослівно прохання автора. -->
			<ul class="result__players">
				{#each ranked as player (player.uid)}
					<li
						class="result__player"
						class:result__player--won={player.uid === match.winnerUid}
						data-testid="pairs-result-{player.uid}-item"
					>
						{#if player.uid === me}<YouTag />{/if}
						<Flag code={memberOf(player.uid)?.country} />
						<Avatar avatar={memberOf(player.uid)?.avatar} />
						<span class="result__name">{player.name}</span>
						<b class="result__score">{scoreOf(player.uid)}</b>
					</li>
				{/each}
			</ul>
			<span class="result__moves" data-testid="pairs-result-moves-value">
				{@html formatFont(t('memory.moves'))}: {match.game.moves}
			</span>

			<!--
				ДІЇ — стовпцем однакової ширини: головна зверху, «Закрити кімнату» — під переходом у
				другу гру, а «Подивитися на картки» — останньою, бо вона нічого не міняє.

				«Закрити» — ОКРЕМО ВІД «Зіграти ще» (аудит 2026-09-25): господар без пари чує, чого
				бракує, а закрити може завжди; гість чекає господаря.
			-->
			<div class="result__actions">
				{#if onRematch}
					<button
						type="button"
						class="btn-primary"
						onclick={onRematch}
						data-testid="pairs-rematch-btn"
					>
						{@html formatFont(t('pairs.rematch'))}
					</button>
				{:else if onClose}
					<span class="result__hint" data-testid="pairs-need-players-text">
						{@html formatFont(t('pairs.needPlayers'))}
					</span>
				{:else}
					<span class="result__hint">{@html formatFont(t('pairs.waitingHost'))}</span>
				{/if}
				{#if onPlayNext}
					<button
						type="button"
						class="btn-secondary"
						onclick={onPlayNext}
						data-testid="pairs-play-next-btn"
					>
						{@html formatFont(t('pairs.playNext'))}
					</button>
				{/if}
				<!--
					Посилання, а не кнопки: це навігація, і «відкрити в новій вкладці» мусить працювати.
					Господар створює кімнату іншої гри, решта переходить за оголошеним кодом.
				-->
				{#if cross.next}
					<a href={cross.next} class="btn-primary" data-testid="room-next-link">
						{@html formatFont(t('room.goNext'))}
					</a>
				{:else if amHost}
					<a href={cross.create} class="btn-secondary" data-testid="room-other-game-link">
						{@html formatFont(t(cross.createLabel))}
					</a>
				{/if}
				{#if onClose}
					<button
						type="button"
						class="btn-secondary"
						onclick={onClose}
						data-testid="pairs-close-btn"
					>
						{@html formatFont(t('pairs.closeRoom'))}
					</button>
				{/if}
				<button
					type="button"
					class="result__cards"
					bind:this={cardsButton}
					onclick={showCards}
					data-testid="pairs-show-cards-btn"
				>
					{@html formatFont(t('pairs.showCards'))}
				</button>
			</div>
		</section>
	</GameDialog>
{/if}

<style>
	.result {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-lg);
		overflow-y: auto;
		text-align: center;
	}

	.result__title {
		font-size: var(--font-size-2xl);
	}

	.result__hint {
		font-size: var(--font-size-sm);
		opacity: 0.75;
	}

	.result__players {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(100%, calc(var(--fill-u) * 24));
		margin: 0;
		padding: 0;
		list-style: none;
		font-variant-numeric: tabular-nums;
	}

	/* Рядок гравця: позначки, імʼя, а рахунок — праворуч, щоб числа стояли стовпцем. */
	.result__player {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		text-align: left;
	}

	/* Переможець — обводкою, як черга в таблі: колір тексту лишається тим самим (контраст). */
	.result__player--won {
		outline: 2px solid var(--color-accent);
		outline-offset: 1px;
	}

	.result__name {
		flex: 1;
		overflow-wrap: anywhere;
	}

	.result__score {
		font-size: var(--font-size-lg);
	}

	/* Ходи — одним числом під гравцями: це про партію, а не про когось із них. */
	.result__moves {
		font-variant-numeric: tabular-nums;
	}

	/*
	 * Дії однакової ширини й висоти — і текст посередині. Доти «Зіграти у „Вікторину“» була
	 * посиланням із класом кнопки без `display`, і в рядку поруч із вищими кнопками її текст
	 * прилипав до верху (знімок автора 2026-09-28).
	 */
	.result__actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(100%, calc(var(--fill-u) * 24));
	}

	/*
	 * `font: inherit` — бо `.btn-secondary` шрифту не задає, і `<button>` брав дрібний шрифт
	 * браузера, а `<a>` поруч — шрифт панелі: «Закрити кімнату» стояла дрібніше за «Зіграти у
	 * „Вікторину“». Головна дія лишається більшою й жирною — окремим правилом нижче.
	 */
	.result__actions > * {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: max(44px, calc(var(--fill-u) * 2.75));
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
		text-align: center;
		text-decoration: none;
	}

	.result__actions > .btn-primary {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
	}

	/* «Подивитися на картки» — тихіша за решту: вона нічого не міняє в кімнаті. */
	.result__cards {
		border: 1px solid color-mix(in srgb, var(--color-text-on-panel), transparent 70%);
		border-radius: var(--radius-sm);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	/*
	 * «ПІДСУМОК» — поки дивляться на картки. Знизу посередині, над дошкою й під шапкою
	 * (`GameHeader`, 100), як смуга «Забрати хід»: картки під нею не зсуваються.
	 */
	.result__back {
		position: fixed;
		bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-md));
		left: 50%;
		z-index: 90;
		min-height: max(44px, calc(var(--fill-u) * 2.75));
		padding: 0 var(--space-lg);
		border: 1px solid var(--color-accent);
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		transform: translateX(-50%);
		cursor: pointer;
	}
</style>
