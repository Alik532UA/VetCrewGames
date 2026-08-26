<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import type { FeedingGameController } from '$lib/controllers/feedingGame.svelte';
	import FeedingDish, { type QuickTarget } from './FeedingDish.svelte';

	/**
	 * Стіл зі стравами — і ціль, куди їх повертають.
	 *
	 * Поводиться як зона: та сама пара «клік або перетягування», той самий
	 * `role="button"` поверх дітей-кнопок. Після годування стіл порожній завжди
	 * (залишки їдуть у смітник), і саме тому в нього стає кнопка «Далі»: по неї
	 * не треба тягнутися вниз повз увесь розбір.
	 */
	interface Props {
		game: FeedingGameController;
		targets: QuickTarget[];
		/**
		 * Онлайн: кнопки «Далі» немає.
		 *
		 * Прохання автора: «після вибору відповіді немає кнопки „Далі“, бо це онлайн
		 * режим і далі буде автоматично, коли всі зроблять вибір». Той самий проп, що
		 * вже є в чотирьох інших дошок вікторини, — тут його просто не було, і саме
		 * тому «Роздай страви» лишалася єдиною грою з кнопкою, яка нічого не вирішує:
		 * наступний раунд у кімнаті оголошує господар, а не гравець.
		 */
		hideNext?: boolean;
	}

	let { game, targets, hideNext = false }: Props = $props();

	/** Сюди повертають страву, яку передумали віддавати. */
	function returnToTable() {
		if (game.picked) game.takeBack(game.picked);
	}
</script>

	<!--
		Стіл поводиться як зона: та сама пара «клік або перетягування», той
		самий `role="button"` поверх дітей-кнопок — див. FeedingZone.
	-->
	<div
		class="table"
		class:table--active={game.picked !== null && !game.fed}
		role="button"
		tabindex="0"
		aria-label={t('feeding.table')}
		data-testid="feeding-table-container"
		onclick={returnToTable}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				returnToTable();
			}
		}}
		ondragover={(e) => {
			if (game.fed) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		}}
		ondrop={(e) => {
			e.preventDefault();
			returnToTable();
		}}
	>
		{#each game.unplaced as food (food.id)}
			<FeedingDish
				{food}
				picked={game.picked?.id === food.id}
				dimmed={game.picked !== null && game.picked.id !== food.id}
				disabled={game.fed}
				{targets}
				onpick={() => game.pick(food)}
				onsend={(target) => game.moveTo(food, target)}
			/>
		{/each}
		{#if game.fed && !hideNext}
			<!--
				Стіл після годування порожній завжди — залишки їдуть у смітник.
				Кнопка стає сюди, щоб по неї не тягнутися вниз повз увесь розбір.
			-->
			<button
				type="button"
				class="btn-primary btn-primary--next"
				onclick={() => game.nextRound()}
				data-testid="feeding-next-btn"
			>
				{@html formatFont(t('common.next'))}
			</button>
		{:else if game.unplaced.length === 0}
			<p class="table__empty">
				{@html formatFont(t(game.picked ? 'feeding.hintReturn' : 'feeding.hintTap'))}
			</p>
		{/if}
	</div>

<style>
	/* Кнопка в порожньому столі: він вужчий за неї, тож стелю знімаємо. */
	.btn-primary--next {
		max-width: none;
		font-size: var(--font-size-md);
		padding: var(--space-sm);
	}


	.table {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-width: 0;
		min-height: 92px;
		padding: var(--space-sm);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-bg-panel), transparent 35%);
		backdrop-filter: var(--blur-glass);
		box-shadow: var(--shadow-card);
	}

	/* Наведення на одну страву приглушує решту. Стан «взято» робить те саме,
	   але через клас — див. `.dish-slot--dimmed` у FeedingDish. */
	.table:hover :global(.dish-slot:not(:hover)) {
		opacity: 0.5;
	}

	.table--active {
		outline: 2px dashed color-mix(in srgb, var(--color-accent), transparent 40%);
		outline-offset: -4px;
	}

	.table__empty {
		margin: 0;
		font-size: var(--font-size-xs);
		text-align: center;
		color: var(--color-text-on-panel);
		opacity: 0.8;
	}
</style>
