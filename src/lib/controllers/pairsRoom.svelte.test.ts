import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import type { Member, RoomInfo } from '$lib/net/roomTypes';

/**
 * «ЗНАЙДИ ПАРУ» ДЛЯ СЕСІЇ — адаптер і реакції, що доти жили в маршруті (аудит
 * 2026-09-24). Тест сесії підставляв саморобну копію адаптера; тепер справжній
 * перевіряється тут, на кімнаті в памʼяті.
 *
 * Зворотні експерименти: прибрати перевірку глядача в нагороді — червоніє
 * «глядачеві балів немає»; прибрати таймер перегортання — «невдала пара
 * перегортається сама».
 */

const playerData = { awardOnline: vi.fn() };
vi.mock('$lib/services/playerData.svelte', () => ({ playerData }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { addScore: vi.fn() } }));

const { PairsMatch, PEEK_MS } = await import('./pairsMatch.svelte');
const { PAIRS_PLAYERS, attachPairsPolicies, pairsGame } = await import('./pairsRoom.svelte');
const { PAIRS_RULES_VERSION } = await import('$lib/config/roomRules');

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const members = (): Member[] => [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

const info = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'pairs',
	rulesVersion: PAIRS_RULES_VERSION,
	// Те саме зерно, що в `pairsMatch.svelte.test.ts`: перший хід — у господаря.
	seed: 20260800,
	status: 'playing',
	hostUid: HOST,
	roster: rosterOf(members()),
	config: { pairs: 4, cols: 4 },
	...over
});

const beam = () => ({ listen: vi.fn(async () => () => {}), clear: vi.fn() });

let cleanup: (() => void) | null = null;
afterEach(() => {
	cleanup?.();
	cleanup = null;
	vi.useRealTimers();
	vi.clearAllMocks();
});

describe('адаптер «Знайди пару»', () => {
	it('версія, мінімум і роль новачка — з гри, розкладка — від кімнати', () => {
		const game = pairsGame(
			beam(),
			() => 0.5,
			() => ({ pairs: 6, cols: 4 })
		);
		expect(game.rulesVersion).toBe(PAIRS_RULES_VERSION);
		expect(game.minPlayers).toBe(PAIRS_PLAYERS);
		expect(game.lateRole).toBe('spectator');
		expect(game.autoStartReady(2)).toBe(true);
		expect(game.autoStartReady(3), 'третій — глядач, автостарт рівно на двох').toBe(false);
		expect(game.newRoom().config).toEqual({ pairs: 6, cols: 4 });
	});

	it('глядачеві балів немає, переможцеві — є', () => {
		const game = pairsGame(beam(), () => 0.5);
		const room = new LocalRoom(info(), members());
		const watcher = new PairsMatch('uid-eye', room.transport());
		const off = watcher.listen();

		game.award(watcher, 'uid-eye');

		expect(watcher.iAmSpectator).toBe(true);
		expect(playerData.awardOnline).not.toHaveBeenCalled();
		off();
	});

	it('підписка на підсвітку — від кімнати', async () => {
		const light = beam();
		const game = pairsGame(light, () => 0.5);
		await game.listen?.('42');
		expect(light.listen).toHaveBeenCalledWith('42');
	});
});

describe('реакції «Знайди пару»', () => {
	it('невдала пара перегортається сама — у того, чия черга', async () => {
		vi.useFakeTimers();
		const room = new LocalRoom(info(), members());
		const host = new PairsMatch(HOST, room.transport());
		const off = host.listen();
		const holder = $state({ match: host as InstanceType<typeof PairsMatch> | null });
		cleanup = $effect.root(() => attachPairsPolicies(holder, beam()));

		// Два індекси з різних пар — промах.
		const slots = host.game.slots;
		const first = 0;
		const second = slots.findIndex(
			(slot, index) => index > 0 && slot.card.pairKey !== slots[0].card.pairKey
		);
		await host.flip(first);
		await host.flip(second);
		flushSync();
		expect(host.game.awaitingPeek, 'перевірка жива: пара чекає перегортання').toBe(true);

		await vi.advanceTimersByTimeAsync(PEEK_MS);
		flushSync();

		expect(host.game.awaitingPeek).toBe(false);
		off();
	});

	it('не в свою чергу підсвітка гасне', () => {
		const room = new LocalRoom(info(), members());
		const guest = new PairsMatch(GUEST, room.transport());
		const off = guest.listen();
		const light = beam();
		const holder = $state({ match: guest as InstanceType<typeof PairsMatch> | null });
		cleanup = $effect.root(() => attachPairsPolicies(holder, light));
		flushSync();

		expect(guest.myTurn, 'перевірка жива: ходить господар').toBe(false);
		expect(light.clear).toHaveBeenCalled();
		off();
	});
});

/**
 * ОДНА СІТКА НА ВСІХ, МІРИЛО — НАЙМЕНШИЙ ЕКРАН (рішення автора 2026-09-26): є
 * серед присутніх хоч один телефон — розкладка телефонна для всіх.
 *
 * Зворотний експеримент: брати сітку творця кімнати (не з учасників) — червоніє
 * «телефон серед присутніх».
 */
describe('сітка на старті', () => {
	const game = pairsGame({ listen: async () => () => {} } as never, () => 0.5, () => ({ pairs: 14, cols: 7 }));
	const member = (uid: string, compact?: boolean): Member =>
		({ uid, name: uid, role: 'player', order: 1, ...(compact ? { compact } : {}) }) as Member;

	it('телефон серед присутніх — телефонна сітка для всіх', () => {
		const members = [member('a'), member('b', true)];
		expect(game.startConfig?.(members, ['a', 'b'])).toEqual({ pairs: 10, cols: 4 });
	});

	it('самі великі екрани — повна колода', () => {
		const members = [member('a'), member('b')];
		expect(game.startConfig?.(members, ['a', 'b'])).toEqual({ pairs: 14, cols: 7 });
	});

	it('телефон, якого немає на звʼязку, сітки не вибирає', () => {
		const members = [member('a'), member('b', true)];
		expect(game.startConfig?.(members, ['a'])).toEqual({ pairs: 14, cols: 7 });
	});

	it('присутності ще немає — рахуються всі учасники', () => {
		const members = [member('a'), member('b', true)];
		expect(game.startConfig?.(members, [])).toEqual({ pairs: 10, cols: 4 });
	});
});
