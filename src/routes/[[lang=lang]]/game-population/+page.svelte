<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { t, td, formatFont, formatPlain, formatPopulation } from '$lib/i18n/index';
	import { settings } from '$lib/services/settings.svelte';
	import { PopulationGameController, type Place } from '$lib/controllers/populationGame.svelte';
	import type { Animal } from '$lib/config/population-game';
	import { Check, X, RotateCcw } from 'lucide-svelte';
	import { createCrossfade } from '$lib/utils/transitions';
	import { parkDraggedCard } from '$lib/utils/parkDraggedCard';
	import { revealScroll } from '$lib/utils/revealScroll';
	import RoundIndicator from '$lib/components/RoundIndicator.svelte';
	import MiniGhostGrid from '$lib/components/MiniGhostGrid.svelte';

	/**
	 * Правила гри — у контролері; тут лишається СПОСІБ ВВЕДЕННЯ: миша, палець,
	 * клік і подвійний клік (SVELTE-CORE-v8 § 3.1). Ділити довелося саме так:
	 * `game.dropOnSlot()` викликають усі чотири шляхи, і жоден із них
	 * контролеру не видно.
	 */
	const game = new PopulationGameController();

	/** Чисто візуальний стан — контролер про нього не знає й знати не має. */
	let isActuallyDragging = $state(false);
	let dragOverId = $state<string | null>(null);
	let hoverSlotIndex = $state<number | null>(null);
	let hoverSourceIndex = $state<number | null>(null);
	const isSwapping = $derived(game.isSwapping);

	// Стан перетягування пальцем: HTML5 DnD на мобільних не працює, тож клон
	// картки їздить за пальцем вручну.
	let touchDragClone: HTMLElement | null = null;
	let touchStartInfo: {
		x: number;
		y: number;
		offsetX: number;
		offsetY: number;
		animal: Animal;
		source: Place;
		target: HTMLElement;
		w: number;
		h: number;
	} | null = null;
	let touchDragStarted = false;
	const TOUCH_DRAG_THRESHOLD = 8;

	const [send, receive] = createCrossfade(() => isSwapping);

	/** Хід зроблено — візуальний стан перетягування знімається тут, не в правилах. */
	function afterDrop(moved: boolean) {
		if (moved) isActuallyDragging = false;
	}

	// --- Миша: HTML5 drag and drop ---
	function handleDragStart(e: DragEvent, animal: Animal, source: Place) {
		if (game.checked) return;
		if (e.dataTransfer) {
			e.dataTransfer.setData('text/plain', animal.id.toString());
			e.dataTransfer.effectAllowed = 'move';
		}
		game.picked = animal;
		game.pickedFrom = source;
		setTimeout(() => {
			isActuallyDragging = true;
		}, 0);
	}

	function handleDragEnd() {
		isActuallyDragging = false;
		// Під час дотику вибір лишається за touchend — інакше палець «губить»
		// картку між подіями.
		if (!touchDragStarted) game.clearSelection();
	}

	function handleDragOver(e: DragEvent, id: string) {
		if (game.checked) return;
		e.preventDefault();
		dragOverId = id;
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDragLeave(_e: DragEvent, id: string) {
		if (dragOverId === id) dragOverId = null;
	}

	function dropFromMouse(e: DragEvent, target: 'slot' | 'source', targetIndex: number) {
		e.preventDefault();
		dragOverId = null;
		const from = game.pickedFrom;
		if (game.checked || !game.picked || !from) return;

		// Відпустили там само, звідки взяли — це не хід, а скасування.
		if (from.type === target && from.index === targetIndex) {
			game.clearSelection();
			isActuallyDragging = false;
			return;
		}

		parkDraggedCard(game.picked.id, e.clientX, e.clientY);
		afterDrop(target === 'slot' ? game.dropOnSlot(targetIndex) : game.dropOnSource(targetIndex));
	}

	// --- Клік і подвійний клік ---
	let lastClickTime = 0;
	let lastClickedAnimalId: string | number | null = null;

	function handleCardClick(e: Event, animal: Animal, source: Place) {
		e.stopPropagation();
		if (game.checked || isActuallyDragging) return;

		const now = Date.now();
		if (now - lastClickTime < 400 && lastClickedAnimalId === animal.id) {
			lastClickTime = 0;
			lastClickedAnimalId = null;
			game.sendToFreeSpot(animal, source);
		} else {
			lastClickTime = now;
			lastClickedAnimalId = animal.id;
			afterDrop(game.select(animal, source));
		}
	}

	function handleSlotClick(i: number) {
		if (game.checked) return;
		if (game.picked && !isActuallyDragging) afterDrop(game.dropOnSlot(i));
		else if (game.slots[i]) game.select(game.slots[i] as Animal, { type: 'slot', index: i });
	}

	function handleSourcePlaceholderClick(i: number) {
		if (game.checked) return;
		if (game.picked && !isActuallyDragging) afterDrop(game.dropOnSource(i));
		else if (game.sourceAnimals[i])
			game.select(game.sourceAnimals[i] as Animal, { type: 'source', index: i });
	}

	// --- Дотик ---
	function handleTouchStart(e: TouchEvent) {
		const target = (e.target as HTMLElement).closest('[data-drag-animal]') as HTMLElement | null;
		if (!target || game.checked) return;

		const sourceType = target.dataset.dragSourceType as 'source' | 'slot';
		const sourceIndex = parseInt(target.dataset.dragSourceIndex!, 10);
		const animal =
			sourceType === 'source' ? game.sourceAnimals[sourceIndex] : game.slots[sourceIndex];
		if (!animal) return;

		const rect = target.getBoundingClientRect();
		const touch = e.touches[0];
		touchStartInfo = {
			x: touch.clientX,
			y: touch.clientY,
			offsetX: touch.clientX - rect.left,
			offsetY: touch.clientY - rect.top,
			animal,
			source: { type: sourceType, index: sourceIndex },
			target,
			w: rect.width,
			h: rect.height
		};
		touchDragStarted = false;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!touchStartInfo) return;
		const touch = e.touches[0];

		if (!touchDragStarted) {
			const dx = touch.clientX - touchStartInfo.x;
			const dy = touch.clientY - touchStartInfo.y;
			// Поріг обов'язковий: без нього звичайний тап читається як перетягування.
			if (Math.abs(dx) < TOUCH_DRAG_THRESHOLD && Math.abs(dy) < TOUCH_DRAG_THRESHOLD) return;

			touchDragStarted = true;
			isActuallyDragging = true;
			const { animal, source, target, w, h, offsetX, offsetY } = touchStartInfo;
			game.picked = animal;
			game.pickedFrom = source;

			const clone = target.cloneNode(true) as HTMLElement;
			clone.classList.add('touch-drag-clone');
			clone.style.width = `${w}px`;
			clone.style.height = `${h}px`;
			clone.style.setProperty(
				'transform',
				`translate3d(${touch.clientX - offsetX}px, ${touch.clientY - offsetY}px, 0) scale(1.1)`,
				'important'
			);
			document.body.appendChild(clone);
			touchDragClone = clone;
		}

		if (e.cancelable) e.preventDefault();
		if (touchDragClone) {
			const { offsetX, offsetY } = touchStartInfo;
			touchDragClone.style.setProperty(
				'transform',
				`translate3d(${touch.clientX - offsetX}px, ${touch.clientY - offsetY}px, 0) scale(1.1)`,
				'important'
			);
		}

		const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
		document
			.querySelectorAll('.container--touch-over')
			.forEach((el) => el.classList.remove('container--touch-over'));
		elUnder
			?.closest('[data-slot-index], [data-source-index]')
			?.classList.add('container--touch-over');
	}

	function handleTouchEnd(e: TouchEvent) {
		document
			.querySelectorAll('.container--touch-over')
			.forEach((el) => el.classList.remove('container--touch-over'));
		if (!touchStartInfo) return;

		const wasDragging = touchDragStarted;
		const startInfo = touchStartInfo;
		touchStartInfo = null;
		touchDragStarted = false;
		if (!wasDragging) return;

		if (e.cancelable) e.preventDefault();
		touchDragClone?.remove();
		touchDragClone = null;

		const from = game.pickedFrom;
		if (game.checked || !game.picked || !from) {
			game.clearSelection();
			isActuallyDragging = false;
			return;
		}

		const touch = e.changedTouches[0];
		const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
		const slotEl = elUnder?.closest('[data-slot-index]') as HTMLElement | null;
		const srcEl = elUnder?.closest('[data-source-index]') as HTMLElement | null;

		const target: 'slot' | 'source' | null = slotEl ? 'slot' : srcEl ? 'source' : null;
		if (!target) {
			game.clearSelection();
			isActuallyDragging = false;
			return;
		}

		const targetIndex = parseInt(
			(target === 'slot' ? slotEl!.dataset.slotIndex : srcEl!.dataset.sourceIndex)!,
			10
		);
		if (from.type === target && from.index === targetIndex) {
			game.clearSelection();
			isActuallyDragging = false;
			return;
		}

		parkDraggedCard(
			game.picked.id,
			touch.clientX,
			touch.clientY,
			startInfo.offsetX,
			startInfo.offsetY
		);
		afterDrop(target === 'slot' ? game.dropOnSlot(targetIndex) : game.dropOnSource(targetIndex));
	}

	onMount(() => {
		game.startRound();
		settings.setHeaderTitle('population.title');
		document.addEventListener('touchstart', handleTouchStart, { passive: false });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd, { passive: false });
		return () => {
			settings.setHeaderTitle(null);
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
			touchDragClone?.remove();
		};
	});
