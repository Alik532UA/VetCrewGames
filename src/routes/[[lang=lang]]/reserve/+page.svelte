<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { dropReserve } from '$lib/services/reserveSave';
	import BiomePicker from '$lib/components/reserve/BiomePicker.svelte';
	import { RESERVE_BIOMES, type ReserveBiome } from '$lib/reserve/species';

	/**
	 * Вибір локації — окремий екран з окремою адресою.
	 *
	 * Доти це був стан усередині гри, і два наслідки виходили однаково погані:
	 * «назад» із карти вело в головне меню замість вибору локації, а новий вибір
	 * стирав попередній заповідник. Тепер кожна локація живе за власною адресою й
	 * у власному збереженні — партії тривають паралельно.
	 *
	 * «Почати заново» теж переїхало сюди, і не заради місця на смузі кнопок:
	 * усередині партії воно означало «стерти цю», а тут — усі. Сторінка, з якої
	 * видно всі чотири, і є єдине місце, де таке рішення взагалі має сенс.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	onMount(() => settings.claimHeader('reserve.title', () => goto(langPath(lang, ''))));

	const open = (biome: ReserveBiome) => goto(langPath(lang, `reserve/${biome}` as const));

	/**
	 * Стирання йде в ДВА кліки, і другий підписаний інакше.
	 *
	 * Одним кліком тут зникають чотири партії, кожна з яких могла тривати години.
	 * Вікно підтвердження було б важчим за саму дію, а кнопка, яка змінює свій
	 * підпис на питання, ставить те саме питання й нічого не перекриває.
	 */
	let confirming = $state(false);

	function wipeAll() {
		if (!confirming) {
			confirming = true;
			return;
		}
		for (const biome of RESERVE_BIOMES) dropReserve(biome);
		confirming = false;
		toast.success('reserve.restartAllDone');
	}
</script>

<div class="menu-page">
	<BiomePicker onPick={open} />

	<button
		type="button"
		class="wipe"
		class:wipe--armed={confirming}
		onclick={wipeAll}
		onblur={() => (confirming = false)}
		data-testid="reserve-startover-btn"
	>
		{@html formatFont(t(confirming ? 'reserve.restartAllConfirm' : 'reserve.restartAll'))}
	</button>
</div>

<style>
	.wipe {
		align-self: center;
		min-height: 44px;
		padding: 0 var(--space-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg-panel);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	/* Занесена рука виглядає інакше: колір попереджає до того, як текст прочитано. */
	.wipe--armed {
		border-color: var(--color-error);
		color: var(--color-error);
	}
</style>
