<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { settings } from '$lib/services/settings.svelte';
	import { pickRandomRoute } from '$lib/services/randomGame';
	import { langPath, languageFromParam, type RouteRest } from '$lib/i18n/routing';
	import type { TranslationKey } from '$lib/i18n/translations/uk';

	/**
	 * П'ять ігор вікторини поодинці, плюс «Випадкова гра».
	 *
	 * «Знайди пару» сюди не входить навмисно: у неї власний розділ, бо її
	 * спільна партія влаштована інакше — гравці ходять по черзі, а не
	 * відповідають на спільне питання.
	 */
	const GAMES: { key: TranslationKey; route: RouteRest }[] = [
		{ key: 'menu.game.mythbusters', route: 'game-mythbusters' },
		{ key: 'menu.game.population', route: 'game-population' },
		{ key: 'menu.game.habitat', route: 'game-habitat' },
		{ key: 'menu.game.family', route: 'game-family' },
		{ key: 'menu.game.feeding', route: 'game-feeding' }
	];

	// Мова береться з адреси: перехід у гру має лишати її, а не скидати на
	// типову (I18N-v8 § 3.1).
	const lang = $derived(languageFromParam(page.params.lang));
	const games = $derived(GAMES.map((game) => ({ ...game, href: langPath(lang, game.route) })));

	/**
	 * «Випадкова гра» — не посилання, бо ціль відома лише в момент кліку.
	 *
	 * Підрежими «Де живем?» самі є адресами, тож вибирати їх окремо не треба:
	 * вони лежать у переліку нарівні з рештою.
	 */
	function playRandom() {
		goto(langPath(lang, pickRandomRoute()));
	}

	// «Назад» веде в розділ, а не на головну: інакше пропускається рівень, з
	// якого сюди й прийшли.
	onMount(() => settings.claimHeader('menu.quiz', () => goto(langPath(lang, 'quiz'))));
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
			<a
				href={game.href}
				class="menu-btn menu-btn--game anim-stagger-{i + 1}"
				data-testid="menu-{game.key.split('.').pop()}-link"
			>
				{@html formatFont(t(game.key))}
			</a>
		{/each}
	</nav>
</div>

<style>
	/*
	 * Відступу тут НЕМАЄ, хоч «Випадкова гра» й мусить читатися окремо від
	 * переліку: цю роботу вже робить `gap` самої сторінки — 48px проти 16px
	 * усередині списку, утричі більше. Власні `margin-bottom: 24px` додавалися
	 * до нього, і розрив ставав 72px — більший за будь-який інший на екрані.
	 */
	.menu-btn--random {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}
</style>
