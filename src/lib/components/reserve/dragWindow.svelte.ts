/**
 * Вікна, які можна відсунути вбік.
 *
 * Панель заповідника завжди чимось накриває карту — а карта і є гра. Доти
 * єдиним виходом було закрити вікно, подивитися й відкрити знову; тепер його
 * можна просто відтягнути й тримати обидва перед очима.
 *
 * Положення живе ТУТ, у модульній таблиці, а не в самому вікні: вікно
 * створюється заново на кожне відкриття (`{#if panel}`), і разом із ним зникав би
 * і зсув. Одна таблиця на застосунок означає «закрив і відкрив — вікно там, де
 * поставив». У сховище вона не пише навмисно: вікно, забуте за краєм на чужому
 * екрані, інакше довелося б вирятовувати кодом.
 */

export interface Spot {
	x: number;
	y: number;
}

/**
 * Куди гравець відтягнув кожне вікно за цей сеанс. Ключ — імʼя вікна.
 *
 * Звичайний обʼєкт, а не `Map`: правило проєкту вимагає `SvelteMap` для
 * мутабельних мап — і має рацію там, де мапу ЧИТАЄ розмітка. Тут її не читає
 * ніхто: значення забирає імперативна дія в момент монтування вікна, тож
 * реактивність була б платою без покупки.
 */
const spots: Record<string, Spot> = {};

export const spotOf = (id: string): Spot | undefined => spots[id];

/**
 * Скільки вікна мусить лишитися на екрані.
 *
 * Без цієї межі вікно можна затягнути за край і більше не дістати: смуга
 * заголовка, за яку його тягнуть, опиниться поза вікном браузера.
 */
const KEEP_VISIBLE = 48;

export interface DragOptions {
	/** Імʼя вікна: під ним і запамʼятовується місце. */
	id: string;
	/** Селектор смуги, за яку тягнуть. Решта вікна лишається клікабельною. */
	handle: string;
}

/**
 * Дія Svelte: `use:dragWindow={{ id, handle }}`.
 *
 * Перший рух переводить вікно на явні `left`/`top`: доти воно могло стояти на
 * `bottom`, `right` чи `transform`, і змішувати їх із перетягуванням означало б
 * стрибок на першому ж пікселі.
 */
export function dragWindow(node: HTMLElement, options: DragOptions) {
	let current = options;

	const place = (x: number, y: number) => {
		const box = node.getBoundingClientRect();
		const left = Math.min(Math.max(KEEP_VISIBLE - box.width, x), window.innerWidth - KEEP_VISIBLE);
		const top = Math.min(Math.max(0, y), window.innerHeight - KEEP_VISIBLE);

		node.style.left = `${left}px`;
		node.style.top = `${top}px`;
		node.style.right = 'auto';
		node.style.bottom = 'auto';
		node.style.transform = 'none';
		spots[current.id] = { x: left, y: top };
	};

	// Місце з попереднього відкриття — ще до першого руху.
	const remembered = spots[current.id];
	if (remembered) place(remembered.x, remembered.y);

	let from: { x: number; y: number; left: number; top: number } | null = null;

	function onPointerDown(event: PointerEvent) {
		const target = event.target as Element | null;
		if (!target?.closest(current.handle)) return;
		// Кнопка в заголовку (закрити) лишається кнопкою, а не ручкою.
		if (target.closest('button')) return;

		const box = node.getBoundingClientRect();
		from = { x: event.clientX, y: event.clientY, left: box.left, top: box.top };
		/*
		 * Захоплення вказівника — зручність, а не умова: без нього перетягування
		 * зупиниться, щойно палець вийде за вікно. Але браузер має право відмовити
		 * (чужий `pointerId`, уже відпущений дотик), і падати через це не варто —
		 * рух після відмови все одно працює, просто в межах вікна.
		 */
		try {
			node.setPointerCapture(event.pointerId);
		} catch {
			// Немає чого захоплювати — тягнемо без захоплення.
		}
		event.preventDefault();
	}

	function onPointerMove(event: PointerEvent) {
		if (!from) return;
		place(from.left + (event.clientX - from.x), from.top + (event.clientY - from.y));
	}

	const onPointerUp = () => {
		from = null;
	};

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', onPointerUp);
	node.addEventListener('pointercancel', onPointerUp);

	return {
		update(next: DragOptions) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerUp);
			node.removeEventListener('pointercancel', onPointerUp);
		}
	};
}
