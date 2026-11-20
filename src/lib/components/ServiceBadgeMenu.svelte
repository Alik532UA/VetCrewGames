<script lang="ts">
	import { Bug, Copy, EyeOff, Trash2 } from 'lucide-svelte';

	interface Props {
		errorCount: number;
		onclick: () => void;
		onview: () => void;
		onclear: () => void;
		onhide: () => void;
	}

	let { errorCount, onclick, onview, onclear, onhide }: Props = $props();
</script>

<div class="service-badge-menu" role="menu" data-testid="service-badge-context-menu">
	<button
		type="button"
		role="menuitem"
		class="menu-item"
		data-testid="service-badge-copy-report-btn"
		{onclick}
	>
		<Copy size={13} />
		<span>Скопіювати повний звіт</span>
	</button>
	<button
		type="button"
		role="menuitem"
		class="menu-item"
		data-testid="service-badge-view-errors-btn"
		onclick={onview}
	>
		<Bug size={13} />
		<span>Переглянути помилки ({errorCount})</span>
	</button>
	<button
		type="button"
		role="menuitem"
		class="menu-item"
		data-testid="service-badge-clear-btn"
		onclick={onclear}
	>
		<Trash2 size={13} />
		<span>Скинути лічильник</span>
	</button>
	<button
		type="button"
		role="menuitem"
		class="menu-item"
		data-testid="service-badge-hide-btn"
		onclick={onhide}
	>
		<EyeOff size={13} />
		<span>Приховати табло</span>
	</button>
</div>

<style>
	.service-badge-menu {
		position: absolute;
		bottom: calc(100% + 8px);
		left: 0;
		min-width: 220px;
		background: var(--color-bg-panel, rgba(20, 20, 20, 0.95));
		backdrop-filter: blur(16px);
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.15));
		border-radius: 12px;
		padding: 6px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--color-text, #ffffff);
		font-size: 0.75rem;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		transition:
			background-color 0.15s ease,
			color 0.15s ease;
	}

	.menu-item:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	@media (prefers-reduced-motion: reduce) {
		.menu-item {
			transition: none;
		}
	}
</style>
