/**
 * ПЕРЕТЯГУВАННЯ ПАЛЬЦЕМ — дія для того, що кладуть у зону (прохання автора 2026-09-29:
 * «Drag and Drop працює в „Кого більше?“ і не працює в „Що їмо?“»).
 *
 * HTML5 drag-and-drop на сенсорних екранах не працює зовсім: `draggable` і `ondragstart`
 * там мовчать. «Кого більше?» тому має власне перетягування пальцем, а «Що їмо?» мало лише
 * мишаче — і на телефоні страву можна було тільки торкнутися, а потім торкнутися зони.
 *
 * ## Як
 *
 * Палець зрушив далі за поріг — `onstart` бере те, що тягнуть, а копія їде за пальцем.
 * Відпустили — `ondrop` отримує зону під пальцем (найближчий `[data-drop-zone]`) або `null`.
 * Що робити з зоною, вирішує той, хто кличе: у «Що їмо?» це НАТИСК на неї — той самий шлях,
 * яким страву кладуть торканням, тож правил гри тут немає зовсім.
 *
 * Звичайне торкання лишається торканням: поки палець не зрушив за поріг, дія не робить
 * нічого, і клік приходить як завжди. Після перетягування клік гаситься (`preventDefault` на
 * `touchend`), інакше він узяв би ту саму річ удруге.
 *
 * Копію малює глобальний `.touch-drag-clone` (`global.css`): вона живе в `<body>`, де стилів
 * компонента-господаря вже немає; зону під пальцем — `.drop-zone--over`. Прокрутку сторінки
 * гасить `preventDefault` на `touchmove` — тому слухач не пасивний.
 */

/** Скільки пікселів пальцем — ще торкання, а не перетягування (як у «Кого більше?»). */
const THRESHOLD_PX = 8;

export interface TouchDragParams {
	/** Тягнути зараз не можна (раунд погодовано). */
	disabled?: boolean;
	/** Палець зрушив за поріг — узяти те, що тягнуть. */
	onstart: () => void;
	/** Відпустили над зоною — вона; не над зоною — `null`. */
	ondrop: (zone: HTMLElement | null) => void;
}

export function touchDrag(node: HTMLElement, params: TouchDragParams) {
	let current = params;
	let start: { x: number; y: number; dx: number; dy: number; w: number; h: number } | null = null;
	let clone: HTMLElement | null = null;
	let over: HTMLElement | null = null;

	const zoneAt = (x: number, y: number) =>
		(document.elementFromPoint(x, y)?.closest('[data-drop-zone]') as HTMLElement | null) ?? null;

	function follow(x: number, y: number) {
		if (!clone || !start) return;
		clone.style.setProperty(
			'transform',
			`translate3d(${x - start.dx}px, ${y - start.dy}px, 0) scale(1.1)`,
			'important'
		);
		const zone = zoneAt(x, y);
		if (zone === over) return;
		over?.classList.remove('drop-zone--over');
		zone?.classList.add('drop-zone--over');
		over = zone;
	}

	function onTouchStart(event: TouchEvent) {
		if (current.disabled || event.touches.length !== 1) return;
		const touch = event.touches[0];
		const rect = node.getBoundingClientRect();
		start = {
			x: touch.clientX,
			y: touch.clientY,
			dx: touch.clientX - rect.left,
			dy: touch.clientY - rect.top,
			w: rect.width,
			h: rect.height
		};
	}

	function onTouchMove(event: TouchEvent) {
		if (!start) return;
		const touch = event.touches[0];
		if (!clone) {
			const far =
				Math.abs(touch.clientX - start.x) >= THRESHOLD_PX ||
				Math.abs(touch.clientY - start.y) >= THRESHOLD_PX;
			if (!far) return;
			current.onstart();
			clone = node.cloneNode(true) as HTMLElement;
			clone.classList.add('touch-drag-clone');
			clone.removeAttribute('data-testid');
			clone.style.width = `${start.w}px`;
			clone.style.height = `${start.h}px`;
			document.body.appendChild(clone);
		}
		if (event.cancelable) event.preventDefault();
		follow(touch.clientX, touch.clientY);
	}

	/** Прибрати копію й підсвітку; `true` — це було перетягування, а не торкання. */
	function reset(): boolean {
		const dragged = clone !== null;
		start = null;
		over?.classList.remove('drop-zone--over');
		over = null;
		clone?.remove();
		clone = null;
		return dragged;
	}

	function onTouchEnd(event: TouchEvent) {
		const touch = event.changedTouches[0];
		if (!reset()) return;
		if (event.cancelable) event.preventDefault();
		current.ondrop(touch ? zoneAt(touch.clientX, touch.clientY) : null);
	}

	function onTouchCancel() {
		if (reset()) current.ondrop(null);
	}

	node.addEventListener('touchstart', onTouchStart, { passive: true });
	node.addEventListener('touchmove', onTouchMove, { passive: false });
	node.addEventListener('touchend', onTouchEnd);
	node.addEventListener('touchcancel', onTouchCancel);

	return {
		update(next: TouchDragParams) {
			current = next;
		},
		destroy() {
			reset();
			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);
		}
	};
}
