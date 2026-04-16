<script lang="ts">
	import { onMount } from 'svelte';
	import { t, td } from '$lib/i18n/index';
	import { getRandomAnimals, type Animal } from '$lib/data/population-game';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { ChevronsRight, ChevronRight } from 'lucide-svelte';

	onMount(() => {
		(async () => {
			const { polyfill } = await import('mobile-drag-drop');
			const { scrollBehaviourDragImageTranslateOverride } = await import('mobile-drag-drop/scroll-behaviour');
			
			polyfill({
				dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
			});
		})();

		// Workaround for mobile devices to allow dragging without scrolling the page
		const noop = () => {};
		window.addEventListener('touchmove', noop, { passive: false });
		
		return () => {
			window.removeEventListener('touchmove', noop);
		};
	});

	const SLOT_COUNT = 3;
	const TOTAL_ROUNDS = 10;

	// Game state
	let roundNumber = $state(1);
	let sourceAnimals = $state<Animal[]>([]);
	let slots = $state<(Animal | null)[]>(Array(SLOT_COUNT).fill(null));
	let checked = $state(false);
	let correctOrder = $state<Animal[]>([]);

	// Drag state
	let draggedAnimal = $state<Animal | null>(null);
	let dragSource = $state<{ type: 'source'; index: number } | { type: 'slot'; index: number } | null>(null);

	function initRound() {
		const picked = getRandomAnimals(SLOT_COUNT);
		sourceAnimals = picked;
		slots = Array(SLOT_COUNT).fill(null);
		checked = false;
		correctOrder = [...picked].sort((a, b) => a.population - b.population);
		draggedAnimal = null;
		dragSource = null;
	}

	initRound();

	// Derived: all slots filled
	let allSlotsFilled = $derived(slots.every((s) => s !== null));

	// Derived: result per slot (after check)
	let slotResults = $derived.by(() => {
		if (!checked) return [];
		return slots.map((animal, i) => {
			if (!animal) return false;
			return animal.id === correctOrder[i].id;
		});
	});

	// --- Drag & Drop / Click to Move logic ---
	function handleDragStart(animal: Animal, source: typeof dragSource) {
		draggedAnimal = animal;
		dragSource = source;
	}

	function handleDragOverSlot(e: DragEvent) {
		if (checked) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleSelect(animal: Animal, source: typeof dragSource) {
		if (checked) return;

		if (draggedAnimal?.id === animal.id) {
			// Deselect if clicking the same
			draggedAnimal = null;
			dragSource = null;
		} else {
			draggedAnimal = animal;
			dragSource = source;
		}
	}

	function handleDropOnSlot(targetIndex: number) {
		if (checked || !draggedAnimal || !dragSource) return;

		const animal = draggedAnimal;
		const source = dragSource;

		// If moving from one slot to another
		if (source.type === 'slot') {
			const oldSlotAnimal = slots[targetIndex];
			slots[source.index] = oldSlotAnimal;
			slots[targetIndex] = animal;
		} else {
			// From source to slot
			const displacedAnimal = slots[targetIndex];
			sourceAnimals = sourceAnimals.filter((a) => a.id !== animal.id);
			if (displacedAnimal) {
				sourceAnimals = [...sourceAnimals, displacedAnimal];
			}
			slots[targetIndex] = animal;
		}

		draggedAnimal = null;
		dragSource = null;
	}

	function handleSlotClick(i: number) {
		if (checked) return;

		if (draggedAnimal) {
			handleDropOnSlot(i);
		} else if (slots[i]) {
			handleSelect(slots[i]!, { type: 'slot', index: i });
		}
	}

	function handleDropOnSource(e?: DragEvent) {
		if (e) e.preventDefault();
		if (checked || !draggedAnimal || !dragSource) return;

		if (dragSource.type === 'slot') {
			const animal = draggedAnimal;
			slots[dragSource.index] = null;
			sourceAnimals = [...sourceAnimals, animal];
		}

		draggedAnimal = null;
		dragSource = null;
	}

	function handleSourcePanelClick(e: MouseEvent) {
		if (checked || !draggedAnimal || !dragSource) return;

		// Only if clicking the panel itself, not a card inside it
		if ((e.target as HTMLElement).classList.contains('source-panel') || 
			(e.target as HTMLElement).classList.contains('source-panel__cards')) {
			handleDropOnSource();
		}
	}

	function handleCheck() {
		if (!allSlotsFilled) return;
		checked = true;
	}

	function handleNextRound() {
		if (roundNumber < TOTAL_ROUNDS) {
			roundNumber++;
		} else {
			roundNumber = 1;
		}
		initRound();
	}

	function getArrowColor(i: number) {
		const startColor = '#E5E5E5';
		const middleColor = '#93C84A';
		const endColor = '#598F3A';
		if (i < 5) {
			// First half: startColor to middleColor
			return `color-mix(in srgb, ${startColor}, ${middleColor} ${(i / 4.5) * 100}%)`;
		} else {
			// Second half: middleColor to endColor
			return `color-mix(in srgb, ${middleColor}, ${endColor} ${((i - 4.5) / 4.5) * 100}%)`;
		}
	}
</script>

<!-- Header -->
<GameHeader 
	titleKey="population.title" 
	roundInfo="{t('population.round')} {roundNumber}/{TOTAL_ROUNDS}" 
/>

<div class="game-page">
	<!-- Sorting panel -->
	<div class="sorting-panel">
		<p class="sorting-panel__instruction">{t('population.description')}</p>

		<div class="slots-row">
			{#each slots as slotAnimal, i}
				<div
					class="slot"
					class:slot--filled={slotAnimal !== null}
					class:slot--correct={checked && slotResults[i] === true}
					class:slot--wrong={checked && slotResults[i] === false}
					class:slot--targetable={!checked && draggedAnimal !== null}
					role="button"
					tabindex="0"
					ondragover={handleDragOverSlot}
					ondrop={() => handleDropOnSlot(i)}
					onclick={() => handleSlotClick(i)}
					onkeydown={(e) => e.key === 'Enter' && handleSlotClick(i)}
				>
					{#if slotAnimal}
						<div
							class="slot-card"
							class:slot-card--correct={checked && slotResults[i] === true}
							class:slot-card--wrong={checked && slotResults[i] === false}
							class:card--selected={draggedAnimal?.id === slotAnimal.id}
							draggable={!checked ? 'true' : 'false'}
							ondragstart={() => handleDragStart(slotAnimal, { type: 'slot', index: i })}
							onclick={(e) => { e.stopPropagation(); handleSelect(slotAnimal, { type: 'slot', index: i }); }}
							onkeydown={(e) => e.key === 'Enter' && (e.stopPropagation(), handleSelect(slotAnimal, { type: 'slot', index: i }))}
							role="button"
							tabindex="0"
						>
							<img src={slotAnimal.image} alt={td(slotAnimal.nameKey)} class="slot-card__img" />
							<span class="slot-card__name">{td(slotAnimal.nameKey)}</span>
							{#if checked}
								<span class="slot-card__icon">{slotResults[i] ? '✅' : '❌'}</span>
							{/if}
						</div>
					{:else}
						<span class="slot__label">
							{#if i === 0}{t('population.least')}
							{:else if i === 1}{t('population.middle')}
							{:else}{t('population.most')}{/if}
						</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Action button -->
	<div class="action-zone">
		{#if !checked}
			<button class="btn-check" disabled={!allSlotsFilled} onclick={handleCheck}>
				{t('population.check')}
			</button>
		{:else}
			<button class="btn-check" onclick={handleNextRound}>
				{t('population.nextRound')}
			</button>
		{/if}
	</div>

	<!-- Source cards panel -->
	{#if !checked}
		<div
			class="source-panel"
			role="group"
			aria-label="source cards"
			tabindex="-1"
			ondragover={(e) => { e.preventDefault(); }}
			ondrop={handleDropOnSource}
			onclick={handleSourcePanelClick}
			onkeydown={(e) => e.key === 'Enter' && handleSourcePanelClick(e as any)}
		>
			<p class="source-panel__title">{t('population.yourAnimals')}</p>
			<div class="source-panel__cards">
				{#each sourceAnimals as animal, i}
					<div
						class="animal-card anim-stagger-{i + 1}"
						class:card--selected={draggedAnimal?.id === animal.id}
						draggable="true"
						ondragstart={() => handleDragStart(animal, { type: 'source', index: i })}
						onclick={(e) => { e.stopPropagation(); handleSelect(animal, { type: 'source', index: i }); }}
						onkeydown={(e) => e.key === 'Enter' && (e.stopPropagation(), handleSelect(animal, { type: 'source', index: i }))}
						role="button"
						tabindex="0"
					>
						<img src={animal.image} alt={td(animal.nameKey)} class="animal-card__img" />
						<span class="animal-card__name">{td(animal.nameKey)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Results info -->
	{#if checked}
		<div class="results-zone">
			{#each correctOrder as animal, i}
				<div class="result-card anim-stagger-{i + 1}">
					<div class="result-card__header">
						<span class="result-card__rank">#{i + 1}</span>
						<img src={animal.image} alt={td(animal.nameKey)} class="result-card__img" />
						<span class="result-card__name">{td(animal.nameKey)}</span>
					</div>
					<div class="result-card__info">
						<div class="result-card__population">
							<strong>{t('population.population')}:</strong> {animal.populationLabel}
						</div>
						<div class="result-card__fact">
							<strong>{t('population.fact')}:</strong> {td(animal.factKey)}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 95%;
		max-width: 600px;
		padding: 0 0 var(--space-2xl);
		gap: var(--space-lg);
		margin: 0 auto;
	}

	/* === Sorting panel === */
	.sorting-panel {
		width: 100%;
		background-color: #94c04d;
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-card);
		animation: card-enter 400ms ease both;
	}

	.sorting-panel__instruction {
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}

	/* === Slots === */
	.slots-row {
		display: flex;
		gap: var(--space-sm);
		justify-content: center;
	}

	.slot {
		width: 110px;
		height: 140px;
		border: 2px dashed var(--color-text);
		border-radius: var(--radius-md);
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: rgba(0, 0, 0, 0.05);
		box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.1);
		transition:
			border-color var(--transition-normal),
			background-color var(--transition-normal),
			box-shadow var(--transition-normal);
	}

	.slot:not(.slot--filled) {
		/* Adjusting dashed appearance by reducing opacity slightly to make it look less "busy" 
		   or applying a mask if supported. Since custom gap is hard with CSS border, 
		   we'll stick to 2px as requested but keep it clean. */
		border-color: color-mix(in srgb, var(--color-text), transparent 30%);
	}

	.slot--filled {
		border-style: solid;
		border-color: var(--color-text);
		background-color: rgba(19, 55, 27, 0.1);
	}

	.slot--correct {
		border-color: #fff;
		box-shadow: var(--shadow-glow-success);
	}

	.slot--wrong {
		border-color: var(--color-error);
		box-shadow: var(--shadow-glow-error);
		animation: shake 500ms ease;
	}

	.slot--targetable {
		border-color: var(--color-accent);
		background-color: rgba(255, 179, 39, 0.05);
	}

	.slot__label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		opacity: 0.5;
		text-transform: uppercase;
		pointer-events: none;
	}

	/* === Slot cards (inside sorting panel) === */
	.slot-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xs);
		cursor: grab;
		user-select: none;
		position: relative;
		transition: transform var(--transition-fast);
	}

	.slot-card:hover {
		transform: scale(1.05);
	}

	.slot-card:active {
		cursor: grabbing;
	}

	.slot-card__img {
		width: 60px;
		height: 80px;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-panel-dark);
		border: none;
		object-fit: cover;
	}

	.slot-card__name {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
	}

	.slot-card__icon {
		position: absolute;
		top: -6px;
		right: -6px;
		font-size: var(--font-size-sm);
	}

	/* === Direction bar === */
	.direction-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 var(--space-sm);
	}

	.direction-bar__label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
	}

	.direction-bar__arrows {
		display: flex;
		align-items: center;
		gap: -4px;
	}

	.direction-bar__arrows :global(svg) {
		margin-right: -8px;
	}

	/* === Check button === */
	.action-zone {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.btn-check {
		padding: var(--space-md) 4rem;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		border-radius: 2rem;
		background: linear-gradient(180deg, #FFD060 0%, #FFB327 40%, #E89E10 100%);
		color: var(--color-text-on-panel);
		box-shadow: 0 5px 0 #b87e0a, 0 8px 20px rgba(255, 179, 39, 0.35);
		border: none;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 2px;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-normal),
			background-color var(--transition-normal);
	}

	.btn-check:hover:not(:disabled) {
		background: linear-gradient(180deg, #FFD870 0%, #FFC04A 40%, #F0A820 100%);
		transform: translateY(-2px);
		box-shadow: 0 7px 0 #b87e0a, 0 10px 24px rgba(255, 179, 39, 0.45);
	}

	.btn-check:active:not(:disabled) {
		transform: translateY(3px);
		box-shadow: 0 1px 0 #b87e0a;
	}

	.btn-check:disabled {
		background: var(--color-disabled);
		color: var(--color-disabled-text);
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
		cursor: not-allowed;
	}

	/* === Source panel === */
	.source-panel {
		width: 100%;
		background-color: #60883f;
		border-radius: var(--radius-lg);
		padding: var(--space-lg) var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-card);
		animation: card-enter 400ms ease both;
		animation-delay: 100ms;
	}

	.source-panel__title {
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}

	.source-panel__cards {
		display: flex;
		gap: var(--space-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	/* === Animal cards (source) === */
	.animal-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background-color: #4a6a31;
		border-radius: var(--radius-md);
		box-shadow: 0 4px 0 #324a21, 0 8px 15px rgba(0, 0, 0, 0.2);
		cursor: grab;
		user-select: none;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		animation: card-enter 400ms ease both;
		min-width: 100px;
		border: none;
	}

	.animal-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 0 #324a21, 0 10px 20px rgba(0, 0, 0, 0.25);
	}

	.animal-card:active {
		cursor: grabbing;
		transform: translateY(2px);
		box-shadow: 0 1px 0 #324a21, 0 2px 5px rgba(0, 0, 0, 0.2);
	}

	.card--selected {
		box-shadow: 0 0 15px var(--color-accent) !important;
		border: 2px solid var(--color-accent) !important;
		transform: scale(1.05) translateY(-2px) !important;
	}

	.animal-card__img {
		width: 90px;
		height: 120px;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-panel-dark);
		border: none;
		object-fit: cover;
	}

	.animal-card__name {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
	}

	/* === Results zone === */
	.results-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}

	.result-card {
		background-color: var(--color-bg-surface);
		border-radius: var(--radius-md);
		padding: var(--space-lg);
		box-shadow: var(--shadow-card);
		animation: slide-up 400ms ease both;
	}

	.result-card__header {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		margin-bottom: var(--space-md);
	}

	.result-card__rank {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		color: var(--color-accent);
		min-width: 2rem;
	}

	.result-card__img {
		width: 48px;
		height: 64px;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-card);
		border: 1px solid var(--color-border);
		flex-shrink: 0;
		object-fit: cover;
	}

	.result-card__name {
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-bold);
	}

	.result-card__info {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		color: var(--color-text-muted);
		font-size: var(--font-size-sm);
		line-height: 1.5;
	}

	.result-card__population strong,
	.result-card__fact strong {
		color: var(--color-text);
	}

	/* === Responsive === */
	@media (max-width: 480px) {
		.slots-row {
			gap: var(--space-xs);
		}

		.slot {
			width: 95px;
			height: 125px;
		}

		.slot-card__img {
			width: 50px;
			height: 67px;
		}

		.animal-card {
			min-width: 85px;
		}

		.animal-card__img {
			width: 70px;
			height: 93px;
		}

		.source-panel__cards {
			gap: var(--space-sm);
		}

		.btn-check {
			padding: var(--space-md) 3rem;
		}
	}
</style>
