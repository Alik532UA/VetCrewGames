import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * АВАТАР ГРАВЦЯ: одне джерело для шапки, форми профілю й кімнати.
 *
 * Доти сховище читали три місця незалежно, кожне — у момент свого створення.
 * Тобто вибір у профілі не доходив до шапки, поки сторінку не перезавантажили:
 * `localStorage` не реактивний, а `$state` тут — реактивний.
 *
 * З 2026-09-27 (рішення автора 8-A) аватарка є в кожного з першого візиту — випадкова,
 * памʼятається на пристрої, і поряд живе `chosen`: чи вибрала її людина сама. Значок,
 * якого більше немає, переходить у тварину того самого кольору одразу при читанні (13-A).
 *
 * Зворотні експерименти: не ставити позначку випадкової — червоніє «перший візит»;
 * рахувати аватарку без позначки випадковою — червоніє «вибір старшої збірки»; у
 * `restore` писати через `set` — червоніє «відкат випадкової».
 */

const store = new Map<string, string>();

vi.mock('./storage', () => ({
	storage: {
		get: (key: string) => store.get(key) ?? null,
		set: (key: string, value: string) => void store.set(key, value),
		remove: (key: string) => void store.delete(key)
	}
}));

const { AVATAR_KEY, isAvatar, normaliseAvatar } = await import('$lib/config/avatars');

/** Свіжий екземпляр на кожен випадок: значення читається при створенні. */
async function fresh() {
	vi.resetModules();
	const module = await import('./playerAvatar.svelte');
	return { mine: module.playerAvatar, RANDOM: module.AVATAR_RANDOM_KEY };
}

describe('аватар гравця', () => {
	beforeEach(() => store.clear());
	afterEach(() => vi.restoreAllMocks());

	it('перший візит — випадкова аватарка, памʼятається й позначена «не вибирав»', async () => {
		vi.spyOn(Math, 'random').mockReturnValue(0);
		const { mine, RANDOM } = await fresh();

		expect(isAvatar(mine.value), mine.value).toBe(true);
		expect(mine.chosen).toBe(false);
		expect(store.get(AVATAR_KEY)).toBe(mine.value);
		expect(store.get(RANDOM)).toBe('1');
	});

	it('другий візит — та сама випадкова, а не нова', async () => {
		const first = (await fresh()).mine.value;
		const { mine } = await fresh();

		expect(mine.value).toBe(first);
		expect(mine.chosen).toBe(false);
	});

	/** Старші збірки писали у сховище лише вибір — позначки випадкової там немає. */
	it('вибір старшої збірки лишається вибором', async () => {
		store.set(AVATAR_KEY, 'cat:blue');
		const { mine } = await fresh();

		expect(mine.value).toBe('cat:blue');
		expect(mine.chosen).toBe(true);
	});

	it('значок, якого більше немає, — мовчки тварина того самого кольору, і назад у сховище', async () => {
		store.set(AVATAR_KEY, 'star:red');
		const { mine } = await fresh();

		expect(mine.value).toBe(normaliseAvatar('star:red'));
		expect(mine.value.endsWith(':red')).toBe(true);
		expect(store.get(AVATAR_KEY)).toBe(mine.value);
		expect(mine.chosen, 'це був вибір — він ним і лишився').toBe(true);
	});

	/** Чужа рука або наш дефект: намалювати `dragon:gold` нічим — тоді як на першому візиті. */
	it('зіпсоване значення — нова випадкова', async () => {
		store.set(AVATAR_KEY, 'dragon:gold');
		const { mine } = await fresh();

		expect(isAvatar(mine.value)).toBe(true);
		expect(mine.chosen).toBe(false);
	});

	it('вибір лягає і в стан, і у сховище, і знімає позначку випадкової', async () => {
		const { mine, RANDOM } = await fresh();

		mine.set('turtle:violet');

		expect(mine.value).toBe('turtle:violet');
		expect(mine.chosen).toBe(true);
		expect(store.get(AVATAR_KEY), 'наступний захід мусить його побачити').toBe('turtle:violet');
		expect(store.has(RANDOM)).toBe(false);
	});

	/**
	 * Недопустиме значення НЕ пишеться нікуди.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `if (!isAvatar(next)) return` —
	 * червоніє цей випадок, а в базу поїхав би рядок, який правило відкидає.
	 */
	it('недопустиме значення не зберігається', async () => {
		const { mine } = await fresh();
		const before = mine.value;

		mine.set('НЕ АВАТАР');
		mine.set('star:red');

		expect(mine.value).toBe(before);
		expect(store.get(AVATAR_KEY)).toBe(before);
	});

	/** Сторінка акаунта відкочує невдалий запис профілю — і випадкова мусить лишитися випадковою. */
	it('відкат випадкової вертає і плитку, і позначку «не вибирав»', async () => {
		const { mine, RANDOM } = await fresh();
		const before = mine.snapshot();

		mine.set('fish:pink');
		mine.restore(before);

		expect(mine.value).toBe(before.value);
		expect(mine.chosen).toBe(false);
		expect(store.get(RANDOM)).toBe('1');
	});

	it('для кімнати їде будь-яка, що є: випадкова теж розрізняє людей', async () => {
		const { mine } = await fresh();
		expect(mine.forRoom()).toBe(mine.value);

		mine.restore({ value: '', chosen: false });
		expect(mine.forRoom(), 'без аватарки — поля немає').toBeUndefined();
	});
});
