import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Службове табло: три стани прапорця й асиметричні пороги.
 *
 * **Чому це варте тестів, хоч тут тридцять рядків коду.** Бо обидва рішення
 * контрінтуїтивні, обидва розписані абзацами в `debugMode.svelte.ts` і
 * PROJECT-CONTEXT.md — і жодне з них не трималося нічим, окрім тих абзаців.
 * Покриття файлу було 46,66% рядків і 25% функцій (`npm test`, 2026-08-20):
 * `pressesToToggle` і `toggle()` не викликав ніхто.
 *
 * Що саме зламалося б непомітно:
 *
 *  * `boolean` замість трьох станів — і табло або зникає в dev, або зʼявляється
 *    кожному відвідувачеві проду. Обидва наслідки видно лише оком і лише в
 *    потрібному середовищі;
 *  * симетричні пороги — і 55 натискань починають коштувати скріншот у dev, або
 *    5 натискань відкривають службовий елемент відвідувачеві проду.
 *
 * `vi.resetModules()` у кожній перевірці обовʼязковий: `debugMode` — module-level
 * синглтон, який читає сховище в конструкторі. Без скидання друга перевірка
 * дістала б стан, гідратований у першій.
 */

function makeStorage(entries: Record<string, string> = {}): Storage {
	const data = new Map(Object.entries(entries));
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

/** Прапорець у сховищі лежить під префіксом проєкту — як і все інше. */
const KEY = 'vetcrewgames_debug_mode';

async function load(stored: string | null, dev: boolean) {
	vi.resetModules();
	vi.doMock('$app/environment', () => ({ browser: true, dev }));
	const store = makeStorage(stored === null ? {} : { [KEY]: stored });
	vi.stubGlobal('localStorage', store);
	const { debugMode, SHOW_PRESSES_PROD, HIDE_PRESSES } = await import('./debugMode.svelte');
	return { debugMode, store, SHOW_PRESSES_PROD, HIDE_PRESSES };
}

describe('службове табло', () => {
	beforeEach(() => {
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it('перевірка жива: пороги — різні числа', async () => {
		const { SHOW_PRESSES_PROD, HIDE_PRESSES } = await load(null, true);
		expect(SHOW_PRESSES_PROD).toBe(55);
		expect(HIDE_PRESSES).toBe(5);
	});

	describe('три стани, а не два', () => {
		it('без ключа: у dev видиме, у проді ні', async () => {
			// Саме тому тут не `boolean`: типова відповідь у двох середовищах різна.
			expect((await load(null, true)).debugMode.enabled).toBe(true);
			expect((await load(null, false)).debugMode.enabled).toBe(false);
		});

		it('«1» показує навіть у проді, «0» ховає навіть у dev', async () => {
			expect((await load('1', false)).debugMode.enabled).toBe(true);
			expect((await load('0', true)).debugMode.enabled).toBe(false);
		});

		it('сміття у сховищі читається як «нічого не сказано»', async () => {
			// Зіпсоване значення не має мовчки означати «показати всім».
			expect((await load('yes', false)).debugMode.enabled).toBe(false);
			expect((await load('', true)).debugMode.enabled).toBe(true);
		});
	});

	describe('пороги асиметричні', () => {
		it('у проді показати коштує 55, сховати — 5', async () => {
			const hidden = await load(null, false);
			expect(hidden.debugMode.pressesToToggle, 'показати відвідувачеві проду').toBe(55);

			const shown = await load('1', false);
			expect(shown.debugMode.pressesToToggle, 'сховати наслідків не має').toBe(5);
		});

		it('у dev обидва напрямки по 5: 55 натискань заради скріншота — покарання', async () => {
			expect((await load(null, true)).debugMode.pressesToToggle).toBe(5);
			expect((await load('0', true)).debugMode.pressesToToggle).toBe(5);
		});

		it('поріг читається ЗАНОВО після перемикання', async () => {
			// Щойно табло стало видимим, наступна серія коштує 5, а не 55.
			const { debugMode } = await load(null, false);
			expect(debugMode.pressesToToggle).toBe(55);
			debugMode.toggle();
			expect(debugMode.pressesToToggle).toBe(5);
		});
	});

	describe('запис у сховище', () => {
		it('«сховати» пише «0», а НЕ видаляє ключ', async () => {
			/*
			 * Видалення повернуло б стан «нічого не сказано», тобто в dev табло
			 * зʼявилося б знову після перезавантаження — а людина щойно попросила
			 * його сховати.
			 */
			const { debugMode, store } = await load(null, true);
			expect(debugMode.toggle()).toBe(false);
			expect(store.getItem(KEY)).toBe('0');
		});

		it('«показати» пише «1»', async () => {
			const { debugMode, store } = await load(null, false);
			expect(debugMode.toggle()).toBe(true);
			expect(store.getItem(KEY)).toBe('1');
		});

		it('наскрізний запис: стан і сховище міняються одним викликом', async () => {
			// `$effect` тут кинув би `effect_orphan` — це module-level синглтон.
			const { debugMode, store } = await load('1', false);
			debugMode.toggle();
			expect(debugMode.enabled).toBe(false);
			expect(store.getItem(KEY)).toBe('0');
		});
	});
});
