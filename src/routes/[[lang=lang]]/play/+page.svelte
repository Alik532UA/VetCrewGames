<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';

	/**
	 * «ГРАТИ» — соло-ігри обох розділів (рішення автора 2026-09-26, 1-A).
	 *
	 * Доти сюди вели два розділи головного меню: «Вікторина» → «Грати» і «Знайди пару» →
	 * «Грати». Тепер спосіб гри вибирається першим, а гра — тут: «Вікторина» веде в перелік
	 * її пʼяти ігор із випадковою (`quiz/play`), «Знайди пару» — просто в гру, бо вона одна.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => settings.claimHeader('menu.play'));
</script>

<div class="menu-page">
	<nav class="menu-grid">
		<a
			href={langPath(lang, 'quiz/play')}
			class="menu-btn menu-btn--game anim-stagger-1"
			data-testid="play-quiz-link"
		>
			{@html formatFont(t('menu.quiz'))}
		</a>
		<a
			href={langPath(lang, 'game-memory')}
			class="menu-btn menu-btn--game anim-stagger-2"
			data-testid="play-pairs-link"
		>
			{@html formatFont(t('menu.game.memory'))}
		</a>
	</nav>
</div>
