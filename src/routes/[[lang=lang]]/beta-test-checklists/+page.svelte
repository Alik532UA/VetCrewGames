<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Copy, Check, Trash2 } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { RULES_VERSION } from '$lib/net/rulesVersion';
	import { betaProgress } from '$lib/services/betaProgress.svelte';
	import { buildBetaReport } from '$lib/services/betaReport';
	import { BETA_TABS, sortedChecks, type Coverage } from '$lib/config/betaChecks';
	import BetaCheckRow from '$lib/components/beta/BetaCheckRow.svelte';

	/**
	 * Чеклист бета-тестування — сторінка для тих, хто згодився потикати сайт.
	 *
	 * **Чому вона взагалі є.** 47 файлів автотестів перевіряють те, що можна
	 * перевірити машиною, і не перевіряють нічого з того, що видно лише оком:
	 * як виглядають силуети тварин, чи натискаються кнопки пальцем, чи бачать двоє
	 * людей на двох пристроях однакову дошку. Доти цю половину роботи не було ЧИМ
	 * передати: доброзичлива людина відкривала сайт і сама вигадувала, що тикати.
	 *
	 * **Сторінки немає в меню й немає в пошуку** (`HIDDEN_ROUTES` у
	 * `routing.ts`), але адреса працює завжди: сайт статичний і лежить у
	 * відкритому репозиторії, тож будувати з неї таємницю було б самообманом.
	 * Посилання дають руками — цього досить, щоб вона не плуталася під ногами в
	 * тих, хто прийшов грати.
	 *
	 * **Відповіді нікуди не надсилаються.** Вони лежать у сховищі цього браузера, а
	 * кнопка складає з них текст у буфер обміну. Збирати їх на сервер означало б
	 * таблицю, правила доступу до неї й чужі імена в ній — заради даних, яких поки
	 * ніхто не читає.
	 */
	const lang = $derived(languageFromParam(page.params.lang));
	const uk = $derived(lang === 'uk');

	let tabId = $state(BETA_TABS[0].id);
	let tab = $derived(BETA_TABS.find((candidate) => candidate.id === tabId) ?? BETA_TABS[0]);

	/**
	 * Пункти вкладки, розкладені на три рівні покриття.
	 *
	 * Порядок рівнів — це вся суть: людина витрачається спершу там, де машини
	 * немає. Останній рівень при цьому не зайвий, і не для повноти: помилка,
	 * знайдена в покритому місці, означає, що бреше ТЕСТ, а такий звіт дорожчий за
	 * звичайний баг.
	 */
	const LEVELS: { coverage: Coverage; title: TranslationKey; hint: TranslationKey }[] = [
		{
			coverage: 'manual',
			title: 'beta.coverage.manual',
			hint: 'beta.coverage.manualHint'
		},
		{
			coverage: 'testable',
			title: 'beta.coverage.testable',
			hint: 'beta.coverage.testableHint'
		},
		{
			coverage: 'covered',
			title: 'beta.coverage.covered',
			hint: 'beta.coverage.coveredHint'
		}
	];

	let ordered = $derived(sortedChecks(tab));

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	/**
	 * Звіт текстом на випадок, коли буфер обміну недоступний.
	 *
	 * Не перестраховка: `navigator.clipboard.writeText` відмовляє в цілком
	 * буденних умовах — вкладка не у фокусі, сторінка відкрита не через https,
	 * браузер вимагає окремого дозволу. Перша версія в такому разі лише писала в
	 * лог: кнопка виглядала натиснутою, а звіту не було НІДЕ — тобто вся робота
	 * тестувальника зникала на останньому кроці. Виявлено при перевірці в браузері,
	 * де вкладка була не у фокусі.
	 */
	let fallback = $state('');

	/**
	 * ЧИ ВИКЛАДЕНІ В БАЗІ ТІ САМІ ПРАВИЛА, ЩО В ЦІЙ ЗБІРЦІ.
	 *
	 * Рядок тут, а не в шапці й не в тості, бо це діагностика, а не стан гри: його
	 * шукають рівно тоді, коли щось у мережевій частині поводиться незрозуміло.
	 *
	 * НА ВИМОГУ, а не при відкритті: читання вимагає авторизації, а вхід анонімний
	 * — тобто автоматична перевірка заводила б обліковий запис Firebase кожному,
	 * хто просто відкрив цю сторінку. Кнопка лишає рішення людині.
	 */
	let rulesState = $state<'idle' | 'checking' | 'fresh' | 'stale' | 'unknown'>('idle');
	let rulesStamp = $state('');

	async function checkRules() {
		if (rulesState === 'checking') return;
		rulesState = 'checking';
		const { checkLiveRules } = await import('$lib/net/rulesLive');
		const result = await checkLiveRules();
		rulesStamp = result.stamp;
		rulesState = result.state;
	}

	async function copyReport() {
		const report = buildBetaReport(betaProgress.marks, {
			version: betaProgress.version,
			userAgent: navigator.userAgent,
			language: settings.locale,
			theme: settings.theme,
			// ISO, а не локальний формат: звіт читає той, хто його розбирає, і 03.08
			// проти 08.03 у ньому нема по чому розрізнити (I18N-v8 § 4.3).
			at: new Date().toISOString()
		});

		try {
			await navigator.clipboard.writeText(report);
			copied = true;
			fallback = '';
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch (error) {
			// Звіт мусить дійти до людини навіть тоді, коли браузер відмовив.
			fallback = report;
			// `String(error)`, а не `{ error }`: `message` і `stack` у `Error`
			// неперелічувані, тож у звіті таке поле стає рівно `{}`.
			logService.error('ui', 'Failed to copy the beta report', {
				reason: String(error)
			});
		}
	}

	onMount(() => {
		const release = settings.claimHeader('beta.title', () => goto(langPath(lang, '')));
		return () => {
			clearTimeout(copyTimer);
			release();
		};
	});
</script>

<div class="beta-page">
	<p class="intro text-panel" data-testid="beta-intro-text">{@html formatFont(t('beta.intro'))}</p>

	<p class="progress text-panel" data-testid="beta-progress-value">
		{@html formatFont(t('beta.progress'))}: {betaProgress.freshCount} / {betaProgress.totalCount}
	</p>

	<nav class="tabs" data-testid="beta-tabs">
		{#each BETA_TABS as candidate (candidate.id)}
			<button
				type="button"
				class="tab"
				class:tab--active={candidate.id === tabId}
				aria-pressed={candidate.id === tabId}
				onclick={() => (tabId = candidate.id)}
				data-testid="beta-tab-{candidate.id}-btn"
			>
				{@html formatFont(uk ? candidate.title.uk : candidate.title.en)}
			</button>
		{/each}
	</nav>

	{#each LEVELS as level (level.coverage)}
		{@const items = ordered.filter((check) => check.coverage === level.coverage)}
		{#if items.length}
			<section class="level" data-testid="beta-level-{level.coverage}-section">
				<h2 class="level-title text-panel">{@html formatFont(t(level.title))}</h2>
				<p class="level-hint text-panel text-panel--tight">{@html formatFont(t(level.hint))}</p>
				<!--
					Списків на сторінці ТРИ — по одному на рівень покриття, тож локатор
					мусить називати рівень. Доти всі три звалися однаково, і перевірка
					доступності мусила писати `.first()`, щоб не впасти зі `strict mode
					violation`.
				-->
				<ul class="checks" data-testid="beta-{level.coverage}-checks-list">
					{#each items as check, position (check.id)}
						<BetaCheckRow {check} index={position + 1} {uk} />
					{/each}
				</ul>
			</section>
		{/if}
	{/each}

	<!--
		ПРАВИЛА ДОСТУПУ — окремий рядок, бо це єдине, чого не видно ні з коду, ні зі
		збірки: вони виконуються на боці Firebase, а викладає їх людина.

		Заміряно 2026-08-23: у продакшні діяла інша редакція, ніж у git, і через це
		не працював список публічних кімнат — а сторінка казала лише «перелік
		недоступний», не називаючи причини. Тепер причину видно одним словом.
	-->
	<section class="rules-state text-panel">
		<h2 class="rules-state__title">{@html formatFont(t('beta.rulesTitle'))}</h2>
		<p class="rules-state__line" data-testid="beta-rules-state-text">
			{#if rulesState === 'idle'}
				<code class="rules-state__stamp">{RULES_VERSION}</code>
			{:else if rulesState === 'checking'}
				{@html formatFont(t('beta.rulesChecking'))}
			{:else}
				{@html formatFont(
					t(
						rulesState === 'fresh'
							? 'beta.rulesFresh'
							: rulesState === 'stale'
								? 'beta.rulesStale'
								: 'beta.rulesUnknown'
					)
				)}
				<code class="rules-state__stamp">{rulesStamp}</code>
			{/if}
		</p>
		<button
			type="button"
			class="action"
			onclick={checkRules}
			aria-disabled={rulesState === 'checking'}
			data-testid="beta-rules-check-btn"
		>
			{@html formatFont(t('beta.rulesCheck'))}
		</button>
	</section>

	<div class="actions">
		<button type="button" class="action" onclick={copyReport} data-testid="beta-report-btn">
			{#if copied}
				<Check class="action-icon" />
				{@html formatFont(t('beta.copied'))}
			{:else}
				<Copy class="action-icon" />
				{@html formatFont(t('beta.copy'))}
			{/if}
		</button>

		<button
			type="button"
			class="action action--danger"
			onclick={() => betaProgress.clear()}
			data-testid="beta-clear-btn"
		>
			<Trash2 class="action-icon" />
			{@html formatFont(t('beta.clear'))}
		</button>
	</div>

	{#if fallback}
		<p class="fallback-hint text-panel text-panel--tight" data-testid="beta-report-hint">
			{@html formatFont(t('beta.copyFailed'))}
		</p>
		<textarea
			class="fallback-text"
			readonly
			rows="10"
			value={fallback}
			data-testid="beta-report-input"
			aria-label={t('beta.copy')}
		></textarea>
	{/if}
</div>

<style>
	.beta-page {
		display: flex;
		flex-direction: column;
		gap: 14px;
		width: min(900px, 100%);
		margin: 0 auto;
		padding: 12px;
	}

	.intro,
	.progress {
		margin: 0;
	}

	.progress {
		font-weight: 700;
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tab {
		min-height: 44px;
		padding: 0 12px;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background-color: var(--color-bg-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.tab--active {
		border-color: var(--color-accent);
		font-weight: 700;
	}

	.level {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.level-title {
		margin: 0;
		font-size: 1.05rem;
	}

	.level-hint {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.75;
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
	 * Смуга стану правил. Тло дає `.text-panel` — свого тут навмисно немає, як і в
	 * решти діагностичних блоків цієї сторінки.
	 */
	.rules-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-sm);
		width: 100%;
		max-width: 46rem;
		margin: 0 auto;
	}

	.rules-state__title {
		margin: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		text-transform: uppercase;
	}

	.rules-state__line {
		margin: 0;
		font-size: var(--font-size-sm);
	}

	/* Штамп — код, і читається він по знаках: рівна ширина обов'язкова. */
	.rules-state__stamp {
		font-family: ui-monospace, monospace;
		font-variant-numeric: tabular-nums;
		padding: 0 4px;
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-text), transparent 90%);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		/* Кнопки внизу: до них доходять, коли робота зроблена. */
		padding-top: 6px;
	}

	.action {
		display: flex;
		align-items: center;
		gap: 6px;
		min-height: 44px;
		padding: 0 14px;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background-color: var(--color-bg-surface);
		color: var(--color-text);
		font: inherit;
		cursor: pointer;
	}

	.action:hover {
		border-color: var(--color-accent);
	}

	.action--danger:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	.action :global(.action-icon) {
		width: 18px;
		height: 18px;
	}

	.fallback-hint {
		margin: 0;
	}

	.fallback-text {
		width: 100%;
		padding: 8px;
		border: 2px solid var(--color-border);
		border-radius: 6px;
		background-color: var(--color-bg-surface);
		color: var(--color-text);
		/* Моноширинний: у звіті є вирівняні відступами рядки. */
		font-family: monospace;
		font-size: 0.8rem;
		resize: vertical;
	}
</style>
