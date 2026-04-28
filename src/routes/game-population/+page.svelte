<script lang="ts">
	import { onMount } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { fade, slide, fly } from 'svelte/transition';
	import { t, td, formatFont, formatPlain } from '$lib/i18n/index';
	import { settings } from '$lib/services/settings.svelte';
	import { getRandomAnimals, type Animal } from '$lib/config/population-game';
	import { Check, X, RotateCcw, Home } from 'lucide-svelte';
	import RoundIndicator, { type RoundStatus } from '$lib/components/RoundIndicator.svelte';
	import { base } from '$app/paths';

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

		function transition(items: Map<string, HTMLElement>, counterparts: Map<string, HTMLElement>, isSend: boolean) {
			return (node: HTMLElement, params: { key: string }) => {
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
	let roundResults = $state<RoundStatus[]>([]);
	let sourceAnimals = $state<(Animal | null)[]>(Array(SLOT_COUNT).fill(null));
	let initialSourceAnimals = $state<(Animal | null)[]>([]);
	let slots = $state<(Animal | null)[]>(Array(SLOT_COUNT).fill(null));
	let checked = $state(false);
	let correctOrder = $state<Animal[]>([]);

	let sessionScore = $state(0);
	let gameOver = $state(false);

	function formatPopulationPlain(num: number): string {
		const locale = settings.locale;
		if (num >= 1_000_000_000_000) return formatPlain(`~${num / 1_000_000_000_000} ${t('unit.trillion')}`);
		if (num >= 1_000_000_000) return formatPlain(`~${num / 1_000_000_000} ${t('unit.billion')}`);
		if (num >= 1_000_000) return formatPlain(`~${num / 1_000_000} ${t('unit.million')}`);
		if (num >= 1_000) return formatPlain(`~${num / 1_000} ${t('unit.thousand')}`);
		return formatPlain(`~${num.toLocaleString(locale)}`);
	}

	function formatPopulationHtml(num: number): string {
		const locale = settings.locale;
		if (num >= 1_000_000_000_000) return formatFont(`~${num / 1_000_000_000_000} ${t('unit.trillion')}`);
		if (num >= 1_000_000_000) return formatFont(`~${num / 1_000_000_000} ${t('unit.billion')}`);
		if (num >= 1_000_000) return formatFont(`~${num / 1_000_000} ${t('unit.million')}`);
		if (num >= 1_000) return formatFont(`~${num / 1_000} ${t('unit.thousand')}`);
		return formatFont(`~${num.toLocaleString(locale)}`);
	}

	// Drag state
	let draggedAnimal = $state<Animal | null>(null);
	let dragSource = $state<{ type: 'source'; index: number } | { type: 'slot'; index: number } | null>(null);
	let isActuallyDragging = $state(false);
	let dragOverId = $state<string | null>(null);
	let hoverSlotIndex = $state<number | null>(null);
	let hoverSourceIndex = $state<number | null>(null);

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
		initialSourceAnimals = [...picked];
		slots = Array(SLOT_COUNT).fill(null);
		checked = false;
		correctOrder = [...picked].sort((a, b) => a.population - b.population);
		draggedAnimal = null; dragSource = null; isActuallyDragging = false;
		hoverSlotIndex = null; hoverSourceIndex = null;
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
	let availableAnimals = $derived(initialSourceAnimals.filter((a): a is Animal => a !== null));

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

	function handleDragOver(e: DragEvent, id: string) {
		if (checked) return;
		e.preventDefault();
		dragOverId = id;
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDragLeave(e: DragEvent, id: string) {
		if (dragOverId === id) dragOverId = null;
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
		dragOverId = null;
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
		dragOverId = null;
		if (checked || !draggedAnimal || !dragSource) return;
		if (dragSource.type === 'source' && dragSource.index === targetIndex) {
			draggedAnimal = null; dragSource = null; isActuallyDragging = false;
			return;
		}
		setDragElementDropPosition(draggedAnimal.id, e.clientX, e.clientY);
		performDropOnSource(targetIndex); 
	}

	function handleDoubleClick(animal: Animal, source: NonNullable<typeof dragSource>) {
		if (checked) return;
		if (isActuallyDragging) return;

		if (draggedAnimal?.id === animal.id) {
			draggedAnimal = null; dragSource = null;
		}

		if (source.type === 'source') {
			const emptySlotIndex = slots.indexOf(null);
			if (emptySlotIndex !== -1) {
				isSwapping = false;
				slots[emptySlotIndex] = animal;
				sourceAnimals[source.index] = null;
			}
		} else {
			const origIndex = initialSourceAnimals.findIndex(a => a?.id === animal.id);
			if (origIndex !== -1 && sourceAnimals[origIndex] === null) {
				isSwapping = false;
				sourceAnimals[origIndex] = animal;
				slots[source.index] = null;
			} else {
				const emptySourceIndex = sourceAnimals.indexOf(null);
				if (emptySourceIndex !== -1) {
					isSwapping = false;
					sourceAnimals[emptySourceIndex] = animal;
					slots[source.index] = null;
				}
			}
		}
	}

	let lastClickTime = 0;
	let lastClickedAnimalId: string | number | null = null;

	function handleCardClick(e: Event, animal: Animal, source: NonNullable<typeof dragSource>) {
		e.stopPropagation();
		if (checked) return;
		if (isActuallyDragging) return;

		const currentTime = Date.now();
		const timeDiff = currentTime - lastClickTime;

		if (timeDiff < 400 && lastClickedAnimalId === animal.id) {
			lastClickTime = 0;
			lastClickedAnimalId = null;
			handleDoubleClick(animal, source);
		} else {
			lastClickTime = currentTime;
			lastClickedAnimalId = animal.id;
			handleSelect(animal, source);
		}
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

	function handleCheck() { 
		if (allSlotsFilled) {
			checked = true;
			const correctCount = slotResults.filter(r => r).length;
			
			// Визначаємо статус раунду для індикатора
			let status: RoundStatus = 'incorrect';
			if (correctCount === SLOT_COUNT) status = 'correct';
			else if (correctCount > 0) status = 'partial';
			
			roundResults.push(status);

			if (correctCount > 0) {
				sessionScore += correctCount;
				settings.addScore(correctCount);
			}
		}
	}

	function resetGame() {
		roundNumber = 1;
		roundResults = [];
		sessionScore = 0;
		gameOver = false;
		initRound();
	}

	function handleNextRound() { 
		if (roundNumber < TOTAL_ROUNDS) {
			roundNumber++; 
			initRound(); 
		} else {
			gameOver = true;
		}
	}

	function moveAnimalToIndex(animal: Animal, targetType: 'slot' | 'source', targetIndex: number) {
		if (checked) return;

		let fromType: 'slot' | 'source' | null = null;
		let fromIndex = -1;

		const sIdx = slots.findIndex((a) => a?.id === animal.id);
		if (sIdx !== -1) {
			fromType = 'slot';
			fromIndex = sIdx;
		} else {
			const srcIdx = sourceAnimals.findIndex((a) => a?.id === animal.id);
			if (srcIdx !== -1) {
				fromType = 'source';
				fromIndex = srcIdx;
			}
		}

		if (!fromType) return;

		// Skip if moving to the same place
		if (fromType === targetType && fromIndex === targetIndex) return;

		draggedAnimal = animal;
		dragSource = { type: fromType, index: fromIndex };

		if (targetType === 'slot') performDropOnSlot(targetIndex);
		else performDropOnSource(targetIndex);
	}

	onMount(() => {
		initRound();
		settings.setHeaderTitle('population.title');
		document.addEventListener('touchstart', handleTouchStart, { passive: false });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd, { passive: false });
		return () => {
			settings.setHeaderTitle(null);
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
			if (touchDragClone) touchDragClone.remove();
		};
	});
</script>

<div class="game-page">
	{#if gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver' as any))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore' as any))}</span>
				<span class="score-value">{sessionScore} / {TOTAL_ROUNDS * SLOT_COUNT}</span>
			</div>
			<button class="btn-play-again" onclick={resetGame}>
				<RotateCcw size={24} />
				{@html formatFont(t('common.playAgain' as any))}
			</button>
		</div>
	{:else}
		<div class="round-indicator-wrapper">
			<RoundIndicator 
				current={roundNumber} 
				total={TOTAL_ROUNDS} 
				results={roundResults}
				label={t('population.round' as any)} 
			/>
		</div>

		<div class="sorting-panel">
			<p class="sorting-panel__instruction">{@html formatFont(t('population.description'))}</p>
			<div class="slots-row">
				{#each slots as slotAnimal, i (i)}
					<div 
						class="game-container" 
						class:container--touch-over={dragOverId === `slot-${i}`}
						data-slot-index={i} 
						ondragover={(e) => handleDragOver(e, `slot-${i}`)} 
						ondragleave={(e) => handleDragLeave(e, `slot-${i}`)}
						onmouseenter={() => hoverSlotIndex = i}
						onmouseleave={() => hoverSlotIndex = null}
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
								onclick={(e) => handleCardClick(e, animal, { type: 'slot', index: i })} 
								onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e, animal, { type: 'slot', index: i }); }}
								role="button" 
								tabindex="0"
								in:receive={{ key: animal.id }}
								out:send={{ key: animal.id }}
							>
								<div class="game-card__img-container">
									<img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="game-card__img" draggable="false" loading="lazy" />
									{#if checked}<div class="game-card__pop-overlay">{@html formatPopulationHtml(animal.population)}</div>{/if}
								</div>
								<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
								{#if checked}<span class="game-card__icon" class:game-card__icon--correct={slotResults[i]} class:game-card__icon--wrong={!slotResults[i]}>{#if slotResults[i]}<Check size={18} strokeWidth={3} />{:else}<X size={18} strokeWidth={3} />{/if}</span>{/if}
							</div>
						{/each}
						{#if !slotAnimal}
							<span class="game-container__label">
								{#if i === 0}{@html formatFont(t('population.least'))}
								{:else if i === 1}{@html formatFont(t('population.middle'))}
								{:else}{@html formatFont(t('population.most'))}
								{/if}
							</span>
							{#if !isActuallyDragging && hoverSlotIndex === i}
								<div class="mini-ghost-grid" transition:fade={{ duration: 150 }}>
									{#each availableAnimals as animal (animal.id)}
										<button 
											class="mini-ghost-card" 
											class:mini-ghost-card--selected={draggedAnimal?.id === animal.id}
											onclick={(e) => { e.stopPropagation(); moveAnimalToIndex(animal, 'slot', i); }}
											onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && moveAnimalToIndex(animal, 'slot', i)}
											aria-label={formatPlain(td(animal.nameKey))}
										>
											<img src={animal.image} alt="" class="mini-ghost-card__img" />
										</button>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div class="action-zone">
			{#if !checked}
				<button class="btn-check" disabled={!allSlotsFilled} onclick={handleCheck}>{@html formatFont(t('population.check'))}</button>
			{:else}
				<button class="btn-check" onclick={handleNextRound}>{@html formatFont(t('population.nextRound'))}</button>
			{/if}
		</div>

		<div class="dynamic-zone-wrapper">
			{#if !checked}
				<div class="source-panel-wrapper" transition:slide={{ duration: 400 }}>
					<div class="source-panel" role="group" aria-label="source cards" tabindex="-1">
						<p class="source-panel__title">{@html formatFont(t('population.yourAnimals'))}</p>
						<div class="source-panel__cards">
							{#each sourceAnimals as srcAnimal, i (i)}
								<div 
									class="game-container" 
									class:container--touch-over={dragOverId === `source-${i}`}
									data-source-index={i} 
									ondragover={(e) => handleDragOver(e, `source-${i}`)} 
									ondragleave={(e) => handleDragLeave(e, `source-${i}`)}
									onmouseenter={() => hoverSourceIndex = i}
									onmouseleave={() => hoverSourceIndex = null}
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
											onclick={(e) => handleCardClick(e, animal, { type: 'source', index: i })} 
											onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(e, animal, { type: 'source', index: i }); }}
											role="button" 
											tabindex="0"
											in:receive={{ key: animal.id }}
											out:send={{ key: animal.id }}
										>
											<div class="game-card__img-container">
												<img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="game-card__img" draggable="false" loading="lazy" />
											</div>
											<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
										</div>
									{/each}
									{#if !srcAnimal && !isActuallyDragging && hoverSourceIndex === i}
										<div class="mini-ghost-grid" transition:fade={{ duration: 150 }}>
											{#each availableAnimals as animal (animal.id)}
												<button 
													class="mini-ghost-card" 
													class:mini-ghost-card--selected={draggedAnimal?.id === animal.id}
													onclick={(e) => { e.stopPropagation(); moveAnimalToIndex(animal, 'source', i); }}
													onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && moveAnimalToIndex(animal, 'source', i)}
													aria-label={formatPlain(td(animal.nameKey))}
												>
													<img src={animal.image} alt="" class="mini-ghost-card__img" />
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if checked}
				<div class="results-zone-wrapper" transition:slide={{ duration: 400 }}>
					<div class="results-zone">
						{#each correctOrder as animal, i (animal.id)}
							<div class="result-card anim-stagger-{i + 1}">
								<div class="result-card__left"><img src={animal.image} alt={formatPlain(td(animal.nameKey))} class="result-card__img-small" loading="lazy" width="70" height="93" /></div>
								<div class="result-card__right">
									<div class="result-card__top"><span class="result-card__name-bold">{@html formatFont(td(animal.nameKey))}</span><span class="result-card__stat">{@html formatPopulationHtml(animal.population)}</span></div>
									<div class="result-card__divider"></div>
									<p class="result-card__fact-simple">{@html formatFont(td(animal.factKey))}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.game-page { 
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		flex: 1;
		width: 95%; max-width: 600px; padding: var(--space-md) 0; 
		gap: clamp(var(--space-xs), 2vh, var(--space-lg)); 
		margin: 0 auto; 
	}
	@media (min-width: 769px) { .game-page { padding: var(--space-2xl) 0 var(--space-2xl); } }

	.round-indicator-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: var(--space-sm);
		position: relative;
		width: 100%;
	}

	.game-over-card {
		width: 100%; background: var(--color-bg-surface); border-radius: var(--radius-lg); padding: var(--space-2xl);
		box-shadow: var(--shadow-card); display: flex; flex-direction: column; align-items: center; gap: var(--space-xl);
		text-align: center;
		animation: blur-in 3s ease 400ms both;
	}
	.game-over-title { font-size: var(--font-size-2xl); font-weight: var(--font-weight-bold); margin: 0; color: var(--color-text); }
	.game-over-score { display: flex; flex-direction: column; gap: var(--space-xs); }
	.score-label { font-size: var(--font-size-md); color: var(--color-text-muted); text-transform: uppercase; }
	.score-value { font-size: 3rem; font-weight: 900; color: var(--color-accent); line-height: 1; }
	
	.game-over-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 300px;
	}

	.btn-play-again, .btn-menu {
		display: flex; align-items: center; justify-content: center; gap: var(--space-sm);
		padding: var(--space-md) var(--space-xl); border-radius: var(--radius-md); border: none; 
		font-weight: var(--font-weight-bold); font-size: var(--font-size-lg);
		cursor: pointer; transition: all var(--transition-fast); text-decoration: none;
	}

	.btn-play-again {
		background: var(--color-accent); color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-play-again:hover { transform: translateY(-2px); box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%); background: var(--color-accent-hover); }

	.btn-menu {
		background: rgba(255, 255, 255, 0.1); color: #ffffff;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.btn-menu:hover { background: rgba(255, 255, 255, 0.2); transform: translateY(-2px); }

	.sorting-panel { 
		width: 100%; 
		background-color: color-mix(in srgb, var(--color-bg-panel), transparent 25%); 
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg); padding: var(--space-md) var(--space-sm); display: flex; flex-direction: column; gap: var(--space-md); box-shadow: var(--shadow-card); 
		animation: 
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both; 
	}
	.sorting-panel__instruction { color: #ffffff; text-align: center; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
	.slots-row, .source-panel__cards { display: flex; gap: var(--space-sm); justify-content: center; width: 100%; }

	.game-container { 
		flex: 1; max-width: 110px; aspect-ratio: 11 / 17; 
		border: 2px dashed color-mix(in srgb, var(--color-text-on-panel), transparent 70%); border-radius: var(--radius-md); 
		display: grid; place-items: center; 
		background-color: rgba(0, 0, 0, 0.05); box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.1); 
		transition: all var(--transition-normal); min-width: 0; position: relative; 
	}
	.container--touch-over { border-color: var(--color-accent) !important; background-color: var(--color-accent-shadow) !important; }
	.game-container__label { grid-area: 1 / 1; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-text); text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1); opacity: 0.5; text-transform: uppercase; text-align: center; padding: 0 4px; }
	
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
	.ghost-card { opacity: 0.5 !important; transform: scale(0.8) !important; pointer-events: none; z-index: 1; }

	.mini-ghost-grid {
		grid-area: 1 / 1;
		display: flex; flex-direction: row; gap: 4px; padding: 6px; 
		justify-content: center; align-items: flex-end; width: 100%; height: 100%;
		z-index: 10;
	}
	.mini-ghost-card {
		flex: 1; max-width: 28%; aspect-ratio: 3 / 4; border-radius: 4px; overflow: hidden;
		background-color: var(--color-bg-card); opacity: 0.9;
		border: 1px solid rgba(255, 255, 255, 0.4);
		transition: all var(--transition-fast);
		display: flex; flex-direction: column;
		cursor: pointer; padding: 0; margin-bottom: 4px;
	}
	.mini-ghost-card:hover { transform: scale(1.1); z-index: 2; border-color: var(--color-accent); }
	.mini-ghost-card__img { width: 100%; height: 100%; object-fit: cover; }
	.mini-ghost-card--selected { 
		opacity: 1; border-color: var(--color-accent); 
		box-shadow: 0 0 8px var(--color-accent); transform: scale(1.1);
		z-index: 2;
	}

	.game-card__img-container { position: relative; width: 100%; aspect-ratio: 3 / 4; min-height: 0; }
	.game-card__img { width: 100%; height: 100%; border-radius: var(--radius-sm); background-color: var(--color-bg-panel-dark); object-fit: cover; }
	.game-card__pop-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 2px 2px; background: linear-gradient(transparent, rgba(0, 0, 0, 0.85)); color: #ffffff; font-size: 8px; font-weight: var(--font-weight-bold); text-align: center; border-bottom-left-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); white-space: nowrap; overflow: hidden; }
	.game-card__name { font-size: var(--font-size-md); font-weight: var(--font-weight-bold); color: #ffffff; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8); text-align: center; width: 100%; line-height: 1.2; flex: 1; display: flex; align-items: center; justify-content: center; }
	.game-card__icon { position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10; }
	.game-card__icon--correct { background-color: var(--color-success); }
	.game-card__icon--wrong { background-color: var(--color-error); }

	.dynamic-zone-wrapper {
		display: grid;
		grid-template-areas: "stack";
		width: 100%;
		align-items: start;
	}

	.source-panel-wrapper, .results-zone-wrapper {
		grid-area: stack;
		width: 100%;
	}

	.results-zone { display: flex; flex-direction: column; gap: var(--space-md); width: 100%; }
	.result-card { 
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 25%); 
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-md); box-shadow: var(--shadow-card); overflow: hidden; 
		animation: 
			slide-up 400ms ease both,
			blur-in 3s ease 400ms both; 
		display: flex; padding: 0; 
	}
	.result-card__left { width: 70px; display: flex; align-items: center; justify-content: center; }
	.result-card__img-small { width: 100%; aspect-ratio: 3 / 4; border-radius: 6px; object-fit: cover; }
	.result-card__right { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; }
	.result-card__top { display: flex; justify-content: space-between; align-items: baseline; }
	.result-card__name-bold { font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
	.result-card__stat { font-size: 12px; font-weight: 700; color: var(--color-stat); }
	.result-card__divider { height: 2px; width: 30px; background: var(--color-accent); margin: 2px 0; border-radius: 2px; }
	.result-card__fact-simple { font-size: 12px; margin: 0; color: var(--color-text-muted); font-style: italic; }
	
	.btn-check { 
		padding: var(--space-md) 4rem; font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); border-radius: 2rem; 
		background: linear-gradient(180deg, 
			color-mix(in srgb, var(--color-accent-hover), transparent 25%) 0%, 
			color-mix(in srgb, var(--color-accent), transparent 25%) 40%, 
			color-mix(in srgb, color-mix(in srgb, var(--color-accent), black 20%), transparent 25%) 100%
		); 
		backdrop-filter: var(--blur-glass);
		color: var(--color-text-on-accent); 
		box-shadow: 0 5px 0 color-mix(in srgb, var(--color-accent), black 40%), 0 8px 20px var(--color-accent-shadow); 
		border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 2px; transition: all var(--transition-fast); 
		animation: blur-in 3s ease 400ms both;
	}
	.btn-check:hover:not(:disabled) { 
		transform: translateY(-2px); 
		box-shadow: 0 7px 0 color-mix(in srgb, var(--color-accent), black 40%), 0 10px 24px var(--color-accent-shadow); 
	}
	.btn-check:disabled { background: var(--color-disabled); color: var(--color-disabled-text); box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15); cursor: not-allowed; }
	.source-panel { 
		width: 100%; 
		background-color: color-mix(in srgb, var(--color-bg-panel-dark), transparent 25%); 
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg); padding: var(--space-md) var(--space-sm); display: flex; flex-direction: column; gap: var(--space-md); box-shadow: var(--shadow-card); 
		animation: 
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both; 
		margin: 0;
	}
	.source-panel__title { color: #ffffff; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5); text-align: center; font-size: var(--font-size-md); font-weight: var(--font-weight-bold); }
	
	:global(.touch-drag-clone) { 
		position: fixed !important; pointer-events: none !important; z-index: 9999 !important; 
		transition: none !important; top: 0; left: 0;
		filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5)); border-radius: var(--radius-md); 
	}
	@media (max-width: 480px) { .slots-row, .source-panel__cards { gap: var(--space-xs); } .btn-check { padding: var(--space-md) 3rem; } }
</style>