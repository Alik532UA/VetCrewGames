<script lang="ts">
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import { t, formatPlain } from '$lib/i18n/index';
	import { settings } from '$lib/settings.svelte';
	import LogCopyButton from '$lib/components/LogCopyButton.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { fly } from 'svelte/transition';

	let { children } = $props();
	
	let appVersion = $state('');

	// Handle transition direction
	let transitionDirection = $state(1); 
	let lastPath = page.url.pathname;

	function isHome(path: string) {
		const p = path.replace(/\/$/, '') || '/';
		const b = base.replace(/\/$/, '') || '/';
		return p === b || p === '/';
	}

	$effect.pre(() => {
		const currentPath = page.url.pathname;
		if (currentPath !== lastPath) {
			const wasHome = isHome(lastPath);
			const currentlyHome = isHome(currentPath);

			if (wasHome && !currentlyHome) {
				// Menu -> Game: Fly elements LEFT (in from Right, out to Left)
				transitionDirection = 1;
			} else if (!wasHome && currentlyHome) {
				// Game -> Menu: Fly elements RIGHT (in from Left, out to Right)
				transitionDirection = -1;
			} else {
				transitionDirection = 1;
			}
			lastPath = currentPath;
		}
	});

	onMount(async () => {
		try {
			const res = await fetch(`${base}/app-version.json?v=${Date.now()}`);
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
	<link rel="icon" href="{base}/favicon.svg" />
	<title>{formatPlain(t('app.title'))}</title>
</svelte:head>

<div class="app-container">
	<GameHeader />

	<main class="app-shell">
		{#key page.url.pathname}
			<div 
				class="page-transition-wrapper"
				in:fly={{ x: 300 * transitionDirection, duration: 400, delay: 400 }}
				out:fly={{ x: -300 * transitionDirection, duration: 400 }}
			>
				{@render children()}
			</div>
		{/key}
	</main>
</div>

{#if appVersion}
	<div class="app-version">{appVersion}</div>
{/if}

<LogCopyButton />

<style>
	:global(body) {
		overflow-x: hidden;
		margin: 0;
	}

	.app-container {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		width: 100%;
	}

	.app-shell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		width: 100%;
	}

	.page-transition-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: absolute;
		top: 0;
		left: 0;
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
