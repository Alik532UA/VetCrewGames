/**
 * Вимірювання прокрутника для власної смуги (SCROLLBAR-v8 § 3).
 *
 * Винесено з компонента не заради розміру, а тому що це окрема річ: смузі
 * потрібні чотири числа й повідомлення «вони змінилися», і жодне з цього не
 * стосується малювання.
 */

export interface ScrollMetrics {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
	/** Верх прокрутника у вікні: смуга накриває його, а не вікно. */
	trackTop: number;
}

export function readMetrics(el: HTMLElement): ScrollMetrics {
	return {
		scrollTop: el.scrollTop,
		// Одиниця, а не нуль: цими числами ділять.
		scrollHeight: Math.max(el.scrollHeight, 1),
		clientHeight: Math.max(el.clientHeight, 1),
		trackTop: el.getBoundingClientRect().top
	};
}

/**
 * Стежити за всім, від чого міняються ці числа. Повертає прибирання.
 *
 * `ResizeObserver` на самому прокрутнику ловить лише зміну ЙОГО коробки —
 * вікно, поворот екрана. Висота ВМІСТУ росте інакше: довантажується
 * зображення, розгортається розбір відповіді. Його коробка при цьому та сама,
 * і смуга лишалася б із застарілим повзунком.
 *
 * Тому спостерігаємо ще й за дітьми, а за списком дітей — мутаціями:
 * повторне `observe` того самого елемента нічого не коштує, тож переспостерігати
 * весь список простіше й надійніше, ніж вести діф.
 */
export function watchScroller(el: HTMLElement, onChange: () => void): () => void {
	const onScroll = () => onChange();
	el.addEventListener('scroll', onScroll, { passive: true });

	const resize = new ResizeObserver(onChange);
	resize.observe(el);
	const observeChildren = () => {
		for (const child of el.children) resize.observe(child);
	};
	observeChildren();

	const mutations = new MutationObserver(() => {
		observeChildren();
		onChange();
	});
	mutations.observe(el, { childList: true });

	return () => {
		el.removeEventListener('scroll', onScroll);
		resize.disconnect();
		mutations.disconnect();
	};
}
