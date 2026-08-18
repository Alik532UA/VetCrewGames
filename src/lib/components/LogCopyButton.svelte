<script lang="ts">
	import { Copy, Check } from 'lucide-svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { storage } from '$lib/services/storage';
	import { t } from '$lib/i18n';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { onDestroy } from 'svelte';

	/**
	 * DEBUGGING-v8 § 2.1. У продакшні логи пишуться в кільцевий буфер завжди —
	 * але доти кнопка була `dev && …`, тобто зняти звіт із пристрою користувача
	 * було неможливо в принципі. Збір логів у prod працював у нікуди.
	 *
	 * Тепер: у dev кнопка з'являється на першій помилці, у prod — коли ввімкнено
	 * debug-режим, `?debug=1` або ключем сховища. Ключ читається один раз: без
	 * перезавантаження він не змінюється.
	 */
	const debugFlag = browser && storage.get('debug_mode') === '1';

	// `browser &&` тут обов'язковий, і це не перестраховка: під час prerender
	// звернення до `page.url.searchParams` кидає «Cannot access url.searchParams
	// on a page with prerendering enabled» і валить збірку цілком. Приклад у
	// DEBUGGING-v8 § 2.1 написаний без цього guard — він для профілю, де
	// сторінка рендериться на запит.
	const debugMode = $derived(
		browser && (page.url.searchParams.get('debug') === '1' || debugFlag)
	);
	const isVisible = $derived(dev ? logService.errorCount > 0 : debugMode);

	let copied = $state(false);
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	onDestroy(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});

	async function copyLogs() {
		const logs = logService.getLogs();
		let version = logService.appVersion;

		// ISO, а не toLocaleString(): звіт читає той, хто розбирає збій, а не
		// відвідувач, який його скопіював. Голий toLocaleString() рендериться в
		// локалі СИСТЕМИ відвідувача — 03.08 чи 08.03 залежно від того, де він
		// живе, і розрізнити їх у звіті нема по чому (I18N-v8 § 4.3).
		//
		// ONLINE — не прикраса: половина звітів «нічого не працює» пояснюється
		// саме цим рядком (DEBUGGING-v8 § 2.3).
		const header = `--- REPORT from Copy LOG button ---
DATE: ${new Date().toISOString()}
URL: ${window.location.href}
DEVICE: ${navigator.userAgent}
VERSION: ${version}
ONLINE: ${navigator.onLine}
------------------------
`;
		const logText = logs
			.map(
				(l) =>
					`[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category.toUpperCase()}] ${l.message} ${l.data ? JSON.stringify(l.data) : ''}`
			)
			.join('\n');

		const fullText = header + logText;

		try {
			await navigator.clipboard.writeText(fullText);
			copied = true;
			timeoutId = setTimeout(() => {
				copied = false;
			}, 1000);
		} catch (err) {
			logService.error('ui', 'Failed to copy logs', { error: err });
		}
	}
</script>

{#if isVisible}
	<button
		type="button"
		class="log-copy-btn"
		class:has-errors={logService.errorCount > 0}
		onclick={copyLogs}
		aria-label={t('debug.copyLogs')}
		data-testid="debug-copy-logs-btn"
	>
		{#if copied}
			<Check class="log-icon" />
		{:else if logService.errorCount > 0}
			<span class="error-count">{logService.errorCount}</span>
		{:else}
			<Copy class="log-icon" />
		{/if}
	</button>
{/if}

<style>
	.log-copy-btn {
		position: fixed;
		bottom: 16px;
		left: 16px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background-color: var(--color-bg-surface);
		color: var(--color-text);
		border: 2px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		z-index: 9999;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		transition: all 0.2s;
	}

	.log-copy-btn:hover {
		transform: scale(1.1);
	}

	/*
	 * Червоний темніший за #ef4444 — за WCAG AA, не за смаком: білий текст на
	 * ньому давав 3.76:1 при потрібних 4.5, і давав це в усіх ЧОТИРЬОХ темах.
	 * Тепер 5.46:1. Лічильник помилок — це та плашка, яку читають саме тоді, коли
	 * щось пішло не так, тобто найгірший кандидат на «майже читно».
	 *
	 * Кольори лишаються літералами, а не токенами теми, свідомо: `--color-error`
	 * у двох темах дорівнює #ff6b6b, і білий на ньому дає 2.7:1 — гірше за те, що
	 * тут було. Сигнал «є помилки» мусить виглядати однаково в будь-якій темі.
	 */
	.log-copy-btn.has-errors {
		background-color: #c92a2a;
		color: white;
		border-color: #7f1d1d;
	}

	.error-count {
		font-weight: bold;
		font-size: 0.9rem;
	}

	.log-copy-btn :global(.log-icon) {
		width: 16px;
		height: 16px;
	}

	/*
	 * Було `@media (max-width: 768px)` із розміром 24×24 — рівно на абсолютному
	 * мінімумі WCAG 2.2 AA (SC 2.5.8) і вдвічі менше за власний стандарт
	 * проєкту. Причому вузьке вікно — не те саме, що палець: на десктопі 900px
	 * кнопка лишалася б маленькою для миші, а на планшеті 1024px — маленькою
	 * для дотику.
	 *
	 * Тепер розмір залежить від СПОСОБУ ВВЕДЕННЯ: 44×44 там, де немає точного
	 * вказівника (ACCESSIBILITY-v8 § 8, DEBUGGING-v8 § 2.2).
	 */
	@media (hover: none) {
		.log-copy-btn {
			width: 44px;
			height: 44px;
		}

		.log-copy-btn :global(.log-icon) {
			width: 20px;
			height: 20px;
		}

		.error-count {
			font-size: 1rem;
		}
	}
</style>
