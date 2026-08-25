<script lang="ts">
	import { formatFont } from '$lib/i18n';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Flag from '$lib/components/ui/Flag.svelte';
	import { BOARD_MIN_SCORE, type Leader } from '$lib/net/leaders';

	/**
	 * ТАБЛИЦЯ ЛІДЕРІВ: усі й друзі, двома вкладками.
	 *
	 * ## Чому дві вкладки, а не два списки поруч
	 *
	 * Бо це той самий перелік, відповідальний на різні питання: «хто найкращий
	 * узагалі» і «хто найкращий серед тих, кого я знаю». Типово відкрита перша
	 * вкладка: друзів у новоприбулого ще немає, і порожній список замість таблиці
	 * читався б як поломка.
	 *
	 * ## Порожньо — це ВІДПОВІДЬ, а не збій
	 *
	 * Порожня таблиця буває з трьох причин, і кожна має свій текст: рахунок нижчий
	 * за поріг, показ вимкнений перемикачем, друзів ще немає. Один спільний рядок
	 * «нікого немає» перетворив би нормальний стан на схожий на поломку.
	 *
	 * ## Чому не показуємо «місце» числом
	 *
	 * У таблиці лежать лише ті, хто дійшов до порога й дозволив показ, тобто
	 * номер рядка — це не місце в грі, а місце в цьому списку. Число, яке виглядає
	 * як рейтинг, але ним не є, гірше за його відсутність.
	 */
	interface Props {
		leaders: Leader[];
		friends: Leader[];
		/** Перекладач сторінки: рядки акаунта лежать у лінивому чанку. */
		text: (key: string) => string;
		/** Мій `uid` — щоб позначити свій рядок. */
		me: string;
	}

	let { leaders, friends, text, me }: Props = $props();

	let tab = $state<'all' | 'friends'>('all');
	const rows = $derived(tab === 'all' ? leaders : friends);
</script>

<section class="board text-panel" data-testid="account-board-panel">
	<h2 class="board__title">{@html formatFont(text('account.boardTitle'))}</h2>

	<div class="board__tabs">
		<button
			type="button"
			class="board__tab"
			class:board__tab--on={tab === 'all'}
			aria-pressed={tab === 'all'}
			data-testid="account-board-all-btn"
			onclick={() => (tab = 'all')}
		>
			{@html formatFont(text('account.boardAll'))}
		</button>
		<button
			type="button"
			class="board__tab"
			class:board__tab--on={tab === 'friends'}
			aria-pressed={tab === 'friends'}
			data-testid="account-board-friends-btn"
			onclick={() => (tab = 'friends')}
		>
			{@html formatFont(text('account.boardFriends'))}
		</button>
	</div>

	{#if rows.length === 0}
		<p class="board__hint" data-testid="account-board-empty-hint">
			{@html formatFont(
				text(tab === 'friends' ? 'account.boardNoFriends' : 'account.boardEmpty').replace(
					'{score}',
					String(BOARD_MIN_SCORE)
				)
			)}
		</p>
	{:else}
		<ul class="board__list" data-testid="account-board-list">
			{#each rows as row (row.uid)}
				<li
					class="board__row"
					class:board__row--me={row.uid === me}
					data-testid="account-board-{row.uid}-item"
				>
					<Avatar avatar={row.avatar} size={28} />
					<span class="board__who">
						<span class="board__name">{@html formatFont(row.name)}</span>
						<span class="board__handle">@{row.handle}</span>
					</span>
					{#if row.country}
						<Flag code={row.country} height={14} />
					{/if}
					<span class="board__score" data-testid="account-board-{row.uid}-value">{row.score}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.board {
		display: flex;
		flex-direction: column;
		gap: var(--account-gap);
		width: 100%;
		border-radius: var(--account-card-radius);
		padding: var(--account-pad);
	}

	.board__title {
		margin: 0 0 var(--space-xs);
		font-size: var(--font-size-md);
	}

	.board__tabs {
		display: flex;
		gap: var(--space-xs);
	}

	.board__tab {
		flex: 1;
		/* 44px — власний стандарт сенсорної цілі (ACCESSIBILITY-v8 § 8). */
		min-height: var(--account-control);
		border: 1px solid var(--account-line, var(--color-border));
		border-radius: var(--account-field-radius);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.board__tab--on {
		border-color: var(--color-accent);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	/* Підказка — кеглем, а не прозорістю: див. `PrivacyPanel`. */
	.board__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.board__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.board__row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-height: 44px;
		padding: var(--space-xs) var(--space-sm);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
	}

	.board__row--me {
		border-color: var(--color-accent);
	}

	.board__who {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--font-size-sm);
	}

	.board__name {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.board__handle {
		flex-shrink: 0;
		font-size: var(--font-size-xs);
	}

	.board__score {
		flex-shrink: 0;
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
	}
</style>
