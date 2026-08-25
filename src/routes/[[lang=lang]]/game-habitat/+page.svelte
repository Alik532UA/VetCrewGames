<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
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
		/*
		 * «Назад» веде в РОЗДІЛ, а не в головне меню. Після того, як ігри переїхали
		 * під «Вікторину» й «Знайди пару», типовий крок на головну змушував би
		 * спускатися двома рівнями заново.
		 */
		return settings.claimHeader('habitat.title', () => goto(langPath(lang, 'quiz/play')));
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
		max-width: var(--measure-habitat);
		padding: 4dvh 0 var(--space-lg);
		gap: clamp(var(--space-xs), 2dvh, var(--space-md));
		margin: 0 auto;
		box-sizing: border-box;
	}
</style>
