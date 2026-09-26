import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sessionStore } from '$lib/services/storage';
import { chunkMissing, reloadOnce } from './staleBuild';

/**
 * ЗАСТАРІЛА ЗБІРКА: РОЗПІЗНАТИ Й ПЕРЕЗАВАНТАЖИТИ РАЗ (аудит 2026-09-26).
 *
 * Зворотні експерименти: прибрати будь-яке з трьох формулювань — червоніє перший;
 * не памʼятати адресу — «вдруге ту саму адресу не вантажить».
 */
describe('шматка збірки немає', () => {
	it('розпізнається всіма трьома браузерами', () => {
		// Chromium, Firefox, Safari — кожен своїми словами.
		expect(
			chunkMissing(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))
		).toBe(true);
		expect(chunkMissing(new TypeError('error loading dynamically imported module: x'))).toBe(true);
		expect(chunkMissing(new TypeError('Importing a module script failed.'))).toBe(true);
	});

	it('звичайна помилка — не вона', () => {
		expect(chunkMissing(new Error('PERMISSION_DENIED: Permission denied'))).toBe(false);
		expect(chunkMissing('room-full')).toBe(false);
	});
});

describe('перезавантаження раз на адресу', () => {
	const real = window.location;
	let visited: string[];

	beforeEach(() => {
		sessionStore.clear();
		visited = [];
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: {
				get href() {
					return visited.at(-1) ?? 'http://localhost/';
				},
				set href(next: string) {
					visited.push(next);
				}
			}
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'location', { configurable: true, value: real });
	});

	it('перша спроба вантажить адресу', () => {
		expect(reloadOnce('http://localhost/pairs/online/')).toBe(true);
		expect(visited).toEqual(['http://localhost/pairs/online/']);
	});

	it('вдруге ту саму адресу не вантажить: інакше зламана збірка крутила б цикл', () => {
		reloadOnce('http://localhost/pairs/online/');
		expect(reloadOnce('http://localhost/pairs/online/')).toBe(false);
		expect(visited).toEqual(['http://localhost/pairs/online/']);
	});

	it('інша адреса має свою спробу', () => {
		reloadOnce('http://localhost/pairs/online/');
		expect(reloadOnce('http://localhost/quiz/online/')).toBe(true);
	});
});
