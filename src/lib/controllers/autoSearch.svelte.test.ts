import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAIRS_RULES_VERSION, QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { LocalSeekBoard, type SeekRoom } from '$lib/net/localSeek';
import { toast } from './toast.svelte';
import {
	AutoSearch,
	CLAIM_RETRY_MS,
	PARTNER_WAIT_MS,
	SEEK_POLL_MS,
	type SearchDeps
} from './autoSearch.svelte';
import type { LobbyRoom } from '$lib/net/lobby';
import type { OnlineGame } from '$lib/utils/crossGame';

/**
 * «АВТОМАТИЧНИЙ ПОШУК» — ДВОЄ ШУКАЧІВ В ОДНОМУ ПРОЦЕСІ (рішення автора 2026-09-26).
 *
 * Дошка пошуку — `LocalSeekBoard`, та сама, що в контракті над емулятором
 * (`net/seek.emulator.test.ts`), тож правила збігу тут справжні: лише створити, лише
 * господарем своєї кімнати в лобі, лише гри й версії, яку просили. Кімнати — мапа, а
 * «партнер зайшов» — його присутність у кімнаті, яку бачить той, хто кімнату створив.
 *
 * Зворотні експерименти (прогнано): не йти за збігом, який повернуло зняття запису, —
 * червоніє «збіг, що приїхав саме тоді…»; не закривати кімнату, куди партнер не прийшов,
 * — «партнер не прийшов»; не чекати присутності партнера — «кімната під збіг»; не
 * памʼятати записів, які не вдалося забрати, — «…не береться знову». Останній випадок
 * знайшов саме експеримент: до памʼяті такий запис брався по колу без паузи, щоразу зі
 * створеною й закритою кімнатою.
 */

const VERSIONS: Record<OnlineGame, number> = {
	pairs: PAIRS_RULES_VERSION,
	quiz: QUIZ_RULES_VERSION
};

interface Person {
	uid: string;
	search: AutoSearch;
	/** Куди людина пішла: гра й код. */
	went: Array<[OnlineGame, string]>;
}

function world() {
	let clock = 1000;
	let codes = 10;
	const rooms = new Map<string, SeekRoom>();
	const lobby: LobbyRoom[] = [];
	/** Хто в присутності кімнати — і хто на неї підписаний. */
	const here = new Map<string, Set<string>>();
	const watchers = new Map<string, Set<(uid: string) => void>>();
	const board = new LocalSeekBoard({ now: () => clock, room: (code) => rooms.get(code) ?? null });

	function person(uid: string, { ghost = false } = {}): Person {
		const went: Array<[OnlineGame, string]> = [];
		const deps: SearchDeps = {
			seek: board.as(uid),
			me: async () => uid,
			rooms: () => lobby,
			createRoom: async (gameId) => {
				const code = String((codes += 1));
				rooms.set(code, { hostUid: uid, status: 'lobby', gameId, rulesVersion: VERSIONS[gameId] });
				here.set(code, new Set([uid]));
				return code;
			},
			closeRoom: async (code) => void rooms.delete(code),
			watchOthers: async (code, onCount) => {
				const count = () => [...(here.get(code) ?? [])].filter((who) => who !== uid).length;
				const listener = () => onCount(count());
				const set = watchers.get(code) ?? new Set();
				set.add(listener);
				watchers.set(code, set);
				onCount(count());
				return () => set.delete(listener);
			},
			go: (gameId, code) => {
				went.push([gameId, code]);
				// Привид «іде» в кімнату, але в ній так і не зʼявляється.
				if (ghost || !rooms.has(code)) return;
				here.set(code, new Set([...(here.get(code) ?? []), uid]));
				for (const listener of watchers.get(code) ?? []) listener(uid);
			},
			random: () => 0
		};
		return { uid, search: new AutoSearch(deps), went };
	}

	return {
		person,
		rooms,
		lobby,
		board,
		tick: (ms = 1) => (clock += ms),
		seeks: () => board.as('observer').list()
	};
}

