import { EMULATOR } from '$lib/net/emulator';
import { RULES_VERSION } from '$lib/net/rulesVersion';
import { buildLogReport } from './logReport';
import { logService } from './logService.svelte';

/**
 * ЗВІТ ІЗ ЖУРНАЛУ — З ТИМ ОТОЧЕННЯМ, ЯКЕ Є ЗАРАЗ, і спроба покласти його в буфер.
 *
 * Звіт знімають у двох місцях: службове табло (`ServiceBadge`) і панель збою
 * (`ProblemPanel`, прохання автора 2026-09-27: «кнопка для копіювання логу»). Доти
 * оточення збиралося в самому табло, і друга копія розійшлася б із першою на першому ж
 * новому полі — так, як поле `RULES` колись дійшло б лише до одного з двох.
 *
 * Формат звіту — `logReport.ts` (там його перевіряє тест); тут лише «що зараз»: адреса,
 * пристрій, мережа, вхід, редакція правил.
 */
export function liveReport(): string {
	return buildLogReport(logService.getLogs(), {
		version: logService.appVersion,
		url: window.location.href,
		userAgent: navigator.userAgent,
		online: navigator.onLine,
		takenAt: new Date().toISOString(),
		uid: logService.sessionUid,
		rules: RULES_VERSION,
		database: EMULATOR ? 'emulator' : 'live'
	});
}

/**
 * Покласти звіт у буфер. `null` — поклали; рядок — не вийшло, і це САМ звіт, щоб показати
 * його в полі, з якого його виділять рукою (BETA-CHECKLIST, `BETA-REPORT-FALLBACK`).
 *
 * Відмов дві, і жодна не рідкісна: `navigator.clipboard` немає поза захищеним контекстом
 * (http на телефоні в локальній мережі), а частина браузерів вимагає жесту, який до
 * `await` уже «згорів». Рівень — `warn`, не `error`: це відсутній дозвіл, а не збій, і
 * червоний лічильник табло від нього не має загорятися (DEBUGGING-v9 § 2.3).
 */
export async function copyLogReport(): Promise<string | null> {
	const report = liveReport();
	try {
		await navigator.clipboard.writeText(report);
		return null;
	} catch (error) {
		logService.warn('ui', 'Failed to copy logs', { reason: String(error) });
		return report;
	}
}
