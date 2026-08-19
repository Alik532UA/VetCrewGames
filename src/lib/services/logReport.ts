import type { LogEntry } from './logService.svelte';

/**
 * Звіт про збій — ТЕКСТ у буфер обміну, який людина вкидає в чат.
 *
 * **Чому окремий модуль, а не тіло `copyReport` у компоненті.** Рівно з тих
 * причин, з яких поруч лежить `betaReport.ts`: це чисте складання рядка з
 * даних, воно не має жодного стосунку до того, як табло намальоване, і
 * всередині `.svelte` його не перевіряє ніщо. Формат звіту при цьому — не
 * дрібниця: за ним читають, що саме зламалося, і мовчазна зміна порядку полів
 * чи зникнення `ONLINE` виявляється тоді, коли звіт уже прийшов неповним.
 *
 * Оточення приходить ПАРАМЕТРОМ, а не читається тут із `window` і `navigator`:
 * інакше модуль знову став би таким, що працює лише у браузері, — і перевірка
 * формату вимагала б DOM.
 */
export interface LogReportContext {
	/** Версія збірки. Без неї звіт ні з чим не звірити. */
	version: string;
	/** Адреса, на якій це сталося: половина звітів пояснюється саме сторінкою. */
	url: string;
	/** Що за браузер і пристрій. */
	userAgent: string;
	/**
	 * Чи була мережа. Не прикраса: половина «нічого не працює» пояснюється
	 * рівно цим рядком (DEBUGGING-v8 § 2.3).
	 */
	online: boolean;
	/**
	 * Момент збору — ISO, а не `toLocaleString()`.
	 *
	 * Звіт читає той, хто розбирає збій, а не відвідувач, який його скопіював.
	 * Голий `toLocaleString()` рендериться в локалі СИСТЕМИ відвідувача — 03.08
	 * чи 08.03 залежно від того, де він живе, і розрізнити їх у звіті нема по
	 * чому (I18N-v8 § 4.3).
	 */
	takenAt: string;
}

/** Шапка звіту: усе, чого немає в самих записах логу. */
export function buildLogReportHeader(context: LogReportContext): string {
	return `--- REPORT from service badge ---
DATE: ${context.takenAt}
URL: ${context.url}
DEVICE: ${context.userAgent}
VERSION: ${context.version}
ONLINE: ${context.online}
------------------------
`;
}

/** Один запис логу рядком. Порядок полів — від найзагальнішого до тексту. */
export function formatLogEntry(entry: LogEntry): string {
	return `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.category.toUpperCase()}] ${entry.message} ${
		entry.data ? JSON.stringify(entry.data) : ''
	}`;
}

/** Готовий звіт: шапка плюс усі записи. Саме це йде в буфер обміну. */
export function buildLogReport(entries: LogEntry[], context: LogReportContext): string {
	return buildLogReportHeader(context) + entries.map(formatLogEntry).join('\n');
}
