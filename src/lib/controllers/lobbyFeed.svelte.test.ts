import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyRoom, LobbyWatcher } from '$lib/net/lobby';
import type { OwnRoom } from '$lib/net/ownRooms';

/**
 * Перелік кімнат і свої партії — одне джерело для всіх спільних ігор.
 *
 * ## Що тут головне
 *
 * «Кімнат немає» і «перелік не читається» — РІЗНІ стани, і другий не мусить
 * читатися як перший. Перша редакція на помилці підписки кликала `onRooms([])`,
 * і сторінка показувала «Відкритих кімнат поки немає» там, де насправді бракувало
 * прав: повідомлення не брехало про факт, але вело до хибного висновку. Тому
 * `unavailable` перевіряється окремо від порожнього списку.
 *
 * Друге — ПРИБИРАННЯ. Підписка їде через `await` (динамічний імпорт плюс вхід), і
 * сторінка може зникнути раніше, ніж та підписка встановиться. Тоді знімати її
 * треба одразу — інакше вона живе довше за сторінку й пише в контролер, якого вже
 * ніхто не показує.
 *
 * Мережа підмінена на межі модуля: `watch()` і `load()` тягнуть `net/lobby` та
 * `net/ownRooms` ДИНАМІЧНИМ імпортом, і передати їм іншу реалізацію нікуди —
 * інтерфейсу транспорту тут, на відміну від кімнати (`net/roomTypes.ts`), немає.
 */

const room = (over: Partial<LobbyRoom> = {}): LobbyRoom => ({
	code: 'AAAA',
	hostUid: 'uid-host',
	hostName: 'Мудра Сова',
	gameId: 'pairs',
	rulesVersion: 1,
	players: 1,
	at: 1,
	...over
});

const own = (over: Partial<OwnRoom> = {}): OwnRoom => ({
	code: 'BBBB',
	gameId: 'quiz',
	status: 'playing',
	hostUid: 'uid-me',
	amHost: true,
	...over
});

const watchLobby = vi.fn<(gameId: string, watcher: LobbyWatcher) => Promise<() => void>>();
const listOwnRooms = vi.fn<() => Promise<OwnRoom[]>>(async () => []);
const friendUids = vi.fn<() => Promise<string[]>>(async () => []);
const unlist = vi.fn<() => void>();
const publishRoom = vi.fn<(entry: Omit<LobbyRoom, 'at'>) => Promise<() => void>>(
	async () => unlist
);
const updateGames = vi.fn<
	(gameId: string, code: string, games: Record<string, number>) => Promise<void>
>(async () => {});

vi.mock('$lib/net/lobby', () => ({ watchLobby, publishRoom, updateGames }));

/**
 * Гра переліку. Тепер це АДРЕСА гілки (`lobby/{gameId}`), а не фільтр: кімнати
 * чужої гри в підписку просто не приходять, а свої партії відсіюються за полем.
 */
const GAME = 'quiz';
vi.mock('$lib/net/ownRooms', () => ({ listOwnRooms }));
vi.mock('$lib/net/follows', () => ({ friendUids }));

const { LobbyFeed } = await import('./lobbyFeed.svelte');

