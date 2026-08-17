<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Quality } from '$lib/reserve/constants';
	import { effectiveQuality } from '$lib/reserve/simulation';
	import type { Animal, Enclosure, ReserveCommand, ReserveState } from '$lib/reserve/types';
	import BottomSheet from './BottomSheet.svelte';
	import AnimalsPanel from './AnimalsPanel.svelte';
	import EnclosurePanel from './EnclosurePanel.svelte';
	import StaffPanel from './StaffPanel.svelte';
	import TasksPanel from './TasksPanel.svelte';
	import type { Panel } from './ReserveBar.svelte';

	/**
	 * Яка панель відкрита — і нічого більше.
	 *
	 * Це єдина відповідальність: чотири розділи, один заголовок, одне закриття.
	 * Живучи на сторінці, вона тягла за собою п'ять імпортів і сорок рядків
	 * розгалуження — і сторінка перестала вміщатися в межу розміру не тому, що гра
	 * складна, а тому, що вибір панелі лежав не на своєму місці.
	 */
	interface Props {
		panel: Panel;
		state: ReserveState;
		day: number;
		residents: Animal[];
		released: Animal[];
		freeEnclosures: Enclosure[];
		/** `id` вольєрів, у яких хтось живе: їх не можна знести. */
		occupied: Set<number>;
		selectedId: number | null;
		onSelect: (id: number) => void;
		onCommand: (command: ReserveCommand) => void;
		/** Замовлення на вольєр прийнято — місце гравець тицяє вже на карті. */
		onPlace: (size: number, quality: Quality) => void;
		onClose: () => void;
	}

	let {
		panel,
		state,
		day,
		residents,
		released,
		freeEnclosures,
		occupied,
		selectedId,
		onSelect,
		onCommand,
		onPlace,
		onClose
	}: Props = $props();

	const TITLE: Record<
		Panel,
		'reserve.animals' | 'reserve.enclosures' | 'reserve.staff' | 'reserve.tasks'
	> = {
		animals: 'reserve.animals',
		enclosures: 'reserve.enclosures',
		staff: 'reserve.staff',
		tasks: 'reserve.tasks'
	};
</script>

<BottomSheet title={t(TITLE[panel])} {onClose}>
	{#if panel === 'animals'}
		<AnimalsPanel
			biome={state.biome}
			{residents}
			{released}
			{freeEnclosures}
			hasVet={state.staff.vet > 0}
			{selectedId}
			{onSelect}
			{onCommand}
		/>
	{:else if panel === 'enclosures'}
		<EnclosurePanel
			enclosures={state.enclosures}
			{occupied}
			effectiveQualityOf={effectiveQuality}
			{onPlace}
			{onCommand}
		/>
	{:else if panel === 'staff'}
		<StaffPanel staff={state.staff} subsidy={state.subsidy} {onCommand} />
	{:else}
		<TasksPanel {state} {day} {onCommand} />
	{/if}
</BottomSheet>
