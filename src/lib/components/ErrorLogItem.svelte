<script lang="ts">
	import type { LogEntry } from '$lib/services/logService.svelte';
	import { AlertCircle, AlertTriangle, Info } from 'lucide-svelte';

	interface Props {
		item: LogEntry;
	}

	let { item }: Props = $props();

	function formatTime(iso: string): string {
		try {
			return new Date(iso).toLocaleTimeString('uk-UA', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return iso;
		}
	}
</script>

<div class="event-card event-card--{item.level}">
	<div class="event-header">
		<div class="event-tags">
			{#if item.level === 'error'}
				<span class="level-pill level-pill--error"><AlertCircle size={11} /> ERROR</span>
			{:else if item.level === 'warn'}
				<span class="level-pill level-pill--warn"><AlertTriangle size={11} /> WARN</span>
			{:else}
				<span class="level-pill level-pill--info"><Info size={11} /> INFO</span>
			{/if}
			<span class="meta-pill">{item.category}</span>
		</div>
		<time class="event-time" title={item.timestamp}>{formatTime(item.timestamp)}</time>
	</div>
	<div class="event-message">{item.message}</div>
	{#if item.data}
		<details class="event-stack">
			<summary>Дані виклику</summary>
			<pre>{JSON.stringify(item.data, null, 2)}</pre>
		</details>
	{/if}
</div>

<style>
	.event-card {
		padding: 10px 14px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-left-width: 4px;
	}
	.event-card--error {
		border-left-color: #ef4444;
	}
	.event-card--warn {
		border-left-color: #f59e0b;
	}
	.event-card--info {
		border-left-color: #3b82f6;
	}
	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		margin-bottom: 4px;
	}
	.event-tags {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.level-pill {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 0.625rem;
		padding: 1px 5px;
		border-radius: 4px;
		font-weight: 700;
	}
	.level-pill--error {
		background: #ef4444;
		color: #ffffff;
	}
	.level-pill--warn {
		background: #f59e0b;
		color: #000000;
	}
	.level-pill--info {
		background: #3b82f6;
		color: #ffffff;
	}
	.meta-pill,
	.event-time {
		font-size: 0.6875rem;
		font-family: monospace;
		opacity: 0.6;
	}
	.event-message {
		font-size: 0.8125rem;
		word-break: break-word;
		line-height: 1.4;
	}
	.event-stack summary {
		cursor: pointer;
		user-select: none;
		font-size: 0.6875rem;
		opacity: 0.6;
	}
	.event-stack pre {
		margin-top: 6px;
		padding: 6px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.4);
		font-family: monospace;
		font-size: 0.6875rem;
		white-space: pre-wrap;
	}
</style>
