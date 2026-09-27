<script lang="ts">
	import { Check, CircleQuestionMark, LayoutGrid, Zap } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import OnlineWindow from './OnlineWindow.svelte';
	import DynamicIcon from '$lib/components/ui/DynamicIcon.svelte';
	import type { SearchPhase } from '$lib/controllers/autoSearch.svelte';
	import type { OnlineGame } from '$lib/utils/crossGame';

	/**
	 * «АВТОМАТИЧНИЙ ПОШУК» — ВІКНО (рішення автора 2026-09-27, 6-A: «кнопка відкриває вікно
	 * з вибором ігор, які запамʼятовуються, і „Шукати“; статус і „Скасувати“ — у тому
	 * самому вікні»). Доти це був перший із пʼяти блоків хабу.
	 *
	 * Два перемикачі — у які ігри людина згодна грати — і кнопка. Обидва ввімкнені типово,
	 * останній не вимикається (3-A): пошук без жодної гри не знайшов би нічого, а причина
	 * стоїть у `title`, як в останньої гри набору вікторини (`QuizGamePicker`). Смуга
	 * перемикачів — та сама `.seg-track`, що в кожного вибору, з `aria-pressed`: тут
	 * вибирають набір, а не один варіант. Вибір памʼятає власник (`OnlineHubState`).
	 *
	 * Поки пошук іде, замість «Шукати» — рядок стану (`role="status"`, його читає скрінрідер)
	 * і «Скасувати», а «Назад» немає: пошук, що йде за закритим вікном, лишав би решту дорог
	 * глухими. ФОКУС ЙДЕ ЗА КНОПКОЮ: «Шукати» зникає під пальцем, тож фокус переїжджає на
	 * «Скасувати», а після скасування — назад на «Шукати». Сама механіка — у
	 * `controllers/autoSearch.svelte.ts`; тут лише вигляд.
	 */
	interface Props {
		games: readonly OnlineGame[];
		phase: SearchPhase;
		onToggle: (game: OnlineGame) => void;
		onStart: () => void;
		onCancel: () => void;
		onBack: () => void;
		/** Вікно відкрила людина: фокус — на заголовок (`OnlineWindow`). */
		focusTitle?: boolean;
	}

	let { games, phase, onToggle, onStart, onCancel, onBack, focusTitle = false }: Props = $props();

	/** Порядок — той самий, що в головному меню «Грати». */
	/* Значки — ті самі, що в меню «Грати» й у «Створити кімнату»: та сама гра, той самий знак. */
	const CHOICES = [
		{ id: 'quiz', key: 'menu.quiz', icon: CircleQuestionMark },
		{ id: 'pairs', key: 'menu.game.memory', icon: LayoutGrid }
	] as const;

	const STATUS = {
		searching: 'online.searching',
		waiting: 'online.waiting',
		found: 'online.found'
	} as const;

	const busy = $derived(phase !== 'idle');

	/** Пошук уже починали: «Шукати», що повернулася після скасування, бере фокус назад. */
	let started = false;

	function start() {
		started = true;
		onStart();
	}

	const refocus = (node: HTMLElement) => {
		if (started) node.focus();
	};
</script>

