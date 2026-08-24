import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVATAR_KEY, DEFAULT_AVATAR } from '$lib/config/avatars';
import { COUNTRY_KEY, NAME_KEY } from '$lib/config/playerName';

/**
 * ХТО Я В КІМНАТІ: підпис, прапор, аватар.
 *
 * Головне тут — межа «наше/людське». Підставлене нами імʼя контролер має право
 * перекинути, коли виявиться зайнятим; введене людиною — ні. Помилка в цій межі
 * не падає й не видна на екрані: вона виглядає як «поле саме перескочило»,
 * і побачить її лише той, хто саме друкував.
 *
 * Друге — порядок у `loadCountry()`: збережений вибір ГОЛОВНІШИЙ за визначення
 * за IP, і запит до сторонньої служби йде ЛИШЕ коли у сховищі немає нічого.
 * Зворотний порядок означав би, що прапор, який людина прибрала, вертається на
 * кожному відкритті — а разом із ним її IP їде в чужий журнал щоразу.
 *
 * Сховище й визначення країни підмінені; словник імен і перевірки кодів —
 * справжні, бо це чисті функції без мережі. Джерело випадковості передається
 * аргументом (так улаштований сам контролер), тож кидки тут ТОЧНІ, а не
 * ймовірні.
 */

const store = new Map<string, string>();

const storageMock = {
	get: vi.fn<(key: string) => string | null>((key) => store.get(key) ?? null),
	set: vi.fn<(key: string, value: string) => boolean>((key, value) => {
		store.set(key, value);
		return true;
	})
};

const detectCountry = vi.fn<() => Promise<string | null>>(async () => null);

vi.mock('$lib/services/storage', () => ({ storage: storageMock }));
vi.mock('$lib/net/country', () => ({ detectCountry }));

const { PlayerIdentity } = await import('./playerIdentity.svelte');

/** Кидок за списком: перевірка стверджує «перше», «друге», а не «щось». */
const rolls = (...values: number[]) => {
	let i = 0;
	return () => values[Math.min(i++, values.length - 1)];
};

/** Найпоширеніший випадок: завжди перше вільне імʼя зі списку. */
const first = () => 0;

