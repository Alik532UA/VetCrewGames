<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	// According to rules, visible in dev, hidden in prod (unless overridden)
	let showButton = dev;

	let copied = $state(false);

	async function copyLogs() {
		const logs = logService.getLogs();
		let version = 'unknown';
		try {
			const res = await fetch(`${base}/app-version.json?v=${Date.now()}`);
			if (res.ok) {
				const data = await res.json();
				version = data.version;
			}
		} catch (e) {
			// ignore
		}

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
			console.error('Failed to copy logs', err);
		}
	}
</script>

{#if showButton}
	<button
		class="log-copy-btn"
		class:has-errors={logService.errorCount > 0}
		onclick={copyLogs}
		title="Copy Logs"
	>
		{#if copied}
			<Check size={24} />
		{:else if logService.errorCount > 0}
			<span class="error-count">{logService.errorCount}</span>
		{:else}
			<Copy size={24} />
		{/if}
	</button>
{/if}

<style>
	.log-copy-btn {
		position: fixed;
		bottom: 20px;
		left: 20px;
		width: 50px;
		height: 50px;
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
		font-size: 1.2rem;
	}
</style>
