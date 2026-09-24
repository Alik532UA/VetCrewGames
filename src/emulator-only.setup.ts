import { afterAll } from 'vitest';

/**
 * КОНТРАКТ ТРАНСПОРТУ ХОДИТЬ ЛИШЕ ДО ЕМУЛЯТОРА НА ЦІЙ МАШИНІ.
 *
 * Той самий запобіжник, що й `src/no-network.setup.ts`, тільки з дозволеним
 * адресатом: `127.0.0.1` / `localhost`. Контракт підміняє `connect()` на
 * підʼєднання до емулятора, і будь-який запит повз нього означав би, що якийсь
 * модуль усе ж дістався до `net/firebase.ts` зі справжнім ключем — тобто до ЖИВОГО
 * проєкту. Тоді прогін мусить упасти, а не тихо реєструвати акаунти.
 *
 * І навпаки: прогін, у якому до емулятора не пішло ЖОДНОГО запиту, теж падає.
 * Контракт, що «пройшов», не діставшись бази, довів би лише `LocalRoom` сам із
 * собою.
 *
 * Зворотний експеримент: прибрати `vi.mock('$lib/net/firebase', …)` з
 * `transport.emulator.test.ts` — падає першим же запитом до `identitytoolkit`.
 */
const LOCAL = /^(?:https?|wss?):\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//;

let reachedEmulator = 0;

function guard(target: unknown): void {
	const where = String((target as { url?: unknown } | null)?.url ?? target);
	if (!LOCAL.test(where)) throw new Error(`контракт транспорту пішов повз емулятор: ${where}`);
	reachedEmulator += 1;
}

const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
	guard(input);
	return realFetch(input, init);
}) as typeof fetch;

const RealSocket = globalThis.WebSocket;
globalThis.WebSocket = class extends RealSocket {
	constructor(url: string | URL, protocols?: string | string[]) {
		guard(url);
		super(url, protocols);
	}
} as typeof WebSocket;

afterAll(() => {
	if (reachedEmulator === 0) {
		throw new Error('контракт не дійшов до емулятора жодним запитом — порівнювати не було з чим');
	}
});
