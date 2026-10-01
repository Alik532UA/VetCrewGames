<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { CircleAlert, Grid2X2Plus, MonitorDown, type Share, X } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { loadInstallText } from '$lib/i18n/install';
	import { settings } from '$lib/services/settings.svelte';
	import { canPromptInstall, isAppAlreadyInstalled, promptInstall } from '$lib/pwa/installPrompt';
	import { GUIDES, guideFor } from '$lib/pwa/installGuide';
	import { STEP_ICONS } from '$lib/pwa/installIcons';
	import { closeOnBackdrop } from '$lib/utils/closeOnBackdrop';
	import DynamicIcon from './ui/DynamicIcon.svelte';
	import FullscreenAlready from './FullscreenAlready.svelte';

	/**
	 * ВІКНО КНОПКИ «НА ВЕСЬ ЕКРАН» (прохання автора 2026-09-29).
	 *
	 * Два види. «Вибір» — там, де браузер уміє повний екран, а застосунок не встановлено:
	 * «На весь екран у цьому браузері» або «Встановити застосунок». «Кроки» — як встановити
	 * вручну; туди веде другий пункт, коли вікна браузера «Встановити?» немає, і туди ж
	 * одразу відкривається кнопка там, де повного екрана не дають (iPhone у браузері), — з
	 * поясненням чому.
	 *
	 * Вікно не лежить у шапці: його монтує `features/fullscreenOffer.ts` у `<body>` на
	 * натиск, бо шапка — у кореневому layout, а його бюджет вичерпано. Звідси й словник —
	 * лінивий (`i18n/install`), а в пропах — уже завантажений, щоб вікно не блимнуло ключами.
	 *
	 * `<dialog>` і `showModal()` — як вибір аватарки: верхній шар, `Escape`, неактивна
	 * сторінка. Власного `Escape` тут немає (`src/overlays.test.ts`).
	 */
	interface Props {
		/** `choice` — два пункти; `blocked` — повного екрана не дають, одразу кроки. */
		mode: 'choice' | 'blocked';
		/** Словник мови, якою відкрили вікно. */
		dict: Record<string, string>;
		/** Вікно закрилося — будь-як. */
		onclose: () => void;
		/**
		 * Увімкнути повний екран. Колбеком, а не імпортом сервісу: інакше сервіс шапки став би
		 * спільним із цим лінивим чанком, і збирач виніс би його з кореневого layout окремим
		 * файлом — заміряно, +0,6 КБ gzip при вичерпаному бюджеті.
		 */
		onfullscreen: () => void;
		/** Значок кнопки шапки (`Expand`) — теж пропом, і з тієї самої причини. */
		fullscreenIcon: typeof Share;
	}

	let { mode, dict, onclose, onfullscreen, fullscreenIcon }: Props = $props();

	let fresh = $state<Record<string, string> | null>(null);
	const label = $derived((key: string) => (fresh ?? dict)[key] ?? key);

	// Мову можуть перемкнути, поки вікно відкрите.
	$effect(() => {
		const wanted = settings.locale;
		void loadInstallText(wanted).then((next) => {
			if (settings.locale === wanted) fresh = next;
		});
	});

	/** Вибір — на початку; після «Встановити» без вікна браузера — або «вже встановлено», або кроки. */
	let view = $state<'choice' | 'steps' | 'already'>(
		untrack(() => (mode === 'choice' ? 'choice' : 'steps'))
	);
	const which = guideFor(navigator.userAgent, navigator.maxTouchPoints ?? 0);
	const guide = GUIDES[which];

	let dialog = $state<HTMLDialogElement>();
	let first = $state<HTMLButtonElement>();
	let heading = $state<HTMLElement>();

	onMount(() => {
		if (!dialog) return;
		if (typeof dialog.showModal === 'function') dialog.showModal();
		else dialog.setAttribute('open', '');
		// У виборі — на перший пункт (Enter і є «на весь екран»), у кроках — на заголовок.
		(view === 'choice' ? first : heading)?.focus();
	});

	const close = () => dialog?.close();

	/** У тому самому натиску: без дії людини браузер повного екрана не дасть. */
	function goFullscreen() {
		close();
		onfullscreen();
	}

	async function install() {
		if (canPromptInstall() && (await promptInstall()) !== 'unavailable') {
			close();
			return;
		}
		if (await isAppAlreadyInstalled()) {
			view = 'already';
			heading?.focus();
			return;
		}
		view = 'steps';
		heading?.focus();
	}
