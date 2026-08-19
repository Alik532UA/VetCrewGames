// @vitest-environment node
// Чисте складання рядка — саме тому воно й винесене сюди з компонента.
import { describe, expect, it } from 'vitest';
import { buildLogReport, buildLogReportHeader, formatLogEntry } from './logReport';
import type { LogEntry } from './logService.svelte';

/**
 * Формат звіту про збій.
 *
 * **Навіщо перевіряти форматування рядка.** Бо цей рядок — єдине, що доходить
 * до того, хто розбирає збій: людина натискає табло, вкидає текст у чат, і
 * більше нічого немає. Поле, яке тихо зникло з шапки, помічається не тут, а
 * тоді, коли звіт уже прийшов неповним, — і другого звіту про той самий збій
 * не буде.
 *
 * Доти це були двадцять рядків усередині `ServiceBadge.svelte`, тобто місце,
 * куди не дивився жоден тест.
 */
const CONTEXT = {
	version: '0.6.260',
	url: 'https://alik532ua.github.io/VetCrewGames/game-memory/',
	userAgent: 'Mozilla/5.0 (Test)',
	online: false,
	takenAt: '2026-08-20T01:02:03.000Z'
};

const ENTRY: LogEntry = {
	timestamp: '2026-08-20T01:02:00.000Z',
	level: 'error',
	category: 'game_engine',
	message: 'deck out of sync'
};

describe('звіт про збій', () => {
	it('перевірка жива: шапка не порожня', () => {
		expect(buildLogReportHeader(CONTEXT).length).toBeGreaterThan(0);
	});

	describe('шапка', () => {
		const header = buildLogReportHeader(CONTEXT);

		it('несе ВСІ пʼять полів — зникнення будь-якого робить звіт нерозбірним', () => {
			expect(header).toContain('DATE: 2026-08-20T01:02:03.000Z');
			expect(header).toContain('URL: https://alik532ua.github.io/VetCrewGames/game-memory/');
			expect(header).toContain('DEVICE: Mozilla/5.0 (Test)');
			expect(header).toContain('VERSION: 0.6.260');
			expect(header).toContain('ONLINE: false');
		});

		it('`ONLINE: false` не зникає, бо це саме те, що пояснює половину збоїв', () => {
			// Найлегший спосіб зламати це — шаблон `${online && ...}` замість значення.
			expect(header).not.toContain('ONLINE: undefined');
			expect(header).toMatch(/^ONLINE: (true|false)$/m);
		});

		it('дата — ISO, а не локаль системи відвідувача (I18N-v8 § 4.3)', () => {
			// `03.08` і `08.03` у звіті розрізнити нема по чому.
			expect(header).toMatch(/^DATE: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m);
		});
	});

	describe('записи', () => {
		it('рівень і категорія — великими: у суцільному тексті їх шукають очима', () => {
			expect(formatLogEntry(ENTRY)).toContain('[ERROR] [GAME_ENGINE]');
		});

		it('запис без `data` не лишає рядка `undefined`', () => {
			expect(formatLogEntry(ENTRY)).not.toContain('undefined');
		});

		it('запис із `data` несе його JSON-ом', () => {
			expect(formatLogEntry({ ...ENTRY, data: { deck: 12 } })).toContain('{"deck":12}');
		});
	});

	it('готовий звіт — це шапка ПЛЮС записи, кожен своїм рядком', () => {
		const report = buildLogReport([ENTRY, { ...ENTRY, level: 'warn' }], CONTEXT);
		expect(report.startsWith(buildLogReportHeader(CONTEXT))).toBe(true);
		expect(report).toContain('[ERROR]');
		expect(report).toContain('[WARN]');
		expect(report.trimEnd().split('\n').at(-1)).toContain('[WARN]');
	});

	it('порожній лог дає саму шапку, а не падіння', () => {
		// Табло натискають і тоді, коли нічого не зламалося: версія в шапці — теж відповідь.
		expect(buildLogReport([], CONTEXT)).toBe(buildLogReportHeader(CONTEXT));
	});
});
