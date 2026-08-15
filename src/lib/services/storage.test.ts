import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * STORAGE-NAMESPACE-v8, Крок 1 і «Автоматична перевірка».
 *
 * Три властивості фасаду, кожна з яких CRITICAL і жодна з яких не видна оком у
 * звичайному прогоні: у розробника квота не переповнюється, приватний режим не
 * вмикається, а сусіднього застосунку на origin просто немає.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1) прогнано на кожному з
 * трьох: прибрати `try` довкола `setItem` — падає «переповнена квота»;
 * прибрати фільтр за префіксом у `clear()` — падає «clear() не чіпає чужі
 * ключі»; прибрати `PREFIX +` у `set` — падає «усі ключі отримують префікс».
 */

vi.mock('$app/environment', () => ({ browser: true, dev: true }));

function makeStorage(overrides: Partial<Storage> = {}): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		key: (i: number) => [...data.keys()][i] ?? null,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k),
		clear: () => data.clear(),
		...overrides
	} as Storage;
}

const quotaExceeded = () => {
	throw new DOMException('quota', 'QuotaExceededError');
};

describe('storage', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('усі ключі отримують префікс проєкту', async () => {
		const mock = makeStorage();
		vi.stubGlobal('localStorage', mock);
		const { storage } = await import('./storage');

		expect(storage.set('theme', 'dark')).toBe(true);

		expect(mock.getItem('theme'), 'ключ без префікса не має існувати').toBeNull();
		expect(mock.key(0)).toBe('vetcrewgames_theme');
		expect(storage.get('theme')).toBe('dark');
	});

	it('clear() не чіпає ключі сусіднього застосунку на тому самому origin', async () => {
		const mock = makeStorage();
		vi.stubGlobal('localStorage', mock);
		const { storage } = await import('./storage');

		mock.setItem('cv-svelte_theme', 'light');
		storage.set('theme', 'dark');

		storage.clear();

		expect(mock.getItem('cv-svelte_theme'), 'дані сусіднього застосунку знищено').toBe('light');
		expect(storage.get('theme')).toBeNull();
	});

	it('переповнена квота не валить застосунок, а повертає false', async () => {
		vi.stubGlobal('localStorage', makeStorage({ setItem: quotaExceeded }));
		const { storage } = await import('./storage');

		expect(() => storage.set('k', 'v')).not.toThrow();
		expect(storage.set('k', 'v'), 'невдале збереження має повертати false').toBe(false);
	});

	it('доступ, що кидає (приватний режим), не поширює виняток назовні', async () => {
		// У Firefox із заблокованими cookie кидає саме звернення до властивості,
		// а не її методи — тому гесер, а не мок методів.
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('denied', 'SecurityError');
			}
		});
		const { storage } = await import('./storage');

		expect(() => storage.get('theme')).not.toThrow();
		expect(storage.get('theme')).toBeNull();
		expect(storage.set('theme', 'dark')).toBe(false);
		expect(() => storage.clear()).not.toThrow();

		vi.unstubAllGlobals();
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: makeStorage()
		});
	});

	it('зіпсований JSON дорівнює відсутньому значенню', async () => {
		vi.stubGlobal('localStorage', makeStorage());
		const { storage } = await import('./storage');

		storage.set('cfg', '{зламано');

		expect(storage.getJSON('cfg')).toBeNull();
	});

	it('sessionStore ізольований тим самим префіксом', async () => {
		const mock = makeStorage();
		vi.stubGlobal('sessionStorage', mock);
		const { sessionStore } = await import('./storage');

		sessionStore.setJSON('logs', [{ level: 'info' }]);

		expect(mock.key(0)).toBe('vetcrewgames_logs');
		expect(sessionStore.getJSON('logs')).toEqual([{ level: 'info' }]);
	});
});

describe('storage без браузера (SSR і prerender)', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doMock('$app/environment', () => ({ browser: false, dev: true }));
	});

	it('нічого не читає й не пише, і не кидає', async () => {
		const mock = makeStorage();
		vi.stubGlobal('localStorage', mock);
		const { storage } = await import('./storage');

		expect(storage.get('theme')).toBeNull();
		expect(storage.set('theme', 'dark')).toBe(false);
		expect(mock.length, 'під час prerender сховища не існує взагалі').toBe(0);
	});
});
