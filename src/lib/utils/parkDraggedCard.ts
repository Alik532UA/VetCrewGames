/**
 * Поставити картку рівно туди, де її відпустили, — ДО того як Svelte перемалює
 * список.
 *
 * Без цього виходить ривок: між «відпустив» і «перемалював» картка на мить
 * повертається у свою стару клітинку, і політ у нову починається звідти, а не
 * з-під курсора. Око читає це як «схибив і перетягнув удруге».
 *
 * `!important` тут не про перемогу над чужим CSS, а про перемогу над власним:
 * у картки є `transition` на `transform`, і без зняття вона поїхала б у
 * поставлену позицію плавно — тобто саме тим ривком, який ми прибираємо.
 *
 * Далі позицію підхоплює crossfade: він знімає `getBoundingClientRect()` уже з
 * цього місця (див. `utils/transitions.ts`).
 */
export function parkDraggedCard(
	animalId: number | string,
	clientX: number,
	clientY: number,
	offsetX?: number,
	offsetY?: number
): void {
	const el = document.querySelector<HTMLElement>(`[data-drag-animal="${animalId}"]`);
	if (!el) return;

	el.style.setProperty('transition', 'none', 'important');
	el.style.setProperty('transform', 'none', 'important');

	// Точку хапання знає лише дотик: у миші її немає, і тоді картка стає
	// серединою під курсором.
	const rect = el.getBoundingClientRect();
	const ox = offsetX ?? el.offsetWidth / 2;
	const oy = offsetY ?? el.offsetHeight / 2;

	el.style.setProperty(
		'transform',
		`translate3d(${clientX - ox - rect.left}px, ${clientY - oy - rect.top}px, 0)`,
		'important'
	);
	el.style.setProperty('z-index', '9999', 'important');
}
