<script lang="ts">
	import { CircleQuestionMark, LayoutGrid } from 'lucide-svelte';
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
	<OnlineWindow scope="online-create" {focusTitle} {onBack}>
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
			<button
				type="button"
				class="create__choice btn-accent"
				onclick={() => onChoose(false)}
				aria-disabled={busy}
				data-testid="online-create-everyone-btn"
			>
				<span class="create__label">{@html formatFont(t('pairs.everyone'))}</span>
				<span class="create__hint">{@html formatFont(t('online.everyoneHint'))}</span>
			</button>
			<button
				type="button"
				class="create__choice btn-secondary"
				onclick={() => onChoose(true)}
				aria-disabled={busy}
				data-testid="online-create-friends-btn"
			>
				<span class="create__label">{@html formatFont(t('pairs.friendsOnly'))}</span>
				<span class="create__hint">{@html formatFont(t('online.friendsHint'))}</span>
			</button>
		{:else}
			<p class="create__question">{@html formatFont(t('online.searchGames'))}</p>
			<!--
				Дві кнопки розмітки, а не цикл: локатор кожної — літерал, і пункти чеклиста
				називають саме його (`betaChecks.test.ts`). Порядок і значки — ті самі, що в
				меню «Грати».
			-->
			<button
				type="button"
				class="create__choice create__choice--game btn-secondary"
				onclick={() => onGame?.('quiz')}
				data-testid="online-create-quiz-btn"
			>
				<CircleQuestionMark size={28} aria-hidden="true" />
				<span class="create__label">{@html formatFont(t(NAME.quiz))}</span>
			</button>
			<button
				type="button"
				class="create__choice create__choice--game btn-secondary"
				onclick={() => onGame?.('pairs')}
				data-testid="online-create-pairs-btn"
			>
				<LayoutGrid size={28} aria-hidden="true" />
				<span class="create__label">{@html formatFont(t(NAME.pairs))}</span>
			</button>
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
	 * Вибір — кнопка з двома рядками: що це й що це означає. Головна — акцентом
	 * (`.btn-accent`), решта — кнопками (`.btn-secondary`), а не плитками вікна. Висота —
	 * від одиниці вікна (`.fill`), дно — сенсорна ціль.
	 */
	.create__choice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-height: max(56px, calc(var(--fill-u) * 3.5));
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font: inherit;
		text-align: start;
	}

	/* Гра — значок і назва одним рядком: вибір тут один, і пояснювати його нема чого. */
	.create__choice--game {
		flex-direction: row;
		align-items: center;
		gap: var(--space-md);
	}

	.create__label {
		font-weight: var(--font-weight-bold);
	}

	.create__hint {
		font-size: var(--font-size-xs);
	}
</style>
