<script lang="ts">
	import { CheckCircle2, Copy } from 'lucide-svelte';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { debugMode } from '$lib/services/debugMode.svelte';
	import { createKeySequence } from '$lib/services/keySequence';
	import { copyLogReport } from '$lib/services/reportCopy';
	import { logService } from '$lib/services/logService.svelte';
	import { hardReset, RESET_PRESSES_DEV, RESET_PRESSES_PROD } from '$lib/services/resetService';
	import { settings } from '$lib/services/settings.svelte';
	import ServiceBadgeMenu from './ServiceBadgeMenu.svelte';

	const appVersion = __APP_VERSION__;
	const urlDebug = $derived(browser && page.url.searchParams.get('debug') === '1');
	const isVisible = $derived(urlDebug || debugMode.enabled);

	let copied = $state(false);
	let manual = $state('');
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	let menuOpen = $state(false);
	let modalOpen = $state(false);
	let hidden = $state(false);

	const versionSequence = createKeySequence({
		code: 'KeyV',
		threshold: () => debugMode.pressesToToggle,
		onComplete: () => {
			hidden = false;
			logService.info('ui', `service badge ${debugMode.toggle() ? 'shown' : 'hidden'}`);
		}
	});

	const resetSequence = createKeySequence({
		code: 'KeyR',
		threshold: dev ? RESET_PRESSES_DEV : RESET_PRESSES_PROD,
		onComplete: () => void hardReset(!dev)
	});

	const ESC_KEY = 'Esc' + 'ape';
	function handleKeydown(event: KeyboardEvent) {
		if ((event.key === ESC_KEY || event.code === ESC_KEY) && menuOpen) return void (menuOpen = false);
		if (!settings.shortcutsEnabled) return (versionSequence.reset(), resetSequence.reset());
		versionSequence.handle(event);
		resetSequence.handle(event);
	}

	function handleWindowClick(event: MouseEvent) {
		if (!menuOpen) return;
		const target = event.target as HTMLElement | null;
		if (
			!target?.closest('[data-testid="service-badge-context-menu"]') &&
			!target?.closest('.service-badge')
		) {
			menuOpen = false;
		}
	}

	onDestroy(() => {
		if (copyTimer) clearTimeout(copyTimer);
		versionSequence.reset();
		resetSequence.reset();
	});

	async function copyReport() {
		menuOpen = false;
		const report = await copyLogReport();
		if (report === null) {
			copied = true;
			copyTimer = setTimeout(() => {
				copied = false;
			}, 1500);
			return;
		}
		manual = report;
	}
</script>

<svelte:window onkeydown={handleKeydown} onclick={handleWindowClick} />

{#if isVisible && !hidden}
	<div class="service-badge-wrapper">
		<button
			type="button"
			class="service-badge"
			class:has-errors={logService.errorCount > 0}
			class:copied
			onclick={() => (menuOpen = !menuOpen)}
			oncontextmenu={(e) => {
				e.preventDefault();
				menuOpen = !menuOpen;
			}}
			aria-expanded={menuOpen}
			aria-haspopup="menu"
			aria-label={`${t('debug.copyLogs')} — ${appVersion}`}
			data-testid="app-version-value"
		>
			{#if copied}
				<CheckCircle2 class="badge-icon badge-icon--hint" />
			{:else if logService.errorCount > 0}
				<span class="error-count">{logService.errorCount > 99 ? '99+' : logService.errorCount}</span
				>
			{:else}
				<Copy class="badge-icon badge-icon--hint" />
			{/if}
			<span class="version">{appVersion}</span>
		</button>

		{#if menuOpen}
			<ServiceBadgeMenu
				errorCount={logService.errorCount}
				onclick={copyReport}
				onview={() => {
					menuOpen = false;
					modalOpen = true;
				}}
				onclear={() => {
					logService.clear();
					menuOpen = false;
				}}
				onhide={() => {
					menuOpen = false;
					hidden = true;
				}}
			/>
		{/if}
	</div>

	{#if manual !== ''}
		<div class="manual" data-testid="app-report-fallback-panel">
			<p class="manual__hint">{@html formatFont(t('debug.copyFailed'))}</p>
			<textarea
				class="manual__text"
				readonly
				rows="6"
				value={manual}
				data-testid="app-report-fallback-input"
			></textarea>
			<button
				type="button"
				class="manual__close"
				onclick={() => (manual = '')}
				data-testid="app-report-fallback-close-btn"
			>
				{@html formatFont(t('common.close'))}
			</button>
		</div>
	{/if}
{/if}

{#if modalOpen}
	{#await import('./ErrorLogModal.svelte') then { default: ErrorLogModal }}
		<ErrorLogModal isOpen={modalOpen} onclose={() => (modalOpen = false)} />
	{/await}
{/if}

<style>
	.service-badge-wrapper {
		position: fixed;
		bottom: 16px;
		left: 16px;
		z-index: 9999;
	}

	.manual {
		position: fixed;
		bottom: 60px;
		left: 16px;
		z-index: 9000;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: min(30rem, calc(100vw - 2 * var(--space-md)));
		padding: var(--space-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		box-shadow: 0 10px 30px rgb(0 0 0 / 45%);
	}

	.manual__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text-on-panel);
	}

	.manual__text,
	.manual__close {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.manual__text {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		padding: var(--space-xs);
		font-family: monospace;
		font-size: var(--font-size-xs);
	}

	.manual__close {
		align-self: flex-end;
		min-height: 44px;
		padding: 0 var(--space-md);
		font: inherit;
		cursor: pointer;
	}

	.service-badge {
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

	.service-badge.has-errors {
		background-color: #c92a2a;
		color: white;
		border-color: #7f1d1d;
	}

	.service-badge.copied {
		background-color: #237a35;
		color: white;
		border-color: #1b5e20;
		box-shadow: 0 4px 12px rgba(35, 122, 53, 0.4);
	}

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

	@media (prefers-reduced-motion: reduce) {
		.service-badge {
			transition: none;
		}
	}
</style>
