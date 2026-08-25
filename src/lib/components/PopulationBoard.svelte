<script lang="ts">
	import { slide } from 'svelte/transition';
	import { t, td, formatFont, formatPopulation } from '$lib/i18n/index';
	import type { PopulationGameController, Place } from '$lib/controllers/populationGame.svelte';
	import type { Animal } from '$lib/config/population-game';
	import { Check, X } from 'lucide-svelte';
	import { createCrossfade } from '$lib/utils/transitions';
	import { parkDraggedCard } from '$lib/utils/parkDraggedCard';
	import { revealScroll } from '$lib/utils/revealScroll';
	import { fitLabel } from '$lib/utils/fitLabel';
	import MiniGhostGrid from '$lib/components/MiniGhostGrid.svelte';
	import { onMount } from 'svelte';

	/**
	 * ДОШКА «Хто численніший?»: сортування карток за чисельністю виду.
	 *
	 * ## Чому окремо від сторінки
	 *
	 * Маршрут мав 1117 рядків — найбільший борг проєкту, і записаний він був саме
	 * як «дошки не має зовсім». Через це гру не можна було внести в
	 * `ONLINE_GAMES`: у спільній вікторині немає ні навігації, ні власного
	 * `GameOverCard`, а тут вони були вплетені в ту саму розмітку.
	 *
	 * Сторінці лишилося те, що належить СТОРІНЦІ: заголовок, лічильник раундів і
	 * картка підсумку. Дошці — правила введення й сама розкладка.
	 *
	 * ## Чому в дошці стільки коду
	 *
	 * Правила гри — у контролері. Тут лишається СПОСІБ ВВЕДЕННЯ: миша, палець,
	 * клік і подвійний клік (SVELTE-CORE-v8 § 3.1). Ділити довелося саме так:
	 * `game.dropOnSlot()` викликають усі чотири шляхи, і жоден із них контролеру
	 * не видно.
	 *
	 * ## Контролер ПРИХОДИТЬ, а не створюється тут
	 *
	 * У спільній грі він мусить народитися з ЗЕРНОМ раунду — інакше двоє гравців
	 * отримають різні набори тварин, і партія перестане бути спільною.
	 */
	/**
	 * `hideNext` — ОНЛАЙН-РАУНД, у якому темп задає не гравець.
	 *
	 * У соло кнопка «Далі» лишається: вона і є темп, і саме за нею читають розбір.
	 * У кімнаті ж наступний раунд оголошує господар за спільним таймером, тож своя
	 * кнопка тут або нічого не робила б, або перескакувала б раунд у себе одного.
	 * Замість неї `QuizRound` ставить рядок «чекаємо на решту» — на те саме місце,
	 * щоб дошка не стрибала.
	 */
	interface Props {
		game: PopulationGameController;
		/** Онлайн-раунд: своєї кнопки «Далі» тут немає. */
		hideNext?: boolean;
	}

	let { game, hideNext = false }: Props = $props();

	/** Чисто візуальний стан — контролер про нього не знає й знати не має. */
	let isActuallyDragging = $state(false);
	let dragOverId = $state<string | null>(null);
	let hoverSlotIndex = $state<number | null>(null);
	let hoverSourceIndex = $state<number | null>(null);

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

	// Читається просто з контролера: проміжне похідне тут було псевдонімом на один
	// ужиток, а зайвий шар між анімацією та її умовою нічого не пояснює.
	const [send, receive] = createCrossfade(() => game.isSwapping);

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

	/*
	 * ОДИН `onMount` на дві справи, бо обидві — про життя дошки.
	 *
	 * Перший раунд роздає ДОШКА, а не сторінка: контролер приходить пропом і може
	 * бути щойно створений — і соло, і в спільній грі. Роздати раунд у сторінці
	 * означало б, що дошка, вставлена деінде, лишається порожньою й виглядає
	 * зламаною.
	 *
	 * Слухачі дотику — на ДОКУМЕНТІ, а не на дошці: палець, що почав тягнути
	 * картку, може вийти за її межі, і тоді `touchmove` на самій дошці більше не
	 * приходить — перетягування зависало б із карткою в руці. Прибираються вони
	 * при знищенні компонента, тобто разом із раундом у спільній грі.
	 */
	onMount(() => {
		game.startRound();
		document.addEventListener('touchstart', handleTouchStart, { passive: false });
		document.addEventListener('touchmove', handleTouchMove, { passive: false });
		document.addEventListener('touchend', handleTouchEnd, { passive: false });
		return () => {
			document.removeEventListener('touchstart', handleTouchStart);
			document.removeEventListener('touchmove', handleTouchMove);
			document.removeEventListener('touchend', handleTouchEnd);
			touchDragClone?.remove();
		};
	});