</script>

<div class="game-page">
	{#if game.gameOver}
		<div class="game-over-card" in:fade={{ duration: 400 }}>
			<h2 class="game-over-title">{@html formatFont(t('common.gameOver'))}</h2>
			<div class="game-over-score">
				<span class="score-label">{@html formatFont(t('common.yourScore'))}</span>
				<span class="score-value">{game.sessionScore} / {game.maxScore}</span>
			</div>
			<button class="btn-play-again" onclick={() => game.reset()} data-testid="population-play-again-btn">
				<RotateCcw size={24} />
				{@html formatFont(t('common.playAgain'))}
			</button>
		</div>
	{:else}
		<div class="round-indicator-wrapper">
			<RoundIndicator
				current={game.roundNumber}
				total={game.totalRounds}
				results={game.roundResults}
			/>
		</div>

		<div class="sorting-panel">
			<p class="sorting-panel__instruction">{@html formatFont(t('population.description'))}</p>
			<div class="slots-row">
				{#each game.slots as slotAnimal, i (i)}
					<div
						class="game-container"
						class:container--filled={!!slotAnimal}
						class:container--picked={!!slotAnimal &&
							game.picked?.id === slotAnimal.id &&
							!isActuallyDragging}
						class:container--touch-over={dragOverId === `slot-${i}`}
						data-slot-index={i}
						ondragover={(e) => handleDragOver(e, `slot-${i}`)}
						ondragleave={(e) => handleDragLeave(e, `slot-${i}`)}
						onmouseenter={() => (hoverSlotIndex = i)}
						onmouseleave={() => (hoverSlotIndex = null)}
						ondrop={(e) => dropFromMouse(e, 'slot', i)}
						onclick={() => handleSlotClick(i)}
						onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSlotClick(i)}
						role="button"
						tabindex="0"
					>
						{#each slotAnimal ? [slotAnimal] : [] as animal (animal.id)}
							<div
								class="game-card"
								class:card--selected={game.picked?.id === animal.id && !isActuallyDragging}
								class:card--dragging-orig={isActuallyDragging &&
									game.pickedFrom?.type === 'slot' &&
									game.pickedFrom?.index === i}
								draggable={!game.checked ? 'true' : 'false'}
								data-drag-animal={animal.id}
								data-drag-source-type="slot"
								data-drag-source-index={i}
								ondragstart={(e) => handleDragStart(e, animal, { type: 'slot', index: i })}
								ondragend={handleDragEnd}
								onclick={(e) => handleCardClick(e, animal, { type: 'slot', index: i })}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ')
										handleCardClick(e, animal, { type: 'slot', index: i });
								}}
								role="button"
								tabindex="0"
								in:receive={{ key: animal.id }}
								out:send={{ key: animal.id }}
							>
								<div class="game-card__img-container">
									<img
										src={animal.image}
										alt={formatPlain(td(animal.nameKey))}
										class="game-card__img"
										draggable="false"
										loading="lazy"
										width="300"
										height="400"
									/>
									{#if game.checked}<div class="game-card__pop-overlay">
											{@html formatPopulation(animal.population)}
										</div>{/if}
								</div>
								<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
								{#if game.checked}<span
										class="game-card__icon"
										class:game-card__icon--correct={game.slotResults[i]}
										class:game-card__icon--wrong={!game.slotResults[i]}
										>{#if game.slotResults[i]}<Check size={18} strokeWidth={3} />{:else}<X
												size={18}
												strokeWidth={3}
											/>{/if}</span
									>{/if}
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
								<MiniGhostGrid
									animals={game.availableAnimals}
									pickedId={game.picked?.id}
									onpick={(animal) => game.moveTo(animal, 'slot', i)}
								/>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		{#if !game.checked}
			<button class="btn-check" disabled={!game.allSlotsFilled} onclick={() => game.check()} data-testid="population-check-btn"
				>{@html formatFont(t('population.check'))}</button
			>
		{:else}
			<button
				type="button"
				class="btn-check"
				onclick={() => game.nextRound()}
				data-testid="population-next-round-btn"
				>{@html formatFont(t('population.nextRound'))}</button
			>
		{/if}

		<div class="dynamic-zone-wrapper">
			{#if !game.checked}
				<div class="source-panel-wrapper" transition:slide={{ duration: 400 }}>
					<div class="source-panel" role="group" aria-label="source cards" tabindex="-1">
						<p class="source-panel__title">{@html formatFont(t('population.yourAnimals'))}</p>
						<div class="source-panel__cards">
							{#each game.sourceAnimals as srcAnimal, i (i)}
								<div
									class="game-container"
									class:container--filled={!!srcAnimal}
									class:container--picked={!!srcAnimal &&
										game.picked?.id === srcAnimal.id &&
										!isActuallyDragging}
									class:container--touch-over={dragOverId === `source-${i}`}
									data-source-index={i}
									ondragover={(e) => handleDragOver(e, `source-${i}`)}
									ondragleave={(e) => handleDragLeave(e, `source-${i}`)}
									onmouseenter={() => (hoverSourceIndex = i)}
									onmouseleave={() => (hoverSourceIndex = null)}
									ondrop={(e) => dropFromMouse(e, 'source', i)}
									onclick={() => handleSourcePlaceholderClick(i)}
									onkeydown={(e) =>
										(e.key === 'Enter' || e.key === ' ') && handleSourcePlaceholderClick(i)}
									role="button"
									tabindex="0"
								>
									{#each srcAnimal ? [srcAnimal] : [] as animal (animal.id)}
										<div
											class="game-card"
											class:card--selected={game.picked?.id === animal.id && !isActuallyDragging}
											class:card--dragging-orig={isActuallyDragging &&
												game.pickedFrom?.type === 'source' &&
												game.pickedFrom?.index === i}
											draggable="true"
											data-drag-animal={animal.id}
											data-drag-source-type="source"
											data-drag-source-index={i}
											ondragstart={(e) => handleDragStart(e, animal, { type: 'source', index: i })}
											ondragend={handleDragEnd}
											onclick={(e) => handleCardClick(e, animal, { type: 'source', index: i })}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ')
													handleCardClick(e, animal, { type: 'source', index: i });
											}}
											role="button"
											tabindex="0"
											in:receive={{ key: animal.id }}
											out:send={{ key: animal.id }}
										>
											<div class="game-card__img-container">
												<img
													src={animal.image}
													alt={formatPlain(td(animal.nameKey))}
													class="game-card__img"
													draggable="false"
													loading="lazy"
													width="300"
													height="400"
												/>
											</div>
											<span class="game-card__name">{@html formatFont(td(animal.nameKey))}</span>
										</div>
									{/each}
									{#if !srcAnimal && !isActuallyDragging && hoverSourceIndex === i}
										<MiniGhostGrid
											animals={game.availableAnimals}
											pickedId={game.picked?.id}
											onpick={(animal) => game.moveTo(animal, 'source', i)}
										/>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if game.checked}
				<div class="results-zone-wrapper" use:revealScroll transition:slide={{ duration: 400 }}>
					<div class="results-zone">
						{#each game.correctOrder as animal, i (animal.id)}
							<div class="result-card anim-stagger-{i + 1}">
								<div class="result-card__left">
									<img
										src={animal.image}
										alt={formatPlain(td(animal.nameKey))}
										class="result-card__img-small"
										loading="lazy"
										width="70"
										height="93"
									/>
								</div>
								<div class="result-card__right">
									<div class="result-card__top">
										<span class="result-card__name-bold"
											>{@html formatFont(td(animal.nameKey))}</span
										><span class="result-card__stat"
											>{@html formatPopulation(animal.population)}</span
										>
									</div>
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
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		flex: 1;
		width: 95%;
		max-width: 600px;
		padding: var(--space-md) 0;
		gap: clamp(var(--space-xs), 2dvh, var(--space-lg));
		margin: 0 auto;
	}
	@media (min-width: 769px) {
		.game-page {
			padding: var(--space-2xl) 0 var(--space-2xl);
		}
	}

	.round-indicator-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: var(--space-sm);
		position: relative;
		width: 100%;
	}

	.game-over-card {
		width: 100%;
		background: var(--color-bg-surface);
		border-radius: var(--radius-lg);
		padding: var(--space-2xl);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-xl);
		text-align: center;
		animation: blur-in 3s ease 400ms both;
	}
	.game-over-title {
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
		margin: 0;
		color: var(--color-text);
	}
	.game-over-score {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}
	.score-label {
		font-size: var(--font-size-md);
		color: var(--color-text-muted);
		text-transform: uppercase;
	}
	.score-value {
		font-size: 3rem;
		font-weight: 900;
		color: var(--color-accent);
		line-height: 1;
	}

	.btn-play-again {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-xl);
		border-radius: var(--radius-md);
		border: none;
		font-weight: var(--font-weight-bold);
		font-size: var(--font-size-lg);
		cursor: pointer;
		transition: all var(--transition-fast);
		text-decoration: none;
	}

	.btn-play-again {
		background: var(--color-accent);
		color: var(--color-text-on-accent);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
	}
	.btn-play-again:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 0 color-mix(in srgb, var(--color-accent), black 30%);
		background: var(--color-accent-hover);
	}

	.sorting-panel {
		width: 100%;
		background-color: color-mix(in srgb, var(--color-bg-panel), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg);
		padding: var(--space-md) var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-card);
		animation:
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both;
	}
	.sorting-panel__instruction {
		color: #ffffff;
		text-align: center;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}
	.slots-row,
	.source-panel__cards {
		display: flex;
		gap: var(--space-sm);
		justify-content: center;
		width: 100%;
	}

	.game-container {
		/*
		 * Товщина рамки — змінна, бо від неї залежить скруглення КАРТКИ
		 * всередині (див. `.game-card`). Два числа, які мусять збігатися,
		 * розходяться при першій же правці, якщо їх двоє.
		 */
		--slot-border: 2px;

		flex: 1;
		max-width: 110px;
		aspect-ratio: 11 / 17;
		border: var(--slot-border) dashed color-mix(in srgb, var(--color-text-on-panel), transparent 70%);
		border-radius: var(--radius-md);
		display: grid;
		place-items: center;
		background-color: rgba(0, 0, 0, 0.05);
		box-shadow: inset 0 4px 10px rgba(0, 0, 0, 0.1);
		transition: all var(--transition-normal);
		min-width: 0;
		position: relative;
	}

	/*
	 * Увесь рух і вся об'ємність живуть ТУТ, а не на картці.
	 *
	 * Картка заповнює слот рівно, тож підйом, `scale` і тверда тінь виносили
	 * її кут (14px) за скруглення слота (16px) — і назовні визирала смужка з
	 * чужим радіусом. Обрізанням не лікується: картка літає між слотами через
	 * `crossfade`, і кліп різав би її в польоті. Слот же крайній у своєму
	 * ряду — йому вилазити нема з-під чого.
	 */
	.container--filled {
		box-shadow:
			0 4px 0 var(--color-bg-panel-dark),
			var(--shadow-card);
	}
	.container--filled:hover {
		transform: translateY(-2px);
		box-shadow:
			0 6px 0 var(--color-bg-panel-dark),
			var(--shadow-card-hover);
	}
	.container--picked {
		border-style: solid;
		border-color: var(--color-accent);
		transform: scale(1.05) translateY(-2px);
		box-shadow:
			0 0 15px var(--color-accent),
			0 4px 0 var(--color-bg-panel-dark);
		/* Піднятий слот мусить лягати поверх сусідів, а не під наступний. */
		z-index: 3;
	}
	.container--touch-over {
		border-color: var(--color-accent) !important;
		background-color: var(--color-accent-shadow) !important;
	}
	.game-container__label {
		grid-area: 1 / 1;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
		opacity: 0.5;
		text-transform: uppercase;
		text-align: center;
		padding: 0 4px;
	}

	.game-card {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 100%;
		height: 100%;
		gap: var(--space-xs);
		padding: var(--space-sm);
		background-color: var(--color-bg-card);
		/*
		 * Концентричне скруглення: внутрішній радіус = зовнішній МІНУС рамка.
		 * З однаковим радіусом у 16px кут картки «з'їдається» сильніше за кут
		 * слота, і той визирає з-під неї крескою: на прямих краях рамка 2px, у
		 * кутах розростається до шести.
		 *
		 * Запасні 2px — для клона під пальцем: він живе в <body>, і
		 * успадкувати `--slot-border` йому нема від кого.
		 */
		border-radius: calc(var(--radius-md) - var(--slot-border, 2px));
		/*
		 * Ні `transform`, ні зовнішньої тіні — усе це на `.container--filled`.
		 * Стереже інваріант «картка не рухається за межі свого слота».
		 */
		cursor: grab;
		user-select: none;
		position: relative;
		transition:
			background-color var(--transition-fast),
			box-shadow var(--transition-fast),
			opacity var(--transition-fast);
		z-index: 2;
		touch-action: none;
	}
	.game-card:hover {
		background-color: var(--color-bg-card-hover);
	}
	.game-card:active {
		cursor: grabbing;
	}
	/* Обводка всередину: назовні вибір показує слот (`.container--picked`). */
	.card--selected {
		box-shadow: inset 0 0 0 3px var(--color-accent) !important;
	}
	.card--dragging-orig {
		opacity: 0 !important;
		pointer-events: none;
	}

	.game-card__img-container {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 4;
		min-height: 0;
	}
	.game-card__img {
		width: 100%;
		height: 100%;
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-panel-dark);
		object-fit: cover;
	}
	.game-card__pop-overlay {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 8px 2px 2px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.85));
		color: #ffffff;
		font-size: 8px;
		font-weight: var(--font-weight-bold);
		text-align: center;
		border-bottom-left-radius: var(--radius-sm);
		border-bottom-right-radius: var(--radius-sm);
		white-space: nowrap;
		overflow: hidden;
	}
	.game-card__name {
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
		text-align: center;
		width: 100%;
		line-height: 1.2;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.game-card__icon {
		position: absolute;
		bottom: -12px;
		left: 50%;
		transform: translateX(-50%);
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		z-index: 10;
	}
	.game-card__icon--correct {
		background-color: var(--color-success);
	}
	.game-card__icon--wrong {
		background-color: var(--color-error);
	}

	.dynamic-zone-wrapper {
		display: grid;
		grid-template-areas: 'stack';
		width: 100%;
		align-items: start;
	}

	.source-panel-wrapper,
	.results-zone-wrapper {
		grid-area: stack;
		width: 100%;
	}

	.results-zone {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
	}
	.result-card {
		background-color: color-mix(in srgb, var(--color-bg-surface), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		animation:
			slide-up 400ms ease both,
			blur-in 3s ease 400ms both;
		display: flex;
		padding: 0;
	}
	.result-card__left {
		width: 70px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.result-card__img-small {
		width: 100%;
		aspect-ratio: 3 / 4;
		border-radius: 6px;
		object-fit: cover;
	}
	.result-card__right {
		flex: 1;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}
	.result-card__top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.result-card__name-bold {
		font-size: 18px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 1px;
	}
	.result-card__stat {
		font-size: 12px;
		font-weight: 700;
		color: var(--color-stat);
	}
	.result-card__divider {
		height: 2px;
		width: 30px;
		background: var(--color-accent);
		margin: 2px 0;
		border-radius: 2px;
	}
	.result-card__fact-simple {
		font-size: 12px;
		margin: 0;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.btn-check {
		padding: var(--space-md) 4rem;
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		border-radius: 2rem;
		background: linear-gradient(
			180deg,
			var(--color-accent-hover) 0%,
			var(--color-accent) 40%,
			color-mix(in srgb, var(--color-accent), black 20%) 100%
		);
		backdrop-filter: var(--blur-glass);
		color: var(--color-text-on-accent);
		box-shadow:
			0 5px 0 color-mix(in srgb, var(--color-accent), black 40%),
			0 8px 20px var(--color-accent-shadow);
		border: none;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 2px;
		transition: all var(--transition-fast);
		animation: blur-in 3s ease 400ms both;
	}
	.btn-check:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow:
			0 7px 0 color-mix(in srgb, var(--color-accent), black 40%),
			0 10px 24px var(--color-accent-shadow);
	}
	.btn-check:disabled {
		background: var(--color-disabled);
		color: var(--color-disabled-text);
		box-shadow: 0 5px 0 rgba(0, 0, 0, 0.15);
		cursor: not-allowed;
		opacity: 0.6;
	}
	.source-panel {
		width: 100%;
		background-color: color-mix(in srgb, var(--color-bg-panel-dark), transparent 25%);
		backdrop-filter: var(--blur-glass);
		border-radius: var(--radius-lg);
		padding: var(--space-md) var(--space-sm);
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		box-shadow: var(--shadow-card);
		animation:
			card-enter 400ms ease both,
			blur-in 3s ease 400ms both;
		margin: 0;
	}
	.source-panel__title {
		color: #ffffff;
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
		text-align: center;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}

	:global(.touch-drag-clone) {
		position: fixed !important;
		pointer-events: none !important;
		z-index: 9999 !important;
		transition: none !important;
		top: 0;
		left: 0;
		filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5));
		/* Тінь тут своя: картка її не має, а клон летить у <body>, де нема
		   контейнера, з-під якого можна вилізти. */
		box-shadow: 0 4px 0 var(--color-bg-panel-dark) !important;
		/*
		 * Скруглення тут НЕ задається: клон — це `cloneNode` картки, він несе
		 * її ж клас і її ж радіус. Власне значення тільки розійшлося б із
		 * карткою, як тільки та своє змінить.
		 */
	}
	@media (max-width: 480px) {
		.slots-row,
		.source-panel__cards {
			gap: var(--space-xs);
		}
		.btn-check {
			padding: var(--space-md) 3rem;
		}
	}
</style>