/** Чекання «поки підписка встановиться»: усередині лише мікрозадачі. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('LobbyFeed', () => {
	beforeEach(() => {
		watchLobby.mockReset().mockResolvedValue(() => {});
		listOwnRooms.mockReset().mockResolvedValue([]);
		friendUids.mockReset().mockResolvedValue([]);
		unlist.mockReset();
		publishRoom.mockReset().mockResolvedValue(unlist);
		updateGames.mockReset().mockResolvedValue(undefined);
	});

	it('перевірка жива: спочатку порожньо й доступно', () => {
		const feed = new LobbyFeed(GAME);
		expect(feed.rooms).toEqual([]);
		expect(feed.own).toEqual([]);
		expect(feed.friends).toEqual([]);
		expect(feed.hasMore).toBe(false);
		expect(feed.unavailable).toBe(false);
		expect(feed.takenNames).toEqual([]);
	});

	describe('watch()', () => {
		it('приїхалі кімнати кладуться в список разом із позначкою обрізки', async () => {
			let push: LobbyWatcher['onRooms'] = () => {};
			watchLobby.mockImplementation(async (_gameId, watcher) => {
				push = watcher.onRooms;
				return () => {};
			});

			const feed = new LobbyFeed(GAME);
			const names: string[][] = [];
			const stop = feed.watch((next) => names.push(next));
			await settle();

			push([room(), room({ code: 'CCCC', hostName: 'Вірний Собака' })], true);

			expect(feed.rooms).toHaveLength(2);
			expect(feed.hasMore).toBe(true);
			expect(feed.unavailable).toBe(false);
			expect(feed.takenNames).toEqual(['Мудра Сова', 'Вірний Собака']);
			expect(names, 'сторінці не сказали, які імена вже зайняті').toEqual([
				['Мудра Сова', 'Вірний Собака']
			]);
			stop();
		});

		/** «Не читається» — окремий стан, а не порожній список. */
		it('недоступний перелік не виглядає як «кімнат немає»', async () => {
			let fail: LobbyWatcher['onUnavailable'] = () => {};
			let push: LobbyWatcher['onRooms'] = () => {};
			watchLobby.mockImplementation(async (_gameId, watcher) => {
				push = watcher.onRooms;
				fail = watcher.onUnavailable;
				return () => {};
			});

			const feed = new LobbyFeed(GAME);
			const stop = feed.watch(() => {});
			await settle();

			push([room()], true);
			fail('PERMISSION_DENIED');

			expect(feed.rooms).toEqual([]);
			expect(feed.hasMore).toBe(false);
			expect(feed.unavailable).toBe(true);
			stop();
		});

		it('кімнати після невдачі знімають позначку недоступності', async () => {
			let fail: LobbyWatcher['onUnavailable'] = () => {};
			let push: LobbyWatcher['onRooms'] = () => {};
			watchLobby.mockImplementation(async (_gameId, watcher) => {
				push = watcher.onRooms;
				fail = watcher.onUnavailable;
				return () => {};
			});

			const feed = new LobbyFeed(GAME);
			const stop = feed.watch(() => {});
			await settle();

			fail('PERMISSION_DENIED');
			push([room()], false);

			expect(feed.unavailable).toBe(false);
			expect(feed.rooms).toHaveLength(1);
			stop();
		});

		it('підписка, що не встановилася, дає «недоступно», а не падіння', async () => {
			watchLobby.mockRejectedValue(new Error('offline'));

			const feed = new LobbyFeed(GAME);
			const stop = feed.watch(() => {});
			await settle();

			expect(feed.unavailable).toBe(true);
			expect(() => stop()).not.toThrow();
		});

		it('прибирання після встановлення знімає підписку', async () => {
			const off = vi.fn();
			watchLobby.mockResolvedValue(off);

			const feed = new LobbyFeed(GAME);
			const stop = feed.watch(() => {});
			await settle();

			stop();
			expect(off).toHaveBeenCalledTimes(1);
		});

		/**
		 * ГОЛОВНЕ про прибирання: сторінка могла зникнути, поки їхав імпорт і вхід.
		 * Тоді підписку треба знімати ОДРАЗУ — інакше вона живе довше за сторінку.
		 */
		it('прибирання ДО встановлення знімає підписку, щойно вона приїде', async () => {
			const off = vi.fn();
			let arrive: (value: () => void) => void = () => {};
			watchLobby.mockImplementation(
				() =>
					new Promise<() => void>((resolve) => {
						arrive = resolve;
					})
			);

			const feed = new LobbyFeed(GAME);
			const stop = feed.watch(() => {});
			// Імпорт доїхав, `watchLobby` уже кликнули — але вхід ще йде.
			await settle();
			stop();

			arrive(off);
			await settle();

			expect(off, 'підписка лишилася жити без сторінки').toHaveBeenCalledTimes(1);
		});
	});

	describe('load()', () => {
		/** Свої партії й друзі — ОДИН запит на двох, а не дві підписки. */
		it('набирає свої кімнати й uid друзів', async () => {
			listOwnRooms.mockResolvedValue([own(), own({ code: 'DDDD', amHost: false })]);
			friendUids.mockResolvedValue(['uid-a', 'uid-b']);

			const feed = new LobbyFeed(GAME);
			feed.load();
			await settle();

			expect(feed.own).toHaveLength(2);
			expect(feed.friends).toEqual(['uid-a', 'uid-b']);
		});

		/** Друзів немає або акаунта немає зовсім — той самий результат. */
		it('без акаунта список друзів просто порожній', async () => {
			friendUids.mockResolvedValue([]);

			const feed = new LobbyFeed(GAME);
			feed.load();
			await settle();

			expect(feed.friends).toEqual([]);
			expect(feed.own).toEqual([]);
		});

		it('прибирання до приїзду відповіді нічого не записує', async () => {
			let arrive: (value: OwnRoom[]) => void = () => {};
			listOwnRooms.mockImplementation(
				() =>
					new Promise<OwnRoom[]>((resolve) => {
						arrive = resolve;
					})
			);
			friendUids.mockResolvedValue(['uid-a']);

			const feed = new LobbyFeed(GAME);
			const stop = feed.load();
			// Запит уже поїхав; сторінка вмирає, поки відповідь у дорозі.
			await settle();
			stop();

			arrive([own()]);
			await settle();

			expect(feed.own, 'відповідь записалася в контролер після демонтажу').toEqual([]);
			expect(feed.friends).toEqual([]);
		});
	});
});

