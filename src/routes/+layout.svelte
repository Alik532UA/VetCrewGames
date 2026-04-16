<script lang="ts">
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import favicon from '$lib/assets/favicon.svg';
	import { t } from '$lib/i18n/index';
	import { settings } from '$lib/settings.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{t('app.title')}</title>
</svelte:head>

<main class="app-shell">
	{@render children()}
</main>

<style>
	.app-shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
	}
</style>
