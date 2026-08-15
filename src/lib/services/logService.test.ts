import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('$app/environment', () => ({
	browser: true,
	dev: false
}));

const sessionStoreMock = {
	get: vi.fn<(key: string) => string | null>(() => null),
	set: vi.fn<(key: string, value: string) => void>()
};

vi.mock('$lib/services/storage', () => ({
	sessionStore: sessionStoreMock
}));

// Re-import after mocks
const { logService } = await import('./logService.svelte');

describe('logService', () => {
	beforeEach(() => {
		logService.clear();
		sessionStoreMock.get.mockClear();
		sessionStoreMock.set.mockClear();
	});

	it('records info entries with timestamp and category', () => {
		logService.info('app', 'hello');
		const logs = logService.getLogs();
		expect(logs).toHaveLength(1);
		expect(logs[0].level).toBe('info');
		expect(logs[0].category).toBe('app');
		expect(logs[0].message).toBe('hello');
		expect(typeof logs[0].timestamp).toBe('string');
	});

	it('preserves structured data context on info/warn', () => {
		logService.warn('network', 'slow', { ms: 1200, url: '/api' });
		const [entry] = logService.getLogs();
		expect(entry.data).toEqual({ ms: 1200, url: '/api' });
	});

	it('increments errorCount only on error level', () => {
		expect(logService.errorCount).toBe(0);
		logService.info('ui', 'a');
		logService.warn('ui', 'b');
		expect(logService.errorCount).toBe(0);
		logService.error('ui', 'boom');
		logService.error('ui', 'boom2');
		expect(logService.errorCount).toBe(2);
	});

	it('clear() removes all logs and resets errorCount', () => {
		logService.error('app', 'x');
		logService.info('app', 'y');
		logService.clear();
		expect(logService.getLogs()).toHaveLength(0);
		expect(logService.errorCount).toBe(0);
	});

	it('persists logs to sessionStore on each addLog', () => {
		logService.info('app', 'persist me');
		expect(sessionStoreMock.set).toHaveBeenCalledWith('logs', expect.any(String));
		const stored = sessionStoreMock.set.mock.calls.at(-1)?.[1];
		expect(stored).toContain('persist me');
	});

	/**
	 * DEBUGGING-v8 § 1.5: у дзеркало йде ХВІСТ буфера. Складати туди всі 1000
	 * записів означає серіалізувати весь журнал на КОЖЕН лог — і впертися в
	 * квоту sessionStorage тим швидше, чим більше подій сталося.
	 */
	it('дзеркало у sessionStore обрізане, а не вся історія', () => {
		for (let i = 0; i < 150; i++) logService.info('app', `подія ${i}`);

		const stored = JSON.parse(sessionStoreMock.set.mock.calls.at(-1)?.[1] ?? '[]');
		expect(stored).toHaveLength(100);
		expect(stored.at(-1).message, 'останній запис має бути в дзеркалі').toBe('подія 149');
		expect(stored.at(0).message, 'найстаріші витісняються').toBe('подія 50');
		expect(logService.getLogs(), 'у памʼяті буфер лишається повним').toHaveLength(150);
	});

	/**
	 * DEBUGGING-v8 § 1.4 / SECURITY-v8 § 10, CRITICAL. Редакція живе в логері, а
	 * не на місцях виклику: достатньо одного забутого місця, щоб правило не
	 * працювало. Звіт із кнопки збору логів надсилають третій особі.
	 */
	it('редагує чутливі поля перед записом', () => {
		logService.error('network', 'request failed', {
			email: 'user@example.com',
			token: 'abc123',
			nested: { password: 'hunter2', status: 500 },
			list: [{ authorization: 'Bearer x' }],
			url: '/api/items'
		});

		const [entry] = logService.getLogs();
		expect(entry.data).toEqual({
			email: '«приховано»',
			token: '«приховано»',
			nested: { password: '«приховано»', status: 500 },
			list: [{ authorization: '«приховано»' }],
			url: '/api/items'
		});
	});

	it('циклічне посилання не зациклює логер', () => {
		const cyclic: Record<string, unknown> = { name: 'loop' };
		cyclic.self = cyclic;

		expect(() => logService.warn('app', 'cyclic', cyclic)).not.toThrow();
		expect(logService.getLogs()).toHaveLength(1);
	});
});
