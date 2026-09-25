import { describe, expect, it, vi } from 'vitest';
import { roomPlace } from './roomPlace';

/**
 * АДРЕСА КІМНАТИ — без браузера (аудит 2026-09-24). Доти цей обʼєкт стояв копією
 * на обох сторінках, і перевірити його не було чим: маршрут тест не бере.
 *
 * Зворотний експеримент: прибрати перевірку `browser` у `urlRoom` — червоніє
 * «на пререндері кімнати немає».
 */
describe('адреса кімнати', () => {
	const at = (href: string) => () => new URL(href);

	it('код — із `?room`, а без нього — порожньо', () => {
		const navigate = vi.fn(async () => {});
		expect(roomPlace(at('https://x.test/pairs/online/?room=42'), navigate, true).urlRoom()).toBe(
			'42'
		);
		expect(roomPlace(at('https://x.test/pairs/online/'), navigate, true).urlRoom()).toBe('');
	});

	it('на пререндері кімнати немає — адреси там не читаємо', () => {
		const navigate = vi.fn(async () => {});
		expect(roomPlace(at('https://x.test/pairs/online/?room=42'), navigate, false).urlRoom()).toBe(
			''
		);
	});

	it('вхід — КРОК в історії з кодом, вихід — крок без нього', async () => {
		const navigate = vi.fn(async () => {});
		const place = roomPlace(at('https://x.test/quiz/online/?room=7&x=1'), navigate, true);

		await place.remember('42');
		await place.exit();

		const [[entered, options], [left]] = navigate.mock.calls as unknown as [URL, object][];
		expect(entered.searchParams.get('room')).toBe('42');
		expect(entered.searchParams.get('x'), 'решта адреси лишається').toBe('1');
		expect(options).toEqual({ noScroll: true, keepFocus: true });
		expect(left.searchParams.has('room')).toBe(false);
	});

	it('на пререндері вхід адреси не чіпає', async () => {
		const navigate = vi.fn(async () => {});
		await roomPlace(at('https://x.test/pairs/online/'), navigate, false).remember('42');
		expect(navigate).not.toHaveBeenCalled();
	});
});