</script>

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
								alt={td(animal.nameKey)}
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
						<span class="game-card__name">
							<!--
							Внутрішній елемент потрібен для ВИМІРУ.

							Зовнішній `.game-card__name` — це flex-контейнер із центруванням,
							і `scrollWidth` на ньому міряє анонімний flex-елемент, а не текст.
							Внутрішній має `max-width: 100%` і `overflow: hidden`, тож у нього
							`clientWidth` — це «скільки місця є», а `scrollWidth` — «скільки
							треба рядку». Два однозначних числа замість одного сумнівного.
						-->
							<span class="game-card__name-text" use:fitLabel={td(animal.nameKey)}
								>{@html formatFont(td(animal.nameKey))}</span
							>
						</span>
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
	<button
		class="btn-check"
		disabled={!game.allSlotsFilled}
		onclick={() => game.check()}
		data-testid="population-check-btn">{@html formatFont(t('population.check'))}</button
	>
{:else if !hideNext}
	<button
		type="button"
		class="btn-check"
		onclick={() => game.nextRound()}
		data-testid="population-next-round-btn">{@html formatFont(t('population.nextRound'))}</button
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
											alt={td(animal.nameKey)}
											class="game-card__img"
											draggable="false"
											loading="lazy"
											width="300"
											height="400"
										/>
									</div>
									<span class="game-card__name">
										<span class="game-card__name-text" use:fitLabel={td(animal.nameKey)}
											>{@html formatFont(td(animal.nameKey))}</span
										>
									</span>
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
								alt={td(animal.nameKey)}
								class="result-card__img-small"
								loading="lazy"
								width="70"
								height="93"
							/>
						</div>
						<div class="result-card__right">
							<div class="result-card__top">
								<span class="result-card__name-bold">{@html formatFont(td(animal.nameKey))}</span
								><span class="result-card__stat">{@html formatPopulation(animal.population)}</span>
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

