<script lang="ts">
	import { focusTrap } from '$lib/utils/focusTrap';
	import { logService, type LogLevel } from '$lib/services/logService.svelte';
	import { liveReport } from '$lib/services/reportCopy';
	import { Bug, Check, Copy, Trash2, X } from 'lucide-svelte';
	import { onDestroy } from 'svelte';
	import ErrorLogItem from './ErrorLogItem.svelte';

	interface Props {
		isOpen: boolean;
		onclose: () => void;
	}

	let { isOpen, onclose }: Props = $props();

	type FilterType = 'all' | LogLevel;
	let activeFilter = $state<FilterType>('all');
	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	const logs = $derived(logService.getLogs());
	const errorCount = $derived(logs.filter((e) => e.level === 'error').length);
	const warnCount = $derived(logs.filter((e) => e.level === 'warn').length);
	const infoCount = $derived(logs.filter((e) => e.level === 'info').length);
	const filteredList = $derived(
		(activeFilter === 'all' ? logs : logs.filter((e) => e.level === activeFilter)).slice().reverse()
	);

	onDestroy(() => clearTimeout(copyTimer));

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(liveReport());
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch (error) {
			logService.warn('ui', 'Failed to copy report', { reason: String(error) });
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') (event.preventDefault(), onclose());
	}
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-labelledby="error-log-modal-title"
		data-testid="error-log-modal-overlay"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) onclose();
		}}
		onkeydown={handleKeydown}
		use:focusTrap
	>
		<div class="modal-card" data-testid="error-log-modal-container">
			<div class="modal-header" data-testid="error-log-modal-header">
				<div class="header-left">
					<div class="icon-wrap"><Bug size={18} /></div>
					<h2 id="error-log-modal-title" class="modal-title" data-testid="error-log-modal-title">
						Журнал помилок та подій
					</h2>
				</div>
				<button
					type="button"
					class="btn-close"
					onclick={onclose}
					aria-label="Закрити"
					data-testid="error-log-modal-close-btn"
				>
					<X size={18} />
				</button>
			</div>

			<div class="modal-toolbar">
				<div class="tabs" role="tablist" data-testid="error-log-modal-tabs">
					{#each [{ id: 'all', label: 'Всі', count: logs.length, tid: 'error-log-modal-all-tab' }, { id: 'error', label: 'Помилки', count: errorCount, tid: 'error-log-modal-error-tab' }, { id: 'warn', label: 'Увага', count: warnCount, tid: 'error-log-modal-warn-tab' }, { id: 'info', label: 'Інфо', count: infoCount, tid: 'error-log-modal-info-tab' }] as t (t.id)}
						<button
							type="button"
							role="tab"
							aria-selected={activeFilter === t.id}
							class="tab"
							class:tab--active={activeFilter === t.id}
							onclick={() => (activeFilter = t.id as FilterType)}
							data-testid={t.tid}
						>
							{t.label} <span class="tab-badge" data-level={t.id}>{t.count}</span>
						</button>
					{/each}
				</div>

				<div class="actions">
					<button
						type="button"
						class="btn-action"
						class:btn-action--copied={copied}
						onclick={handleCopy}
						data-testid="error-log-modal-copy-btn"
						aria-label="Скопіювати звіт"
					>
						{#if copied}<Check size={14} /><span>Скопійовано</span>{:else}<Copy size={14} /><span
								>Копіювати звіт</span
							>{/if}
					</button>
					<button
						type="button"
						class="btn-action btn-action--danger"
						onclick={() => logService.clear()}
						disabled={logs.length === 0}
						data-testid="error-log-modal-clear-btn"
						aria-label="Очистити журнал"
					>
						<Trash2 size={14} /><span>Очистити</span>
					</button>
				</div>
			</div>

			<div class="modal-body" data-testid="error-log-modal-list">
				{#if filteredList.length === 0}
					<div class="empty-state" data-testid="error-log-modal-empty-message">
						<Check size={28} class="empty-icon" />
						<p class="empty-text">Журнал порожній. Жодної події не зафіксовано!</p>
					</div>
				{:else}
					<div class="event-list">
						{#each filteredList as item, idx (idx)}
							<ErrorLogItem {item} />
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 10001;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(6px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
	}
	.modal-card {
		background: #18181b;
		color: #f4f4f5;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 16px;
		width: 100%;
		max-width: 800px;
		max-height: 85dvh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.modal-header,
	.modal-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 16px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.header-left,
	.tabs,
	.actions {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.icon-wrap {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: rgba(239, 68, 68, 0.15);
		color: #ef4444;
	}
	.modal-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0;
		color: #ffffff;
	}
	.btn-close,
	.tab,
	.btn-action {
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.15s ease;
	}
	.btn-close {
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: #f4f4f5;
		opacity: 0.7;
	}
	.tab,
	.btn-action {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 0.8125rem;
		color: #f4f4f5;
		border: 1px solid rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.05);
	}
	.tab--active {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.3);
		font-weight: 600;
	}
	.tab-badge {
		font-size: 0.625rem;
		padding: 1px 5px;
		border-radius: 4px;
		font-weight: 700;
		background: rgba(255, 255, 255, 0.15);
	}
	.tab-badge[data-level='error'] {
		background: #ef4444;
	}
	.tab-badge[data-level='warn'] {
		background: #f59e0b;
		color: #000;
	}
	.tab-badge[data-level='info'] {
		background: #3b82f6;
	}
	.btn-action--copied {
		background: #15803d;
	}
	.btn-action--danger:hover {
		color: #ef4444;
	}
	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		min-height: 200px;
	}
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 40px;
		opacity: 0.7;
	}
	.empty-text {
		margin: 0;
	}
	:global(.empty-icon) {
		color: #22c55e;
	}
	.event-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	@media (prefers-reduced-motion: reduce) {
		.btn-close,
		.tab,
		.btn-action {
			transition: none;
		}
	}
</style>
