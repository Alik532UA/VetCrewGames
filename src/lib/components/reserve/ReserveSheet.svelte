<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Quality } from '$lib/reserve/constants';
	import { effectiveQuality } from '$lib/reserve/simulation';
	import type { Animal, Enclosure, ReserveCommand, ReserveState } from '$lib/reserve/types';
	import type { ReserveBiome } from '$lib/reserve/species';
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
		/** Ділянка, на якій стоїть гравець: панелі керують нею, а не фондом. */
		at: ReserveBiome;
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
		/** Перейти від прийому тварини до будівництва потрібного вольєра. */
		onBuildFor: (size: number) => void;
		/** Розмір, з яким відкрилася панель вольєрів; `undefined` — типовий. */
		buildSize?: number;
		onClose: () => void;
		/** Центр кнопки, з якої відкрили: панель спливає саме над нею. */
		anchorX: number | null;
	}

	let {
		panel,
		at,
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
		onBuildFor,
		buildSize,
		onClose,
		anchorX
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

<BottomSheet title={t(TITLE[panel])} id={panel} {anchorX} {onClose}>
	{#if panel === 'animals'}
		<AnimalsPanel
			biome={at}
			{residents}
			{released}
			{freeEnclosures}
			hasVet={state.sites[at].staff.vet > 0}
			feed={state.feed}
			{selectedId}
			{onSelect}
			{onCommand}
			{onBuildFor}
		/>
	{:else if panel === 'enclosures'}
		<EnclosurePanel
			enclosures={state.sites[at].enclosures}
			{occupied}
			effectiveQualityOf={effectiveQuality}
			initialSize={buildSize}
			budget={state.budget}
			{onPlace}
			{onCommand}
		/>
	{:else if panel === 'staff'}
		<StaffPanel staff={state.sites[at].staff} subsidy={state.subsidy} {onCommand} />
	{:else}
		<TasksPanel {state} {day} {onCommand} />
	{/if}
</BottomSheet>
