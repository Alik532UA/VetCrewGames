<script lang="ts">
	import { Check, Copy } from 'lucide-svelte';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { t } from '$lib/i18n';
	import { debugMode } from '$lib/services/debugMode.svelte';
	import { devPanel } from '$lib/services/devPanel.svelte';
	import { createKeySequence } from '$lib/services/keySequence';
	import { buildLogReport } from '$lib/services/logReport';
	import { logService } from '$lib/services/logService.svelte';
	import { hardReset, RESET_PRESSES_DEV, RESET_PRESSES_PROD } from '$lib/services/resetService';
	import { settings } from '$lib/services/settings.svelte';

	/**
	 * Службове табло: номер версії, лічильник помилок і збір звіту — ОДИН елемент.
	 * Форма: капсула з номером версії; з помилками — червоний чіп із лічильником; після копіювання — галочка.
	 * Видимість (DEBUGGING-v8 § 2.1): у dev видиме завжди (несе версію); у проді за debug-режимом.
	 * Два входи: ?debug=1 (тач/посилання) та серія V (клавіатура).
	 * Пороги: 55 показати в проді, 5 сховати, 5/5 у dev. Правий клік — devPanel.
	 */
	const appVersion = __APP_VERSION__;

	// browser && обов'язковий: під час prerender page.url.searchParams кидає виняток.
	const urlDebug = $derived(browser && page.url.searchParams.get('debug') === '1');
	// ?debug=1 діє поверх збереженого стану.
	const isVisible = $derived(urlDebug || debugMode.enabled);

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	/** Серія V перемикає табло (поріг залежить від поточного стану). */
	const versionSequence = createKeySequence({
		code: 'KeyV',
		threshold: () => debugMode.pressesToToggle,
		onComplete: () =>
			logService.info('ui', `service badge ${debugMode.toggle() ? 'shown' : 'hidden'}`)
	});

	/** Серія R — аварійне скидання. У проді питає підтвердження. */
	const resetSequence = createKeySequence({
		code: 'KeyR',
		threshold: dev ? RESET_PRESSES_DEV : RESET_PRESSES_PROD,
		onComplete: () => void hardReset(!dev)
	});

	function handleKeydown(event: KeyboardEvent) {
		if (!settings.shortcutsEnabled) {
			versionSequence.reset();
			resetSequence.reset();
			return;
		}
		versionSequence.handle(event);
		resetSequence.handle(event);
	}

	onDestroy(() => {
		if (copyTimer) clearTimeout(copyTimer);
		versionSequence.reset();
		resetSequence.reset();
	});

	async function copyReport() {
		const report = buildLogReport(logService.getLogs(), {
			version: logService.appVersion,
			url: window.location.href,
			userAgent: navigator.userAgent,
			online: navigator.onLine,
			takenAt: new Date().toISOString()
		});

		try {
			await navigator.clipboard.writeText(report);
			copied = true;
			copyTimer = setTimeout(() => {
				copied = false;
			}, 1500);
		} catch (err) {
			logService.warn('ui', 'Failed to copy logs', { error: err });
		}
	}

	/** Правий клік — службове меню заповідника (тільки в dev). */
	function openDevPanel(event: MouseEvent) {
		if (!dev) return;
		event.preventDefault();
		devPanel.toggle();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isVisible}
	<button
		type="button"
		class="service-badge"
		class:has-errors={logService.errorCount > 0}
		class:copied
		onclick={copyReport}
		oncontextmenu={openDevPanel}
		aria-label={`${t('debug.copyLogs')} — ${appVersion}`}
		data-testid="app-version-value"
	>
		<!-- Номер версії — поза гілками: лічильник додається до нього -->
		{#if copied}
			<Check class="badge-icon badge-icon--hint" />
		{:else if logService.errorCount > 0}
			<span class="error-count">{logService.errorCount > 99 ? '99+' : logService.errorCount}</span>
		{:else}
			<Copy class="badge-icon badge-icon--hint" />
		{/if}
		<span class="version">{appVersion}</span>
	</button>
{/if}

<style>
	.service-badge {
		position: fixed;
		bottom: 16px;
		left: 16px;
		z-index: 9999;
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: 32px;
		padding: 0 8px;
		border-radius: 16px;
		background-color: var(--color-bg-surface);
		color: var(--color-text);
		border: 2px solid var(--color-border);
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		transition: all 0.2s;
	}

	.service-badge:hover {
		transform: scale(1.05);
	}

	.version {
		font-size: 10px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		line-height: 1;
		white-space: nowrap;
	}

	.service-badge :global(.badge-icon) {
		width: 16px;
		height: 16px;
		flex: none;
	}

	.service-badge :global(.badge-icon--hint) {
		width: 12px;
		height: 12px;
		opacity: 0.6;
	}

	/* Червоний темніший за #ef4444 за WCAG AA (5.46:1 з білим текстом) */
	.service-badge.has-errors {
		background-color: #c92a2a;
		color: white;
		border-color: #7f1d1d;
	}

	/* Зелений за WCAG AA: #237a35 дає 5.38:1 */
	.service-badge.copied {
		background-color: #237a35;
		color: white;
		border-color: #1b5e20;
		box-shadow: 0 4px 12px rgba(35, 122, 53, 0.4);
	}

	/* Чіп лічильника перед номером: #7f1d1d на #c92a2a (10:1) */
	.error-count {
		font-weight: bold;
		font-size: 0.75rem;
		line-height: 1;
		padding: 2px 5px;
		border-radius: 8px;
		background-color: #7f1d1d;
		color: white;
	}

	@media (hover: none) {
		.service-badge {
			min-height: 44px;
			padding: 0 12px;
			border-radius: 22px;
		}

		.service-badge :global(.badge-icon) {
			width: 20px;
			height: 20px;
		}

		.version {
			font-size: 12px;
		}

		.error-count {
			font-size: 1rem;
		}
	}
</style>
