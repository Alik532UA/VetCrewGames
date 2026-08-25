import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * АВАТАР ГРАВЦЯ: одне джерело для шапки, форми профілю й кімнати.
 *
 * Доти сховище читали три місця незалежно, кожне — у момент свого створення.
 * Тобто вибір у профілі не доходив до шапки, поки сторінку не перезавантажили:
 * `localStorage` не реактивний, а `$state` тут — реактивний.
 *
 * Головне, що перевіряється, — ПОРОЖНЕЧА ЗНАЧУЩА. Шапка на неї показує звичайний
 * значок акаунта, а не типову плитку: «ще не вибирав» і «вибрав типовий» — різні
 * стани, і перший не мусить виглядати як другий.
 */

const store = new Map<string, string>();

vi.mock('./storage', () => ({
	storage: {
		get: (key: string) => store.get(key) ?? null,
		set: (key: string, value: string) => void store.set(key, value),
		remove: (key: string) => void store.delete(key)
	}
}));

const { AVATAR_KEY, DEFAULT_AVATAR } = await import('$lib/config/avatars');

/** Свіжий екземпляр на кожен випадок: значення читається при створенні. */
async function fresh() {
	vi.resetModules();
	const module = await import('./playerAvatar.svelte');
	return module.playerAvatar;
}

describe('аватар гравця', () => {
	beforeEach(() => store.clear());

	it('без вибору — порожньо, а не типовий аватар', async () => {
		const mine = await fresh();

		expect(mine.value, 'шапка на це показує звичайний значок акаунта').toBe('');
	});

	it('читає збережений вибір', async () => {
		store.set(AVATAR_KEY, 'cat:blue');

		expect((await fresh()).value).toBe('cat:blue');
	});

	/** Чужа рука або наш дефект: намалювати `dragon:gold` нічим. */
	it('зіпсоване значення читається як «не вибирав»', async () => {
		store.set(AVATAR_KEY, 'dragon:gold');

		expect((await fresh()).value).toBe('');
	});

	it('вибір лягає і в стан, і у сховище', async () => {
		const mine = await fresh();

		mine.set('turtle:violet');

		expect(mine.value).toBe('turtle:violet');
		expect(store.get(AVATAR_KEY), 'наступний захід мусить його побачити').toBe('turtle:violet');
	});

	/**
	 * Недопустиме значення НЕ пишеться нікуди.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `if (!isAvatar(next)) return` —
	 * червоніє цей випадок, а в базу поїхав би рядок, який правило відкидає.
	 */
	it('недопустиме значення не зберігається', async () => {
		const mine = await fresh();

		mine.set('НЕ АВАТАР');

		expect(mine.value).toBe('');
		expect(store.has(AVATAR_KEY)).toBe(false);
	});

	/** У кімнату типовий не передається: його підставить показ. */
	it('для кімнати типовий і порожній однаково не передаються', async () => {
		const mine = await fresh();
		expect(mine.forRoom()).toBeUndefined();

		mine.set(DEFAULT_AVATAR);
		expect(mine.forRoom()).toBeUndefined();

		mine.set('bird:blue');
		expect(mine.forRoom()).toBe('bird:blue');
	});
});
