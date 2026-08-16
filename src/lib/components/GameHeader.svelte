<script lang="ts">
	import { ArrowLeft, Sun, Moon, Maximize, Minimize, Snowflake, Leaf } from 'lucide-svelte';
	import { settings } from '$lib/services/settings.svelte';
	import { fullscreen } from '$lib/services/fullscreen.svelte';
	// Без `formatPlain`: підписи нижче — `aria-label`, а не текст на екрані.
	// `formatPlain` міняє кириличну «і» на латинську «i», щоб літера була у
	// шрифті inglobal, — це правильно для того, що МАЛЮЄТЬСЯ, і неправильно
	// для того, що ЧИТАЄ скрінрідер: «Змiнити» з латинською i вимовляється як
	// покруч. Той самий висновок уже записаний у +layout.svelte для <title>.
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
	import { page } from '$app/state';
	import {
		DEFAULT_LANGUAGE,
		LANGUAGES,
		langPath,
		languageFromParam,
		routeRestFromId
	} from '$lib/i18n/routing';
	import { onMount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';

	interface Props {
		titleKey?: TranslationKey;
		showBack?: boolean;
	}

	// `let {…}: Props = $props()`, а не `$props<Props>()`: форма з типовим
	// аргументом була в ранніх прев'ю Svelte 5 і з релізу не підтримується —
	// тип там мовчки ігнорується (SVELTE-UI-v8 § 1.1).
	let { titleKey, showBack = true }: Props = $props();

	const activeTitleKey = $derived(titleKey || settings.headerTitleKey || 'app.title');

	let lastScore = $state(settings.score);
	let isPulsing = $state(false);
	// Ефект тут законний: він не обчислює похідне значення, а запускає ЗОВНІШНІЙ
	// таймер у відповідь на подію (SVELTE-CORE-v8 § 2.1). `untrack` для читання
	// `lastScore` обов'язковий: без нього запис у нього ж робить ефект залежним
	// від власного результату, і його доводиться проганяти вдруге, щоб він
	// заспокоївся. Cleanup знімає таймер — інакше швидкі влучання поспіль
	// гасили б підсвітку одне одному (§ 2.2).
	$effect(() => {
		const score = settings.score;
		const previous = untrack(() => lastScore);
		lastScore = score;
		if (score <= previous) return;

		isPulsing = true;
		const timeoutId = setTimeout(() => {
			isPulsing = false;
		}, 600);
		return () => clearTimeout(timeoutId);
	});

	/**
	 * Перемикач мови — ПОСИЛАННЯ, а не кнопка з `goto()` (I18N-v8 § 5.3):
	 * працює без JS, читається пошуковиком і лишає користувача на ТІЙ САМІЙ
	 * сторінці — змінюється лише мовний сегмент адреси.
	 */
	const currentLanguage = $derived(languageFromParam(page.params.lang));
	const otherLanguage = $derived(
		LANGUAGES.find((lang) => lang !== currentLanguage) ?? DEFAULT_LANGUAGE
	);
	const otherLanguageHref = $derived(langPath(otherLanguage, routeRestFromId(page.route.id)));
onMount(() => fullscreen.watch());
</script>

<header class="game-header">
	<div class="game-header__inner">
		<div class="game-header__left">
			{#if showBack && activeTitleKey !== 'app.title'}
				<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} class="btn-wrap">
					<!--
						Лишається посиланням на головну, а не стає кнопкою: середній клік,
						Ctrl-клік і робота без JS зберігаються. Сторінка з власним кроком
						назад просто перехоплює звичайний клік.
					-->
					<a
						href={langPath(currentLanguage)}
						class="header-btn"
						aria-label={t('common.back')}
						data-testid="header-back-link"
						onclick={(e) => {
							if (!settings.headerBack) return;
							e.preventDefault();
							settings.headerBack();
						}}
					>
						<ArrowLeft size={22} />
					</a>
				</div>
			{:else}
				<div in:fade={{ duration: 300 }} out:fade={{ duration: 200 }} class="btn-wrap">
					<div class="header-btn placeholder"></div>
				</div>
			{/if}
		</div>

		<div class="game-header__center">
			<div class="title-with-score">
				<div class="game-title-wrapper">
					{#key activeTitleKey}
						<h1
							class="game-title"
							in:fade={{ duration: 300, delay: 150 }}
							out:fade={{ duration: 150 }}
						>
							{@html formatFont(t(activeTitleKey as TranslationKey))}
						</h1>
					{/key}
				</div>
				<div
					class="global-score"
					class:is-pulsing={isPulsing}
					role="status"
					aria-label={t('header.score')}
					data-testid="header-score-value"
				>
					<!-- Декоративний: те саме число нижче текстом (ACCESSIBILITY-v8 § 4.5). -->
					<svg class="score-circle" viewBox="0 0 36 36" aria-hidden="true" focusable="false">
						<path
							class="circle-bg"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
						<path
							class="circle-fill"
							stroke-dasharray="{(settings.score % 100) * 1}, 100"
							d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
						/>
					</svg>
					<span class="score-value">{settings.score}</span>
				</div>
			</div>
		</div>

		<div class="game-header__right">
			<button
				type="button"
				class="header-btn"
				onclick={() => settings.toggleTheme()}
				aria-label={t('header.toggleTheme')}
				data-testid="header-theme-btn"
			>
				{#if settings.theme === 'dark'}
					<Moon size={20} />
				{:else if settings.theme === 'light-green'}
					<Sun size={20} />
				{:else if settings.theme === 'winter'}
					<Snowflake size={20} />
				{:else if settings.theme === 'orange-purple'}
					<Leaf size={20} />
				{/if}
			</button>

			<a
				class="header-btn lang-btn"
				href={otherLanguageHref}
				hreflang={otherLanguage}
				aria-label={t('header.toggleLocale')}
				data-testid="header-locale-link"
				onclick={() => settings.rememberLocale(otherLanguage)}
			>
				<span class="lang-text">{otherLanguage.toUpperCase()}</span>
			</a>

			<button
				type="button"
				class="header-btn"
				onclick={() => fullscreen.toggle()}
				aria-label={t(fullscreen.active ? 'header.exitFullscreen' : 'header.toggleFullscreen')}
				data-testid="header-fullscreen-btn"
			>
				{#if fullscreen.active}
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
		backdrop-filter: var(--blur-glass);
		padding: var(--space-sm) var(--space-md);
		display: flex;
		justify-content: center;
		z-index: 100;
		position: sticky;
		top: 0;
		flex-shrink: 0;
		transition: background-color var(--transition-normal);
		animation: blur-in 3s ease both;
	}

	.game-header__inner {
		width: 100%;
		max-width: 1200px;
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-md);
	}

	.game-header__left,
	.game-header__right {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.btn-wrap {
		display: grid;
		grid-template-areas: 'btn';
		align-items: center;
	}
	.btn-wrap > * {
		grid-area: btn;
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
		grid-template-areas: 'title';
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
		height: 36px;
		aspect-ratio: 1;
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
		width: 90%;
		height: 90%;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-90deg);
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
		.game-title {
			font-size: var(--font-size-sm);
		}
		.game-header {
			padding: var(--space-xs) var(--space-sm);
		}
		.game-header__inner {
			gap: var(--space-sm);
		}
	}
</style>
