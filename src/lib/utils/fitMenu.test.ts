import { describe, expect, it, beforeEach } from 'vitest';
import { fitMenu } from './menuColumns';

/**
 * ПАНЕЛЬ ВИБОРУ КРАЇНИ МУСИТЬ ВИХОДИТИ З КАРТКИ, у якій стоїть кнопка.
 *
 * ## Що ловить цей файл
 *
 * Скарга автора зі знімком: панель на сторінці акаунта лежить ПІД картками
 * «Приватність», «Мої підписки» й «Таблиця лідерів». Причина не в числі
 * `z-index`, а в тому, що його ні з чим не порівнюють: глобальний `.text-panel`
 * має `backdrop-filter`, а це власний контекст накладання — і 9500 панелі
 * змагається лише з сусідами всередині тієї самої картки, тоді як картки
 * малюються в порядку документа, кожна поверх попередньої ЦІЛКОМ.
 *
 * Заміряно в браузері на живій панелі: у точці перетину (648, 490)
 * `elementsFromPoint` віддавав `SECTION.text-panel` першим, а кнопку країни в
 * панелі — другою. Після переїзду панелі в `<body>` у тій самій точці першою йде
 * кнопка країни.
 *
 * Тут перевіряється те, що з цього можна перевірити без браузера: сам переїзд,
 * координати від кнопки й те, що фокус його переживає. Розкладку колонок і
 * клавіатуру перевіряє `tests/country-menu.spec.ts`.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати
 * `document.body.appendChild(node)` — червоніє «панель переїжджає в body»;
 * прибрати відновлення фокуса — червоніє «фокус переживає переїзд».
 */

/** Кнопка з ЗАМІРЯНИМ прямокутником: jsdom сам віддає нулі для всього. */
function anchorAt(box: { left: number; bottom: number; width: number }) {
	const button = document.createElement('button');
	button.getBoundingClientRect = () =>
		({ left: box.left, right: box.left + box.width, top: box.bottom - 44, bottom: box.bottom, width: box.width, height: 44, x: box.left, y: box.bottom - 44, toJSON: () => ({}) }) as DOMRect;
	return button;
}

/** Картка з `backdrop-filter`, кнопкою й панеллю всередині — як на сторінці акаунта. */
function card() {
	const panel = document.createElement('section');
	const menu = document.createElement('div');
	const search = document.createElement('input');
	const button = anchorAt({ left: 480, bottom: 227, width: 352 });
	menu.appendChild(search);
	panel.append(button, menu);
	document.body.appendChild(panel);
	return { panel, menu, search, button };
}

describe('fitMenu', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	it('панель переїжджає в body', () => {
		const { panel, menu, button } = card();

		const stop = fitMenu(menu, button);

		expect(menu.parentElement, 'у картці панель нічим не підняти над сусідніми картками').toBe(
			document.body
		);
		expect(panel.contains(menu), 'панель не мусить лишатися в картці').toBe(false);
		stop();
	});

	it('стає під кнопкою, за її заміром', () => {
		const { menu, button } = card();

		const stop = fitMenu(menu, button);

		// 227 (низ кнопки) + 6 (проміжок) = 233; ліва межа збігається з кнопкою.
		expect(menu.style.top).toBe('233px');
		expect(menu.style.left).toBe('480px');
		expect(
			menu.style.getPropertyValue('--menu-least'),
			'панель не вужча за кнопку — доти це робив `min-width: 100%`'
		).toBe('352px');
		stop();
	});

	/**
	 * Перенесення вузла — це виймання з дерева, і браузер знімає фокус із усього,
	 * що було всередині. Без відновлення панель, відкрита кнопкою, лишалася б без
	 * клавіатури: ні `Escape`, ні стрілок.
	 */
	it('фокус переживає переїзд', () => {
		const { menu, search, button } = card();
		search.focus();
		expect(document.activeElement).toBe(search);

		const stop = fitMenu(menu, button);

		expect(document.activeElement, 'поле пошуку мусить лишитися з фокусом').toBe(search);
		stop();
	});

	it('прибирання забирає панель зі сторінки', () => {
		const { menu, button } = card();

		fitMenu(menu, button)();

		expect(menu.parentElement, 'закрита панель не мусить лишатися в body').toBeNull();
	});

	it('після прибирання прокрутка панель не рухає', () => {
		const { menu, button } = card();
		const stop = fitMenu(menu, button);
		stop();

		// Кнопка «поїхала», але слухачів уже немає — координата мусить лишитися.
		button.getBoundingClientRect = () =>
			({ left: 10, right: 362, top: 56, bottom: 100, width: 352, height: 44, x: 10, y: 56, toJSON: () => ({}) }) as DOMRect;
		window.dispatchEvent(new Event('scroll'));
		window.dispatchEvent(new Event('resize'));

		expect(menu.style.top).toBe('233px');
	});
});
