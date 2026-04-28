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
});
