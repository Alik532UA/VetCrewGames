import { describe, expect, it } from 'vitest';
import { ROOM_BEAT_MS, ROOM_DEAD_MS, ROOM_IDLE_MS, roomLife } from './roomLife';

/**
 * Три стани кімнати — і межі між ними.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): прибрати перевірку
 * `aliveAt === undefined` — червоніє «кімната зі старішої збірки лишається
 * видимою»; поміняти `>` на `>=` — червоніє випадок рівно на межі.
 */

const NOW = 1_800_000_000_000;

describe('життя кімнати', () => {
	it('перевірка жива: пороги ростуть, а удар частіший за них', () => {
		expect(ROOM_BEAT_MS).toBeLessThan(ROOM_IDLE_MS);
		expect(ROOM_IDLE_MS).toBeLessThan(ROOM_DEAD_MS);
	});

	it('щойно билася — жива', () => {
		expect(roomLife(NOW, NOW)).toBe('alive');
		expect(roomLife(NOW - ROOM_BEAT_MS, NOW)).toBe('alive');
	});

	/** Два пропущені удари: там уже нікого, але партію ще пам'ятають. */
	it('тиша понад дві хвилини — порожня, але свіжа', () => {
		expect(roomLife(NOW - ROOM_IDLE_MS, NOW)).toBe('alive');
		expect(roomLife(NOW - ROOM_IDLE_MS - 1, NOW)).toBe('idle');
		expect(roomLife(NOW - ROOM_DEAD_MS, NOW)).toBe('idle');
	});

	it('тиша понад п’ять хвилин — показувати нема чого', () => {
		expect(roomLife(NOW - ROOM_DEAD_MS - 1, NOW)).toBe('dead');
		expect(roomLife(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('dead');
	});

	/**
	 * Кімната зі старішої збірки позначки не має. Ховати її означало б покарати
	 * гравця за те, що застосунок оновився.
	 */
	it('без позначки — жива, а не мертва', () => {
		expect(roomLife(undefined, NOW)).toBe('alive');
	});

	/**
	 * Позначка з майбутнього можлива: серверний час і місцевий годинник
	 * розходяться. Відʼємна тиша — це «щойно», а не помилка.
	 */
	it('позначка з майбутнього не робить кімнату мертвою', () => {
		expect(roomLife(NOW + 10_000, NOW)).toBe('alive');
	});
});
