<script lang="ts">
	import { goto } from '$app/navigation';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, type Language, type RouteRest } from '$lib/i18n/routing';
	import { pickRandomRoute } from '$lib/services/randomGame';
	import type { MenuGame } from '$lib/config/menu-games';

	/**
	 * Плоский перелік ігор: «Випадкова гра» і всі решта поспіль.
	 *
	 * Один компонент на два місця — головне меню у збірці для людей і сторінку
	 * «Грати» всередині вікторини. Різниця між ними лише в наборі ігор, тож
	 * набір приходить пропсом, а розмітка й кнопка випадкової гри спільні: дві
	 * копії цих десяти рядків розійшлися б на першій же правці.
	 */
	interface Props {
		lang: Language;
		games: readonly MenuGame[];
		/**
		 * Звідки вибирати «Випадкову гру».
		 *
		 * Окремо від переліку кнопок: у меню кнопка веде до «Де живем?», а
		 * випадкова гра мусить одразу давати підрежим — континенти або природні
		 * зони, — бо обіцяла ГРУ, а не ще один вибір.
		 */
		pool?: readonly Exclude<RouteRest, ''>[];
	}

	let { lang, games, pool }: Props = $props();

	/** «Випадкова гра» — не посилання: ціль відома лише в момент кліку. */
	const playRandom = () => goto(langPath(lang, pickRandomRoute(Math.random, pool)));
</script>

<button
	type="button"
	class="menu-btn menu-btn--random anim-stagger-1"
	onclick={playRandom}
	data-testid="menu-random-btn"
>
	{@html formatFont(t('menu.game.random'))}
</button>

<nav class="menu-grid">
	{#each games as game, index (game.key)}
		<a
			href={langPath(lang, game.route)}
			class="menu-btn menu-btn--game anim-stagger-{index + 1}"
			data-testid="menu-{game.key.split('.').pop()}-link"
		>
			{@html formatFont(t(game.key))}
		</a>
	{/each}
</nav>

<style>
	/*
	 * Відступу тут НЕМАЄ, хоч «Випадкова гра» й мусить читатися окремо від
	 * переліку: цю роботу вже робить `gap` самої сторінки — 48px проти 16px
	 * усередині списку, утричі більше. Власні `margin-bottom: 24px` додавалися до
	 * нього, і розрив ставав 72px — більший за будь-який інший на екрані.
	 */
	.menu-btn--random {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}
</style>
