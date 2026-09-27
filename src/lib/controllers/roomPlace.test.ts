import { describe, expect, it, vi } from 'vitest';
import { roomPlace } from './roomPlace';

/**
 * АДРЕСА КІМНАТИ — без браузера (аудит 2026-09-24). Доти цей обʼєкт стояв копією
 * на обох сторінках, і перевірити його не було чим: маршрут тест не бере.
 *
 * Зворотні експерименти: прибрати перевірку `browser` у `urlRoom` — червоніє
 * «на пререндері кімнати немає»; не ставити `move=1` у `elsewhere` — «кімната іншої гри».
 */
describe('адреса кімнати', () => {
	const at = (href: string) => () => new URL(href);
	const ROUTES = {
		hub: () => '/online/',
		game: (gameId: string) => (gameId === 'pairs' ? '/pairs/online/' : null)
	};
	const place = (href: string, navigate = vi.fn(async () => {}), browser = true) =>
		roomPlace(at(href), navigate, browser, ROUTES);

	it('код — із `?room`, а без нього — порожньо', () => {
		expect(place('https://x.test/pairs/online/?room=42').urlRoom()).toBe('42');
		expect(place('https://x.test/pairs/online/').urlRoom()).toBe('');
	});

	it('на пререндері кімнати немає — адреси там не читаємо', () => {
		const prerender = place('https://x.test/pairs/online/?room=42&create=friends', vi.fn(), false);
		expect(prerender.urlRoom()).toBe('');
		expect(prerender.creating()).toBeNull();
	});

	it('вхід — КРОК в історії з кодом, вихід — крок без нього', async () => {
		const navigate = vi.fn(async () => {});
		const room = place('https://x.test/quiz/online/?room=7&x=1', navigate);

		await room.remember('42');
		await room.exit();

		const [[entered, options], [left]] = navigate.mock.calls as unknown as [URL, object][];
		expect(entered.searchParams.get('room')).toBe('42');
		expect(entered.searchParams.get('x'), 'решта адреси лишається').toBe('1');
		expect(options).toEqual({ noScroll: true, keepFocus: true });
		expect(left.searchParams.has('room')).toBe(false);
	});

	it('вхід з адреси з наміром — ЗАМІНОЮ: «назад» не створює ще однієї кімнати', async () => {
		const navigate = vi.fn(async () => {});
		await place('https://x.test/pairs/online/?create=everyone', navigate).remember('42');
		await place('https://x.test/pairs/online/?from=7', navigate).remember('43');
		const calls = navigate.mock.calls as unknown as [URL, { replaceState?: boolean }][];
		expect(calls.map(([, options]) => options.replaceState)).toEqual([true, true]);
		expect(calls[0][0].searchParams.has('create'), 'намір відслужив').toBe(false);
	});

	it('на пререндері вхід адреси не чіпає', async () => {
		const navigate = vi.fn(async () => {});
		await place('https://x.test/pairs/online/', navigate, false).remember('42');
		expect(navigate).not.toHaveBeenCalled();
	});

	it('переїзд групи — з `?move=1`, а на пререндері адреси не читаємо', () => {
		expect(place('https://x.test/quiz/online/?room=7&move=1').moved()).toBe(true);
		expect(place('https://x.test/quiz/online/?room=7').moved()).toBe(false);
		expect(place('https://x.test/quiz/online/?room=7&move=1', vi.fn(), false).moved()).toBe(false);
	});

	it('двері: намір створити — із `?create`, вибір публічності — при `?from` без нього', () => {
		expect(place('https://x.test/pairs/online/?create=friends').creating()).toBe(true);
		expect(place('https://x.test/pairs/online/?create=everyone').creating()).toBe(false);
		expect(place('https://x.test/pairs/online/?create=hack').creating()).toBeNull();
		expect(place('https://x.test/pairs/online/?from=42').choosing()).toBe(true);
		expect(place('https://x.test/pairs/online/?from=42&create=friends').choosing()).toBe(false);
	});

	it('на хаб і нова кімната — ЗАМІНОЮ запису в історії', async () => {
		const navigate = vi.fn(async () => {});
		const door = place('https://x.test/pairs/online/?room=7&from=3', navigate);
		await door.hub();
		await door.recreate(true);
		const [[hub, hubOptions], [fresh, freshOptions]] = navigate.mock.calls as unknown as [
			URL,
			{ replaceState?: boolean }
		][];
		expect(hub.pathname).toBe('/online/');
		expect(hubOptions.replaceState).toBe(true);
		expect(fresh.searchParams.get('create')).toBe('friends');
		expect(fresh.searchParams.has('room'), 'кімната, яку нікому вести, лишається позаду').toBe(
			false
		);
		expect(freshOptions.replaceState).toBe(true);
	});

	it('кімната іншої гри — на її сторінку з тим самим кодом; невідомої — ні', () => {
		const navigate = vi.fn(async () => {});
		const door = place('https://x.test/quiz/online/?room=42', navigate);
		expect(door.elsewhere('pairs', '42')).toBe(true);
		const [[next]] = navigate.mock.calls as unknown as [URL][];
		expect(next.pathname).toBe('/pairs/online/');
		expect(next.searchParams.get('room')).toBe('42');
		expect(next.searchParams.get('move'), 'людина вже вирішила зайти').toBe('1');
		expect(door.elsewhere('chess', '42')).toBe(false);
	});
});
