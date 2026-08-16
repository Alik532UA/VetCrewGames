<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import HabitatModeSelect from '$lib/components/HabitatModeSelect.svelte';

	/**
	 * Вибір підрежиму — тепер окрема сторінка, а не стан усередині гри.
	 *
	 * Доти за однією адресою жили три різні екрани: це меню й дві гри. Надіслати
	 * другові конкретний режим було нічим, пошуковик бачив одну сторінку замість
	 * трьох, а «назад» доводилося підмінювати вручну.
	 *
	 * Побічний виграш більший за очікуваний: «Випадкова гра» більше не передає
	 * режим модульною змінною повз адресу — вона просто відкриває один із двох
	 * URL. Той обхідний шлях існував саме тому, що режим не мав де жити.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => {
		settings.setHeaderTitle('habitat.title');
		return () => settings.setHeaderTitle(null);
	});
</script>

<div class="game-page" use:fitToViewport>
	<HabitatModeSelect {lang} />
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: 560px;
		padding: 4dvh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2dvh, var(--space-md));
		margin: 0 auto;
		box-sizing: border-box;
	}
</style>
