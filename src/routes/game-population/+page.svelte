<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { t, td, formatFont, formatPlain } from '$lib/i18n/index';
	import { settings } from '$lib/settings.svelte';
	import { getRandomAnimals, type Animal } from '$lib/data/population-game';
	import GameHeader from '$lib/components/GameHeader.svelte';
	import { Check, X } from 'lucide-svelte';

	let isSwapping = $state(false);

	function createCrossfade() {
		const to_receive = new Map<any, HTMLElement>();
		const to_send = new Map<any, HTMLElement>();

		function doCrossfade(from_node: HTMLElement, node: HTMLElement, isSend: boolean) {
			const from = from_node.getBoundingClientRect();
			const to = node.getBoundingClientRect();
			const dx = from.left - to.left;
			const dy = from.top - to.top;
			const style = getComputedStyle(node);
			const transform = style.transform === 'none' ? '' : style.transform;
			const opacity = +style.opacity;

			let arcX = 0;
			let arcY = 0;
			if (isSwapping) {
				const horizontal = Math.abs(dx) >= Math.abs(dy);
				const sign = isSend ? 1 : -1;
				if (horizontal) {
					arcY = sign * -30;
				} else {
					arcX = sign * 30;
				}
			}

			return {
				duration: 300,
				easing: cubicOut,
				css: (t: number, u: number) => {
					const sine = Math.sin(Math.PI * t);
					return `
						opacity: ${t * opacity};
						transform-origin: top left;
						transform: ${transform} translate(${u * dx + arcX * sine}px, ${u * dy + arcY * sine}px);
					`;
				}
			};
		}

		function transition(items: Map<any, HTMLElement>, counterparts: Map<any, HTMLElement>, isSend: boolean) {
			return (node: HTMLElement, params: { key: any }) => {
				items.set(params.key, node);
				return () => {
					if (counterparts.has(params.key)) {
						const other = counterparts.get(params.key)!;
						counterparts.delete(params.key);
						return doCrossfade(other, node, isSend);
					}
					items.delete(params.key);
					const style = getComputedStyle(node);
					const tfm = style.transform === 'none' ? '' : style.transform;
					return {
						duration: 300,
						easing: cubicOut,
						css: (t: number) => `
							transform: ${tfm} scale(${t});
							opacity: ${t}
						`
					};
				};
			};
		}

		return [
			transition(to_send, to_receive, true),
			transition(to_receive, to_send, false)
		];
	}

	const [send, receive] = createCrossfade();

	const SLOT_COUNT = 3;
	const TOTAL_ROUNDS = 10;

	// Game state
	let roundNumber = $state(1);
	let sourceAnimals = $state<(Animal | null)[]>(Array(SLOT_COUNT).fill(null));
	let slots = $state<(Animal | null)[]>(Array(SLOT_COUNT).fill(null));
	let checked = $state(false);
	let correctOrder = $state<Animal[]>([]);

	function formatPopulationPlain(num: number): string {
		if (num >= 1_000_000_000_000) return formatPlain(`~${num / 1_000_000_000_000} ${t('unit.trillion')}`);
		if (num >= 1_000_000_000) return formatPlain(`~${num / 1_000_000_000} ${t('unit.billion')}`);
		if (num >= 1_000_000) return formatPlain(`~${num / 1_000_000} ${t('unit.million')}`);
		if (num >= 1_000) return formatPlain(`~${num / 1_000} ${t('unit.thousand')}`);
		return formatPlain(`~${num.toLocaleString()}`);
	}

	function formatPopulationHtml(num: number): string {
		if (num >= 1_000_000_000_000) return formatFont(`~${num / 1_000_000_000_000} ${t('unit.trillion')}`);
		if (num >= 1_000_000_000) return formatFont(`~${num / 1_000_000_000} ${t('unit.billion')}`);
		if (num >= 1_000_000) return formatFont(`~${num / 1_000_000} ${t('unit.million')}`);
		if (num >= 1_000) return formatFont(`~${num / 1_000} ${t('unit.thousand')}`);
		return formatFont(`~${num.toLocaleString()}`);
	}

	// Drag state
	let draggedAnimal = $state<Animal | null>(null);
	let dragSource = $state<{ type: 'source'; index: number } | { type: 'slot'; index: number } | null>(null);
	let isActuallyDragging = $state(false);

	// Touch drag state
	let touchDragClone: HTMLElement | null = null;
	let touchStartInfo: { 
		x: number; y: number; offsetX: number; offsetY: number;
		animal: Animal; source: NonNullable<typeof dragSource>; target: HTMLElement; w: number; h: number 
	} | null = null;
	let touchDragStarted = false;
	const TOUCH_DRAG_THRESHOLD = 8;

	function initRound() {
		const picked = getRandomAnimals(SLOT_COUNT);
		sourceAnimals = picked;
		slots = Array(SLOT_COUNT).fill(null);
		checked = false;
		correctOrder = [...picked].sort((a, b) => a.population - b.population);
		draggedAnimal = null; dragSource = null; isActuallyDragging = false;
	}

	// --- Core drop logic ---
	function performDropOnSlot(targetIndex: number): boolean {
		if (checked || !draggedAnimal || !dragSource) return false;
		const animal = draggedAnimal;
		const source = dragSource;
		isSwapping = slots[targetIndex] !== null;

		if (source.type === 'slot') {
			const oldSlotAnimal = slots[targetIndex];
			slots[source.index] = oldSlotAnimal;
			slots[targetIndex] = animal;
		} else {
			const displacedAnimal = slots[targetIndex];
			sourceAnimals[source.index] = displacedAnimal;
			slots[targetIndex] = animal;
		}
		draggedAnimal = null; dragSource = null; isActuallyDragging = false;
		return true;
	}

	function performDropOnSource(targetIndex: number): boolean {
		if (checked || !draggedAnimal || !dragSource) return false;
		const animal = draggedAnimal;
		const source = dragSource;
		isSwapping = sourceAnimals[targetIndex] !== null;

		if (source.type === 'source') {
			const oldSourceAnimal = sourceAnimals[targetIndex];
			sourceAnimals[source.index] = oldSourceAnimal;
			sourceAnimals[targetIndex] = animal;
		} else {
			const displacedAnimal = sourceAnimals[targetIndex];
			slots[source.index] = displacedAnimal;
			sourceAnimals[targetIndex] = animal;
		}
		draggedAnimal = null; dragSource = null; isActuallyDragging = false;
		return true;
	}

	let allSlotsFilled = $derived(slots.every((s) => s !== null));
	let slotResults = $derived.by(() => {
		if (!checked) return [];
		return slots.map((animal, i) => animal?.id === correctOrder[i].id);
	});

	// --- Handlers ---
	function handleDragStart(e: DragEvent, animal: Animal, source: NonNullable<typeof dragSource>) {
		if (checked) return;
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', animal.id.toString());
			e.dataTransfer.effectAllowed = 'move';
		}
		draggedAnimal = animal; dragSource = source;
		setTimeout(() => { isActuallyDragging = true; }, 0);
	}

	function handleDragEnd() {
		isActuallyDragging = false;
		if (!touchDragStarted) { draggedAnimal = null; dragSource = null; }
	}

	function handleDragOver(e: DragEvent) {
		if (checked) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function setDragElementDropPosition(animalId: number | string, clientX: number, clientY: number, offsetX?: number, offsetY?: number) {
		const el = document.querySelector(`[data-drag-animal="${animalId}"]`) as HTMLElement;
		if (!el) return;
		
		el.style.setProperty('transition', 'none', 'important');
		el.style.setProperty('transform', 'none', 'important');
		
		const rect = el.getBoundingClientRect();
		const ox = offsetX !== undefined ? offsetX : el.offsetWidth / 2;
		const oy = offsetY !== undefined ? offsetY : el.offsetHeight / 2;
		
		const dx = (clientX - ox) - rect.left;
		const dy = (clientY - oy) - rect.top;
		
		el.style.setProperty('transform', `translate3d(${dx}px, ${dy}px, 0)`, 'important');
		el.style.setProperty('z-index', '9999', 'important');
	}

	function handleDropOnSlot_DnD(e: DragEvent, targetIndex: number) { 
		e.preventDefault(); 
		if (checked || !draggedAnimal || !dragSource) return;
		if (dragSource.type === 'slot' && dragSource.index === targetIndex) {
			draggedAnimal = null; dragSource = null; isActuallyDragging = false;
			return;
		}
		setDragElementDropPosition(draggedAnimal.id, e.clientX, e.clientY);
		performDropOnSlot(targetIndex); 
	}

	function handleDropOnSource_DnD(e: DragEvent, targetIndex: number) { 
		e.preventDefault(); 
		if (checked || !draggedAnimal || !dragSource) return;
		if (dragSource.type === 'source' && dragSource.index === targetIndex) {
			draggedAnimal = null; dragSource = null; isActuallyDragging = false;
			return;
		}
		setDragElementDropPosition(draggedAnimal.id, e.clientX, e.clientY);
		performDropOnSource(targetIndex); 
	}

	function handleSelect(animal: Animal, source: NonNullable<typeof dragSource>) {
		if (checked) return;
		if (isActuallyDragging) return;

		// IF we already have a selection, and click another card - SWAP them
		if (draggedAnimal && draggedAnimal.id !== animal.id) {
			if (source.type === 'slot') performDropOnSlot(source.index);
			else performDropOnSource(source.index);
			return;
		}

		if (draggedAnimal?.id === animal.id) {
			draggedAnimal = null; dragSource = null;
		} else {
			draggedAnimal = animal; dragSource = source;
		}
	}

	function handleSlotClick(i: number) {
		if (checked) return;
		if (draggedAnimal && !isActuallyDragging) performDropOnSlot(i);
		else if (slots[i]) handleSelect(slots[i] as Animal, { type: 'slot', index: i });
	}

	function handleSourcePlaceholderClick(i: number) {
		if (checked) return;
		if (draggedAnimal && !isActuallyDragging) performDropOnSource(i);
		else if (sourceAnimals[i]) handleSelect(sourceAnimals[i] as Animal, { type: 'source', index: i });
	}

	// --- Touch handlers ---
	function handleTouchStart(e: TouchEvent) {
		const target = (e.target as HTMLElement).closest('[data-drag-animal]') as HTMLElement | null;
		if (!target) return;
		if (checked) return;

		const sourceType = target.dataset.dragSourceType as 'source' | 'slot';
		const sourceIndex = parseInt(target.dataset.dragSourceIndex!, 10);
		const animal = sourceType === 'source' ? sourceAnimals[sourceIndex] : slots[sourceIndex];
		if (!animal) return;
		
		const rect = target.getBoundingClientRect();
		const touch = e.touches[0];
		touchStartInfo = { 
			x: touch.clientX, y: touch.clientY, 
			offsetX: touch.clientX - rect.left,
			offsetY: touch.clientY - rect.top,
			animal, source: { type: sourceType, index: sourceIndex }, 
			target, w: rect.width, h: rect.height 
		};
		touchDragStarted = false;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!touchStartInfo) return;
		const touch = e.touches[0];
		if (!touchDragStarted) {
			const dx = touch.clientX - touchStartInfo.x;
			const dy = touch.clientY - touchStartInfo.y;
			if (Math.abs(dx) < TOUCH_DRAG_THRESHOLD && Math.abs(dy) < TOUCH_DRAG_THRESHOLD) return;
			
			touchDragStarted = true;
			isActuallyDragging = true;
			const { animal, source, target, w, h, offsetX, offsetY } = touchStartInfo;
			draggedAnimal = animal; dragSource = source;
			const clone = target.cloneNode(true) as HTMLElement;
			clone.classList.add('touch-drag-clone');
			clone.style.width = w + 'px'; clone.style.height = h + 'px';
			clone.style.setProperty('transform', `translate3d(${touch.clientX - offsetX}px, ${touch.clientY - offsetY}px, 0) scale(1.1)`, 'important');
			document.body.appendChild(clone);
			touchDragClone = clone;
		}

		if (touchDragStarted) {
			if (e.cancelable) e.preventDefault();
			if (touchDragClone && touchStartInfo) {
				const { offsetX, offsetY } = touchStartInfo;
				touchDragClone.style.setProperty('transform', `translate3d(${touch.clientX - offsetX}px, ${touch.clientY - offsetY}px, 0) scale(1.1)`, 'important');
			}
			const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
			document.querySelectorAll('.container--touch-over').forEach(el => el.classList.remove('container--touch-over'));
			const containerUnder = elUnder?.closest('[data-slot-index], [data-source-index]') as HTMLElement | null;
			if (containerUnder) containerUnder.classList.add('container--touch-over');
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		document.querySelectorAll('.container--touch-over').forEach(el => el.classList.remove('container--touch-over'));
		if (!touchStartInfo) return;
		
		const wasDragging = touchDragStarted;
		const startInfo = touchStartInfo;
		touchStartInfo = null;
		touchDragStarted = false;

		if (wasDragging) {
			if (e.cancelable) e.preventDefault();
			if (touchDragClone) { touchDragClone.remove(); touchDragClone = null; }
			
			const touch = e.changedTouches[0];
			const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
			const slotEl = elUnder?.closest('[data-slot-index]') as HTMLElement | null;
			const srcEl = elUnder?.closest('[data-source-index]') as HTMLElement | null;
			
			if (checked || !draggedAnimal || !dragSource) {
				draggedAnimal = null; dragSource = null; isActuallyDragging = false;
				return;
			}

			if (slotEl) {
				const targetIndex = parseInt(slotEl.dataset.slotIndex!, 10);
				if (dragSource.type === 'slot' && dragSource.index === targetIndex) {
					draggedAnimal = null; dragSource = null; isActuallyDragging = false;
					return;
				}
				setDragElementDropPosition(draggedAnimal.id, touch.clientX, touch.clientY, startInfo.offsetX, startInfo.offsetY);
				performDropOnSlot(targetIndex);
			} else if (srcEl) {
				const targetIndex = parseInt(srcEl.dataset.sourceIndex!, 10);
				if (dragSource.type === 'source' && dragSource.index === targetIndex) {
					draggedAnimal = null; dragSource = null; isActuallyDragging = false;
					return;
				}
				setDragElementDropPosition(draggedAnimal.id, touch.clientX, touch.clientY, startInfo.offsetX, startInfo.offsetY);
				performDropOnSource(targetIndex);
			} else { 
				draggedAnimal = null; dragSource = null; isActuallyDragging = false; 
			}
		}
	}

	onMount(() => {
		initRound();
		document.addEventListener('touchstart', handleTouchStart, { passive: false });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd, { passive: false });
		return () => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
			if (touchDragClone) touchDragClone.remove();
		};
	});

	function handleCheck() { 
		if (allSlotsFilled) {
			checked = true;
			// Award points: +1 for each correctly placed animal
			const correctCount = slotResults.filter(r => r).length;
			if (correctCount > 0) {
				settings.addScore(correctCount);
			}
		}
	}
	function handleNextRound() { roundNumber = roundNumber < TOTAL_ROUNDS ? roundNumber + 1 : 1; initRound(); }