<style>
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
		/*
		 * Тло цієї панелі — `--color-bg-panel` під прозорістю, і воно СВІТЛЕ у двох
		 * темах: заміряно 1.80:1 у light-green і 1.79:1 у winter при потрібних 4.5
		 * (`tests/contrast-runtime.spec.ts`). Із `--color-text-on-panel` — 7.37:1 і
		 * 7.72:1. Той самий клас, що `.game-title` у `GameHeader`.
		 */
		color: var(--color-text-on-panel);
		text-align: center;
		font-size: var(--font-size-md);
		font-weight: var(--font-weight-bold);
	}
	/*
	 * ДВА РЯДКИ КАРТОК — ОДНЕ ПРАВИЛО: слоти вгорі й запас унизу.
	 *
	 * Скарга автора зі знімком: три слоти («найменша», «середня», «найбільша»)
	 * стояли стовпцем ліворуч, а решта панелі була порожня. Причина не в
	 * розкладці, а в її ВІДСУТНОСТІ: у `.slots-row` не було жодного `display`,
	 * тобто три `<div class="game-container">` лишалися блоковими й ставали одне
	 * під одним.
	 *
	 * Найпомітніше в цьому те, що медіазапит для вузьких екранів уже правив цьому
	 * рядку `gap` — а `gap` без flex не робить нічого. Тобто правило існувало для
	 * розкладки, якої не було, і саме це показувало, що обидва рядки мали бути
	 * одним правилом із самого початку.
	 *
	 * Проміжок ПЛИННИЙ, а не двоступеневий: доти вузькі екрани отримували
	 * `--space-xs` через `@media (max-width: 480px)`, і той медіазапит зник разом
	 * із цим рядком. `clamp` дає те саме на обох краях (4px на телефоні, 8px на
	 * широкому), але без стрибка на 481-му пікселі.
	 */
	.slots-row,
	.source-panel__cards {
		display: flex;
		gap: clamp(var(--space-xs), 1.5vw, var(--space-sm));
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
		border: var(--slot-border) dashed
			color-mix(in srgb, var(--color-text-on-panel), transparent 70%);
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
	/*
	 * ПІДПИС СЛОТА — ВКАЗІВКА, А НЕ ВОДЯНИЙ ЗНАК, тож приглушувати його не можна.
	 *
	 * Тут стояло `opacity: 0.5`, і воно давало 2.44:1 при потрібних 4.5 (заміряно
	 * `tests/contrast-runtime.spec.ts`, усі чотири теми). А текст цей каже, ЩО
	 * саме кладуть у порожній слот — «найменше», «середнє», «найбільше»: не
	 * оздоба, а єдина підказка про правило гри на самій дошці.
	 *
	 * Ієрархія лишається за кеглем, накресленням і великими літерами: `xs`, жирний,
	 * uppercase. Прозорість із цього набору просто зайва — вона єдина коштувала
	 * читабельності.
	 */
	.game-container__label {
		grid-area: 1 / 1;
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-bold);
		color: var(--color-text);
		text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.1);
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
		/*
		 * КАРТКА НЕ МАЄ ПРАВА СТАТИ ШИРШОЮ ЗА СВІЙ СЛОТ, і тримає це саме цей
		 * рядок, а не скрипт.
		 *
		 * Картка — елемент сітки, а елемент сітки типово не може стати вужчим за
		 * свій `min-content`. Для нерозривної назви (`Reuzenmiereneter`,
		 * `Stachelschwein`) цей мінімум і є ширина слова — заміряно на скріншотах
		 * автора: слот 110px, картка в ньому 118.78px. Картка визирала з-під рамки
		 * і штовхала сусідів у рядку.
		 *
		 * Пара до цього рядка — `overflow: hidden` на `.game-card__name-text`:
		 * коробка з прихованим переповненням має нульовий внесок у мінімальну
		 * ширину, тож текст більше нічого не розсуває. Разом вони дають гарантію
		 * БЕЗ JS: якщо `fitLabel` не виконається, картка все одно лишиться в межах
		 * слота, просто підпис буде обрізаний.
		 */
		min-width: 0;
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
		font-weight: var(--font-weight-bold);
		/*
		 * `--color-text`, а не `--color-text-on-panel`: тло тут — `--color-bg-card`
		 * самої картки, не панель. Білим було 3.88:1 у light-green і 3.00:1 у
		 * winter при потрібних 4.5.
		 *
		 * Одного цього рядка не хватило: на тодішньому `#598f3a` AA не давав ЖОДЕН
		 * колір теми, тож разом із ним висвітлено сам токен (див. `themes/dark.css`).
		 * Тепер 5.04:1 у light-green і 4.68:1 у winter.
		 */
		color: var(--color-text);
		/* Облямівка кольором тла — див. те саме міркування в `.source-panel__title`. */
		text-shadow: 1px 1px 2px color-mix(in srgb, var(--color-bg-card), transparent 20%);
		text-align: center;
		width: 100%;
		line-height: 1.2;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
	}
	/*
	 * Тут живе і розмір підпису, і вся гарантія «картка не росте».
	 *
	 * `--label-scale` ставить `fitLabel` інлайновим стилем, і лише тоді, коли
	 * текст справді не вміщається. Типове значення `1` означає «не чіпали»:
	 * назва, яка вміщалася, лишається того самого кегля, що й раніше. Це вимога,
	 * а не оптимізація — інакше картки в одному рядку мали б різний розмір тексту
	 * і це читалося б як дефект.
	 *
	 * `overflow: hidden` тут не для краси: він робить внесок цієї коробки в
	 * мінімальну ширину нульовим (автоматичний мінімум скрол-контейнера — нуль).
	 * Саме тому текст більше не розсуває картку навіть без скрипта.
	 */
	.game-card__name-text {
		max-width: 100%;
		font-size: calc(var(--font-size-md) * var(--label-scale, 1));
		overflow: hidden;
		text-overflow: ellipsis;
		/*
		 * Три змінні — це СТАН ПЕРЕНОСУ, і типові значення означають «в один
		 * рядок». Перемикає їх `fitLabel` інлайновим стилем, і лише тоді, коли
		 * навіть на дні масштабу текст не вміщається в рядок.
		 *
		 * Чому змінними, а не окремим правилом під атрибут: атрибут ставить лише
		 * скрипт, тож компілятор Svelte такого селектора не бачить і викидає
		 * «Unused CSS selector». Лікується це або `:global()` — виходом зі скоупу
		 * компонента заради власного стану, — або цим. Плюс інлайнові стилі копіює
		 * `cloneNode`, тож клон під пальцем несе стан переносу з собою.
		 *
		 * Обрізане «Reuzenmierenet…» у грі, де тварину треба впізнати за назвою,
		 * гірше за дрібний шрифт у два рядки, а місце під другий рядок є: підпис має
		 * `flex: 1` у картці з фіксованим співвідношенням сторін.
		 *
		 * `anywhere` — гарантія на нерозривних словах; `hyphens: auto` ставить
		 * перенос по складах у німецькій і нідерландській, а мову бере з
		 * `<html lang>`, який виставляє маршрут.
		 */
		white-space: var(--label-wrap, nowrap);
		overflow-wrap: var(--label-break, normal);
		hyphens: var(--label-hyphens, manual);
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
		/* 2.71:1 (light-green) і 2.29:1 (winter) білим; із теми — 4.88:1 і 5.98:1. */
		color: var(--color-text-on-panel);
		/*
		 * Тінь — кольором ТЛА, а не чорним.
		 *
		 * Сенс тіні тут — облямівка, що відділяє текст від панелі. Чорна працює
		 * лише поки текст світлий; під темним текстом на світлій панелі вона стає
		 * плямою, яка з'їдає ту саму читабельність. Колір тла перевертається
		 * разом із темою сам.
		 */
		text-shadow: 1px 1px 2px color-mix(in srgb, var(--color-bg-panel-dark), transparent 50%);
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
		.btn-check {
			padding: var(--space-md) 3rem;
		}
	}
	.source-panel-wrapper,
	.results-zone-wrapper {
		grid-area: stack;
		width: 100%;
	}
</style>
