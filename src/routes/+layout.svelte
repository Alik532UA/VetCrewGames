<script lang="ts">
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import { t, formatPlain } from '$lib/i18n/index';
	import { settings } from '$lib/settings.svelte';
	import LogCopyButton from '$lib/components/LogCopyButton.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();
	
	let appVersion = $state('');

	onMount(async () => {
		try {
			const res = await fetch('/app-version.json');
			if (res.ok) {
				const data = await res.json();
				appVersion = data.version;
			}
		} catch (e) {
			// ignore
		}
	});
</script>

<svelte:head>
	<link rel="icon" href="/favicon.svg" />
	<title>{formatPlain(t('app.title'))}</title>
</svelte:head>

<main class="app-shell">
	{@render children()}
</main>

{#if appVersion}
	<div class="app-version">{appVersion}</div>
{/if}

<LogCopyButton />

<style>
	.app-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
	}

	.app-version {
		position: fixed;
		bottom: 4px;
		right: 8px;
		font-size: 10px;
		color: var(--text-muted, #888);
		opacity: 0.5;
		pointer-events: none;
		z-index: 1000;
	}
</style>
