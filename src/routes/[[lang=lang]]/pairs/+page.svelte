<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import ModeMenu from '$lib/components/ModeMenu.svelte';

	/**
	 * Розділ «Знайди пару». Гра лишається за своєю давньою адресою
	 * `/game-memory/` — цей екран лише додає над нею вибір режиму.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => settings.claimHeader('memory.title'));
</script>

<div class="menu-page">
	<ModeMenu
		playHref={langPath(lang, 'game-memory')}
		onlineHref={langPath(lang, 'pairs/online')}
		testId="pairs"
	/>
</div>
