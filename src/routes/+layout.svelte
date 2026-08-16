<script lang="ts">
	import '$lib/styles/global.css';
	import '$lib/styles/animations.css';
	import { t, formatPlain } from '$lib/i18n/index';
	import { logService } from '$lib/services/logService.svelte';
	import { settings } from '$lib/services/settings.svelte';
	import { scrollbar } from '$lib/controllers/scrollbar.svelte';
	import PageScrollbar from '$lib/components/PageScrollbar.svelte';
	import ScrollbarContextMenu from '$lib/components/ScrollbarContextMenu.svelte';
	import LogCopyButton from '$lib/components/LogCopyButton.svelte';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import ErrorFallback from '$lib/components/ErrorFallback.svelte';
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { trackPageView } from '$lib/services/analytics';
	import { fly } from 'svelte/transition';
	import {
		INDEXED_LANGUAGES,
		SITE_BASE,
		SITE_ORIGIN,
		DEFAULT_LANGUAGE,
		langPath,
		langUrl,
		languageFromParam,
		routeRestFromId
	} from '$lib/i18n/routing';

	let { children } = $props();

	/**
	 * Мова сторінки береться з АДРЕСИ, і присвоюється тут — у layout, ДО рендеру
	 * дітей (SVELTE-CORE-v8 § 5.1, I18N-v8 § 5.1).
	 *
	 * Це не перестраховка: prerender генерує сторінки послідовно в одному
	 * процесі, а `settings` — модульний синглтон. Присвоєння в компоненті
	 * СТОРІНКИ спрацювало б на один рендер пізніше, ніж читає layout, і в
	 * `build/` мова з'їхала б на одну сторінку: `/en/` українською.
	 *
	 * Виклик стоїть у тілі `<script>`, а не в ефекті: на сервері ефекти не
	 * виконуються взагалі, а саме серверний рендер і потрапляє у файл.
	 */
	const routeLanguage = $derived(languageFromParam(page.params.lang));
	settings.applyRouteLocale(languageFromParam(page.params.lang));

	// Клієнтська навігація: layout не перемонтовується, тож тіло `<script>`
	// вдруге не виконається. `$effect.pre` — щоб мова змінилася ДО того, як
	// оновиться розмітка, інакше один кадр показує попередню.
	$effect.pre(() => {
		settings.applyRouteLocale(routeLanguage);
	});

	/** «Хвіст» адреси без мови — спільний для всіх мовних версій цієї сторінки. */
	const routeRest = $derived(routeRestFromId(page.route.id));

	// Deliberately not formatPlain: that swaps Cyrillic і for Latin i to work
	// around a font missing the glyph. Fine for text on screen, wrong for
	// anything a machine reads — a search engine would index "Безкоштовнi" with
	// a Latin i, which no Ukrainian query matches. The tab title is drawn in the
	// system font too, so it does not want the substitution either.
	let pageTitle = $derived(t('app.title'));
	let seoDescription = $derived(t('app.description'));
	// Абсолютні адреси — з явних констант, а не з `page.url`: під час prerender
	// origin дорівнює `sveltekit-prerender` (SEO-v8 § 1.2).
	let canonical = $derived(langUrl(routeLanguage, routeRest));
	let ogImage = $derived(`${SITE_ORIGIN}${SITE_BASE}/images/VetCrewGames_logo_v1.png`);

	// Fires on the initial load too, so this covers the first view and each
	// client-side move between the games. trackPageView initialises analytics
	// itself, so there is no ordering to get wrong against onMount.
	afterNavigate(() => trackPageView());

	// Версія інжектується Vite на етапі збірки (VERSIONING-v8 § 2, підхід A):
	// нуль мережевих запитів, синхронний доступ, і номер той самий, що у звіті
	// логів та в `release` Sentry.
	//
	// Доти тут стояло `let appVersion = $state('')`, якому ніхто нічого не
	// присвоював, — тобто блок нижче не рендерився ніколи, а виглядав як
	// реалізований показ версії.
	const appVersion = __APP_VERSION__;

	// Handle transition direction
	let transitionDirection = $state(1);
	let lastPath = page.url.pathname;

	/**
	 * Головна — це шлях без нічого, крім (можливого) мовного сегмента. Порівняння
	 * з голим `base` тут уже не годиться: `/VetCrewGames/en/` теж головна.
	 */
	function isHome(path: string) {
		// Головна — це шлях, у якому після (можливого) мовного сегмента вже нічого
		// немає. Порівняння з голим `base` тут не годиться: `…/en/` теж головна.
		return !/\/(game-[a-z-]+)\/?$/.test(path);
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

	/**
	 * Клас, що ховає нативну смугу, має рівно ОДНОГО власника — цей ефект.
	 *
	 * Якби його ставили й знімали самі малювальники, перемикання режиму давало б
	 * гонку: новий компонент клас додає, а прибиральник старого спрацьовує після
	 * нього й одразу знімає. На екрані видно дві смуги (SCROLLBAR-v8 § 2.3).
	 *
	 * SYNC: ті самі умови продубльовані в інлайн-скрипті `src/app.html` — інакше
	 * ніяк, скрипт першого кадру не може імпортувати контролер.
	 */
	$effect(() => {
		document.documentElement.classList.toggle('has-custom-scrollbar', scrollbar.hidesNative);
	});

	onMount(() => {
		// Підписка на системну тему. `settings` — module-level singleton, тож
		// $effect у ньому недоступний (effect_orphan), і життєвий цикл підписки
		// веде цей компонент: init() повертає cleanup, який іде в загальний
		// return нижче (SVELTE-CORE-v8 § 2.6).
		const stopThemeSync = settings.init();

		/*
		 * Пріоритет вибору мови: АДРЕСА → збережений вибір → типова
		 * (I18N-v8 § 3.3). Голий шлях означає «вибору в адресі не зроблено»,
		 * тож саме там — і ТІЛЬКИ там — застосовується збережений.
		 *
		 * `replaceState`, щоб «назад» не впиралося в нескінченний редирект, і
		 * `noScroll`, щоб сторінка не сіпнулася вгору. На мовній адресі не
		 * робиться нічого: інакше збережений вибір викидав би відвідувача зі
		 * сторінки, яку він щойно відкрив за посиланням.
		 */
		if (!page.params.lang) {
			const saved = settings.savedLocale();
			if (saved && saved !== DEFAULT_LANGUAGE) {
				goto(langPath(saved, routeRestFromId(page.route.id)), {
					replaceState: true,
					noScroll: true
				});
			}
		}

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
			stopThemeSync();
			window.removeEventListener('unhandledrejection', onRejection);
			window.removeEventListener('error', onError);
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={asset('/favicon.svg')} />
	<title>{pageTitle}</title>
	<meta name="description" content={seoDescription} />
	<link rel="canonical" href={canonical} />

	<!--
		hreflang: набір однаковий на всіх мовних версіях і взаємний, плюс
		`x-default` на типову мову (SEO-v8 § 2.2). Без цього дві мовні версії
		того самого вмісту конкурують одна з одною в індексі.
	-->
	{#each INDEXED_LANGUAGES as lang (lang)}
		<link rel="alternate" hreflang={lang} href={langUrl(lang, routeRest)} />
	{/each}
	<link rel="alternate" hreflang="x-default" href={langUrl(DEFAULT_LANGUAGE, routeRest)} />

	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:url" content={canonical} />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:locale" content={routeLanguage === 'uk' ? 'uk_UA' : 'en_US'} />

	<!-- Twitter -->
	<meta property="twitter:card" content="summary_large_image" />
	<meta property="twitter:url" content={canonical} />
	<meta property="twitter:title" content={pageTitle} />
	<meta property="twitter:description" content={seoDescription} />
	<meta property="twitter:image" content={ogImage} />
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
				use:scrollbar.register
				in:fly={{ x: 300 * transitionDirection, duration: 400, delay: 400 }}
				out:fly={{ x: -300 * transitionDirection, duration: 400 }}
			>
				<svelte:boundary
					onerror={(error) =>
						logService.error('app', 'Render boundary caught error', { error: String(error) })}
				>
					{@render children()}

					{#snippet failed(_, reset)}
						<ErrorFallback lang={routeLanguage} onretry={reset} />
					{/snippet}
				</svelte:boundary>
			</div>
		{/key}
	</main>
</div>

<div class="app-version text-panel text-panel--tight" data-testid="app-version-value">{appVersion}</div>

<PageScrollbar />

<!-- Меню в корені: після перемикання на системну смуга зникає — разом із меню,
     якби воно було всередині неї. -->
<ScrollbarContextMenu />

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
		color: var(--color-text-muted);
		opacity: 0.5;
		pointer-events: none;
		z-index: 1000;
	}
</style>
