<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { t, formatPlain } from '$lib/i18n';
</script>

<div class="error-page" role="alert">
	<h1>{page.status} — {formatPlain(t('error.title'))}</h1>
	<p>{formatPlain(t('error.message'))}</p>
	<a class="error-link" href="{base}/">{formatPlain(t('error.goHome'))}</a>
</div>

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		padding: var(--space-xl);
		text-align: center;
		min-height: 60vh;
	}

	.error-page h1 {
		font-size: var(--font-size-2xl);
	}

	.error-link {
		padding: var(--space-sm) var(--space-lg);
		border: 2px solid currentColor;
		border-radius: var(--radius-md);
		text-decoration: none;
	}
</style>
