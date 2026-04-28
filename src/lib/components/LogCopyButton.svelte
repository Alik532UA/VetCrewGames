<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { dev } from '$app/environment';
	import { base } from '$app/paths';
	import { onDestroy } from 'svelte';

	// According to rules, visible in dev, hidden in prod (unless overridden)
	let isVisible = $derived(dev && logService.errorCount > 0);

	let copied = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});

	async function copyLogs() {
		const logs = logService.getLogs();
		let version = logService.appVersion;

		const header = `--- REPORT from Copy LOG button ---
DATE: ${new Date().toLocaleString()}
URL: ${window.location.href}
DEVICE: ${navigator.userAgent}
VERSION: ${version}
------------------------
`;
		const logText = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category.toUpperCase()}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`).join('\n');
		
		const fullText = header + logText;

		try {
			await navigator.clipboard.writeText(fullText);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1000);
		} catch (err) {
			logService.error('ui', 'Failed to copy logs', { error: err });
		}
	}
</script>

{#if isVisible}
	<button
		class="log-copy-btn"
		class:has-errors={logService.errorCount > 0}
		onclick={copyLogs}
		title="Copy Logs"
	>
		{#if copied}
			<Check class="log-icon" />
		{:else if logService.errorCount > 0}
			<span class="error-count">{logService.errorCount}</span>
		{:else}
			<Copy class="log-icon" />
		{/if}
	</button>
{/if}

<style>
	.log-copy-btn {
		position: fixed;
		bottom: 16px;
		left: 16px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--bg-surface, #333);
		color: var(--text-primary, #fff);
		border: 2px solid var(--border-color, #555);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 9999;
		box-shadow: 0 4px 6px rgba(0,0,0,0.3);
		transition: all 0.2s;
	}

	.log-copy-btn:hover {
		transform: scale(1.1);
	}

	.log-copy-btn.has-errors {
		background-color: #ef4444;
		color: white;
		border-color: #b91c1c;
	}

	.error-count {
		font-weight: bold;
		font-size: 0.9rem;
	}

	.log-copy-btn :global(.log-icon) {
		width: 16px;
		height: 16px;
	}

	@media (max-width: 768px) {
		.log-copy-btn {
			width: 24px;
			height: 24px;
		}

		.log-copy-btn :global(.log-icon) {
			width: 12px;
			height: 12px;
		}

		.error-count {
			font-size: 0.75rem;
		}
	}
</style>
