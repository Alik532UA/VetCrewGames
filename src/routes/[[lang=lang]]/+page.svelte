<script lang="ts">
	import { t, formatFont } from '$lib/i18n';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { toast } from '$lib/controllers/toast.svelte';

	/**
	 * Головне меню: три розділи замість переліку ігор.
	 *
	 * Доти тут лежали всі шість ігор поспіль, і список ріс із кожною новою.
	 * Тепер меню називає ВИДИ занять, а не їхню кількість: заповідник —
	 * симулятор, вікторина — п'ять міні-ігор, «Знайди пару» — окрема гра зі
	 * своєю спільною партією.
	 *
	 * Адреси самих ігор не змінилися: змінився шлях кліками, а не URL.
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
	<nav class="menu-grid">
		<!--
			Заповідника ще немає, тож кнопка `aria-disabled`, а не `disabled`:
			друга ковтала б клік, і людина лишалася б без пояснення, чому нічого
			не сталося.
		-->
		<button
			type="button"
			class="menu-btn menu-btn--disabled anim-stagger-1"
			aria-disabled="true"
			onclick={() => toast.info('menu.comingSoon')}
			data-testid="menu-reserve-btn"
		>
			{@html formatFont(t('menu.reserve'))}
		</button>

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
	</nav>

	<div class="menu-links">
		{#each links as link (link.key)}
			<a href={link.href} class="menu-btn menu-btn--link" target="_blank" rel="noopener noreferrer">
				{@html formatFont(t(link.key))}
			</a>
		{/each}
	</div>
</div>