describe('PlayerIdentity', () => {
	beforeEach(() => {
		store.clear();
		storageMock.get.mockClear();
		storageMock.set.mockClear();
		detectCountry.mockReset().mockResolvedValue(null);
	});

	describe('аватар читається у конструкторі', () => {
		it('без збереженого — типовий', () => {
			expect(new PlayerIdentity(first).avatar).toBe(DEFAULT_AVATAR);
		});

		it('збережений підхоплюється', () => {
			store.set(AVATAR_KEY, 'cat:blue');
			expect(new PlayerIdentity(first).avatar).toBe('cat:blue');
		});

		/**
		 * Невідоме значення дає типовий, а не порожню плитку: «без аватара» не
		 * буває — порожнє місце в списку читалося б як дефект показу.
		 */
		it('зіпсоване значення дає типовий, а не порожнє', () => {
			store.set(AVATAR_KEY, 'НЕ АВАТАР');
			expect(new PlayerIdentity(first).avatar).toBe(DEFAULT_AVATAR);
		});
	});

	describe('load()', () => {
		it('до завантаження словника перекладач віддає сам ключ', () => {
			const me = new PlayerIdentity(first);
			expect(me.text('pairs.crew.cat')).toBe('pairs.crew.cat');
		});

		it('підставляє імʼя зі словника мови, а не ключ', async () => {
			const me = new PlayerIdentity(first);
			await me.load('uk', []);

			expect(me.value).not.toBe('');
			expect(me.value, 'у полі лишився ключ — словник не приїхав').not.toContain('pairs.crew.');
		});

		it('збережене імʼя головніше за кидок', async () => {
			store.set(NAME_KEY, 'Оксана');
			const me = new PlayerIdentity(first);
			await me.load('uk', []);

			expect(me.value).toBe('Оксана');
		});

		/**
		 * Перемикач мови перезапускає той самий `$effect`. Підпис, який людина вже
		 * бачить, мінятися не мусить — інакше вибір злітав би від дотику до мови.
		 */
		it('повторний виклик (інша мова) не переписує вже показане імʼя', async () => {
			const me = new PlayerIdentity(first);
			await me.load('uk', []);
			const shown = me.value;

			await me.load('en', []);
			expect(me.value).toBe(shown);
		});

		it('невідома мова лишає порожній словник — на екрані видно ключ', async () => {
			const me = new PlayerIdentity(first);
			await me.load('xx', []);

			expect(me.value).toContain('pairs.crew.');
		});
	});

	describe('loadCountry(): збережений вибір головніший за IP', () => {
		it('збережений код беруть як є, служби не питають', async () => {
			store.set(COUNTRY_KEY, 'ua');
			const me = new PlayerIdentity(first);
			await me.loadCountry();

			expect(me.country).toBe('ua');
			expect(detectCountry, 'IP поїхав у чужу службу, хоч вибір уже був').not.toHaveBeenCalled();
		});

		/**
		 * Порожньо у сховищі — це ВІДПОВІДЬ «без прапора», а не «не питали». Без
		 * цієї різниці той, хто прапор прибрав, отримував би його назад щоразу.
		 */
		it('порожній рядок — це «без прапора», і служби теж не питають', async () => {
			store.set(COUNTRY_KEY, '');
			const me = new PlayerIdentity(first);
			await me.loadCountry();

			expect(me.country).toBe('');
			expect(detectCountry).not.toHaveBeenCalled();
		});

		it('невідомий код у сховищі дає «без прапора»', async () => {
			store.set(COUNTRY_KEY, 'zz');
			const me = new PlayerIdentity(first);
			await me.loadCountry();

			expect(me.country).toBe('');
			expect(detectCountry).not.toHaveBeenCalled();
		});

		it('нічого не збережено — питається служба, і підказка ЗАПАМʼЯТОВУЄТЬСЯ', async () => {
			detectCountry.mockResolvedValue('de');
			const me = new PlayerIdentity(first);
			await me.loadCountry();

			expect(me.country).toBe('de');
			expect(
				store.get(COUNTRY_KEY),
				'підказку не запамʼятали — IP поїде туди на кожному відкритті'
			).toBe('de');
		});

		it('служба не відповіла — лишається «без прапора» і нічого не пишеться', async () => {
			detectCountry.mockResolvedValue(null);
			const me = new PlayerIdentity(first);
			await me.loadCountry();

			expect(me.country).toBe('');
			expect(store.has(COUNTRY_KEY)).toBe(false);
		});
	});

	describe('кубик і перекидання зайнятого', () => {
		it('reroll() виключає і зайняті імена, і поточне', async () => {
			const me = new PlayerIdentity(rolls(0, 0));
			await me.load('uk', []);
			const before = me.value;

			me.reroll([]);
			expect(me.value, 'кубик віддав те саме імʼя — кнопка виглядає зламаною').not.toBe(before);
		});

		/** Наше імʼя перекидається, коли перелік кімнат показав його зайнятим. */
		it('settle() міняє ПІДСТАВЛЕНЕ імʼя, яке виявилося зайнятим', async () => {
			const me = new PlayerIdentity(rolls(0, 0));
			await me.load('uk', []);
			const mine = me.value;

			me.settle([mine]);
			expect(me.value).not.toBe(mine);
		});

		/**
		 * Головний тест набору: введене людиною не чіпається НІКОЛИ, навіть коли
		 * воно збіглося з чужим. Два однакових підписи в переліку не ломають нічого
		 * (особу несе `uid`), а поле, що перескочило під пальцями, — ломає довіру.
		 */
		it('settle() НЕ чіпає імені, яке ввела людина', async () => {
			const me = new PlayerIdentity(first);
			await me.load('uk', []);
			me.value = 'Оксана';

			me.settle(['Оксана']);
			expect(me.value).toBe('Оксана');
		});

		it('settle() не робить нічого, коли наше імʼя вільне', async () => {
			const me = new PlayerIdentity(first);
			await me.load('uk', []);
			const mine = me.value;

			me.settle(['Хтось Інший']);
			expect(me.value).toBe(mine);
		});

		/** Кубик віддає теж НАШЕ імʼя — отже, його можна перекинути далі. */
		it('імʼя з кубика лишається нашим і теж перекидається', async () => {
			const me = new PlayerIdentity(rolls(0, 0.5, 0));
			await me.load('uk', []);
			me.reroll([]);
			const rolled = me.value;

			me.settle([rolled]);
			expect(me.value).not.toBe(rolled);
		});
	});

	describe('forEntry()', () => {
		it('запамʼятовує імʼя й прапор саме при вході в кімнату', async () => {
			store.set(COUNTRY_KEY, 'ua');
			const me = new PlayerIdentity(first);
			await me.load('uk', []);
			await me.loadCountry();

			const who = me.forEntry([]);

			expect(who).toBe(me.value);
			expect(store.get(NAME_KEY)).toBe(who);
			expect(store.get(COUNTRY_KEY)).toBe('ua');
		});

		/** Порожнє поле означає «хай буде будь-яке»: вигадувати за людину нікому. */
		it('порожнє поле дає імʼя зі списку, а не порожній підпис', async () => {
			const me = new PlayerIdentity(first);
			await me.load('uk', []);
			me.value = '   ';

			const who = me.forEntry([]);
			expect(who.trim()).not.toBe('');
			expect(store.get(NAME_KEY)).toBe(who);
		});
	});

	describe('forRoom()', () => {
		/**
		 * Типовий аватар НЕ пишеться: він і так підставляється на показі, а
		 * `members/$uid` пишеться на КОЖЕН вхід у кімнату.
		 */
		it('типовий аватар не їде в базу зовсім', () => {
			expect(new PlayerIdentity(first).forRoom()).toBeUndefined();
		});

		it('вибраний аватар їде рядком', () => {
			store.set(AVATAR_KEY, 'turtle:violet');
			expect(new PlayerIdentity(first).forRoom()).toBe('turtle:violet');
		});
	});
});
