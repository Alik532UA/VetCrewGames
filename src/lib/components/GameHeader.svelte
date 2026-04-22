<script lang="ts">
	import { ArrowLeft, Sun, Moon, Languages, Maximize, Minimize } from 'lucide-svelte';
	import { settings } from '$lib/settings.svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	let { titleKey, roundInfo, showBack = true } = $props<{ 
		titleKey?: TranslationKey; 
		roundInfo?: string;
		showBack?: boolean;
	}>();

	const activeTitleKey = $derived(titleKey || settings.headerTitleKey || 'app.title');

	let lastScore = $state(settings.score);
	let isPulsing = $state(false);
	let isFullscreen = $state(false);

	const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
	const isIPhone = typeof navigator !== 'undefined' && /iPhone/.test(navigator.userAgent);

	$effect(() => {
		if (settings.score > lastScore) {
			isPulsing = true;
			setTimeout(() => { isPulsing = false; }, 600);
			lastScore = settings.score;
		} else {
			lastScore = settings.score;
		}
	});

	function toggleLocale() {
		settings.setLocale(settings.locale === 'uk' ? 'en' : 'uk');
	}

	function toggleFullscreen() {
		if (isIOS) {
			// iOS Safari (especially iPhone) doesn't support Fullscreen API for elements.
			// Force Fake Fullscreen instead.
			const isFake = document.documentElement.hasAttribute('data-fake-fullscreen');
			if (!isFake) {
				document.documentElement.setAttribute('data-fake-fullscreen', 'true');
				isFullscreen = true;
			} else {
				document.documentElement.removeAttribute('data-fake-fullscreen');
				isFullscreen = false;
			}
			return;
		}

		const doc = document as any;
		const el = document.documentElement as any;

		if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
			const request = el.requestFullscreen || el.webkitRequestFullscreen;
			if (request) {
				request.call(el).catch(() => {
					document.documentElement.setAttribute('data-fake-fullscreen', 'true');
					isFullscreen = true;
				});
			} else {
				document.documentElement.setAttribute('data-fake-fullscreen', 'true');
				isFullscreen = true;
			}
		} else {
			const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
			if (exit) exit.call(doc);
			document.documentElement.removeAttribute('data-fake-fullscreen');
			isFullscreen = false;
		}
	}

	onMount(() => {
		const handler = () => { 
			const native = !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement: unknown }).webkitFullscreenElement);
			const fake = document.documentElement.hasAttribute('data-fake-fullscreen');
			isFullscreen = native || fake; 
		};
		document.addEventListener('fullscreenchange', handler);
		document.addEventListener('webkitfullscreenchange', handler);
		return () => {
			document.removeEventListener('fullscreenchange', handler);
			document.removeEventListener('webkitfullscreenchange', handler);
		};
	});
</script>

<header class="game-header">
	<div class="game-header__inner">
		<div class="game-header__left">
			{#if showBack && activeTitleKey !== 'app.title'}
				<a href="{base}/" class="header-btn" aria-label={formatPlain(t('common.back'))}>
					<ArrowLeft size={22} />
				</a>
			{:else}
				<div class="header-btn placeholder"></div>
			{/if}
		</div>

		<div class="game-header__center">
			<div class="title-with-score">
				<div class="game-title-wrapper">
					{#key activeTitleKey}
						<h1 class="game-title" in:fade={{ duration: 300, delay: 150 }} out:fade={{ duration: 150 }}>
							{@html formatFont(t(activeTitleKey as any))}
						</h1>
					{/key}
				</div>
				<div class="global-score" class:is-pulsing={isPulsing}>
					<svg class="score-circle" viewBox="0 0 36 36">
						<path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
						<path class="circle-fill" stroke-dasharray="{(settings.score % 100) * 1}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
					</svg>
					<span class="score-value">{settings.score}</span>
				</div>
			</div>
		</div>

		<div class="game-header__right">
			<button class="header-btn" onclick={() => settings.toggleTheme()} aria-label="Toggle theme">
				{#if settings.theme === 'dark'}
					<Sun size={20} />
				{:else}
					<Moon size={20} />
				{/if}
			</button>

			<button class="header-btn lang-btn" onclick={toggleLocale} aria-label="Toggle language">
				<span class="lang-text">{settings.locale.toUpperCase()}</span>
			</button>

			<button class="header-btn" onclick={toggleFullscreen} aria-label="Toggle fullscreen">
				{#if isFullscreen}
					<Minimize size={20} />
				{:else}
					<Maximize size={20} />
				{/if}
			</button>
		</div>
	</div>
</header>

<style>
	.game-header {
		width: 100vw;
		margin-left: calc(-50vw + 50%);
		background-color: color-mix(in srgb, var(--color-bg-panel-dark), transparent 25%);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		padding: var(--space-sm) var(--space-md);
		display: flex;
		justify-content: center;
		z-index: 100;
		position: sticky;
		top: 0;
		transition: background-color var(--transition-normal);
	}

	.game-header__inner {
		width: 100%;
		max-width: 1200px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-md);
	}

	.game-header__left, .game-header__right {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.game-header__center {
		display: flex;
		justify-content: center;
		min-width: 0;
	}

	.title-with-score {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		min-width: 0;
	}

	.game-title-wrapper {
		display: grid;
		grid-template-areas: "title";
		align-items: center;
		min-width: 0;
	}

	.game-title {
		grid-area: title;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		margin: 0;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.global-score {
		position: relative;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
	}

	.global-score.is-pulsing {
		transform: scale(1.2);
	}

	.score-circle {
		position: absolute;
		width: 100%;
		height: 100%;
		transform: rotate(-90deg);
	}

	.circle-bg {
		fill: none;
		stroke: rgba(255, 255, 255, 0.15);
		stroke-width: 3.5;
	}

	.circle-fill {
		fill: none;
		stroke: #ffffff;
		stroke-width: 3.5;
		stroke-linecap: round;
		transition: stroke-dasharray 0.5s ease;
	}

	.score-value {
		font-size: 11px;
		font-weight: 900;
		color: #ffffff;
		z-index: 1;
	}

	.header-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background-color: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.1);
		color: #ffffff;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
		padding: 0;
	}

	.header-btn.placeholder {
		background: transparent;
		border-color: transparent;
		cursor: default;
		pointer-events: none;
	}

	@media (hover: hover) {
		.header-btn:hover {
			background-color: rgba(255, 255, 255, 0.2);
			transform: scale(1.05);
		}
	}

	.header-btn:active {
		transform: scale(0.95);
	}

	.lang-btn {
		width: auto;
		padding: 0 var(--space-xs);
		min-width: 36px;
	}

	.lang-text {
		font-weight: var(--font-weight-bold);
		font-size: 11px;
	}

	@media (max-width: 768px) {
		.game-title { font-size: var(--font-size-sm); }
		.game-header { padding: var(--space-xs) var(--space-sm); }
		.game-header__inner { gap: var(--space-sm); }
	}
</style>

