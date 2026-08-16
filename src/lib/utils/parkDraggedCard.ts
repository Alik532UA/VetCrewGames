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

	const rect = el.getBoundingClientRect();

	/*
	 * Сторінка гри може бути зменшена (`zoom`, див. `fitToViewport`), і тоді
	 * пікселі бувають двох різних видів. `getBoundingClientRect()` і
	 * координати вказівника — ЕКРАННІ; `offsetWidth` і те, що ми запишемо в
	 * `translate3d`, — ВЛАСНІ пікселі елемента. Змішати їх означає промахнутися
	 * рівно на коефіцієнт зуму: при 0.8 картка стрибне на чверть своєї ширини
	 * убік від пальця.
	 *
	 * Тому спершу дізнаємося курс: скільки екранних пікселів в одному власному.
	 */
	const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;

	// Точку хапання знає лише дотик — і знає її в ЕКРАННИХ пікселях
	// (`touch.clientX - rect.left`). У миші її немає, і тоді картка стає
	// серединою під курсором.
	const ox = offsetX ?? rect.width / 2;
	const oy = offsetY ?? rect.height / 2;

	el.style.setProperty(
		'transform',
		`translate3d(${(clientX - ox - rect.left) / scale}px, ${(clientY - oy - rect.top) / scale}px, 0)`,
		'important'
	);
	el.style.setProperty('z-index', '9999', 'important');
}
