import { describe, expect, it, vi } from 'vitest';
import { buildBetaReport } from './betaReport';
import type { Mark } from './betaProgress.svelte';

/**
 * Позначки чеклиста й звіт, який людина копіює.
 *
 * Найважливіше тут — ВЕРСІЯ в позначці. Без неї галочка «працює», поставлена
 * сорок комітів тому, виглядає точно так само, як поставлена сьогодні, і список
 * поступово перетворюється на звіт про минуле, який читають як звіт про
 * теперішнє. Друге за важливістю — окрема помітка `fail` на покритому пункті:
 * така відповідь означає, що бреше ТЕСТ, і зі звіту це мусить бути видно
 * одразу, а не після зіставлення з кодом.
 *
 * Зворотний експеримент: прибрати `storage.setJSON` із `vote()` — червоніє
 * «позначка переживає перезавантаження»; прибрати рядок про покритий пункт зі
 * `betaReport.ts` — червоніє «звіт кричить про дефект тесту».
 */

function makeStorage(seed: Record<string, string> = {}): Storage {
	const data = new Map<string, string>(Object.entries(seed));
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear()
	} as Storage;
}

async function load(seed: Record<string, string> = {}) {
	vi.resetModules();
	const raw = makeStorage(seed);
	vi.stubGlobal('localStorage', raw);
	const { betaProgress } = await import('./betaProgress.svelte');
	return { betaProgress, raw };
}

const KEY = 'vetcrewgames_beta.marks';

describe('позначки бета-тестування', () => {
	it('гідрація не пише у сховище нічого', async () => {
		const { raw } = await load();
		expect(raw.getItem(KEY), 'конструктор зберіг те, що щойно прочитав').toBeNull();
	});

	it('позначка переживає перезавантаження', async () => {
		const { betaProgress, raw } = await load();
		betaProgress.vote('reserve_1', 'ok');

		const saved = JSON.parse(raw.getItem(KEY) ?? '{}');
		expect(saved.reserve_1.vote).toBe('ok');

		const again = await load({ [KEY]: raw.getItem(KEY) ?? '' });
		expect(again.betaProgress.voteOf('reserve_1')).toBe('ok');
	});

	it('позначка несе версію збірки', async () => {
		const { betaProgress } = await load();
		betaProgress.vote('reserve_1', 'fail');
		expect(betaProgress.marks.reserve_1.version).toBe(betaProgress.version);
		expect(betaProgress.isStale('reserve_1'), 'своя ж версія не застаріла').toBe(false);
	});

	/**
	 * Позначка з чужої версії НЕ зникає: вона все ще щось означає. Але видно, що
	 * вона з іншого коду, — інакше «перевірено» назавжди лишалося б перевіреним.
	 */
	it('позначка з іншої версії видна як застаріла', async () => {
		const seed: Record<string, Mark> = { reserve_1: { vote: 'ok', version: 'v0.0.1' } };
		const { betaProgress } = await load({ [KEY]: JSON.stringify(seed) });

		expect(betaProgress.voteOf('reserve_1'), 'позначка зникла').toBe('ok');
		expect(betaProgress.isStale('reserve_1')).toBe(true);
		expect(betaProgress.freshCount, 'застаріла позначка не рахується як зроблена').toBe(0);
	});

	it('повторне натискання того самого стану знімає позначку', async () => {
		const { betaProgress, raw } = await load();
		betaProgress.vote('reserve_1', 'ok');
		betaProgress.vote('reserve_1', 'none');

		expect(betaProgress.voteOf('reserve_1')).toBe('none');
		expect(
			Object.keys(JSON.parse(raw.getItem(KEY) ?? '{}')),
			'знята позначка лишилася записом у сховищі'
		).toEqual([]);
	});

	it('«стерти позначки» прибирає ключ, а не лишає порожній обʼєкт', async () => {
		const { betaProgress, raw } = await load();
		betaProgress.vote('reserve_1', 'weird');
		betaProgress.clear();

		expect(betaProgress.freshCount).toBe(0);
		expect(raw.getItem(KEY)).toBeNull();
	});
});

describe('звіт бета-тестування', () => {
	const context = {
		version: 'v1.2.3',
		userAgent: 'TestBrowser/1.0',
		language: 'uk',
		theme: 'dark',
		at: '2026-01-01T00:00:00.000Z'
	};

	it('містить версію, пристрій і тему', () => {
		const report = buildBetaReport({ reserve_1: { vote: 'ok', version: 'v1.2.3' } }, context);
		expect(report).toContain('v1.2.3');
		expect(report).toContain('TestBrowser/1.0');
		expect(report).toContain('dark');
	});

	/** Перелік того, чого людина не дивилася, робить звіт нечитним. */
	it('містить лише позначені пункти', () => {
		const report = buildBetaReport({ reserve_1: { vote: 'ok', version: 'v1.2.3' } }, context);
		expect(report).toContain('reserve_1');
		expect(report, 'у звіт потрапив непозначений пункт').not.toContain('reserve_2');
	});

	it('поламане стоїть вище за те, що працює', () => {
		const report = buildBetaReport(
			{
				reserve_1: { vote: 'ok', version: 'v1.2.3' },
				reserve_3: { vote: 'fail', version: 'v1.2.3' }
			},
			context
		);
		expect(report.indexOf('reserve_3')).toBeLessThan(report.indexOf('reserve_1'));
	});

	/**
	 * `fail` на покритому пункті — не звичайний баг, а звіт про дефект ТЕСТА.
	 * Найдорожча новина в усьому звіті, і вона мусить бути видна без зіставлення з
	 * кодом.
	 */
	it('звіт кричить про дефект тесту', () => {
		const covered = buildBetaReport(
			{ reserve_11: { vote: 'fail', version: 'v1.2.3' } },
			context
		);
		expect(covered).toContain('ПОКРИТО АВТОТЕСТОМ');
		expect(covered, 'не названо, який саме тест бреше').toContain('save.test.ts');

		const manual = buildBetaReport({ reserve_1: { vote: 'fail', version: 'v1.2.3' } }, context);
		expect(manual, 'непокритий пункт не мусить називатися дефектом тесту').not.toContain(
			'ПОКРИТО АВТОТЕСТОМ'
		);
	});

	it('порожній чеклист дає звіт, а не порожній рядок', () => {
		const report = buildBetaReport({}, context);
		expect(report).toContain('Жодного пункта не позначено');
	});
});