</script>

<GameHeader titleKey="population.title" />

<div class="game-page">
	<div class="sorting-panel">
		<p class="sorting-panel__instruction">{@html formatFont(t('population.description'))}</p>
		<div class="slots-row">
			{#each slots as slotAnimal, i (i)}
				<div 
					class="game-container" 
					data-slot-index={i} 
					ondragover={handleDragOver} 
					ondrop={(e) => handleDropOnSlot_DnD(e, i)} 
					onclick={() => handleSlotClick(i)} 
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSlotClick(i)}
					role="button" 
					tabindex="0"
				>
					{#each slotAnimal ? [slotAnimal] : [] as animal (animal.id)}
						<div 
							class="game-card" 
							class:card--selected={draggedAnimal?.id === animal.id && !isActuallyDragging} 
							class:card--dragging-orig={isActuallyDragging && dragSource?.type === 'slot' && dragSource?.index === i} 
							draggable={!checked ? 'true' : 'false'} 
							data-drag-animal={animal.id} 
							data-drag-source-type="slot" 
							data-drag-source-index={i} 
							ondragstart={(e) => handleDragStart(e, animal, { type: 'slot', index: i })} 
							ondragend={handleDragEnd} 
							onclick={(e) => { e.stopPropagation(); handleSelect(animal, { type: 'slot', index: i }); }} 
							onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelect(animal, { type: 'slot', index: i }); } }}
							role="button" 
							tabindex="0"
							in:receive={{ key: animal.id }}
							out:send={{ key: animal.id }}
						>
							<div class="game-card__img-container">
								<img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="game-card__img" />
								{#if checked}<div class="game-card__pop-overlay">{@html formatPopulationHtml(animal.population)}</div>{/if}
							</div>
							<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
							{#if checked}<span class="game-card__icon" class:game-card__icon--correct={slotResults[i]} class:game-card__icon--wrong={!slotResults[i]}>{#if slotResults[i]}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>{/if}
						</div>
					{/each}
					{#if !slotAnimal}
						<span class="game-container__label">{#if i === 0}{@html formatFont(t('population.least'))}{:else if i === 1}{@html formatFont(t('population.middle'))}{:else}{@html formatFont(t('population.most'))}{/if}</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<div class="action-zone">
		{#if !checked}<button class="btn-check" disabled={!allSlotsFilled} onclick={handleCheck}>{@html formatFont(t('population.check'))}</button>
		{:else}<button class="btn-check" onclick={handleNextRound}>{@html formatFont(t('population.nextRound'))}</button>{/if}
	</div>

	{#if !checked}
		<div class="source-panel" role="group" aria-label="source cards" tabindex="-1">
			<p class="source-panel__title">{@html formatFont(t('population.yourAnimals'))}</p>
			<div class="source-panel__cards">
				{#each sourceAnimals as srcAnimal, i (i)}
					<div 
						class="game-container" 
						data-source-index={i} 
						ondragover={handleDragOver} 
						ondrop={(e) => handleDropOnSource_DnD(e, i)} 
						onclick={() => handleSourcePlaceholderClick(i)} 
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSourcePlaceholderClick(i)}
						role="button" 
						tabindex="0"
					>
						{#each srcAnimal ? [srcAnimal] : [] as animal (animal.id)}
							<div 
								class="game-card" 
								class:card--selected={draggedAnimal?.id === animal.id && !isActuallyDragging} 
								class:card--dragging-orig={isActuallyDragging && dragSource?.type === 'source' && dragSource?.index === i} 
								draggable="true" 
								data-drag-animal={animal.id} 
								data-drag-source-type="source" 
								data-drag-source-index={i} 
								ondragstart={(e) => handleDragStart(e, animal, { type: 'source', index: i })} 
								ondragend={handleDragEnd} 
								onclick={(e) => { e.stopPropagation(); handleSelect(animal, { type: 'source', index: i }); }} 
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelect(animal, { type: 'source', index: i }); } }}
								role="button" 
								tabindex="0"
								in:receive={{ key: animal.id }}
								out:send={{ key: animal.id }}
							>
								<div class="game-card__img-container">
									<img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="game-card__img" />
								</div>
								<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if checked}
		<div class="results-zone">
			{#each correctOrder as animal, i (animal.id)}
				<div class="result-card anim-stagger-{i + 1}">
					<div class="result-card__left"><img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="result-card__img-small" /></div>
					<div class="result-card__right">
						<div class="result-card__top"><span class="result-card__name-bold">{@html formatFont(td(animal.nameKey))}</span><span class="result-card__stat">{@html formatPopulationHtml(animal.population)}</span></div>
						<div class="result-card__divider"></div>
						<p class="result-card__fact-simple">{@html formatFont(td(animal.factKey))}</p>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.game-page { display: flex; flex-direction: column; align-items: center; width: 95%; max-width: 600px; padding: 0 0 var(--space-2xl); gap: var(--space-lg); margin: 0 auto; }
	@media (min-width: 769px) { .game-page { padding: var(--space-2xl) 0 var(--space-2xl); } }
	.sorting-panel { width: 100%; background-color: var(--color-bg-panel); border-radius: var(--radius-lg); padding: var(--space-md) var(--space-sm); display: flex; flex-direction: column; gap: var(--space-md); box-shadow: var(--shadow-card); animation: card-enter 400ms ease both; }
	.sorting-panel__instruction { color: var(--color-text-on-panel); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2); text-align: center; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
	.slots-row, .source-panel__cards { display: flex; gap: var(--space-sm); justify-content: center; width: 100%; }

	.game-container { 
		flex: 1; max-width: 110px; aspect-ratio: 11 / 17; 
		border: 2px dashed color-mix(in srgb, var(--color-text-on-panel), transparent 70%); border-radius: var(--radius-md); 
		display: grid; place-items: center; 
		background-color: rgba(0, 0, 0, 0.05); box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.1); 
		transition: all var(--transition-normal); min-width: 0; position: relative; 
	}
	.container--touch-over { border-color: var(--color-accent) !important; background-color: var(--color-accent-shadow) !important; }
	.game-container__label { grid-area: 1 / 1; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-text-on-panel); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); opacity: 0.5; text-transform: uppercase; text-align: center; padding: 0 4px; }
	
	.game-card { 
		grid-area: 1 / 1;
		display: flex; flex-direction: column; align-items: center; width: 100%; height: 100%; gap: var(--space-xs); padding: var(--space-sm); 
		background-color: var(--color-bg-card); border-radius: var(--radius-md); box-shadow: 0 4px 0 var(--color-bg-panel-dark), var(--shadow-card); 
		cursor: grab; user-select: none; position: relative; transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast); z-index: 2;
		touch-action: none;
	}
	.game-card:hover { transform: translateY(-2px); background-color: var(--color-bg-card-hover); box-shadow: 0 6px 0 var(--color-bg-panel-dark), var(--shadow-card-hover); }
	.game-card:active { cursor: grabbing; }
	.card--selected { box-shadow: 0 0 15px var(--color-accent) !important; border: 2px solid var(--color-accent) !important; transform: scale(1.05) translateY(-2px) !important; }
	.card--dragging-orig { opacity: 0 !important; pointer-events: none; }

	.game-card__img-container { position: relative; width: 100%; aspect-ratio: 3 / 4; min-height: 0; }
	.game-card__img { width: 100%; height: 100%; border-radius: var(--radius-sm); background-color: var(--color-bg-panel-dark); object-fit: cover; }
	.game-card__pop-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 2px 2px; background: linear-gradient(transparent, rgba(0, 0, 0, 0.85)); color: #ffffff; font-size: 8px; font-weight: var(--font-weight-bold); text-align: center; border-bottom-left-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); white-space: nowrap; overflow: hidden; }
	.game-card__name { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: #ffffff; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); text-align: center; width: 100%; line-height: 1.2; flex: 1; display: flex; align-items: center; justify-content: center; }
	.game-card__icon { position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10; }
	.game-card__icon--correct { background-color: var(--color-success); }
	.game-card__icon--wrong { background-color: var(--color-error); }

	.results-zone { display: flex; flex-direction: column; gap: var(--space-md); width: 100%; }
	.result-card { background-color: var(--color-bg-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; animation: slide-up 400ms ease both; display: flex; padding: 0; }
	.result-card__left { width: 70px; 
		/* background: var(--color-bg-panel-dark);  */
		display: flex; align-items: center; justify-content: center; 
		/* padding: 8px; */
	 }
	.result-card__img-small { width: 100%; aspect-ratio: 3 / 4; border-radius: 6px; object-fit: cover; }
	.result-card__right { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; }
	.result-card__top { display: flex; justify-content: space-between; align-items: baseline; }
	.result-card__name-bold { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
	.result-card__stat { font-size: 12px; font-weight: 700; color: var(--color-stat); }
	.result-card__divider { height: 2px; width: 30px; background: var(--color-accent); margin: 2px 0; border-radius: 2px; }
	.result-card__fact-simple { font-size: 12px; margin: 0; color: var(--color-text-muted); font-style: italic; }
	
	.btn-check { 
		padding: var(--space-md) 4rem; font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); border-radius: 2rem; 
		background: linear-gradient(180deg, var(--color-accent-hover) 0%, var(--color-accent) 40%, color-mix(in srgb, var(--color-accent), black 20%) 100%); 
		color: var(--color-text-on-panel); 
		box-shadow: 0 5px 0 color-mix(in srgb, var(--color-accent), black 40%), 0 8px 20px var(--color-accent-shadow); 
		border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; transition: all var(--transition-fast); 
	}
	.btn-check:hover:not(:disabled) { 
		transform: translateY(-2px); 
		box-shadow: 0 7px 0 color-mix(in srgb, var(--color-accent), black 40%), 0 10px 24px var(--color-accent-shadow); 
	}
	.btn-check:disabled { background: var(--color-disabled); color: var(--color-disabled-text); box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15); cursor: not-allowed; }
	.source-panel { width: 100%; background-color: var(--color-bg-panel-dark); border-radius: var(--radius-lg); padding: var(--space-md) var(--space-sm); display: flex; flex-direction: column; gap: var(--space-md); box-shadow: var(--shadow-card); animation: card-enter 400ms ease both; }
	.source-panel__title { color: #ffffff; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); text-align: center; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
	
	:global(.touch-drag-clone) { 
		position: fixed !important; pointer-events: none !important; z-index: 9999 !important; 
		transition: none !important; top: 0; left: 0;
		filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5)); border-radius: var(--radius-md); 
	}
	@media (max-width: 480px) { .slots-row, .source-panel__cards { gap: var(--space-xs); } .btn-check { padding: var(--space-md) 3rem; } }
</style>
