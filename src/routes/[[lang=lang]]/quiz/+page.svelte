<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import ModeMenu from '$lib/components/ModeMenu.svelte';

	/**
	 * Розділ «Вікторина»: п'ять міні-ігор, разом і поодинці.
	 *
	 * «Знайди пару» сюди не входить — у неї власний розділ і власна спільна гра,
	 * бо там гравці ходять по черзі, а не відповідають одночасно.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => settings.claimHeader('menu.quiz'));
</script>

<div class="menu-page">
	<ModeMenu
		playHref={langPath(lang, 'quiz/play')}
		onlineHref={langPath(lang, 'quiz/online')}
		testId="quiz"
	/>
</div>
