<script lang="ts">
	import { dev } from '$app/environment';
	import { t, formatFont } from '$lib/i18n';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { MENU_GAMES } from '$lib/config/menu-games';
	import { MENU_POOL } from '$lib/services/randomGame';
	import FlatGameMenu from '$lib/components/FlatGameMenu.svelte';

	/**
	 * Головне меню — РІЗНЕ в роботі й у збірці для людей.
	 *
	 * У робочій версії тут три розділи: заповідник, вікторина, «Знайди пару». Це
	 * та структура, до якої гра йде, — з режимами «грати з друзями» й «грати
	 * онлайн» усередині кожного.
	 *
	 * У збірці для людей — плоский перелік: випадкова гра й шість готових ігор.
	 * Причина не в естетиці: режимів, які обіцяють розділи, ще немає, і кожен
	 * зайвий рівень вкладеності відводить від того, що працює. Гість, який
	 * прийшов пограти, не мусить проходити через меню, за яким два вимкнені
	 * пункти й тост «скоро буде».
	 *
	 * Адреси при цьому НЕ змінюються: розділи лишаються за своїми URL і в
	 * продакшні — просто на них не ведуть кнопки. Прибирати маршрути означало б
	 * ламати посилання, які вже могли комусь піти.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

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
	{#if dev}
		<nav class="menu-grid">
			<a
				href={langPath(lang, 'reserve')}
				class="menu-btn menu-btn--game anim-stagger-1"
				data-testid="menu-reserve-link"
			>
				{@html formatFont(t('menu.reserve'))}
			</a>

			<a
				href={langPath(lang, 'quiz')}
				class="menu-btn menu-btn--game anim-stagger-2"
				data-testid="menu-quiz-link"
			>
				{@html formatFont(t('menu.quiz'))}
			</a>

			<a
				href={langPath(lang, 'pairs')}
				class="menu-btn menu-btn--game anim-stagger-3"
				data-testid="menu-pairs-link"
			>
				{@html formatFont(t('menu.game.memory'))}
			</a>

			<!--
				АКАУНТ — окремим пунктом, а не в шапці.

				У шапці живуть перемикачі (тема, мова, повний екран) — те, що міняє
				вигляд поточної сторінки. Акаунт натомість веде на ОКРЕМУ сторінку з
				чотирма блоками, і в рядку іконок він читався б як ще один перемикач.

				Клас `--link`, а не `--game`: це не гра, і виглядати вона мусить інакше
				від тих трьох, що вище.
			-->
			<a
				href={langPath(lang, 'account')}
				class="menu-btn menu-btn--link anim-stagger-4"
				data-testid="menu-account-link"
			>
				{@html formatFont(t('account.title'))}
			</a>
		</nav>
	{:else}
		<FlatGameMenu {lang} games={MENU_GAMES} pool={MENU_POOL} />
	{/if}

	<div class="menu-links">
		{#each links as link (link.key)}
			<a href={link.href} class="menu-btn menu-btn--link" target="_blank" rel="noopener noreferrer">
				{@html formatFont(t(link.key))}
			</a>
		{/each}
	</div>
</div>
