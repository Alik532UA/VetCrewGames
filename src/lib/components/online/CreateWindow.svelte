<script lang="ts">
	import { CircleQuestionMark, Globe, LayoutGrid, Lock } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import OnlineWindow from './OnlineWindow.svelte';
	import type { OnlineGame } from '$lib/utils/crossGame';

	/**
	 * «СТВОРИТИ КІМНАТУ» — ДВА ЕКРАНИ ОДНОГО ВІКНА (рішення автора 2026-09-27, 7-A): спершу
	 * гра, тоді «хто зможе зайти». Доти гру вибирали дві кнопки на самому хабі, і вікно
	 * відкривалося вже з нею.
	 *
	 * «ХТО ЗМОЖЕ ЗАЙТИ» — окремим питанням (рішення автора 2026-09-26, 4). Доти вибір стояв у
	 * формі входу поруч із кнопкою «Створити», і його доводилося читати ще до того, як
	 * людина вирішила щось створювати. Тепер його питають рівно тоді, коли він потрібен:
	 * після вибору гри на хабі й при переїзді групи в іншу гру (`?from`) — там гра вже
	 * відома, і вікно відкривається одразу з другого екрана.
	 *
	 * ДВІ КНОПКИ, А НЕ ПЕРЕМИКАЧ І «СТВОРИТИ»: вибір і є дія, і кожен із двох варіантів несе
	 * власний рядок пояснення — що саме він означає. Від вибору залежить і ДОВЖИНА коду
	 * (`net/rtdbRoom.ts`, `NewRoom.isPrivate`), тож питати доводиться до створення.
	 *
	 * «Для всіх» — перша й акцентна: кімната в переліку робить корисними і перелік, і
	 * автоматичний пошук. «Лише друзі» — поза переліком, за кодом; справжнього переліку
	 * друзів тут немає й не треба: «друзі» — це ті, кому ви дали код.
	 *
	 * Кожен екран — окреме вікно для фокуса (`{#key}`): кнопка гри зникає під пальцем, і
	 * фокус переїжджає на заголовок другого екрана, а «Назад» — на заголовок першого.
	 */
	interface Props {
		/** Гра кімнати; `null` — перший екран, вибір гри (лише на хабі). */
		game: OnlineGame | null;
		/** Вибрали гру на першому екрані. */
		onGame?: (game: OnlineGame) => void;
		/** Поки кімната створюється, кнопки не приймають повторних натискань. */
		busy: boolean;
		onChoose: (isPrivate: boolean) => void;
		onBack: () => void;
		/** Вікно відкрила людина: фокус — на заголовок (`OnlineWindow`). */
		focusTitle?: boolean;
	}

	let { game, onGame, busy, onChoose, onBack, focusTitle = false }: Props = $props();

	const NAME = { quiz: 'menu.quiz', pairs: 'menu.game.memory' } as const;
</script>

{#key game}
	<OnlineWindow scope="online-create" {focusTitle} {onBack} wide>
		{#snippet title()}
			{#if game}
				{@html formatFont(t('online.createTitle'))}
				<b data-testid="online-create-game-value">{@html formatFont(t(NAME[game]))}</b>
			{:else}
				{@html formatFont(t('pairs.createRoom'))}
			{/if}
		{/snippet}

		{#if game}
			<p class="create__question">{@html formatFont(t('pairs.visibility'))}</p>
			<div class="menu-tile-grid">
				<button
					type="button"
					class="menu-btn menu-tile btn-accent"
					onclick={() => onChoose(false)}
					aria-disabled={busy}
					data-testid="online-create-everyone-btn"
				>
					<Globe class="menu-tile__icon" aria-hidden="true" />
					<span class="create__label">{@html formatFont(t('pairs.everyone'))}</span>
					<span class="menu-tile__hint">{@html formatFont(t('online.everyoneHint'))}</span>
				</button>
				<button
					type="button"
					class="menu-btn menu-btn--game menu-tile"
					onclick={() => onChoose(true)}
					aria-disabled={busy}
					data-testid="online-create-friends-btn"
				>
					<Lock class="menu-tile__icon" aria-hidden="true" />
					<span class="create__label">{@html formatFont(t('pairs.friendsOnly'))}</span>
					<span class="menu-tile__hint">{@html formatFont(t('online.friendsHint'))}</span>
				</button>
			</div>
		{:else}
			<p class="create__question">{@html formatFont(t('online.searchGames'))}</p>
			<!--
				Дві кнопки розмітки, а не цикл: локатор кожної — літерал, і пункти чеклиста
				називають саме його (`betaChecks.test.ts`). Порядок, значки й сам вигляд — ті самі,
				що в меню «Грати»: той самий вибір, та сама плитка.
			-->
			<div class="menu-tile-grid">
				<button
					type="button"
					class="menu-btn menu-btn--game menu-tile"
					onclick={() => onGame?.('quiz')}
					data-testid="online-create-quiz-btn"
				>
					<CircleQuestionMark class="menu-tile__icon" aria-hidden="true" />
					<span>{@html formatFont(t(NAME.quiz))}</span>
				</button>
				<button
					type="button"
					class="menu-btn menu-btn--game menu-tile"
					onclick={() => onGame?.('pairs')}
					data-testid="online-create-pairs-btn"
				>
					<LayoutGrid class="menu-tile__icon" aria-hidden="true" />
					<span>{@html formatFont(t(NAME.pairs))}</span>
				</button>
			</div>
		{/if}
	</OnlineWindow>
{/key}

<style>
	.create__question {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * ВИБІР — ПЛИТКАМИ МЕНЮ «ГРАТИ», а не рядками-кнопками (прохання автора 2026-09-27: «як
	 * тобі великі відступи і не великі кнопки?»): сітка й пояснення — глобальні
	 * (`.menu-tile-grid`, `.menu-tile__hint`), спільні з пошуком і вибором режиму.
	 */
	.create__label {
		font-weight: var(--font-weight-bold);
	}
</style>
