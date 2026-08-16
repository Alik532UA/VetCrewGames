/**
 * Дія: показати щойно розкритий блок, не змушуючи прокручувати вручну.
 *
 * У кожній грі відповідь ДОРОЩУЄ сторінку — під питанням з'являється розбір.
 * На невисокому вікні він опиняється нижче краю, і людина читає обрізане
 * речення, аж поки здогадається крутити. Тут це робиться саме тоді, коли блок
 * з'явився, і рівно настільки, наскільки треба.
 *
 * Три речі, без яких воно не працює:
 *
 *  1. **Блок РОЗКРИВАЄТЬСЯ, а не з'являється.** Усі розбори йдуть під
 *     `transition:slide` на 300–400мс, тож у мить монтування висота ще нульова.
 *     Прокрутка «до нього» тоді нікуди не веде. Тому не один виклик, а
 *     спостереження за розміром, поки він росте.
 *  2. **`block: 'nearest'`.** Крутити треба рівно доти, доки блок влізе, а не
 *     тягти його на верх екрана: питання над ним — це контекст відповіді, і
 *     викидати його з поля зору немає підстав. Якщо блок і так видно цілком,
 *     `nearest` не робить нічого.
 *  3. **Людина головніша.** Якщо в ці півсекунди вона крутить сама — ми
 *     відступаємо назавжди. Автопрокрутка, що перебиває, гірша за її
 *     відсутність.
 *
 * `scrollIntoView` сам знаходить найближчого предка з прокруткою, тож про
 * `.page-transition-wrapper` тут знати не треба.
 */

/** Скільки чекаємо тиші в розмірах, перш ніж крутити. Менше за кадр анімації. */
export const SETTLE_MS = 60;

/**
 * Стеля спостереження від монтування. Утричі більша за найдовший перехід у
 * проєкті (400мс): якщо за цей час блок не влігся, це вже не розкриття, а щось
 * інше — і воно не наша справа.
 */
export const WATCH_MS = 1200;

/**
 * Саме ці події, а не `scroll`: `scroll` шле й наша власна прокрутка, і дія
 * зупиняла б себе першим-таки рухом. Ці три надходять лише від людини.
 */
const USER_SCROLL = ['wheel', 'touchmove', 'keydown'] as const;

/**
 * @param enabled Читається один раз, при монтуванні, і `update` тут навмисно
 *   немає: у розкриття немає стану «то так, то ні». Параметр існує для випадку,
 *   коли той самий компонент показують кілька разів на екран, а крутити треба
 *   до одного — як три розбори в «Що їмо?», з яких нижній тільки один.
 */
export function revealScroll(node: HTMLElement, enabled: boolean = true) {
	if (!enabled || typeof ResizeObserver === 'undefined') return;

	const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let capTimer: ReturnType<typeof setTimeout> | null = null;
	let observer: ResizeObserver | null = null;

	function stop() {
		if (settleTimer) clearTimeout(settleTimer);
		if (capTimer) clearTimeout(capTimer);
		settleTimer = null;
		capTimer = null;
		observer?.disconnect();
		observer = null;
		for (const event of USER_SCROLL) window.removeEventListener(event, stop);
	}

	function schedule() {
		// `observer === null` означає, що нас уже спинили: або людина крутнула
		// сама, або вийшов час. Відкладений виклик після цього — це саме той
		// ривок, якого ми уникаємо.
		if (!observer) return;
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = setTimeout(() => {
			settleTimer = null;
			node.scrollIntoView({ block: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
		}, SETTLE_MS);
	}

	for (const event of USER_SCROLL) window.addEventListener(event, stop, { passive: true });
	observer = new ResizeObserver(schedule);
	observer.observe(node);
	capTimer = setTimeout(stop, WATCH_MS);

	// Перший виклик — для блоків, які з'являються без анімації: у них
	// спостерігач більше не спрацює, і чекати нема чого.
	schedule();

	return { destroy: stop };
}
