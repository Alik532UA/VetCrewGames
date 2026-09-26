// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * ЗОНД ПРАВИЛ У CI — ВСУХУ, БЕЗ ЖОДНОГО ЗАПИТУ (аудит 2026-09-26).
 *
 * `scripts/check-rules-live.mjs` питає живу базу, чи діє редакція правил із git, і
 * кожна його спроба — новий анонімний обліковий запис Firebase. Доти вони
 * лишалися назавжди, по одному-чотири на викладку. Тут зонд іде окремим процесом,
 * а `fetch` у ньому підставний: мережі немає зовсім, будь-який незнайомий запит
 * падає.
 *
 * Зворотні експерименти: прибрати `finally` з видаленням — червоніють усі три;
 * видаляти чужим токеном — перший.
 */
const sandbox = mkdtempSync(join(tmpdir(), 'rules-probe-'));
const STUB = join(sandbox, 'stub.mjs');
writeFileSync(
	STUB,
	`
const scenario = process.env.PROBE_SCENARIO;
let signUps = 0;
globalThis.fetch = async (url, init = {}) => {
	const where = String(url);
	const reply = (body, status = 200) => ({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body)
	});
	let answer;
	if (where.includes('accounts:signUp')) {
		signUps += 1;
		if (scenario === 'flaky' && signUps === 1) {
			console.log('CALL ' + JSON.stringify({ kind: 'signUp', failed: true }));
			throw new Error('мережа впала');
		}
		answer = reply({ idToken: 'token-' + signUps });
		console.log('CALL ' + JSON.stringify({ kind: 'signUp', token: 'token-' + signUps }));
	} else if (where.includes('accounts:delete')) {
		const token = JSON.parse(init.body).idToken;
		answer = reply({});
		console.log('CALL ' + JSON.stringify({ kind: 'delete', token }));
	} else if (where.includes('__rulesVersion/')) {
		const bogus = where.includes('__rulesVersion/000000000000');
		answer = reply(null, bogus || scenario === 'stale' ? 401 : 200);
		console.log('CALL ' + JSON.stringify({ kind: 'probe', token: /auth=([^&]+)/.exec(where)?.[1] }));
	} else {
		throw new Error('незнайомий запит: ' + where);
	}
	return answer;
};
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, _ms, ...args) => realSetTimeout(fn, 0, ...args);
`
);

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

type Call = { kind: 'signUp' | 'delete' | 'probe'; token?: string; failed?: boolean };

function probe(scenario: 'fresh' | 'flaky' | 'stale'): { code: number; calls: Call[] } {
	let out: string;
	let code = 0;
	try {
		out = execFileSync(
			'node',
			['--import', pathToFileURL(STUB).href, 'scripts/check-rules-live.mjs'],
			{
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, PROBE_SCENARIO: scenario }
			}
		);
	} catch (error) {
		const failure = error as { status?: number; stdout?: string };
		code = failure.status ?? 1;
		out = failure.stdout ?? '';
	}
	const calls = out
		.split('\n')
		.filter((line) => line.startsWith('CALL '))
		.map((line) => JSON.parse(line.slice('CALL '.length)) as Call);
	return { code, calls };
}

const created = (calls: Call[]) =>
	calls.filter((call) => call.kind === 'signUp' && !call.failed).map((call) => call.token);
const deleted = (calls: Call[]) =>
	calls.filter((call) => call.kind === 'delete').map((call) => call.token);

describe('зонд правил прибирає за собою', () => {
	it('перевірка жива: свіжі правила — код 0, і анонім прибраний своїм же токеном', () => {
		const { code, calls } = probe('fresh');
		expect(code).toBe(0);
		expect(created(calls), 'перевірка жива: вхід був').toEqual(['token-1']);
		expect(deleted(calls), 'анонім зонда лишився назавжди').toEqual(['token-1']);
	});

	it('невдалий вхід прибирати нічого, повтор прибирає свого', () => {
		const { code, calls } = probe('flaky');
		expect(code).toBe(0);
		expect(deleted(calls)).toEqual(created(calls));
	});

	it('відсталі правила — код 1, і всі чотири аноніми повторів прибрані', () => {
		const { code, calls } = probe('stale');
		expect(code).toBe(1);
		expect(created(calls)).toHaveLength(4);
		expect(deleted(calls)).toEqual(created(calls));
	});
});
