<script lang="ts">
	import { Maximize, Minimize } from 'lucide-svelte';
	import { settings } from '$lib/services/settings.svelte';
	import { fullscreen } from '$lib/services/fullscreen.svelte';
	import HeaderControls from './HeaderControls.svelte';
	import HeaderNav from './HeaderNav.svelte';
	// Без `formatPlain`: підписи нижче — `aria-label`, а не текст на екрані.
	// `formatPlain` міняє кириличну «і» на латинську «i», щоб літера була у
	// шрифті inglobal, — це правильно для того, що МАЛЮЄТЬСЯ, і неправильно
	// для того, що ЧИТАЄ скрінрідер: «Змiнити» з латинською i вимовляється як
	// покруч. Той самий висновок уже записаний у +layout.svelte для <title>.
	import { t, formatFont } from '$lib/i18n';
	import type { TranslationKey } from '$lib/i18n/translations/uk';
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

	// Мова сторінки поїхала в `HeaderNav` разом із посиланнями, які її вживають:
	// «назад» і «додому» ведуть у меню ТІЄЇ САМОЇ мови, і знати її має той, хто
	// будує адресу.
	onMount(() => fullscreen.watch());
</script>

<header class="game-header">
	<div class="game-header__inner">
		<HeaderNav {showBack} {activeTitleKey} />

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
			<HeaderControls />

			<button
				type="button"
				class="header-btn"
				onclick={() => fullscreen.toggle()}
				aria-label={t(fullscreen.active ? 'header.exitFullscreen' : 'header.toggleFullscreen')}
				aria-keyshortcuts={settings.shortcutsEnabled ? 'F' : undefined}
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

	.game-header__right {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
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
		/*
		 * `var(--color-text-on-panel)`, а не зашитий `#ffffff`.
		 *
		 * Тло цієї смуги — `--color-bg-panel-dark`, і воно СВІТЛЕ у двох темах із
		 * чотирьох: `#598f3a` у light-green, `#4d94ff` у winter. Білий текст на
		 * них не проходить 4.5:1, і саме це знайшов перший прогін axe 2026-08-23
		 * (`color-contrast`, serious, 3 вузли на головній).
		 *
		 * Чому цього не бачив наявний `src/contrast.test.ts`: він звіряє ПАРИ
		 * змінних тем між собою, а зашитий у компоненті колір змінною не є —
		 * тобто випадає з його поля зору за визначенням. Рівно та третина
		 * порушень, задля якої й потрібен axe поверх юніт-перевірки.
		 *
		 * `--color-text-on-panel` існує в усіх чотирьох темах і вже підібраний
		 * під контраст: у light-green це `#13371b` із коментарем про 4.25:1
		 * проти потрібних 4.5, тобто його вже одного разу правили саме за цим
		 * критерієм.
		 */
		color: var(--color-text-on-panel);
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

	/*
	 * `.header-btn` тут НЕМАЄ навмисно — вона в `global.css`.
	 *
	 * Ту саму кнопку малює й `LanguageMenu`, окремий компонент; зі `<style>`
	 * цього файлу вона до нього не доходила, і перемикач мови стояв у шапці
	 * голою кнопкою браузера.
	 */

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
