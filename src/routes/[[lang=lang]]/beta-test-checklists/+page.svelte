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

	/**
	 * МОВА ЧЕКЛИСТА ПЕРЕМИКАЄТЬСЯ ТУТ (§ 8.3, `BETA-OWN-LANG-BTN`).
	 *
	 * Пункти живуть двома мовами (§ 2.4), а інтерфейс сайту має чотири. Доти
	 * чеклист просто йшов за локаллю сторінки, і з цього виходив тупик, якого не
	 * видно з даних: людина, чий сайт відкрився нідерландською, бачила чеклист
	 * англійською й НЕ МАЛА ЧИМ перемкнути його на українську — мовний
	 * перемикач сайту дає їй чотири мови інтерфейсу, а чеклист розуміє дві.
	 *
	 * Кнопка перемикає РІВНО чеклист і нічого більше: адреса, мова сайту й
	 * решта сторінок лишаються як були.
	 */
	let checklistLang = $state<'uk' | 'en' | null>(null);
	const uk = $derived(checklistLang !== null ? checklistLang === 'uk' : lang === 'uk');

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

	/**
	 * Адреса вкладки → дискримінатор локатора: `quiz/play` → `quiz-play`,
	 * порожня (корінь) → `root`. Косих рисок і підкреслень у локаторах немає
	 * (TESTID-AND-NAMING § 1.2), а значення однозначно виходить із самої адреси,
	 * тож другим іменем, яке треба тримати узгодженим, це не стає.
	 */
	const screenTid = (route: string) => route.replace(/\//g, '-') || 'root';

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

	<!--
		ВЕРСІЯ ЗБІРКИ ВИДИМА (§ 8.5.1, `BETA-VERSION-VISIBLE`).

		Позначка несе версію з 9.0, і підказка «позначено на іншій версії» на
		пункті стояла — а якої версії ЦЯ сторінка, не було написано ніде. Через
		це підказка була докором без інструкції: людина не могла вирішити,
		перепоставити позначку чи вона вже на поточній збірці.

		Поруч — вихід зі сторінки (§ 8.4) і перемикач мови чеклиста (§ 8.3).
		Шапка сайту теж веде на головну (`claimHeader` нижче), але то домовленість
		між сторінкою й оболонкою, якої не видно ні з розмітки, ні з перевірки.
	-->
	<p class="meta text-panel">
		<span class="meta__version" data-testid="beta-version-text">{betaProgress.version}</span>

		<a class="meta__link" href={langPath(lang, '')} data-testid="beta-home-link">
			{@html formatFont(t('beta.home'))}
		</a>

		<button
			type="button"
			class="meta__link meta__link--btn"
			onclick={() => (checklistLang = uk ? 'en' : 'uk')}
			data-testid="beta-lang-btn"
		>
			{uk ? 'English' : 'Українська'}
		</button>
	</p>

	<!--
		КУДИ ЙТИ ПО ЦЮ ВКЛАДКУ (§ 8.4, `BETA-SCREEN-LINKS`).

		Перелік маршрутів вкладки лежав у даних невикористаним: його читав лише
		інваріант § 5.1. При одинадцяти вкладках це найдовший крок у роботі
		тестувальника — прочитав пункт, шукає, де це на сайті. Показаний той
		САМИЙ перелік, тож розійтися з дійсністю непоміченим він не може.
	-->
	<p class="screens text-panel">
		{#each tab.routes as route (route)}
			<a
				class="screens__link"
				href={langPath(lang, route)}
				data-testid="beta-screen-{screenTid(route)}-link"
			>
				{route === '' ? '/' : route}
			</a>
		{/each}
	</p>

	<!--
		ПОСТУП НА КОЖНІЙ ВКЛАДЦІ (§ 8.1), а не лише загальний.

		Вкладок одинадцять, у найбільшій — 33 пункти. Загальне «17 / 169» не
		відповідає на єдине питання, яке тестувальник собі ставить: чи закінчена
		ЦЯ вкладка. Без лічильника позицію доводиться тримати в голові або
		перераховувати очима.
	-->
	<nav class="tabs" data-testid="beta-tabs">
		{#each BETA_TABS as candidate (candidate.id)}
			{@const tabProgress = betaProgress.progressOf(candidate)}
			<button
				type="button"
				class="tab"
				class:tab--active={candidate.id === tabId}
				aria-pressed={candidate.id === tabId}
				onclick={() => (tabId = candidate.id)}
				data-testid="beta-tab-{candidate.id}-btn"
			>
				{@html formatFont(uk ? candidate.title.uk : candidate.title.en)}
				<span
					class="tab-count"
					aria-label={t('beta.tabProgress')}
					data-testid="beta-tab-{candidate.id}-progress-text"
				>
					{tabProgress.done}/{tabProgress.total}
				</span>
			</button>
		{/each}
	</nav>

	{#each LEVELS as level (level.coverage)}
		{@const items = ordered.filter((check) => check.coverage === level.coverage)}
		<!--
			Зсув нумерації: номери йдуть наскрізно 1..n по ВКЛАДЦІ, а не з одиниці
			в кожному рівні (§ 2.2). Рівнів на екрані три, і три пункти «№ 1» на
			одній сторінці роблять номер марним саме тоді, коли він потрібен:
			людина каже «зламалося на третьому», а не «зламалося на `reserve_12`».
		-->
		{@const offset = ordered.findIndex((check) => check.coverage === level.coverage)}
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
						<BetaCheckRow {check} index={offset + position + 1} {uk} />
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

		<!--
			Стирання у ДВА кроки (§ 6.3): це єдина незворотна дія на сторінці, і вона
			стоїть у тому самому рядку, що й «скопіювати звіт», до якого тягнуться
			щоразу. При 169 пунктах ціна помилки — вечір роботи проти зайвого кліка.
		-->
		<button
			type="button"
			class="action action--danger"
			class:action--armed={betaProgress.clearArmed}
			onclick={() => betaProgress.requestClear()}
			data-testid="beta-clear-btn"
		>
			<Trash2 class="action-icon" />
			{@html formatFont(t(betaProgress.clearArmed ? 'beta.clearConfirm' : 'beta.clear'))}
		</button>
	</div>

	<!--
		ДВІ ПІДКАЗКИ, А НЕ ОДНА (§ 6.2.1, `BETA-REPORT-HINT-SPLIT`).

		Доти `beta-report-hint` стояв на ВІДМОВІ буфера, тож сценарій «підказка
		видима» зеленів саме тоді, коли копіювання не спрацювало. Тепер успіх має
		свою назву, відмова — свою, і перевірка запасного шляху (§ 5.7) дивиться
		на другу.
	-->
	{#if copied}
		<p class="fallback-hint text-panel text-panel--tight" data-testid="beta-report-hint">
			{@html formatFont(t('beta.copied'))}
		</p>
	{/if}

	{#if fallback}
		<p class="fallback-hint text-panel text-panel--tight" data-testid="beta-report-failed-hint">
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

	.meta,
	.screens {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
		margin: 0;
	}

	.meta__version {
		font-variant-numeric: tabular-nums;
		opacity: 0.8;
	}

	/*
	 * Посилання й кнопка в одному рядку мусять бути однією річчю на дотик:
	 * 44 px — межа з ACCESSIBILITY-v9, і для тексту в рядку її дає саме
	 * `min-height` разом із `inline-flex`, а не `padding`.
	 */
	.meta__link,
	.screens__link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--color-accent);
	}

	.meta__link--btn {
		border: 0;
		padding: 0;
		background: none;
		font: inherit;
		color: var(--color-accent);
		text-decoration: underline;
		cursor: pointer;
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

	/* Рівна ширина цифр: лічильники в ряду вкладок не мусять стрибати. */
	.tab-count {
		margin-inline-start: 6px;
		font-size: 0.8rem;
		opacity: 0.75;
		font-variant-numeric: tabular-nums;
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

	/*
	 * Зведена кнопка стирання (§ 6.3). Стан НЕ лише кольором: рамка червона,
	 * напис напівжирний, і сам текст кнопки міняється на питання — три
	 * незалежні ознаки, тож зміну видно й тому, хто кольори не розрізняє
	 * (ACCESSIBILITY-v9).
	 */
	.action--armed {
		border-color: #ef4444;
		color: #ef4444;
		font-weight: 700;
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
