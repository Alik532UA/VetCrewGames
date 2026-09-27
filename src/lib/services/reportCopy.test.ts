import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyLogReport, liveReport } from './reportCopy';
import { logService } from './logService.svelte';

/**
 * ЗВІТ У БУФЕР — один модуль на табло й панель збою (2026-09-27).
 *
 * Зворотний експеримент: повертати `null` і з гілки відмови — червоніє «відмова буфера».
 */

function clipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
	vi.restoreAllMocks();
	Reflect.deleteProperty(navigator, 'clipboard');
});

describe('звіт у буфер', () => {
	it('звіт несе шапку й журнал', () => {
		logService.info('ui', 'click', { target: 'online-search-btn' });
		const report = liveReport();
		expect(report).toMatch(/^--- REPORT from service badge ---/);
		expect(report).toContain('RULES: ');
		expect(report).toContain('"target":"online-search-btn"');
	});

	it('поклали — `null`, і в буфері саме звіт', async () => {
		const written: string[] = [];
		clipboard(async (text) => void written.push(text));
		expect(await copyLogReport()).toBeNull();
		expect(written[0]).toMatch(/^--- REPORT from service badge ---/);
	});

	it('відмова буфера — сам звіт назад, щоб показати його в полі, і лише попередження', async () => {
		clipboard(async () => Promise.reject(new DOMException('denied', 'NotAllowedError')));
		const warn = vi.spyOn(logService, 'warn');
		const error = vi.spyOn(logService, 'error');
		const report = await copyLogReport();
		expect(report).toMatch(/^--- REPORT from service badge ---/);
		expect(warn).toHaveBeenCalledWith('ui', 'Failed to copy logs', expect.any(Object));
		expect(error, 'відмова буфера — не збій').not.toHaveBeenCalled();
	});

	it('буфера немає зовсім (http у локальній мережі) — той самий запасний шлях', async () => {
		expect(await copyLogReport()).toMatch(/^--- REPORT from service badge ---/);
	});
});