/**
 * МІЙ РЯДОК У ПЕРЕЛІКУ: опублікувати, наздогнати набором, зняти.
 *
 * Доти цим господарювала сторінка — тримала нульовану замикачку `unlist` і
 * розкладала її по чотирьох місцях. Поки операція була одна, це трималося; щойно
 * набір ігор став правитися просто в кімнаті, з'явилася друга, і виявилося, що
 * стан без господаря. Перевіряється тут саме те, що зламалося б непомітно: чи
 * знає перелік, що кімната в ньому Є.
 */
describe('свій рядок у переліку', () => {
	const entry = { code: 'AAAA', hostUid: 'uid-me', hostName: 'Я', rulesVersion: 1, players: 1 };

	/*
	 * Свій `beforeEach`, бо цей блок — сусід головного, а не його дитина. Перша
	 * редакція про це забула, і «знятий рядок більше не оновлюється» червонів на
	 * виклику з ПОПЕРЕДНЬОГО випадку: перевірка була права, а не зайва.
	 */
	beforeEach(() => {
		unlist.mockReset();
		publishRoom.mockReset().mockResolvedValue(unlist);
		updateGames.mockReset().mockResolvedValue(undefined);
	});

	it('гру бере із себе, а не з виклику', async () => {
		const feed = new LobbyFeed(GAME);

		await feed.publish(entry);

		expect(publishRoom).toHaveBeenCalledWith({ ...entry, gameId: GAME });
	});

	it('знімає рядок, і другий раз нічого не робить', async () => {
		const feed = new LobbyFeed(GAME);
		await feed.publish(entry);

		feed.unpublish();
		feed.unpublish();

		expect(unlist).toHaveBeenCalledTimes(1);
	});

	/**
	 * Закрита кімната («лише друзі») у перелік не писалася — оновлювати нічого. Це
	 * не тихе ігнорування, а відповідь: без цієї межі кожна зміна набору в закритій
	 * кімнаті стукала б у базу за записом, якого немає.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `if (!this.#unlist) return` —
	 * червоніє «поза переліком оновлювати нічого».
	 */
	it('поза переліком оновлювати нічого', async () => {
		const feed = new LobbyFeed(GAME);

		await feed.setGames('AAAA', { game_myths: 1 });

		expect(updateGames).not.toHaveBeenCalled();
	});

	it('опублікованій кімнаті набір наздоганяє', async () => {
		const feed = new LobbyFeed(GAME);
		await feed.publish(entry);

		await feed.setGames('AAAA', { game_myths: 1 });

		expect(updateGames).toHaveBeenCalledWith(GAME, 'AAAA', { game_myths: 1 });
	});

	it('знятий рядок більше не оновлюється', async () => {
		const feed = new LobbyFeed(GAME);
		await feed.publish(entry);
		feed.unpublish();

		await feed.setGames('AAAA', { game_myths: 1 });

		expect(updateGames, 'кімната вже не в переліку').not.toHaveBeenCalled();
	});
});
