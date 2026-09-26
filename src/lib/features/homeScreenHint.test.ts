import { afterEach, describe, expect, it, vi } from 'vitest';

// Сховище — у памʼяті: у цьому оточенні `localStorage` немає, і справжній фасад
// мовчки повертав би `null` (він ніколи не кидає). `vi.hoisted`, бо модуль під
// тестом імпортується статично, тобто раніше за тіло файлу.
const { store, memory } = vi.hoisted(() => {
	const store = new Map<string, string>();
	const memory = {
		get: (key: string) => store.get(key) ?? null,
		set: (key: string, value: string) => {
			store.set(key, value);
			return true;
		}
	};
	return { store, memory };
});
vi.mock('$lib/services/storage', () => ({ storage: memory, sessionStore: memory }));

import { hintHomeScreenOnce, HINT_SHOWN_KEY } from './homeScreenHint';
import { toast } from '$lib/controllers/toast.svelte';

/**
 * ПІДКАЗКА «НА ПОЧАТКОВИЙ ЕКРАН» — рівно один раз і рівно там, де кнопки немає
 * (прохання автора 2026-09-26).
 *
 * Зворотний експеримент: прибрати перевірку позначки — червоніє «удруге ні»;
 * прибрати перевірку `wantsHomeScreenHint` — червоніє «комп'ютер».
 */

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/605.1';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0';

const patched: Array<[object, string]> = [];
function patch(target: object, key: string, value: unknown): void {
	Object.defineProperty(target, key, { value, configurable: true, writable: true });
	patched.push([target, key]);
}

const hints = () => toast.messages.filter((m) => m.messageKey === 'header.fullscreenHint');

afterEach(() => {
	for (const [target, key] of patched.reverse()) Reflect.deleteProperty(target, key);
	patched.length = 0;
	toast.messages = [];
	store.clear();
	vi.useRealTimers();
});

describe('підказка «на початковий екран»', () => {
	it('iPhone у браузері — показує, і вдруге ні', () => {
		vi.useFakeTimers();
		patch(navigator, 'userAgent', IPHONE_UA);

		hintHomeScreenOnce();
		expect(hints()).toHaveLength(1);
		expect(store.get(HINT_SHOWN_KEY), 'позначка лягла разом із показом').toBeDefined();

		toast.messages = [];
		hintHomeScreenOnce();
		expect(hints(), 'удруге ні').toHaveLength(0);
	});

	it('комп’ютер, що вміє повний екран, — не показує', () => {
		patch(navigator, 'userAgent', DESKTOP_UA);
		patch(document, 'fullscreenEnabled', true);

		hintHomeScreenOnce();
		expect(hints()).toHaveLength(0);
	});

	it('iPhone з початкового екрана — не показує: там уже без панелей', () => {
		patch(navigator, 'userAgent', IPHONE_UA);
		patch(navigator, 'standalone', true);

		hintHomeScreenOnce();
		expect(hints()).toHaveLength(0);
	});
});