<OnlineWindow scope="online-search" {focusTitle} onBack={busy ? undefined : onBack} wide>
	{#snippet title()}
		<Zap size={24} aria-hidden="true" />
		{@html formatFont(t('online.search'))}
	{/snippet}

	<fieldset class="search__games" data-testid="online-search-fieldset">
		<legend class="search__legend">{@html formatFont(t('online.searchGames'))}</legend>
		<div class="menu-tile-grid">
			{#each CHOICES as game (game.id)}
				{@const on = games.includes(game.id)}
				{@const last = on && games.length === 1}
				<button
					type="button"
					class="search__tile menu-btn menu-btn--game menu-tile"
					class:search__tile--on={on}
					aria-pressed={on}
					aria-disabled={busy || last}
					title={last ? t('online.searchLast') : ''}
					onclick={() => onToggle(game.id)}
					data-testid="online-search-{game.id}-toggle"
				>
					{#if on}
						<span class="search__check"><Check size={18} strokeWidth={3} aria-hidden="true" /></span
						>
					{/if}
					<DynamicIcon icon={game.icon} class="menu-tile__icon" aria-hidden="true" />
					<span>{@html formatFont(t(game.key))}</span>
				</button>
			{/each}
		</div>
	</fieldset>

	{#if phase === 'idle'}
		<p class="search__hint">{@html formatFont(t('online.searchHint'))}</p>
		<button
			type="button"
			class="search__go btn-accent"
			onclick={start}
			data-testid="online-search-btn"
			{@attach refocus}
		>
			<Zap size={20} aria-hidden="true" />
			{@html formatFont(t('online.searchGo'))}
		</button>
	{:else}
		<p
			id="online-search-status"
			class="search__status"
			role="status"
			data-testid="online-search-status-text"
		>
			{@html formatFont(t(STATUS[phase]))}
		</p>
		<button
			type="button"
			class="search__cancel btn-secondary"
			onclick={onCancel}
			aria-describedby="online-search-status"
			data-testid="online-search-cancel-btn"
			{@attach (node) => node.focus()}
		>
			{@html formatFont(t('online.searchCancel'))}
		</button>
	{/if}
</OnlineWindow>

<style>
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
	 * ІГРИ — ПЛИТКАМИ-ПЕРЕМИКАЧАМИ, а не вузькою смугою (прохання автора 2026-09-27: «50%
	 * вікна порожня, кнопки вибору гри з маленьким шрифтом»). Вигляд — плитки меню «Грати»,
	 * як і в «Створити кімнату»; сітка — спільна (`.menu-tile-grid`).
	 *
	 * УВІМКНЕНА — КІЛЬЦЕМ І ГАЛОЧКОЮ, а не акцентом: акцент тут належить «Шукати», і три
	 * жовті плями поспіль не сказали б, що з них дія. Кільце — кольором тексту, як вибрана
	 * клітинка аватарки: воно тримає 3:1 до тла у всіх чотирьох темах (WCAG 1.4.11). Стан для
	 * читалки несе `aria-pressed`, а кільце його лише малює.
	 */
	.search__tile {
		position: relative;
	}

	.search__tile--on {
		box-shadow:
			inset 0 0 0 3px var(--color-text),
			0 4px 0 color-mix(in srgb, var(--color-bg-card), black 35%);
	}

	.search__check {
		position: absolute;
		top: var(--space-sm);
		right: var(--space-sm);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-text);
		color: var(--color-bg-card);
	}

	/*
	 * Кнопка пошуку — акцентом, як була «Швидка гра»: це найкоротший шлях у гру, і він
	 * мусить читатися першим. Висота — від одиниці вікна (`.fill`), дно — сенсорна ціль;
	 * ширина — від слова, а не від вікна: смуга на всю ширину з одним словом читалася б як
	 * порожня.
	 */
	.search__go {
		display: flex;
		align-self: center;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		min-width: min(100%, 12em);
		min-height: max(48px, calc(var(--fill-u) * 3));
		padding: 0 var(--space-xl);
		border-radius: var(--radius-md);
		font: inherit;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
	}

	/* Підказки приглушені КЕГЛЕМ, а не прозорістю — та сама причина, що в `RoomList`. */
	.search__hint {
		margin: 0;
		font-size: var(--font-size-md);
		color: var(--color-text-on-panel);
	}

	.search__status {
		margin: 0;
		font-weight: var(--font-weight-bold);
		color: var(--color-text-on-panel);
	}

	/* «Скасувати» — кнопкою (`.btn-secondary`), а не голим текстом; 44px — сенсорна ціль. */
	.search__cancel {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		font: inherit;
	}
</style>
