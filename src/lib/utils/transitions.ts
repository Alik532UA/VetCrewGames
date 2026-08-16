import { cubicOut } from 'svelte/easing';

/**
 * Власні переходи, які не описати вбудованими.
 *
 * Обидва жили просто в тілі своїх сторінок — по 28 і 70 рядків серед ігрової
 * логіки, хоч ані той, ані той нічого про свою гру не знають. Тут вони
 * читаються як те, чим і є: чисті функції над вузлом і його стилями.
 */

/**
 * Виїзд із одночасним згортанням висоти.
 *
 * `slide` міняє висоту, `fly` — положення; тут потрібне і те, і те відразу, бо
 * блок мусить поїхати вбік І звільнити місце під собою. Два переходи на одному
 * вузлі Svelte не складає, тож це один власний.
 *
 * Розміри знімаються з `getComputedStyle` у момент СТВОРЕННЯ переходу: на той
 * час вузол ще в потоці й має справжню висоту. Пізніше її вже не спитати.
 */
export function flyAndSlide(
	node: HTMLElement,
	{ delay = 0, duration = 400, easing = cubicOut, y = 0 } = {}
) {
	const style = getComputedStyle(node);
	const targetOpacity = +style.opacity;
	const transform = style.transform === 'none' ? '' : style.transform;
	const height = parseFloat(style.height);
	const paddingTop = parseFloat(style.paddingTop);
	const paddingBottom = parseFloat(style.paddingBottom);

	return {
		delay,
		duration,
		easing,
		css: (t: number) => `
			transform: ${transform} translateY(${y * (1 - t)}px);
			opacity: ${targetOpacity * t};
			height: ${t * height}px;
			padding-top: ${t * paddingTop}px;
			padding-bottom: ${t * paddingBottom}px;
			overflow: hidden;
		`
	};
}

/**
 * Переліт картки з місця на місце — власний crossfade замість вбудованого.
 *
 * Вбудований `crossfade` уміє тільки пряму лінію. Тут при ОБМІНІ двох карток
 * потрібна дуга: дві картки, що летять назустріч по прямій, проходять одна крізь
 * одну, і рух читається як миготіння, а не як обмін. Дуга розводить їх у
 * різні боки — одна поверх, друга під низом.
 *
 * @param isSwapping Читається в момент створення переходу, не раніше: чи це
 *   обмін, стає відомо саме тоді. Тому геттер, а не значення.
 */
export function createCrossfade(isSwapping: () => boolean) {
	const toReceive = new Map<string | number, HTMLElement>();
	const toSend = new Map<string | number, HTMLElement>();

	function doCrossfade(fromNode: HTMLElement, node: HTMLElement, isSend: boolean) {
		const from = fromNode.getBoundingClientRect();
		const to = node.getBoundingClientRect();
		const dx = from.left - to.left;
		const dy = from.top - to.top;
		const style = getComputedStyle(node);
		const transform = style.transform === 'none' ? '' : style.transform;
		const opacity = +style.opacity;

		let arcX = 0;
		let arcY = 0;
		if (isSwapping()) {
			// Дуга йде впоперек напрямку руху: горизонтальний обмін розводиться по
			// вертикалі й навпаки. Знак протилежний у відправника й отримувача —
			// саме він і робить із двох прямих два різні шляхи.
			const horizontal = Math.abs(dx) >= Math.abs(dy);
			const sign = isSend ? 1 : -1;
			if (horizontal) arcY = sign * -30;
			else arcX = sign * 30;
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

	function transition(
		items: Map<string | number, HTMLElement>,
		counterparts: Map<string | number, HTMLElement>,
		isSend: boolean
	) {
		return (node: HTMLElement, params: { key: string | number }) => {
			items.set(params.key, node);
			return () => {
				const other = counterparts.get(params.key);
				if (other) {
					counterparts.delete(params.key);
					return doCrossfade(other, node, isSend);
				}

				// Пари немає: картка не летить, а зникає або з'являється на місці.
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

	return [transition(toSend, toReceive, true), transition(toReceive, toSend, false)] as const;
}
