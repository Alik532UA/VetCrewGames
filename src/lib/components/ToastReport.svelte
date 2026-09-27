<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t, formatFont } from '$lib/i18n';
	import { copyLogReport } from '$lib/services/reportCopy';
	import ContactLinks from '$lib/components/ui/ContactLinks.svelte';

	/**
	 * «СКОПІЮВАТИ ЗВІТ» І «ЗВʼЯЗАТИСЯ З РОЗРОБНИКОМ» у тості про збій (прохання автора
	 * 2026-09-27): там, де причину людина сама не виправить — правила ще не викладені,
	 * проблема в коді, гру саме оновлюють.
	 *
	 * Звіт — той самий, що знімає службове табло (`services/reportCopy.ts`), разом із
	 * запасним полем на відмову буфера. Контакти — месенджери автора (`ContactLinks`), за
	 * кнопкою: у тості місця мало, а потрібні вони лише тому, хто вже вирішив написати.
	 *
	 * ## Лінивим шматком, а не в кореневому layout
	 *
	 * Тост живе в кореневому layout, а той на межі бюджету (`check:build`, 22 КБ gzip): цей
	 * вміст потрібен лише тоді, коли збій уже стався. Текст причини й «Оновити сторінку»
	 * лишаються в самому тості — саме вони потрібні, коли на сервері вже інша збірка і
	 * лінивих шматків цієї вкладки там немає.
	 *
	 * `onEngage` — людина взялася за дію: тост закріплюється й сам більше не зникає.
	 */
	let { onEngage }: { onEngage: () => void } = $props();

	let copied = $state(false);
	/** Звіт, який не вдалося покласти в буфер, — щоб виділити рукою. Порожньо — поклали. */
	let manual = $state('');
	let contacts = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		onEngage();
		const failed = await copyLogReport();
		if (failed !== null) {
			manual = failed;
			return;
		}
		manual = '';
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 1500);
	}

	function toggleContacts() {
		onEngage();
		contacts = !contacts;
	}

	onDestroy(() => clearTimeout(timer));
</script>

<div class="report" data-testid="toast-report-panel">
	<div class="report__actions">
		<button type="button" class="report__btn" onclick={copy} data-testid="toast-report-copy-btn">
			{@html formatFont(t(copied ? 'problem.copied' : 'problem.copyReport'))}
		</button>
		<button
			type="button"
			class="report__btn"
			aria-expanded={contacts}
			aria-controls="toast-contacts"
			onclick={toggleContacts}
			data-testid="toast-report-contact-btn"
		>
			{@html formatFont(t('problem.contact'))}
		</button>
	</div>

	<!-- Поле — лише після відмови буфера; підпис над ним і є його доступне ім'я. -->
	{#if manual !== ''}
		<label class="report__hint" for="toast-report">
			{@html formatFont(t('debug.copyFailed'))}
		</label>
		<textarea
			id="toast-report"
			class="report__manual"
			readonly
			rows="5"
			value={manual}
			data-testid="toast-report-textarea"
		></textarea>
	{/if}

	<!--
		Контакти стоять у DOM завжди й ховаються `hidden`: `aria-controls` мусить вказувати на
		наявний елемент, а не на той, що зʼявиться.
	-->
	<div id="toast-contacts" class="report__contacts" hidden={!contacts}>
		<p class="report__hint">{@html formatFont(t('problem.contactHint'))}</p>
		<ContactLinks scope="toast" />
	</div>
</div>

<style>
	/* Фону свого немає: це вміст тоста, і фон дає він (`backdrop.test.ts`). */
	.report {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.report__actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	/* Тихіша за дію тоста: рамка без заливки; 44px — сенсорна ціль (ACCESSIBILITY-v9 § 8). */
	.report__btn {
		min-height: 44px;
		padding: 0 var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-text);
		font: inherit;
		font-size: var(--font-size-sm);
		cursor: pointer;
	}

	.report__hint {
		margin: 0;
		font-size: var(--font-size-xs);
		color: var(--color-text);
	}

	.report__contacts {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.report__contacts[hidden] {
		display: none;
	}

	.report__manual {
		width: 100%;
		box-sizing: border-box;
		resize: vertical;
		padding: var(--space-xs);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
		font-family: monospace;
		font-size: var(--font-size-xs);
	}
</style>
