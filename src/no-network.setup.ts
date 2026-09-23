import { afterAll, afterEach, vi } from 'vitest';

/**
 * ЮНІТ-ТЕСТИ НЕ ХОДЯТЬ У МЕРЕЖУ — і це тримає середовище, а не дисципліна.
 *
 * Знайдено пробою (аудит 2026-09-23): `readMyProfile()` без мока доходив через
 * `connect()` до справжнього `accounts:signUp` продакшн-проєкту. Ключ Firebase
 * зашитий у `net/firebase.ts` (він публічний за задумом), а `fetch` у jsdom —
 * справжній, від Node. Тобто кожен прогін `npm test`, локально й у CI, міг
 * створювати анонімний акаунт у ЖИВІЙ базі й витрачати ліміт реєстрацій з
 * адреси — той самий, об який уже спотикалися E2E (`TOO_MANY_ATTEMPTS_TRY_LATER`).
 * Видно цього не було: `readMyProfile` не кидає, і тест проходив зеленим.
 *
 * Звідси два кроки.
 *
 *  1. `fetch`, `WebSocket` і `XMLHttpRequest` відмовляють одразу, до будь-якого
 *     запиту. Firebase Auth ходить через `fetch`, база — через `WebSocket`, а
 *     jsdom-івський XHR теж робить справжні запити.
 *  2. Кожна відмова записується, і тест, у якому вона сталася, ПАДАЄ з адресою.
 *     Інакше заблокований запит лишався б мовчазним: код і далі не кидає, і про
 *     незамокану межу модуля ніхто б не дізнався.
 *
 * Тест, якому мережа потрібна за задумом, підміняє її сам
 * (`vi.stubGlobal('fetch', …)`) — тоді сюди виклик не доходить. Правила бази
 * перевіряє `check:rules` над емулятором, а не Vitest.
 *
 * Зворотний експеримент: прибрати `vi.mock('$lib/net/account', …)` із
 * `services/playerSync.test.ts` — червоніє той файл, з адресою `identitytoolkit`.
 */
const reached: string[] = [];

function refuse(target: unknown): Error {
	const where = String((target as { url?: unknown } | null)?.url ?? target);
	reached.push(where);
	return new Error(`юніт-тест дійшов до мережі: ${where}`);
}

globalThis.fetch = (async (input: unknown) => {
	throw refuse(input);
}) as typeof fetch;

globalThis.WebSocket = class {
	constructor(url: unknown) {
		throw refuse(url);
	}
} as unknown as typeof WebSocket;

if (typeof XMLHttpRequest !== 'undefined') {
	Object.defineProperty(XMLHttpRequest.prototype, 'open', {
		configurable: true,
		value(_method: string, url: unknown) {
			throw refuse(url);
		}
	});
}

function report(): void {
	if (reached.length === 0) return;
	const list = [...new Set(reached.splice(0))];
	throw new Error(
		`Тест дійшов до мережі: ${list.join(', ')}.\n` +
			'Замокай межу модуля (`$lib/net/*`), а не покладайся на відмову: без цього ' +
			'файлу запит пішов би в живий проєкт.'
	);
}

afterEach(report);

/*
 * ХВІСТ ФАЙЛУ. `void`-ланцюжок — типово публікація рядка таблиці після злиття —
 * доходить до мережі вже ПІСЛЯ останнього тесту файлу. Коротка пауза дає йому
 * дійти до відмови, щоб і він не пройшов мовчки.
 */
afterAll(async () => {
	// Упалий тест міг лишити підмінені таймери, і під ними пауза нижче не
	// скінчилася б ніколи: замість назви тесту — «Hook timed out» через 10 с.
	vi.useRealTimers();
	await new Promise((resolve) => setTimeout(resolve, 50));
	report();
});
