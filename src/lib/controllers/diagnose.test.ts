import { afterEach, describe, expect, it, vi } from 'vitest';
import { logService } from '$lib/services/logService.svelte';
import { diagnose, logFailure, PROBE_WAIT_MS, type ProblemProbe } from './diagnose';

/**
 * ДІАГНОЗ ЗБОЮ — звідки факти й куди запис (прохання автора 2026-09-27).
 *
 * Зворотні експерименти (прогнано): звіряти правила на будь-який збій — червоніє «не
 * відмова — правила не звіряються»; прибрати межу часу — «звірка, що мовчить»; писати
 * `error` на все — «лише дефект коду червоний».
 */

const DENIED = new Error('PERMISSION_DENIED: Permission denied');

function probe(over: Partial<ProblemProbe> = {}): ProblemProbe {
	return {
		online: () => true,
		rules: vi.fn(async () => 'stale' as const),
		newBuild: vi.fn(async () => false),
		deployed: () => false,
		emulator: () => false,
		...over
	};
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('діагноз збою', () => {
	it('відмова правил — звірка штампа; локальна збірка — «правила не викладені»', async () => {
		const facts = probe();
		const result = await diagnose(DENIED, facts);
		expect(facts.rules).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			problem: 'rules',
			rules: 'stale',
			newBuild: false,
			deployed: false,
			online: true,
			emulator: false
		});
	});

	it('не відмова — правила не звіряються: звірка вимагає входу, а його могло й не бути', async () => {
		const facts = probe();
		const result = await diagnose(
			new Error('Firebase: Error (auth/network-request-failed).'),
			facts
		);
		expect(facts.rules).not.toHaveBeenCalled();
		expect(result.problem).toBe('offline');
		expect(result.rules).toBeNull();
	});

	it('звірка, що мовчить, не тримає людину: за межею часу — «не знаю»', async () => {
		vi.useFakeTimers();
		const facts = probe({
			rules: () => new Promise(() => {}),
			newBuild: () => new Promise(() => {})
		});
		const pending = diagnose(DENIED, facts);
		await vi.advanceTimersByTimeAsync(PROBE_WAIT_MS);
		const result = await pending;
		expect(result.rules).toBe('unknown');
		expect(result.newBuild).toBe(false);
		expect(result.problem).toBe('offline');
	});

	it('звірка, що впала, — теж «не знаю», а не необроблена відмова', async () => {
		const facts = probe({
			rules: async () => Promise.reject(new Error('boom')),
			newBuild: async () => Promise.reject(new Error('boom'))
		});
		expect((await diagnose(DENIED, facts)).rules).toBe('unknown');
	});
});

describe('збій у журналі', () => {
	it('лише дефект коду червоний і лише з ним стек; решта — попередження', () => {
		const error = vi.spyOn(logService, 'error');
		const warn = vi.spyOn(logService, 'warn');
		const facts = {
			rules: 'fresh' as const,
			newBuild: false,
			deployed: true,
			online: true,
			emulator: false
		};
		logFailure('auto search failed', DENIED, { ...facts, problem: 'code' }, { step: 'list' });
		expect(error).toHaveBeenCalledWith(
			'network',
			'auto search failed',
			expect.objectContaining({ step: 'list', problem: 'code', reason: String(DENIED) })
		);
		expect(error.mock.calls[0][2]).toHaveProperty('stack');

		logFailure('auto search failed', DENIED, { ...facts, problem: 'rules' }, { step: 'list' });
		expect(error).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(
			'network',
			'auto search failed',
			expect.objectContaining({ problem: 'rules', rules: 'fresh' })
		);
		expect(warn.mock.calls[0][2]).not.toHaveProperty('stack');
	});
});
