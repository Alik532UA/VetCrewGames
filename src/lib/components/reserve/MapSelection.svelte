<script lang="ts">
	import type { ReserveController } from '$lib/controllers/reserve.svelte';
	import type { Animal, ReserveCommand } from '$lib/reserve/types';
	import AnimalCard from './AnimalCard.svelte';
	import EnclosureCard from './EnclosureCard.svelte';

	/**
	 * Що вибрано на карті — тварина чи вольєр — і чия картка через це відкрита.
	 *
	 * Окремим файлом, бо це РОЗГАЛУЖЕННЯ, а не частина сторінки. Живучи на
	 * сторінці, воно тягло за собою два імпорти, пошук мешканця й чотири
	 * замикання — і сторінка перестала б уміщатися в межу розміру не тому, що гра
	 * складна, а тому, що вибір картки лежав не на своєму місці. Так само раніше
	 * поїхала звідти `ReserveSheet`.
	 */
	interface Props {
		game: ReserveController;
		/** Мешканці ЦІЄЇ ділянки: у вибраному вольєрі шукається саме тут. */
		residents: Animal[];
		onCommand: (command: ReserveCommand) => void;
	}

	let { game, residents, onCommand }: Props = $props();

	const resident = $derived.by(() => {
		const pen = game.selectedEnclosure;
		if (!pen) return null;
		return residents.find((animal) => animal.enclosureId === pen.id) ?? null;
	});
</script>

<!--
	Або одна, або інша: вибір один на двох. Два вікна над тим самим кутом карти
	означали б одне під іншим — саме той дефект, який тут і виправляли.
-->
{#if game.selected}
	<AnimalCard
		animal={game.selected}
		{onCommand}
		onEnclosure={(id) => game.selectEnclosure(id)}
		onClose={() => game.clearSelection()}
	/>
{:else if game.selectedEnclosure}
	<EnclosureCard
		enclosure={game.selectedEnclosure}
		{resident}
		{onCommand}
		onAnimal={(id) => game.selectAnimal(id)}
		onClose={() => game.clearSelection()}
	/>
{/if}
