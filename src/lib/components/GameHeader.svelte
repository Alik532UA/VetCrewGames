<script lang="ts">
	import { ArrowLeft, Sun, Moon, Languages } from 'lucide-svelte';
	import { settings } from '$lib/settings.svelte';
	import { t, formatFont, formatPlain } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { base } from '$app/paths';

	let { titleKey, roundInfo, showBack = true } = $props<{ 
		titleKey: TranslationKey; 
		roundInfo?: string;
		showBack?: boolean;
	}>();

	let lastScore = $state(settings.score);
	let isPulsing = $state(false);

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
</script>

<header class="game-header">
	<div class="game-header__inner">
		<div class="game-header__left">
			{#if showBack}
				<a href="{base}/" class="header-btn" aria-label={formatPlain(t('common.back'))}>
					<ArrowLeft size={24} />
				</a>
			{:else}
				<div class="header-btn placeholder"></div>
			{/if}
		</div>

		<div class="game-header__center">
			<div class="title-group desktop-only">
				<div class="title-with-score">
					<h1 class="game-title">{@html formatFont(t(titleKey))}</h1>
					<div class="global-score" class:is-pulsing={isPulsing}>
						<svg class="score-circle" viewBox="0 0 36 36">
							<path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
							<path class="circle-fill" stroke-dasharray="{(settings.score % 100) * 10}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
						</svg>
						<span class="score-value">{settings.score}</span>
					</div>
				</div>
				{#if roundInfo}
					<span class="game-round">{@html formatFont(roundInfo)}</span>
				{/if}
			</div>
		</div>

		<div class="game-header__right">
			<button class="header-btn" onclick={() => settings.toggleTheme()} aria-label="Toggle theme">
				{#if settings.theme === 'dark'}
					<Sun size={24} />
				{:else}
					<Moon size={24} />
				{/if}
			</button>

			<button class="header-btn lang-btn" onclick={toggleLocale} aria-label="Toggle language">
				<Languages size={24} />
				<span class="lang-text">{settings.locale.toUpperCase()}</span>
			</button>
		</div>
	</div>
</header>

<div class="mobile-title-container mobile-only">
	<div class="title-group">
		<div class="title-with-score">
			<h1 class="game-title">{@html formatFont(t(titleKey))}</h1>
			<div class="global-score" class:is-pulsing={isPulsing}>
				<svg class="score-circle" viewBox="0 0 36 36">
					<path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
					<path class="circle-fill" stroke-dasharray="{(settings.score % 100) * 10}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
				</svg>
				<span class="score-value">{settings.score}</span>
			</div>
		</div>
	</div>
</div>

<style>
	.title-group {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.title-with-score {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.global-score {
		position: relative;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
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
		stroke: color-mix(in srgb, var(--color-text), transparent 90%);
		stroke-width: 2.8;
	}

	.circle-fill {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 2.8;
		stroke-linecap: round;
		transition: stroke-dasharray 0.5s ease;
	}

	.score-value {
		font-size: 14px;
		font-weight: 900;
		color: var(--color-accent);
		z-index: 1;
	}

	.game-round {
		font-size: var(--font-size-sm);
		color: color-mix(in srgb, var(--color-text), transparent 30%);
	}

	.game-header {
		width: 100vw;
		margin-left: calc(-50vw + 50%);
		background-color: var(--color-bg-panel-dark);
		padding: var(--space-md) var(--space-lg);
		display: flex;
		justify-content: center;
		animation: slide-up 400ms ease both;
		z-index: 100;
	}
/* ... rest of styles ... */

	.game-header__inner {
		width: 100%;
		max-width: 1200px;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
	}

	.game-header__left {
		display: flex;
		justify-content: flex-start;
	}

	.game-header__center {
		display: flex;
		justify-content: center;
	}

	.game-header__right {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-sm);
	}

	.header-btn {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-md);
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 90%);
		border: 1px solid color-mix(in srgb, var(--color-bg-surface), transparent 90%);
		color: var(--color-text);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
	}

	.header-btn.placeholder {
		background: transparent;
		border-color: transparent;
		cursor: default;
		pointer-events: none;
	}

	.header-btn:hover {
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 80%);
		transform: scale(1.05);
	}

	.lang-btn {
		width: auto;
		padding: 0 var(--space-sm);
		gap: var(--space-xs);
	}

	.lang-text {
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-sm);
	}

	.game-title {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		margin: 0;
		text-align: center;
	}

	.mobile-title-container {
		width: 100%;
		padding: var(--space-md) 0;
		display: flex;
		justify-content: center;
	}

	.desktop-only {
		display: block;
	}

	.mobile-only {
		display: none;
	}

	@media (max-width: 768px) {
		.title-group {
			flex-direction: row;
			gap: var(--space-sm);
			align-items: baseline;
		}

		.game-round {
			font-size: var(--font-size-md);
		}

		.desktop-only {
			display: none;
		}
		.mobile-only {
			display: flex;
		}
		.game-header__inner {
			grid-template-columns: 1fr 1fr;
		}
		.game-header__center {
			display: none;
		}
	}

	@keyframes slide-up {
		from {
			transform: translateY(-100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}
</style>
