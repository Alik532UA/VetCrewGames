<script lang="ts">
	import { Zap } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { SearchPhase } from '$lib/controllers/autoSearch.svelte';
	import type { OnlineGame } from '$lib/utils/crossGame';

	/**
	 * «АВТОМАТИЧНИЙ ПОШУК» — перший блок хабу (рішення автора 2026-09-26).
	 *
	 * Два перемикачі — у які ігри людина згодна грати — і кнопка. Обидва ввімкнені типово,
	 * останній не вимикається (3-A): пошук без жодної гри не знайшов би нічого, а причина
	 * стоїть у `title`, як в останньої гри набору вікторини (`QuizGamePicker`). Смуга
	 * перемикачів — та сама `.seg-track`, що в кожного вибору, з `aria-pressed`: тут
	 * вибирають набір, а не один варіант.
	 *
	 * Поки пошук іде, замість кнопки — рядок стану (`role="status"`, його читає скрінрідер) і
	 * «Скасувати». Сама механіка — у `controllers/autoSearch.svelte.ts`; тут лише вигляд.
	 */
	interface Props {
		games: readonly OnlineGame[];
		phase: SearchPhase;
		onToggle: (game: OnlineGame) => void;
		onStart: () => void;
		onCancel: () => void;
	}

	let { games, phase, onToggle, onStart, onCancel }: Props = $props();

	/** Порядок — той самий, що в головному меню «Грати». */
	const CHOICES = [
		{ id: 'quiz', key: 'menu.quiz' },
		{ id: 'pairs', key: 'menu.game.memory' }
	] as const;

	const STATUS = {
		searching: 'online.searching',
		waiting: 'online.waiting',
		found: 'online.found'
	} as const;

	const busy = $derived(phase !== 'idle');
</script>

<section class="search" data-testid="online-search-panel">
	<fieldset class="search__games" data-testid="online-search-fieldset">
		<legend class="search__legend">{@html formatFont(t('online.searchGames'))}</legend>
		<div class="seg-track">
			{#each CHOICES as game (game.id)}
				{@const on = games.includes(game.id)}
				{@const last = on && games.length === 1}
				<button
					type="button"
					class="seg-item"
					class:seg-item--on={on}
					aria-pressed={on}
					aria-disabled={busy || last}
					title={last ? t('online.searchLast') : ''}
					onclick={() => onToggle(game.id)}
					data-testid="online-search-{game.id}-toggle"
				>
					{@html formatFont(t(game.key))}
				</button>
			{/each}
		</div>
	</fieldset>

	{#if phase === 'idle'}
		<button type="button" class="search__go" onclick={onStart} data-testid="online-search-btn">
			<Zap size={20} aria-hidden="true" />
			{@html formatFont(t('online.search'))}
		</button>
		<p class="search__hint">{@html formatFont(t('online.searchHint'))}</p>
	{:else}
		<p class="search__status" role="status" data-testid="online-search-status-text">
			{@html formatFont(t(STATUS[phase]))}
		</p>
		<button
			type="button"
			class="search__cancel"
			onclick={onCancel}
			data-testid="online-search-cancel-btn"
		>
			{@html formatFont(t('online.searchCancel'))}
		</button>
	{/if}
</section>

<style>
	.search {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: var(--shadow-card);
	}

	.search__games {
		margin: 0;
		padding: 0;
		border: none;
		min-width: 0;
	}

	.search__legend {
		padding: 0;
		margin-bottom: var(--space-xs);
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	/*
	 * Кнопка пошуку — акцентом, як була «Швидка гра»: це найкоротший шлях у гру, і він
	 * мусить читатися першим.
	 */
	.search__go {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-height: 48px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
	}

	@media (hover: hover) {
		.search__go:hover {
			background: var(--color-accent-hover);
		}
	}

	/* Підказки приглушені КЕГЛЕМ, а не прозорістю — та сама причина, що в `RoomList`. */
	.search__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.search__status {
		margin: 0;
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
	}

	/* Друга дорога — тихіша за першу: рамка без заливки; 44px — сенсорна ціль. */
	.search__cancel {
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
