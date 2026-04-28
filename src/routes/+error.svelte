<script lang="ts">
	import { page } from '$app/stores';
	import { t, formatFont } from '$lib/i18n';
	import { Home, RotateCcw } from 'lucide-svelte';
	import { base } from '$app/paths';
	import '$lib/styles/global.css';
</script>

<div class="error-page">
	<div class="error-card">
		<h1 class="error-status">{$page.status}</h1>
		<h2 class="error-title">{@html formatFont(t('error.title'))}</h2>
		<p class="error-message">{$page.error?.message ?? t('error.message')}</p>

		<div class="error-actions">
			<button class="btn-retry" onclick={() => window.location.reload()}>
				<RotateCcw size={20} />
				{@html formatFont(t('error.retry'))}
			</button>
			<a href="{base}/" class="btn-home">
				<Home size={20} />
				{@html formatFont(t('error.goHome'))}
			</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-md);
		background-color: var(--color-bg);
	}

	.error-card {
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		max-width: 400px;
		width: 100%;
		border: 2px solid var(--color-error);
	}

	.error-status {
		font-size: 5rem;
		font-weight: 900;
		color: var(--color-error);
		margin: 0;
		line-height: 1;
	}

	.error-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin: var(--space-md) 0 var(--space-sm);
	}

	.error-message {
		color: var(--color-text-muted);
		font-size: var(--font-size-md);
		margin-bottom: var(--space-xl);
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.btn-retry,
	.btn-home {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md);
		border-radius: var(--radius-md);
		font-weight: var(--font-weight-bold);
		text-decoration: none;
		transition: all var(--transition-fast);
		border: none;
		cursor: pointer;
	}

	.btn-retry {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
	}

	.btn-retry:hover {
		transform: translateY(-2px);
		background: var(--color-accent-hover);
	}

	.btn-home {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 90%);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.btn-home:hover {
		background: color-mix(in srgb, var(--color-bg-panel), transparent 80%);
		transform: translateY(-2px);
	}
</style>