</script>

<dialog
	bind:this={dialog}
	class="offer"
	aria-labelledby="fullscreen-offer-title"
	{onclose}
	{@attach closeOnBackdrop}
	data-testid="fullscreen-offer-modal"
>
	<div class="offer__window fill" data-testid="fullscreen-offer-panel">
		<div class="offer__head">
			<h2 class="offer__title" id="fullscreen-offer-title" tabindex="-1" bind:this={heading}>
				{@html formatFont(
					label(view === 'choice' ? 'install.title.choice' : view === 'already' ? 'install.title.already' : guide.title)
				)}
			</h2>
			<button
				type="button"
				class="offer__close btn-secondary"
				onclick={close}
				aria-label={t('common.close')}
				data-testid="fullscreen-offer-close-btn"
			><X aria-hidden="true" /></button>
		</div>

		{#if view === 'choice'}
			<button
				type="button"
				class="offer__option"
				bind:this={first}
				onclick={goFullscreen}
				data-testid="fullscreen-offer-browser-btn"
			>
				<span class="offer__icon" aria-hidden="true"><DynamicIcon icon={fullscreenIcon} /></span>
				<span class="offer__label">{@html formatFont(label('install.browser'))}</span>
				<span class="offer__hint">{@html formatFont(label('install.browserHint'))}</span>
			</button>
			<button
				type="button"
				class="offer__option"
				onclick={install}
				data-testid="fullscreen-offer-install-btn"
			>
				<!-- Та сама кнопка, що в адресному рядку браузера: в Edge — сітка з плюсом. -->
				<span class="offer__icon" class:offer__icon--edge={which === 'edge'} aria-hidden="true">
					{#if which === 'edge'}<Grid2X2Plus />{:else}<MonitorDown />{/if}
				</span>
				<span class="offer__label">{@html formatFont(label('install.app'))}</span>
				<span class="offer__hint">{@html formatFont(label('install.appHint'))}</span>
			</button>
		{:else if view === 'already'}
			<FullscreenAlready
				{label}
				{fullscreenIcon}
				onfullscreen={goFullscreen}
				onclose={close}
			/>
		{:else}
			{#if mode === 'blocked'}
				<p class="offer__lead" data-testid="fullscreen-offer-lead-text">
					{@html formatFont(label('install.lead.blocked'))}
				</p>
			{/if}
			<p class="offer__note" data-testid="fullscreen-offer-note-text">
				{@html formatFont(label(guide.note))}
			</p>
			<ol class="offer__steps" data-testid="fullscreen-offer-steps-list">
				{#each guide.steps as step, index (step.text)}
					<li class="offer__step" data-testid="fullscreen-offer-step-item">
						<span class="offer__num" aria-hidden="true">{index + 1}</span>
						<span
							class="offer__icon"
							class:offer__icon--edge={step.icon === 'installEdge'}
							aria-hidden="true"><DynamicIcon icon={STEP_ICONS[step.icon]} /></span
						>
						<span>{@html formatFont(label(step.text))}</span>
					</li>
				{/each}
			</ol>
			{#if guide.warning}
				<p class="offer__warning" data-testid="fullscreen-offer-warning-text">
					<CircleAlert aria-hidden="true" />
					<span>{@html formatFont(label(guide.warning))}</span>
				</p>
			{/if}
			<button
				type="button"
				class="offer__done btn-accent"
				onclick={close}
				data-testid="fullscreen-offer-done-btn"
			>
				{@html formatFont(label('install.done'))}
			</button>
		{/if}
	</div>
</dialog>

<style>
	/*
	 * ВІКНО КНОПКИ «НА ВЕСЬ ЕКРАН» — як CountryPicker.svelte:
	 * на мобільному займає ~95% екрана, на десктопі обмежене 34 одиницями.
	 */
	.offer {
		--edge: clamp(8px, 2vmin, 24px);
		width: min(calc(100vw - 2 * var(--edge)), calc(var(--fill-u) * 34));
		max-width: none;
		height: min(calc(100dvh - 2 * var(--edge)), calc(var(--fill-u) * 44));
		max-height: calc(100dvh - 2 * var(--edge));
		padding: 0;
		border: none;
		background: transparent;
		color: inherit;
		overflow: visible;
	}

	.offer::backdrop {
		background: rgba(0, 0, 0, 0.55);
	}

	/* Та сама панель, що вікна хабу й вибір аватарки: пара, яку гейт контрасту вже бачив. */
	.offer__window {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: var(--space-md);
		width: 100%;
		height: 100%;
		max-height: 100%;
		padding: clamp(var(--space-md), 3vw, var(--space-lg));
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
		box-sizing: border-box;
		overflow-y: auto;
	}

	.offer__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.offer__title {
		margin: 0;
		font-size: var(--font-size-lg);
		color: var(--color-text-on-panel);
	}

	/* 44px — дно сенсорної цілі (ACCESSIBILITY-v8 § 8); далі росте з кеглем вікна. */
	.offer__close {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: max(44px, calc(var(--fill-u) * 2.75));
		aspect-ratio: 1;
		padding: 0;
		border-radius: var(--radius-sm);
	}

	/* Пункт вибору — плитка зі значком, назвою й поясненням: вибір читається до натиску. */
	.offer__option {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-xs) var(--space-md);
		align-items: center;
		min-height: 44px;
		padding: var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-card);
		color: var(--color-text);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	@media (hover: hover) {
		.offer__option:hover {
			border-color: var(--color-accent);
		}
	}

	.offer__option .offer__icon {
		grid-row: span 2;
	}

	.offer__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-accent);
	}

	/*
	 * Значок встановлення Edge — сітка з трьох квадратів і плюсом угорі праворуч (скарга
	 * автора 2026-09-29, знімок адресного рядка). `lucide` малює плюс унизу праворуч, тож
	 * значок повернуто на чверть оберту — так само, як у Slovko.
	 */
	.offer__icon--edge :global(svg) {
		transform: rotate(-90deg);
	}

	.offer__icon :global(svg),
	.offer__close :global(svg),
	.offer__warning :global(svg) {
		flex-shrink: 0;
		width: calc(var(--fill-u) * 1.5);
		height: calc(var(--fill-u) * 1.5);
	}

	.offer__label,
	.offer__lead {
		font-weight: var(--font-weight-bold);
	}

	.offer__hint {
		font-size: var(--font-size-sm);
	}

	.offer__lead,
	.offer__note {
		margin: 0;
		color: var(--color-text-on-panel);
	}

	.offer__steps {
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		flex: 1;
		gap: var(--space-sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.offer__step {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: var(--color-text);
	}

	.offer__num {
		flex-shrink: 0;
		width: 1.5em;
		font-weight: var(--font-weight-bold);
		text-align: center;
	}

	.offer__warning {
		display: flex;
		align-items: flex-start;
		gap: var(--space-sm);
		margin: 0;
		font-size: var(--font-size-sm);
		color: var(--color-text-on-panel);
	}

	.offer__done {
		min-height: 44px;
		border-radius: var(--radius-sm);
		font: inherit;
		font-weight: var(--font-weight-bold);
	}
</style>

