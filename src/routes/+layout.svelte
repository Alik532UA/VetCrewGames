<script lang="ts">
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import { t, formatPlain } from '$lib/i18n/index';
	import { logService } from '$lib/services/logService.svelte';
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

	onMount(() => {
		// Version is now injected at build time

		// Глобальна сітка безпеки для unhandled promise rejections
		const onRejection = (event: PromiseRejectionEvent) => {
			logService.error('app', 'Unhandled promise rejection', { reason: String(event.reason) });
		};
		const onError = (event: ErrorEvent) => {
			logService.error('app', 'Window error', {
				message: event.message,
				source: event.filename,
				line: event.lineno
			});
		};
		window.addEventListener('unhandledrejection', onRejection);
		window.addEventListener('error', onError);
		return () => {
			window.removeEventListener('unhandledrejection', onRejection);
			window.removeEventListener('error', onError);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href="{base}/favicon.svg" />
	<title>{formatPlain(t('app.title'))}</title>
</svelte:head>

<div class="app-container">
	<a href="#main-content" class="skip-link"
		>{formatPlain(t('common.skipLink') || 'Перейти до основного вмісту')}</a
	>
	<GameHeader />

	<main class="app-shell" id="main-content">
		{#key page.url.pathname}
			<div
				class="page-transition-wrapper"
				in:fly={{ x: 300 * transitionDirection, duration: 400, delay: 400 }}
				out:fly={{ x: -300 * transitionDirection, duration: 400 }}
			>
				<svelte:boundary
					onerror={(error) =>
						logService.error('app', 'Render boundary caught error', { error: String(error) })}
				>
					{@render children()}

					{#snippet failed(_, reset)}
						<div class="error-fallback" role="alert" aria-live="assertive">
							<h2>{formatPlain(t('error.title'))}</h2>
							<p>{formatPlain(t('error.message'))}</p>
							<div class="error-fallback__actions">
								<button type="button" onclick={reset}>{formatPlain(t('error.retry'))}</button>
								<a href="{base}/">{formatPlain(t('error.goHome'))}</a>
							</div>
						</div>
					{/snippet}
				</svelte:boundary>
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
		height: 100dvh;
		width: 100%;
		box-sizing: border-box;
	}

	.app-shell {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		position: relative;
		width: 100%;
		min-height: 0;
	}

	.page-transition-wrapper {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		position: absolute;
		top: 0;
		left: 0;
		overflow-y: auto;
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

	.error-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-md);
		padding: var(--space-xl);
		text-align: center;
		max-width: 600px;
		margin: var(--space-xl) auto;
	}

	.error-fallback__actions {
		display: flex;
		gap: var(--space-md);
		flex-wrap: wrap;
		justify-content: center;
	}

	.error-fallback button,
	.error-fallback a {
		padding: var(--space-sm) var(--space-lg);
		border: 2px solid currentColor;
		border-radius: var(--radius-md);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
		text-decoration: none;
	}
</style>
