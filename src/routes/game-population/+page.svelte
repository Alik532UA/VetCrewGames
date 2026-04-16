<script lang="ts">
	import { onMount } from 'svelte';
	import { t, td } from '$lib/i18n/index';
	import { getRandomAnimals, type Animal } from '$lib/data/population-game';
	import GameHeader from '$lib/components/GameHeader.svelte';

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

	// Touch drag state
	let touchDragClone: HTMLElement | null = null;
	let touchStartInfo: { x: number; y: number; animal: Animal; source: NonNullable<typeof dragSource>; target: HTMLElement } | null = null;
	let touchDragStarted = false;
	const TOUCH_DRAG_THRESHOLD = 10; // px of movement before drag begins

	// --- Logging ---
	function logState(label: string) {
		console.log(
			`%c[STATE] ${label}`,
			'color: #4CAF50; font-weight: bold;',
			'\n  sourceAnimals:', sourceAnimals.map(a => a.id),
			'\n  slots:', slots.map(s => s?.id ?? null),
			'\n  draggedAnimal:', draggedAnimal?.id ?? null,
			'\n  dragSource:', dragSource,
			'\n  checked:', checked,
			'\n  roundNumber:', roundNumber
		);
	}

	function initRound() {
		const picked = getRandomAnimals(SLOT_COUNT);
		sourceAnimals = picked;
		slots = Array(SLOT_COUNT).fill(null);
		checked = false;
		correctOrder = [...picked].sort((a, b) => a.population - b.population);
		draggedAnimal = null;
		dragSource = null;
		console.log(
			`%c[INIT] Round ${roundNumber} initialized`,
			'color: #FF9800; font-weight: bold;',
			'\n  picked:', picked.map(a => ({ id: a.id, population: a.population }))
		);
		logState('After initRound');
	}

	// --- Core drop logic (shared between D&D, touch, click) ---
	function performDropOnSlot(targetIndex: number): boolean {
		console.log('[DROP] performDropOnSlot:', { targetIndex, draggedAnimal: draggedAnimal?.id, dragSource });
		if (checked || !draggedAnimal || !dragSource) {
			console.warn('[DROP] Ignored:', { checked, noDraggedAnimal: !draggedAnimal, noDragSource: !dragSource });
			return false;
		}

		const animal = draggedAnimal;
		const source = dragSource;

		if (source.type === 'slot') {
			const oldSlotAnimal = slots[targetIndex];
			console.log('[DROP] Slot→Slot swap:', { from: source.index, to: targetIndex, displaced: oldSlotAnimal?.id ?? null });
			slots[source.index] = oldSlotAnimal;
			slots[targetIndex] = animal;
		} else {
			const displacedAnimal = slots[targetIndex];
			console.log('[DROP] Source→Slot:', { animal: animal.id, targetIndex, displaced: displacedAnimal?.id ?? null });
			sourceAnimals = sourceAnimals.filter((a) => a.id !== animal.id);
			if (displacedAnimal) {
				sourceAnimals = [...sourceAnimals, displacedAnimal];
			}
			slots[targetIndex] = animal;
		}

		draggedAnimal = null;
		dragSource = null;
		logState('After performDropOnSlot');
		return true;
	}

	function performReturnToSource(): boolean {
		console.log('[DROP] performReturnToSource:', { draggedAnimal: draggedAnimal?.id, dragSource });
		if (checked || !draggedAnimal || !dragSource) return false;

		if (dragSource.type === 'slot') {
			const animal = draggedAnimal;
			slots[dragSource.index] = null;
			sourceAnimals = [...sourceAnimals, animal];
			console.log('[DROP] Returned to source:', animal.id);
		}

		draggedAnimal = null;
		dragSource = null;
		logState('After performReturnToSource');
		return true;
	}

	// Derived
	let allSlotsFilled = $derived(slots.every((s) => s !== null));

	let slotResults = $derived.by(() => {
		if (!checked) return [];
		return slots.map((animal, i) => {
			if (!animal) return false;
			return animal.id === correctOrder[i].id;
		});
	});

	// --- HTML5 Drag & Drop handlers (desktop) ---
	function handleDragStart(e: DragEvent, animal: Animal, source: typeof dragSource) {
		console.log('[D&D] dragstart:', { animal: animal.id, source });
		logState('Before dragstart');
		if (checked) return;

		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', animal.id.toString());
			e.dataTransfer.effectAllowed = 'move';
		}

		draggedAnimal = animal;
		dragSource = source;
		logState('After dragstart');
	}

	function handleDragOverSlot(e: DragEvent) {
		if (checked) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDropOnSlot_DnD(e: DragEvent, targetIndex: number) {
		e.preventDefault();
		performDropOnSlot(targetIndex);
	}

	function handleDropOnSource_DnD(e: DragEvent) {
		e.preventDefault();
		performReturnToSource();
	}

	function handleSelect(animal: Animal, source: typeof dragSource) {
		console.log('[SELECT]', { animal: animal.id, source });
		if (checked) return;

		if (draggedAnimal?.id === animal.id) {
			console.log('[SELECT] Deselected:', animal.id);
			draggedAnimal = null;
			dragSource = null;
		} else {
			draggedAnimal = animal;
			dragSource = source;
			console.log('[SELECT] Selected:', animal.id);
		}
		logState('After select');
	}

	function handleSlotClick(i: number) {
		console.log('[CLICK] Slot:', i);
		if (checked) return;

		if (draggedAnimal) {
			performDropOnSlot(i);
		} else if (slots[i]) {
			handleSelect(slots[i]!, { type: 'slot', index: i });
		}
	}

	function handleSourcePanelClick(e: MouseEvent) {
		if (checked || !draggedAnimal || !dragSource) return;

		if ((e.target as HTMLElement).classList.contains('source-panel') ||
			(e.target as HTMLElement).classList.contains('source-panel__cards')) {
			performReturnToSource();
		}
	}

	// --- Touch handlers (mobile) ---
	function handleTouchStart(e: TouchEvent) {
		const target = (e.target as HTMLElement).closest('[data-drag-animal]') as HTMLElement | null;
		
		if (!target) {
			// Not on a draggable card — check if tapping a slot while an animal is selected
			if (draggedAnimal && !checked) {
				const slotEl = (e.target as HTMLElement).closest('[data-slot-index]') as HTMLElement | null;
				if (slotEl) {
					e.preventDefault();
					const idx = parseInt(slotEl.dataset.slotIndex!, 10);
					console.log('%c[TOUCH] tap slot with selection', 'color: #E91E63; font-weight: bold;', { slot: idx, animal: draggedAnimal.id });
					performDropOnSlot(idx);
				}
			}
			return;
		}
		if (checked) return;

		const animalId = target.dataset.dragAnimal!;
		const sourceType = target.dataset.dragSourceType as 'source' | 'slot';
		const sourceIndex = parseInt(target.dataset.dragSourceIndex!, 10);

		const animal = sourceType === 'source'
			? sourceAnimals.find(a => a.id === animalId)
			: slots[sourceIndex];

		if (!animal) return;

		// Prevent scrolling from taking over AND prevent duplicate click event
		e.preventDefault();

		const touch = e.touches[0];
		touchStartInfo = {
			x: touch.clientX,
			y: touch.clientY,
			animal,
			source: { type: sourceType, index: sourceIndex },
			target
		};
		touchDragStarted = false;

		console.log('%c[TOUCH] touchstart (pending)', 'color: #E91E63; font-weight: bold;', { animal: animal.id, sourceType, sourceIndex });
	}

	function beginTouchDrag(touch: Touch) {
		if (!touchStartInfo) return;
		touchDragStarted = true;

		const { animal, source, target } = touchStartInfo;
		console.log('%c[TOUCH] drag started', 'color: #E91E63; font-weight: bold;', { animal: animal.id, source });

		draggedAnimal = animal;
		dragSource = source;

		const rect = target.getBoundingClientRect();
		const clone = target.cloneNode(true) as HTMLElement;
		clone.classList.add('touch-drag-clone');
		clone.style.position = 'fixed';
		clone.style.pointerEvents = 'none';
		clone.style.zIndex = '9999';
		clone.style.opacity = '0.85';
		clone.style.width = rect.width + 'px';
		clone.style.left = touch.clientX - rect.width / 2 + 'px';
		clone.style.top = touch.clientY - rect.height / 2 + 'px';
		clone.style.transform = 'scale(1.1)';
		document.body.appendChild(clone);
		touchDragClone = clone;

		logState('After beginTouchDrag');
	}

	function handleTouchMove(e: TouchEvent) {
		if (!touchStartInfo) return;
		const touch = e.touches[0];

		if (!touchDragStarted) {
			// Check if finger moved enough to start a drag
			const dx = touch.clientX - touchStartInfo.x;
			const dy = touch.clientY - touchStartInfo.y;
			if (Math.abs(dx) < TOUCH_DRAG_THRESHOLD && Math.abs(dy) < TOUCH_DRAG_THRESHOLD) return;

			e.preventDefault();
			beginTouchDrag(touch);
			return;
		}

		e.preventDefault();

		if (touchDragClone) {
			const w = touchDragClone.offsetWidth;
			const h = touchDragClone.offsetHeight;
			touchDragClone.style.left = touch.clientX - w / 2 + 'px';
			touchDragClone.style.top = touch.clientY - h / 2 + 'px';
		}

		// Highlight slot under finger
		const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
		const slotUnder = elUnder?.closest('[data-slot-index]') as HTMLElement | null;
		document.querySelectorAll('.slot--touch-over').forEach(el => el.classList.remove('slot--touch-over'));
		if (slotUnder) {
			slotUnder.classList.add('slot--touch-over');
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		// Remove highlight
		document.querySelectorAll('.slot--touch-over').forEach(el => el.classList.remove('slot--touch-over'));

		if (!touchStartInfo) {
			if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }
			return;
		}

		const info = touchStartInfo;
		touchStartInfo = null;

		if (!touchDragStarted) {
			// It was a tap, not a drag — treat as click/select
			console.log('%c[TOUCH] tap → select', 'color: #E91E63; font-weight: bold;', { animal: info.animal.id });

			// If there's already a selected animal and we tapped a slot, drop it there
			const touch = e.changedTouches[0];
			const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
			const slotEl = elUnder?.closest('[data-slot-index]') as HTMLElement | null;

			if (draggedAnimal && slotEl) {
				const idx = parseInt(slotEl.dataset.slotIndex!, 10);
				performDropOnSlot(idx);
			} else {
				// Toggle select on this animal
				handleSelect(info.animal, info.source);
			}
			return;
		}

		// It was a drag — handle drop
		console.log('%c[TOUCH] touchend (drag)', 'color: #E91E63; font-weight: bold;');
		logState('Before touchend');

		const touch = e.changedTouches[0];
		if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }

		if (!draggedAnimal || !dragSource) return;

		const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
		console.log('[TOUCH] Element under finger:', elUnder?.tagName, elUnder?.className?.toString().slice(0, 60));

		const slotEl = elUnder?.closest('[data-slot-index]') as HTMLElement | null;
		const sourcePanel = elUnder?.closest('.source-panel');

		if (slotEl) {
			const idx = parseInt(slotEl.dataset.slotIndex!, 10);
			console.log('[TOUCH] Drop on slot:', idx);
			performDropOnSlot(idx);
		} else if (sourcePanel) {
			console.log('[TOUCH] Return to source');
			performReturnToSource();
		} else {
			console.log('[TOUCH] Dropped outside — cancelling drag');
			draggedAnimal = null;
			dragSource = null;
		}

		logState('After touchend');
		touchDragStarted = false;
	}

	onMount(() => {
		console.log('%c[MOUNT] Component mounted', 'color: #2196F3; font-weight: bold;');
		initRound();
		logState('On mount');

		// Global touch handlers (must be on document with passive:false for reliable tracking)
		document.addEventListener('touchstart', handleTouchStart, { passive: false });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd);

		return () => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
			if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }
		};
	});

	function handleCheck() {
		if (!allSlotsFilled) return;
		checked = true;
		logState('After check');
	}

	function handleNextRound() {
		if (roundNumber < TOTAL_ROUNDS) {
			roundNumber++;
		} else {
			roundNumber = 1;
		}
		initRound();
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
			{#each slots as slotAnimal, i (slotAnimal?.id ?? `empty-${i}`)}
				<div
					class="slot"
					class:slot--filled={slotAnimal !== null}
					class:slot--correct={checked && slotResults[i] === true}
					class:slot--wrong={checked && slotResults[i] === false}
					class:slot--targetable={!checked && draggedAnimal !== null}
					data-slot-index={i}
					role="button"
					tabindex="0"
					ondragover={handleDragOverSlot}
					ondrop={(e) => handleDropOnSlot_DnD(e, i)}
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
							data-drag-animal={slotAnimal.id}
							data-drag-source-type="slot"
							data-drag-source-index={i}
							ondragstart={(e) => handleDragStart(e, slotAnimal, { type: 'slot', index: i })}
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
			ondrop={handleDropOnSource_DnD}
			onclick={handleSourcePanelClick}
			onkeydown={(e) => e.key === 'Enter' && handleSourcePanelClick(e as any)}
		>
			<p class="source-panel__title">{t('population.yourAnimals')}</p>
			<div class="source-panel__cards">
				{#each sourceAnimals as animal, i (animal.id)}
					<div
						class="animal-card anim-stagger-{i + 1}"
						class:card--selected={draggedAnimal?.id === animal.id}
						draggable="true"
						data-drag-animal={animal.id}
						data-drag-source-type="source"
						data-drag-source-index={i}
						ondragstart={(e) => handleDragStart(e, animal, { type: 'source', index: i })}
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
			{#each correctOrder as animal, i (animal.id)}
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
		padding: var(--space-md) var(--space-sm);
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
		width: 100%;
	}

	.slot {
		flex: 1;
		max-width: 110px;
		aspect-ratio: 11 / 14;
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
		min-width: 0;
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
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		opacity: 0.5;
		text-transform: uppercase;
		pointer-events: none;
		text-align: center;
		padding: 0 4px;
	}

	/* === Slot cards (inside sorting panel) === */
	.slot-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		height: 100%;
		justify-content: center;
		gap: var(--space-xs);
		cursor: grab;
		user-select: none;
		-webkit-user-drag: element;
		-webkit-touch-callout: none;
		position: relative;
		transition: transform var(--transition-fast);
		padding: 4px;
	}

	.slot-card:hover {
		transform: scale(1.05);
	}

	.slot-card:active {
		cursor: grabbing;
	}

	.slot-card__img {
		width: 100%;
		max-width: 60px;
		aspect-ratio: 3 / 4;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-panel-dark);
		border: none;
		object-fit: cover;
		pointer-events: none;
	}

	.slot-card__name {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
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
		padding: var(--space-md) var(--space-sm);
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
		flex-wrap: nowrap;
		width: 100%;
	}

	/* === Animal cards (source) === */
	.animal-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		max-width: 110px;
		min-width: 0;
		gap: var(--space-sm);
		padding: var(--space-sm);
		background-color: #4a6a31;
		border-radius: var(--radius-md);
		box-shadow: 0 4px 0 #324a21, 0 8px 15px rgba(0, 0, 0, 0.2);
		cursor: grab;
		user-select: none;
		-webkit-user-drag: element;
		-webkit-touch-callout: none;
		transition:
			transform var(--transition-fast),
			box-shadow var(--transition-fast);
		animation: card-enter 400ms ease both;
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
		width: 100%;
		max-width: 80px;
		aspect-ratio: 4/5;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-panel-dark);
		border: none;
		object-fit: cover;
		pointer-events: none;
	}

	.animal-card__name {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
	}

	/* === Results zone === */
	.results-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
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

	/* === Touch drag === */
	.slot--touch-over {
		border-color: var(--color-accent) !important;
		background-color: rgba(255, 179, 39, 0.15) !important;
		box-shadow: 0 0 10px var(--color-accent);
	}

	:global(.touch-drag-clone) {
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.35));
		border-radius: var(--radius-md);
	}

	/* === Responsive === */
	@media (max-width: 480px) {
		.slots-row {
			gap: var(--space-xs);
		}

		.slot {
		}

		.slot-card__img {
		}

		.animal-card {
			
		}

		.animal-card__img {
		}

		.source-panel__cards {
			gap: var(--space-sm);
		}

		.btn-check {
			padding: var(--space-md) 3rem;
		}
	}
</style>
