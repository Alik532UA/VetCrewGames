<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import BiomePicker from '$lib/components/reserve/BiomePicker.svelte';
	import type { ReserveBiome } from '$lib/reserve/species';

	/**
	 * Вибір ділянки — окремий екран з окремою адресою.
	 *
	 * Доти це був стан усередині гри, і два наслідки виходили однаково погані:
	 * «назад» із карти вело в головне меню замість вибору ділянки, а новий вибір
	 * стирав попередній заповідник. Тепер кожен біом живе за власною адресою й у
	 * власному збереженні — партії тривають паралельно.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => settings.claimHeader('reserve.title', () => goto(langPath(lang, ''))));

	const open = (biome: ReserveBiome) => goto(langPath(lang, `reserve/${biome}` as const));
</script>

<div class="menu-page">
	<BiomePicker onPick={open} />
</div>
