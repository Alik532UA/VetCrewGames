<script lang="ts">
	import { goto } from '$app/navigation';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, type Language } from '$lib/i18n/routing';
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
		/*
		 * НАБОРУ ДЛЯ «ВИПАДКОВОЇ ГРИ» ТУТ БІЛЬШЕ НЕ ПЕРЕДАЮТЬ.
		 *
		 * Він існував, поки цей перелік малював ще й головне меню збірки для людей:
		 * там стояло шість ігор, і випадкова мусила давати будь-яку з шести. Тепер
		 * головна показує розділи (як і в роботі), а цей компонент лишився лише за
		 * «Грати» у вікторині — тобто набір завжди той самий, її пʼятірка, і
		 * тримати його параметром означало б тримати вибір, якого ніхто не робить.
		 *
		 * Правило «випадкова гра дає ГРУ, а не ще один вибір» лишилося на місці, у
		 * `services/randomGame`: підрежими «Де живем?» у переліку є, а сама сторінка
		 * вибору підрежиму — ні.
		 */
	}

	let { lang, games }: Props = $props();

	/** «Випадкова гра» — не посилання: ціль відома лише в момент кліку. */
	const playRandom = () => goto(langPath(lang, pickRandomRoute()));
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
