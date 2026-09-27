import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '$lib/services/storage';
import { chunkMissing, freshLoad, reloadOnce } from './staleBuild';

/**
 * ЗАСТАРІЛА ЗБІРКА: РОЗПІЗНАТИ Й ПЕРЕЗАВАНТАЖИТИ РАЗ (аудит 2026-09-26) — і СВІЖОЮ
 * сторінкою, а не з кешу браузера (2026-09-27).
 *
 * Зворотні експерименти: прибрати будь-яке з трьох формулювань — червоніє перший (а
 * «Unable to preload CSS» — «зниклий стиль»);
 * не памʼятати адресу — «вдруге ту саму адресу не вантажить»; прибрати `cache: 'reload'`
 * чи вантажити до перевірки — червоніє «спершу свіжа сторінка».
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

	it('і зниклий стиль лінивого шматка — його Vite відкидає своїми словами', () => {
		expect(
			chunkMissing(new Error('Unable to preload CSS for /VetCrewGames/_app/immutable/assets/7.css'))
		).toBe(true);
	});

	it('звичайна помилка — не вона', () => {
		expect(chunkMissing(new Error('PERMISSION_DENIED: Permission denied'))).toBe(false);
		expect(chunkMissing('room-full')).toBe(false);
	});
});

describe('перезавантаження раз на адресу', () => {
	const real = window.location;
	let visited: string[];
	/** Що бачив запит перед завантаженням: адреса, режим кешу й скільки адрес уже відвідано. */
	let fetched: Array<{ url: string; cache: RequestCache | undefined; visitedBefore: number }>;

	beforeEach(() => {
		sessionStore.clear();
		visited = [];
		fetched = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string, init?: RequestInit) => {
				fetched.push({ url, cache: init?.cache, visitedBefore: visited.length });
				return new Response('');
			})
		);
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
		vi.unstubAllGlobals();
	});

	it('перша спроба вантажить адресу', async () => {
		expect(reloadOnce('http://localhost/pairs/online/')).toBe(true);
		await vi.waitFor(() => expect(visited).toEqual(['http://localhost/pairs/online/']));
	});

	it('вдруге ту саму адресу не вантажить: інакше зламана збірка крутила б цикл', async () => {
		reloadOnce('http://localhost/pairs/online/');
		await vi.waitFor(() => expect(visited).toHaveLength(1));
		expect(reloadOnce('http://localhost/pairs/online/')).toBe(false);
		expect(visited).toEqual(['http://localhost/pairs/online/']);
	});

	/**
	 * Pages тримає HTML у кеші браузера десять хвилин, і звичайне завантаження адреси бере
	 * його звідти: одразу після деплою це стара сторінка з частинами, яких уже немає.
	 */
	it('спершу свіжа сторінка з мережі — у кеш, і лише тоді завантаження', async () => {
		await freshLoad('http://localhost/game-mythbusters/');

		expect(fetched).toEqual([
			{ url: 'http://localhost/game-mythbusters/', cache: 'reload', visitedBefore: 0 }
		]);
		expect(visited).toEqual(['http://localhost/game-mythbusters/']);
	});

	it('без мережі перевірка не вдається, а завантаження однаково йде', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('Failed to fetch');
			})
		);
		await freshLoad('http://localhost/');

		expect(visited).toEqual(['http://localhost/']);
	});

	it('інша адреса має свою спробу', () => {
		reloadOnce('http://localhost/pairs/online/');
		expect(reloadOnce('http://localhost/quiz/online/')).toBe(true);
	});
});
