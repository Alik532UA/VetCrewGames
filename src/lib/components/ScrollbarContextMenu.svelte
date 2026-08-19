<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { settings, type ScrollbarMode } from '$lib/services/settings.svelte';
	import { scrollbar } from '$lib/controllers/scrollbar.svelte';
	import { SCROLLBAR_MODES } from '$lib/config/scrollbar-modes';

	/**
	 * Вибір режиму смуги на праву кнопку (SCROLLBAR-v8 § 7).
	 *
	 * Меню живе в корені, а не всередині смуги: після перемикання на системну
	 * компонент, який його відкрив, зникає — разом із меню, якби воно було
	 * всередині. Тобто повернутися звідти стало б неможливо.
	 */

	const WIDTH = 210;
	const ITEM_HEIGHT = 38;
	const PADDING = 12;
	/** Смуга завширшки в цю зону біля правого краю ловить праву кнопку. */
	const EDGE_PX = 20;

	const height = $derived(SCROLLBAR_MODES.length * ITEM_HEIGHT + PADDING * 2 + 24);

	/** Меню відкривається біля курсора, але цілком у межах вікна. */
	const position = $derived.by(() => {
		const { x, y } = scrollbar.menu;
		return {
			// Ліворуч від курсора: смуга притулена до правого краю, і меню
			// праворуч від неї просто не влізло б.
			left: Math.max(PADDING, x - WIDTH - 4),
			top: Math.min(Math.max(PADDING, y), window.innerHeight - height - PADDING)
		};
	});

	/**
	 * Системну смугу малює браузер, і подій із неї сторінка не отримує.
	 * Прозорий елемент поверх неї перекрив би саму смугу — її стало б не можна
	 * ані тягнути, ані клацнути. Тому слухаємо документ і дивимося координату.
	 */
	function onDocumentContextMenu(e: MouseEvent) {
		if (scrollbar.active !== 'native') return;
		// `clientWidth`, а не `innerWidth`: перший не включає нативну смугу, тож
		// зона не залежить від її товщини в системі.
		const edge = document.documentElement.clientWidth;
		if (e.clientX < edge - EDGE_PX || e.clientX > edge) return;
		e.preventDefault();
		scrollbar.openMenu(e.clientX, e.clientY);
	}

	function choose(mode: ScrollbarMode) {
		settings.setScrollbarMode(mode);
		scrollbar.closeMenu();
	}
</script>

<svelte:window oncontextmenu={onDocumentContextMenu} />

{#if scrollbar.menu.open}
	<!-- Тло перехоплює будь-який натиск поза меню. Права кнопка теж закриває,
	     інакше системне меню з'явилося б поверх нашого. -->
	<div
		class="scrollbar-menu__backdrop"
		data-testid="scrollbar-menu-backdrop"
		role="presentation"
		onpointerdown={scrollbar.closeMenu}
		oncontextmenu={(e) => {
			e.preventDefault();
			scrollbar.closeMenu();
		}}
	></div>

	<div
		class="scrollbar-menu"
		style="left: {position.left}px; top: {position.top}px; width: {WIDTH}px;"
		role="menu"
		tabindex="-1"
		aria-label={t('scrollbar.title')}
		data-testid="scrollbar-context-menu"
		onkeydown={(e) => {
			if (e.key === 'Escape') scrollbar.closeMenu();
		}}
	>
		<span class="scrollbar-menu__title">{@html formatFont(t('scrollbar.title'))}</span>
		{#each SCROLLBAR_MODES as mode (mode.id)}
			<button
				type="button"
				class="scrollbar-menu__item"
				class:active={settings.scrollbarMode === mode.id}
				role="menuitemradio"
				aria-checked={settings.scrollbarMode === mode.id}
				onclick={() => choose(mode.id)}
				data-testid="scrollbar-menu-{mode.id}-btn"
			>
				{@html formatFont(t(mode.key))}
			</button>
		{/each}
	</div>
{/if}

<style>
	.scrollbar-menu__backdrop {
		position: fixed;
		inset: 0;
		z-index: 9500;
	}

	.scrollbar-menu {
		position: fixed;
		z-index: 9501;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px;
		border-radius: var(--radius-md);
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	}

	.scrollbar-menu__title {
		margin-bottom: 6px;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
		letter-spacing: 1px;
		color: var(--color-text-muted);
	}

	.scrollbar-menu__item {
		padding: 8px 10px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background var(--transition-fast);
	}

	.scrollbar-menu__item:hover {
		background: color-mix(in srgb, var(--color-accent), transparent 85%);
	}

	.scrollbar-menu__item.active {
		background: color-mix(in srgb, var(--color-accent), transparent 70%);
		font-weight: var(--font-weight-bold);
	}
</style>
