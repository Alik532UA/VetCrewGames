<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { OnlineGame } from '$lib/utils/crossGame';

	/**
	 * «ХТО ЗМОЖЕ ЗАЙТИ» — ОКРЕМЕ ВІКНО ПІД ЧАС СТВОРЕННЯ КІМНАТИ (рішення автора 2026-09-26, 4).
	 *
	 * Доти вибір стояв у формі входу поруч із кнопкою «Створити», і його доводилося читати ще
	 * до того, як людина вирішила щось створювати. Тепер його питають рівно тоді, коли він
	 * потрібен: після «Створити → гра» на хабі й при переїзді групи в іншу гру (`?from`).
	 *
	 * ДВІ КНОПКИ, А НЕ ПЕРЕМИКАЧ І «СТВОРИТИ»: вибір і є дія, і кожен із двох варіантів несе
	 * власний рядок пояснення — що саме він означає. Від вибору залежить і ДОВЖИНА коду
	 * (`net/rtdbRoom.ts`, `NewRoom.isPrivate`), тож питати доводиться до створення.
	 *
	 * «Для всіх» — перша й акцентна: кімната в переліку робить корисними і перелік, і
	 * автоматичний пошук. «Лише друзі» — поза переліком, за кодом; справжнього переліку
	 * друзів тут немає й не треба: «друзі» — це ті, кому ви дали код.
	 */
	interface Props {
		game: OnlineGame;
		/** Поки кімната створюється, кнопки не приймають повторних натискань. */
		busy: boolean;
		onChoose: (isPrivate: boolean) => void;
		onBack: () => void;
	}

	let { game, busy, onChoose, onBack }: Props = $props();

	const NAME = { quiz: 'menu.quiz', pairs: 'menu.game.memory' } as const;
</script>

<section class="create" data-testid="online-create-panel">
	<h2 class="create__title">
		{@html formatFont(t('online.createTitle'))}
		<b data-testid="online-create-game-value">{@html formatFont(t(NAME[game]))}</b>
	</h2>
	<p class="create__question">{@html formatFont(t('pairs.visibility'))}</p>

	<button
		type="button"
		class="create__choice create__choice--main"
		onclick={() => onChoose(false)}
		aria-disabled={busy}
		data-testid="online-create-everyone-btn"
	>
		<span class="create__label">{@html formatFont(t('pairs.everyone'))}</span>
		<span class="create__hint">{@html formatFont(t('online.everyoneHint'))}</span>
	</button>
	<button
		type="button"
		class="create__choice"
		onclick={() => onChoose(true)}
		aria-disabled={busy}
		data-testid="online-create-friends-btn"
	>
		<span class="create__label">{@html formatFont(t('pairs.friendsOnly'))}</span>
		<span class="create__hint">{@html formatFont(t('online.friendsHint'))}</span>
	</button>

	<button type="button" class="create__back" onclick={onBack} data-testid="online-create-back-btn">
		{@html formatFont(t('online.back'))}
	</button>
</section>

<style>
	/* Та сама панель, що вікно «вас запросили» (`InviteWindow`), — одна ширина на телефон. */
	.create {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: min(26rem, 100%);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
	}

	.create__title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-on-panel);
	}

	.create__question {
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Вибір — кнопка з двома рядками: що це й що це означає. Друга — рамкою без заливки,
	 * перша — акцентом.
	 */
	.create__choice {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		min-height: 56px;
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}

	.create__choice--main {
		border-color: transparent;
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.create__label {
		font-weight: var(--font-weight-bold);
	}

	.create__hint {
		font-size: var(--font-size-xs);
	}

	.create__back {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text-on-panel);
		font: inherit;
		cursor: pointer;
	}
</style>
