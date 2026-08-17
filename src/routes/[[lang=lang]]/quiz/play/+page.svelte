<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { settings } from '$lib/services/settings.svelte';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { QUIZ_GAMES } from '$lib/config/menu-games';
	import FlatGameMenu from '$lib/components/FlatGameMenu.svelte';

	/**
	 * П'ять ігор вікторини поодинці, плюс «Випадкова гра».
	 *
	 * «Знайди пару» сюди не входить навмисно: у неї власний розділ, бо її спільна
	 * партія влаштована інакше — гравці ходять по черзі, а не відповідають на
	 * спільне питання.
	 *
	 * Сам перелік і кнопка випадкової гри — у `FlatGameMenu`: те саме показує
	 * головне меню у збірці для людей, і дві копії розійшлися б на першій правці.
	 */
	// Мова береться з адреси: перехід у гру має лишати її, а не скидати на
	// типову (I18N-v8 § 3.1).
	const lang = $derived(languageFromParam(page.params.lang));

	// «Назад» веде в розділ, а не на головну: інакше пропускається рівень, з
	// якого сюди й прийшли.
	onMount(() => settings.claimHeader('menu.quiz', () => goto(langPath(lang, 'quiz'))));
</script>

<div class="menu-page">
	<FlatGameMenu {lang} games={QUIZ_GAMES} />
</div>