/** Кроки пошуку йдуть через мікрозадачі й таймери: дати їм доїхати. */
const settle = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('автоматичний пошук', () => {
	it('нікого немає — ставить свій запис і чекає', async () => {
		const w = world();
		const a = w.person('a');
		void a.search.start();
		await settle();
		expect(a.search.phase).toBe('waiting');
		expect((await w.seeks()).map((seek) => seek.uid)).toEqual(['a']);
		a.search.cancel();
	});

	it('двоє, що натиснули разом, знаходять одне одного — в одній кімнаті', async () => {
		const w = world();
		const [a, b] = [w.person('a'), w.person('b')];
		// Разом — обидва прочитали порожній пошук раніше, ніж хтось поставив запис.
		void a.search.start();
		void b.search.start();
		await settle();
		expect([a.search.phase, b.search.phase]).toEqual(['waiting', 'waiting']);
		await vi.advanceTimersByTimeAsync(SEEK_POLL_MS);

		expect(a.went).toHaveLength(1);
		expect(b.went).toEqual(a.went);
		const [[gameId, code]] = a.went;
		// Та сама мить — вирішує uid, і обидва бачать ту саму відповідь.
		expect(w.rooms.get(code)?.hostUid, 'кімнату створив «молодший»').toBe('b');
		expect(gameId, 'обидва вибрали обидві — навмання (тут перша)').toBe('pairs');
		expect(await w.seeks()).toEqual([]);
	});

	it('хто вибрав обидві, знаходить того, хто вибрав лише вікторину', async () => {
		const w = world();
		const [a, b] = [w.person('a'), w.person('b')];
		a.search.toggle('pairs');
		expect(a.search.games).toEqual(['quiz']);
		void a.search.start();
		await settle();
		w.tick();
		void b.search.start();
		await vi.advanceTimersByTimeAsync(0);
		expect(a.went).toHaveLength(1);
		expect(a.went[0][0]).toBe('quiz');
		expect(b.went).toEqual(a.went);
	});

	it('вільна кімната — заходить одразу, без запису', async () => {
		const w = world();
		w.lobby.push({
			code: '77',
			hostUid: 'host',
			hostName: 'Господар',
			gameId: 'quiz',
			rulesVersion: QUIZ_RULES_VERSION,
			players: 1,
			at: 1
		});
		const a = w.person('a');
		await a.search.start();
		expect(a.went).toEqual([['quiz', '77']]);
		expect(await w.seeks()).toEqual([]);
	});

	it('той, хто чекає, заходить у кімнату, що відкрилася, і знімає свій запис', async () => {
		const w = world();
		const a = w.person('a');
		void a.search.start();
		await settle();
		w.lobby.push({
			code: '78',
			hostUid: 'host',
			hostName: 'Господар',
			gameId: 'pairs',
			rulesVersion: PAIRS_RULES_VERSION,
			players: 1,
			at: 2
		});
		await vi.advanceTimersByTimeAsync(SEEK_POLL_MS);
		expect(a.went).toEqual([['pairs', '78']]);
		expect(await w.seeks()).toEqual([]);
	});

	it('кімната під збіг: той, хто її створив, іде туди, лише коли партнер зайшов', async () => {
		const w = world();
		const [a, b] = [w.person('a', { ghost: true }), w.person('b')];
		void a.search.start();
		await settle();
		w.tick();
		void b.search.start();
		await settle();
		expect(a.went, 'збіг дійшов до того, хто чекав').toHaveLength(1);
		expect(b.search.phase, 'партнера ще немає — чекаємо тут').toBe('found');
		expect(b.went).toEqual([]);
	});

	it('партнер не прийшов — кімнату закрито, пошук далі', async () => {
		const w = world();
		const [a, b] = [w.person('a', { ghost: true }), w.person('b')];
		void a.search.start();
		await settle();
		w.tick();
		void b.search.start();
		await settle();
		const [[, code]] = a.went;
		await vi.advanceTimersByTimeAsync(PARTNER_WAIT_MS);
		expect(w.rooms.has(code), 'кімнату, куди ніхто не прийшов, закрито').toBe(false);
		expect(b.search.phase, 'і пошук іде далі — власним записом').toBe('waiting');
		expect(b.went).toEqual([]);
		b.search.cancel();
	});

	it('скасування знімає запис і закриває кімнату під збіг', async () => {
		const w = world();
		const [a, b] = [w.person('a', { ghost: true }), w.person('b')];
		void a.search.start();
		await settle();
		w.tick();
		void b.search.start();
		await settle();
		const [[, code]] = a.went;
		b.search.cancel();
		await settle();
		expect(b.search.phase).toBe('idle');
		expect(w.rooms.has(code)).toBe(false);

		const c = w.person('c');
		void c.search.start();
		await settle();
		c.search.cancel();
		expect(await w.seeks(), 'після скасування запису не лишилося').toEqual([]);
	});

	it('останню гру не вимкнути, а посеред пошуку перемикачі не діють', async () => {
		const w = world();
		const a = w.person('a');
		a.search.toggle('quiz');
		a.search.toggle('pairs');
		expect(a.search.games).toEqual(['pairs']);
		void a.search.start();
		a.search.toggle('quiz');
		expect(a.search.games).toEqual(['pairs']);
		a.search.cancel();
	});

	it('збіг, що приїхав саме тоді, як я вирушив забирати чужий запис, не губиться', async () => {
		const w = world();
		const b = w.person('b');
		const seek = b.search.deps.seek;
		const create = vi.spyOn(b.search.deps, 'createRoom');
		const claim = vi.spyOn(seek, 'claim');
		// Мій запис уже стоїть, і старший за мене з’явився, — але поки я знімав свій,
		// хтось устиг вписати в нього свою кімнату (гонку тримає транзакція в `withdraw`).
		vi.spyOn(seek, 'open').mockImplementation(async () => ({
			stop: () => {},
			withdraw: async () => ({ code: '55', gameId: 'quiz' })
		}));
		const list = vi.spyOn(seek, 'list').mockResolvedValueOnce([]);
		list.mockResolvedValue([
			{ uid: 'a', at: 1, games: { pairs: PAIRS_RULES_VERSION, quiz: QUIZ_RULES_VERSION } },
			{ uid: 'b', at: 2, games: { pairs: PAIRS_RULES_VERSION, quiz: QUIZ_RULES_VERSION } }
		]);
		void b.search.start();
		await settle();
		await vi.advanceTimersByTimeAsync(SEEK_POLL_MS);
		expect(b.went, 'іде туди, куди його вже покликали').toEqual([['quiz', '55']]);
		expect(create, 'а своєї кімнати під старшого не створює').not.toHaveBeenCalled();
		expect(claim).not.toHaveBeenCalled();
	});

	it('запис, який забрати не вдалося, не береться знову — і кімната під нього закрита', async () => {
		const w = world();
		const b = w.person('b');
		const claim = vi.spyOn(b.search.deps.seek, 'claim');
		// Запис стоїть у переліку, але правило його не віддає (на дошці його немає зовсім).
		const ghost = { uid: 'a', at: 1, games: { pairs: PAIRS_RULES_VERSION } };
		const list = vi.spyOn(b.search.deps.seek, 'list');
		list.mockResolvedValue([ghost]);
		void b.search.start();
		await vi.advanceTimersByTimeAsync(CLAIM_RETRY_MS + 3 * SEEK_POLL_MS);
		expect(claim, 'не по колу: один раз').toHaveBeenCalledTimes(1);
		expect(w.rooms.size, 'кімнату під нього закрито').toBe(0);
		expect(b.search.phase).toBe('waiting');
		b.search.cancel();
	});

	it('пошук не вдався — тост і назад у спокій', async () => {
		const w = world();
		const a = w.person('a');
		const error = vi.spyOn(toast, 'error');
		vi.spyOn(a.search.deps.seek, 'list').mockRejectedValue(new Error('PERMISSION_DENIED'));
		await a.search.start();
		expect(a.search.phase).toBe('idle');
		expect(error).toHaveBeenCalledWith('online.searchFailed');
	});
});
