import { describe, expect, it } from 'vitest';
import { deniedDeep, netProblem, shortStack, type ProblemFacts } from './netProblem';

/**
 * ЩО САМЕ ЗЛАМАЛОСЯ — таблиця причин (прохання автора 2026-09-27).
 *
 * Головний випадок — той, що автор і спіймав: локальна збірка, правила `seek` ще не
 * викладені, база відмовляє на кожен запит. Доти він чув «спробуйте ще раз»; тепер —
 * `rules`, «нові правила ще не опубліковані», і повтор не пропонується.
 *
 * Зворотні експерименти (прогнано): не зважати на `deployed` — червоніє «стара збірка з
 * Pages…»; не дивитися під `cause` — «“код зайнятий”, за яким стоїть відмова»; вважати
 * відмову за звірених правил відмовою правил — «правила ті самі».
 */

const DENIED = new Error('PERMISSION_DENIED: Permission denied');

const facts = (over: Partial<ProblemFacts> = {}): ProblemFacts => ({
	error: DENIED,
	online: true,
	rules: 'stale',
	newBuild: false,
	deployed: false,
	...over
});

describe('причина збою', () => {
	it('локальна збірка, у базі інша редакція — нових правил ще не виклали (випадок автора)', () => {
		expect(netProblem(facts())).toBe('rules');
	});

	it('стара збірка з Pages, у базі інша редакція — гру саме оновлюють, а не «правила не викладені»', () => {
		expect(netProblem(facts({ deployed: true }))).toBe('mismatch');
	});

	it('правила ті самі, а база відмовляє — це код, і повтор його не виправить', () => {
		expect(netProblem(facts({ rules: 'fresh' }))).toBe('code');
		expect(netProblem(facts({ rules: 'fresh', deployed: true }))).toBe('code');
	});

	it('нова збірка на сервері чи відсутній шматок — оновити сторінку, що б не казали правила', () => {
		expect(netProblem(facts({ newBuild: true, rules: 'fresh' }))).toBe('reload');
		const chunk = new TypeError('Failed to fetch dynamically imported module: /_app/x.js');
		expect(netProblem(facts({ error: chunk, rules: null }))).toBe('reload');
	});

	it('немає мережі — повтор і є ліки: і за `navigator.onLine`, і за текстом SDK', () => {
		expect(netProblem(facts({ online: false }))).toBe('offline');
		const auth = new Error('Firebase: Error (auth/network-request-failed).');
		expect(netProblem(facts({ error: auth, rules: null }))).toBe('offline');
		expect(netProblem(facts({ error: new TypeError('Load failed'), rules: null }))).toBe('offline');
	});

	it('відмова була, а звірити правила не вдалося — звʼязок, а не правила', () => {
		expect(netProblem(facts({ rules: 'unknown' }))).toBe('offline');
	});

	it('«код зайнятий», за яким стоїть відмова правил, — відмова правил', () => {
		const taken = new Error('room-code-taken', { cause: DENIED });
		expect(deniedDeep(taken)).toBe(true);
		expect(netProblem(facts({ error: taken }))).toBe('rules');
	});

	it('виняток, якого не мало бути, — код', () => {
		const bug = new TypeError("Cannot read properties of null (reading 'code')");
		expect(netProblem(facts({ error: bug, rules: null }))).toBe('code');
	});
});

describe('стек для журналу', () => {
	it('кадри, а не рядки: Chromium із текстом помилки згори, Firefox — без нього', () => {
		const chromium = Object.assign(new Error('boom'), {
			stack:
				'Error: boom\n    at start (autoSearch.svelte.ts:147:9)\n    at onclick (SearchBlock.svelte:68:1)'
		});
		expect(shortStack(chromium)).toBe(
			'at start (autoSearch.svelte.ts:147:9) | at onclick (SearchBlock.svelte:68:1)'
		);
		const firefox = Object.assign(new Error('boom'), {
			stack: 'start@autoSearch.svelte.ts:147:9\nonclick@SearchBlock.svelte:68:1'
		});
		expect(shortStack(firefox)).toBe(
			'start@autoSearch.svelte.ts:147:9 | onclick@SearchBlock.svelte:68:1'
		);
		expect(shortStack('не помилка')).toBeUndefined();
	});
});
