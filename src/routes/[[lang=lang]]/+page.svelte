<script lang="ts">
	import { goto } from '$app/navigation';
	import { t, formatFont } from '$lib/i18n';
	import { page } from '$app/state';
	import { armHabitatMode, pickHabitatMode, pickRandomRoute } from '$lib/services/randomGame';
	import { langPath, languageFromParam, type RouteRest } from '$lib/i18n/routing';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * Пункт меню або веде на маршрут, або не веде нікуди — третього стану немає.
	 *
	 * Доти в трьох вимкнених пунктів був `href` на `game-habitat`,
	 * `game-family` і `game-feeding` — маршрутів, яких у проєкті не існує.
	 * Кнопка `disabled`, тож посилання не спрацьовувало ніколи, і помітити це
	 * було нічим. Побачив це типізований `resolve()` з першої ж збірки: він
	 * звіряє шлях зі справжнім переліком маршрутів (SEO-v8 § 1.5).
	 */
	type MenuGame = { key: TranslationKey } & ({ route: RouteRest } | { route: null });

	const GAMES: MenuGame[] = [
		{ key: 'menu.game.mythbusters', route: 'game-mythbusters' },
		{ key: 'menu.game.population', route: 'game-population' },
		{ key: 'menu.game.habitat', route: 'game-habitat' },
		{ key: 'menu.game.family', route: 'game-family' },
		{ key: 'menu.game.feeding', route: 'game-feeding' },
		{ key: 'menu.game.memory', route: 'game-memory' }
	];

	// Мова береться з адреси: перехід у гру має лишати її, а не скидати на
	// типову (I18N-v8 § 3.1).
	const lang = $derived(languageFromParam(page.params.lang));
	const games = $derived(
		GAMES.map((game) => ({
			...game,
			href: game.route === null ? null : langPath(lang, game.route)
		}))
	);

	/**
	 * «Випадкова гра» — не посилання, бо ціль відома лише в момент кліку.
	 *
	 * «Де живем?» тут відкривається одразу грою: питати про режим після
	 * «випадкової» означало б не виконати обіцянку кнопки, тож режим теж
	 * випадає — і намір передається окремо, не адресою (див. randomGame.ts).
	 */
	function playRandom() {
		const route = pickRandomRoute();
		if (route === 'game-habitat') armHabitatMode(pickHabitatMode());
		goto(langPath(lang, route));
	}

	const links = [
		{
			key: 'menu.link.vetcrew' as const,
			href: 'https://sites.google.com/view/vetcrew'
		},
		{
			key: 'menu.link.order' as const,
			href: 'https://alik532ua.github.io/DigitalWorkshop'
		}
	];
</script>

<div class="menu-page">
	<button
		type="button"
		class="menu-btn menu-btn--random anim-stagger-1"
		onclick={playRandom}
		data-testid="menu-random-btn"
	>
		{@html formatFont(t('menu.game.random'))}
	</button>

	<nav class="menu-grid">
		{#each games as game, i (game.key)}
			{#if game.href === null}
				<button
					type="button"
					class="menu-btn menu-btn--game menu-btn--disabled anim-stagger-{i + 1}"
					disabled
					data-testid="menu-{game.key.split('.').pop()}-btn"
				>
					{@html formatFont(t(game.key))}
				</button>
			{:else}
				<a
					href={game.href}
					class="menu-btn menu-btn--game anim-stagger-{i + 1}"
					data-testid="menu-{game.key.split('.').pop()}-link"
				>
					{@html formatFont(t(game.key))}
				</a>
			{/if}
		{/each}
	</nav>

	<div class="menu-links">
		{#each links as link (link.key)}
			<a href={link.href} class="menu-btn menu-btn--link" target="_blank" rel="noopener noreferrer">
				{@html formatFont(t(link.key))}
			</a>
		{/each}
	</div>
</div>

<style>
	/*
	 * Відступу тут НЕМАЄ, хоч «Випадкова гра» й мусить читатися окремо від
	 * переліку: цю роботу вже робить `gap` самої сторінки — 48px проти 16px
	 * усередині списку, утричі більше. Власні `margin-bottom: 24px` додавалися
	 * до нього, і розрив ставав 72px — більший за будь-який інший на екрані, аж
	 * до відчуття, що кнопка загубилася зверху сама по собі.
	 */
	.menu-btn--random {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}

	.menu-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		padding: var(--space-xl);
		gap: var(--space-2xl);
		width: 100%;
		max-width: 480px;
		box-sizing: border-box;
	}

	.menu-grid {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}

	.menu-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: var(--space-md) var(--space-xl);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-medium);
		border-radius: var(--radius-md);
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-normal),
			background-color var(--transition-normal);
		text-align: center;
		text-decoration: none;
		animation:
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.menu-btn--game {
		background-color: color-mix(in srgb, var(--color-bg-panel), transparent 25%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text-on-panel);
		box-shadow: var(--shadow-card);
	}

	@media (hover: hover) {
		.menu-btn--game:hover {
			background-color: color-mix(in srgb, var(--color-bg-card-hover), transparent 15%);
			box-shadow: var(--shadow-glow-primary);
			transform: translateY(-2px);
		}
		.menu-btn--link:hover {
			background-color: color-mix(in srgb, var(--color-bg-surface), transparent 20%);
			box-shadow: var(--shadow-glow-primary);
			transform: translateY(-2px);
		}
	}

	.menu-btn--game:active {
		background-color: var(--color-bg-card-hover);
		transform: scale(0.98);
		box-shadow: none;
	}

	.menu-btn--disabled {
		background-color: color-mix(in srgb, var(--color-disabled), transparent 50%);
		backdrop-filter: var(--blur-glass);
		color: var(--color-disabled-text);
		cursor: not-allowed;
		box-shadow: none;
	}

	.menu-btn--disabled:active {
		transform: none;
	}

	.menu-links {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		width: 100%;
	}

	.menu-btn--link {
		background-color: color-mix(in srgb, var(--color-primary), transparent 50%);
		backdrop-filter: var(--blur-glass);
		color: #ffffff;
		box-shadow: none;
	}

	.menu-btn--link:active {
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 30%);
		transform: scale(0.98);
	}
</style>
