import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { ReloadAdvice, RULES_RECHECK_MS } = await import('./reloadAdvice.svelte');
const { logService } = await import('$lib/services/logService.svelte');

/**
 * ЧОМУ СТОРІНКУ ТРЕБА ОНОВИТИ (аудит 2026-09-26).
 *
 * Доти звірка правил була «раз на сторінку» і без обробки відмови: безневинний
 * відкинутий хід витрачав єдину спробу, а звірка, що сама впала на відсутньому
 * шматку збірки, давала необроблену відмову промісу й тишу.
 *
 * Зворотні експерименти: повернути «раз на сторінку» — червоніє «свіжі правила не
 * витрачають спроби»; прибрати `catch` — «звірка сама впала»; прибрати паузу —
 * «не частіше за хвилину».
 */
const settle = async () => {
	for (let tick = 0; tick < 5; tick += 1) await Promise.resolve();
};

const missing = new TypeError('Failed to fetch dynamically imported module: https://x/rulesLive.js');

describe('звірка правил після відмови', () => {
	let now: number;
	const clock = () => now;

	beforeEach(() => {
		now = 1_000_000;
		vi.clearAllMocks();
	});

	it('правила новіші — причина «правила»', async () => {
		const advice = new ReloadAdvice(async () => 'stale', clock);
		advice.noteDenial('42');
		await settle();
		expect(advice.reason).toBe('rules');
	});

	it('свіжі правила не витрачають спроби: через хвилину звіряє знову', async () => {
		const check = vi.fn(async (): Promise<'fresh' | 'stale' | 'unknown'> => 'fresh');
		const advice = new ReloadAdvice(check, clock);
		advice.noteDenial('42');
		await settle();
		expect(advice.reason).toBeNull();

		now += RULES_RECHECK_MS;
		check.mockResolvedValueOnce('stale');
		advice.noteDenial('42');
		await settle();

		expect(check).toHaveBeenCalledTimes(2);
		expect(advice.reason).toBe('rules');
	});

	it('не частіше за хвилину: подвійний тап не звіряє двічі', async () => {
		const check = vi.fn(async (): Promise<'fresh' | 'stale' | 'unknown'> => 'fresh');
		const advice = new ReloadAdvice(check, clock);
		advice.noteDenial('42');
		await settle();
		now += RULES_RECHECK_MS - 1;
		advice.noteDenial('42');
		await settle();
		expect(check).toHaveBeenCalledTimes(1);
	});

	it('звірка сама впала на відсутньому шматку збірки — причина «збірка», без необробленої відмови', async () => {
		const advice = new ReloadAdvice(async () => Promise.reject(missing), clock);
		advice.noteDenial('42');
		await settle();
		expect(advice.reason).toBe('build');
	});

	it('звірка впала з іншої причини — у журнал, а смуги немає', async () => {
		const advice = new ReloadAdvice(async () => Promise.reject(new Error('offline')), clock);
		advice.noteDenial('42');
		await settle();
		expect(advice.reason).toBeNull();
		expect(logService.warn).toHaveBeenCalledWith(
			'network',
			'rules not checked',
			expect.objectContaining({ code: '42' })
		);
	});
});

describe('помилка, за якою стоїть застаріла збірка', () => {
	it('розпізнана — причина «збірка»; інша — ні', () => {
		const advice = new ReloadAdvice(async () => 'fresh');
		expect(advice.noteFailure(new Error('room-full'))).toBe(false);
		expect(advice.reason).toBeNull();
		expect(advice.noteFailure(missing)).toBe(true);
		expect(advice.reason).toBe('build');
	});

	it('правила важливіші: відома причина «правила» не підміняється', async () => {
		const advice = new ReloadAdvice(async () => 'stale');
		advice.noteDenial('42');
		await settle();
		advice.noteFailure(missing);
		expect(advice.reason).toBe('rules');
	});
});
