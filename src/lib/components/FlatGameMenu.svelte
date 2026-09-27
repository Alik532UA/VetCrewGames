<script lang="ts">
	import { goto } from '$app/navigation';
	import { Carrot, ChartColumn, Dices, Dna, LayoutGrid, MapPin, Scale } from 'lucide-svelte';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, type Language } from '$lib/i18n/routing';
	import { pickRandomRoute } from '$lib/services/randomGame';
	import type { GameId, MenuGame } from '$lib/config/menu-games';
	import DynamicIcon from './ui/DynamicIcon.svelte';

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

	/*
	 * ЗНАЧОК КОЖНОЇ ГРИ — щоб рядок упізнавався без читання (прохання автора 2026-09-27:
	 * «частина кнопок великі, в яких текст займає всього 10%»). Мапа лежить тут, а не в
	 * `config/menu-games.ts`: той конфіг читають контролери всіх ігор і `net/play.ts`, і
	 * значки поїхали б у кожен їхній чанк. Повний `Record`, а не часткова мапа: нова гра
	 * без значка — помилка типів, а не порожнє місце в рядку.
	 */
	const ICONS: Record<GameId, typeof Scale> = {
		mythbusters: Scale,
		population: ChartColumn,
		habitat: MapPin,
		family: Dna,
		feeding: Carrot,
		memory: LayoutGrid
	};
</script>

<button
	type="button"
	class="menu-btn menu-btn--random menu-row anim-stagger-1"
	onclick={playRandom}
	data-testid="menu-random-btn"
>
	<Dices class="menu-row__icon" />
	<span>{@html formatFont(t('menu.game.random'))}</span>
</button>

<nav class="menu-list">
	{#each games as game, index (game.key)}
		<a
			href={langPath(lang, game.route)}
			class="menu-btn menu-btn--game menu-row anim-stagger-{index + 1}"
			data-testid="menu-{game.key.split('.').pop()}-link"
		>
			<DynamicIcon icon={ICONS[game.id]} class="menu-row__icon" />
			<span>{@html formatFont(t(game.key))}</span>
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
		/* Та сама ширина, що в переліку під нею (`.menu-list`): кнопка — його перший рядок. */
		width: min(100%, calc(var(--fill-u) * 32));
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		font-weight: var(--font-weight-bold);
	}
</style>
