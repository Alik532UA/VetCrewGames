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
	 *
	 * **Чому одне, а не двоє.** Доти в двох нижніх кутах стояли дві накладки для
	 * однієї й тієї самої людини — того, хто знімає звіт: `AppVersion` праворуч і
	 * `LogCopyButton` ліворуч. Праворуч було ще й неправильно: `PageScrollbar` — це
	 * `position: fixed; right: 0` шириною 10px (20px під курсором) із `z-index:
	 * 8000`, а версія стояла на `right: 8px` із `z-index: 1000`. Тобто номер
	 * лежав ПІД власною смугою прокрутки — накритий у тому самому куті, куди його
	 * поклали.
	 *
	 * **Форма змінюється, місце — ні.** У спокої це капсула з номером версії; коли
	 * є помилки — червоний кружок із їхньою кількістю; після копіювання — галочка.
	 * Один елемент, один `data-testid`, один кут.
	 *
	 * **Видимість (DEBUGGING-v8 § 2.1, із відхиленням).** У dev табло видиме
	 * ЗАВЖДИ, а не лише за наявності помилок, як приписує канон: воно тепер несе
	 * номер версії, а його ховати нема сенсу — саме в dev він і потрібен. У проді
	 * табло приховане, доки не ввімкнено debug-режим.
	 *
	 * **Два входи, і вони навмисно різні за природою.** `?debug=1` в адресі
	 * працює на телефоні й пересилається посиланням; серія натискань `V` — для
	 * того, хто вже сидить за клавіатурою, і вона зберігається між сеансами. На
	 * дотику серія недосяжна, і саме тому адресний параметр лишається: інакше
	 * версію на телефоні не побачив би ніхто.
	 *
	 * **Пороги асиметричні** — 55 щоб показати в проді, 5 щоб сховати, 5/5 у dev.
	 * Чому саме так, розписано в `debugMode.svelte.ts`: поріг тримає службовий
	 * елемент від випадкового відвідувача, а ховання наслідків не має.
	 *
	 * **Службове меню заповідника переїхало на ПРАВИЙ клік.** Доти його відкривав
	 * звичайний клік по номеру версії; тепер звичайний клік копіює звіт, бо це
	 * головна дія табло. Правий клік (довгий тап) лишає меню на місці й не займає
	 * жодного нового елемента; у проді `devPanel.toggle()` і так нічого не робить,
	 * бо `dev` — константа збірки.
	 */
	const appVersion = __APP_VERSION__;

	/*
	 * `browser &&` тут обов'язковий, і це не перестраховка: під час prerender
	 * звернення до `page.url.searchParams` кидає «Cannot access url.searchParams on
	 * a page with prerendering enabled» і валить збірку цілком. Приклад у
	 * DEBUGGING-v8 § 2.1 написаний без цього guard — він для профілю, де сторінка
	 * рендериться на запит.
	 */
	const urlDebug = $derived(browser && page.url.searchParams.get('debug') === '1');
	/*
	 * `?debug=1` діє ПОВЕРХ збереженого стану: посилання з ним мусить показати
	 * табло навіть тому, хто раніше сховав його серією натискань. Інакше
	 * найнадійніший шлях (єдиний досяжний на телефоні) можна було б випадково
	 * заблокувати назавжди.
	 */
	const isVisible = $derived(urlDebug || debugMode.enabled);

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Серія `V` ПЕРЕМИКАЄ табло, а поріг залежить від напрямку.
	 *
	 * Функція, а не число: після спрацювання потрібний поріг інший (щойно табло
	 * стало видимим, сховати його коштує 5, а не 55). Перестворювати послідовність
	 * на кожну зміну стану означало б губити половину набраної серії.
	 */
	const versionSequence = createKeySequence({
		code: 'KeyV',
		threshold: () => debugMode.pressesToToggle,
		onComplete: () =>
			logService.info('ui', `service badge ${debugMode.toggle() ? 'shown' : 'hidden'}`)
	});

	/**
	 * Серія `R` — аварійне скидання. Пороги й підтвердження живуть у `resetService`.
	 *
	 * У проді `hardReset(true)` питає підтвердження: разом із порогом у пʼятдесят
	 * це два незалежні барʼєри перед знищенням місцевого прогресу, і жоден не
	 * покладається на уважність.
	 */
	const resetSequence = createKeySequence({
		code: 'KeyR',
		threshold: dev ? RESET_PRESSES_DEV : RESET_PRESSES_PROD,
		onComplete: () => void hardReset(!dev)
	});

	/**
	 * `V` і `R` — теж одиночні літери, тож і вони під вимикачем гарячих клавіш
	 * (WCAG SC 2.1.4; чому саме так — у `settings.shortcutsEnabled`). Вимикач, що
	 * лишає живою саме `R` — серію, яка стирає весь місцевий прогрес, — був
	 * би вимикачем лише на вигляд. Вхід у табло не зникає: `?debug=1`
	 * клавіатури не потребує взагалі (DEBUGGING-v8 § 3.1). Серії СКИДАЮТЬСЯ, а
	 * не ігноруються: набране до вимкнення не має чекати на повторне
	 * ввімкнення, щоб раптом спрацювати.
	 */
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

	/** Складання самого тексту живе в `logReport.ts` — там його перевіряє тест. */
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
			}, 1000);
		} catch (err) {
			logService.error('ui', 'Failed to copy logs', { error: err });
		}
	}

	/** Правий клік — службове меню заповідника. У проді не робить нічого. */
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
		<!-- Номер версії — поза гілками: лічильник ДОДАЄТЬСЯ до нього, а не заміняє
		     його. Інакше на dev, де помилка буває майже завжди, версії не видно. -->
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
		/*
		 * Вище за `PageScrollbar` (8000) і за все інше, крім `Toast` (10000): звіт
		 * знімають саме тоді, коли на екрані щось не так, тож табло не має права
		 * опинитися під іншою накладкою. Тост лишається вище навмисно — він
		 * зʼявляється на секунди й несе те, що людина щойно зробила.
		 */
		z-index: 9999;

		display: flex;
		align-items: center;
		gap: 4px;
		/* Капсула: номер версії в коло 32px не влазить. */
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
		/* Номер читає той, хто дивиться на скріншот, тож він не має «розсипатися». */
		white-space: nowrap;
	}

	/*
	 * Іконка копіювання — підказка, що капсула клікабельна, а не окрема дія. Тому
	 * вона дрібніша за номер і тане: головне тут число версії.
	 */
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

	/*
	 * Форма НЕ змінюється між станами: капсула лишається капсулою, бо номер версії
	 * лишається на місці. Доти помилки перетворювали табло на кружок 32px — зникала
	 * не лише версія, а й упізнаваність елемента: у куті з'являлося щось інше.
	 */

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
	.service-badge.has-errors {
		background-color: #c92a2a;
		color: white;
		border-color: #7f1d1d;
	}

	/*
	 * Лічильник — плашка ПЕРЕД номером, а не текст замість нього. Темніший червоний
	 * за тло капсули (#7f1d1d на #c92a2a): білий текст дає на ньому 10:1, і плашка
	 * читається як окремий елемент, а не як пляма.
	 */
	.error-count {
		font-weight: bold;
		font-size: 0.75rem;
		line-height: 1;
		padding: 2px 5px;
		border-radius: 8px;
		background-color: #7f1d1d;
		color: white;
	}

	/*
	 * Розмір залежить від СПОСОБУ ВВЕДЕННЯ, а не від ширини вікна: на десктопі
	 * 900px кнопка лишалася б маленькою для миші, а на планшеті 1024px —
	 * маленькою для дотику (ACCESSIBILITY-v8 § 8, DEBUGGING-v8 § 2.2).
	 */
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
