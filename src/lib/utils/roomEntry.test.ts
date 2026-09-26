import { describe, expect, it } from 'vitest';
import { entryErrorKey, entryRefusal, listedSince, newcomerRole, quickPick } from './roomEntry';
import type { LobbyRoom } from '$lib/net/lobby';
import type { RoomInfo } from '$lib/net/roomTypes';

const game = { gameId: 'quiz', rulesVersion: 3 };

const info = (over: Partial<RoomInfo> = {}): RoomInfo => ({
	gameId: 'quiz',
	rulesVersion: 3,
	seed: 1,
	status: 'lobby',
	hostUid: 'h',
	config: {},
	...over
});

const listed = (code: string, over: Partial<LobbyRoom> = {}): LobbyRoom => ({
	code,
	hostUid: 'h',
	hostName: 'Господар',
	gameId: 'quiz',
	rulesVersion: 3,
	players: 1,
	at: 100,
	...over
});

describe('чи пускати в кімнату', () => {
	it('перевірка жива: та сама гра й версія — пускаємо', () => {
		expect(entryRefusal(info(), game)).toBeNull();
	});

	it('немає кімнати, чужа гра, старша й новіша версія — чотири різні відповіді', () => {
		expect(entryRefusal(null, game)).toBe('pairs.noRoom');
		expect(entryRefusal(info({ gameId: 'pairs' }), game)).toBe('quiz.otherGame');
		expect(entryRefusal(info({ rulesVersion: 2 }), game)).toBe('pairs.roomOlder');
		expect(entryRefusal(info({ rulesVersion: 4 }), game)).toBe('pairs.oldVersion');
	});
});

describe('повідомлення на невдалий вхід', () => {
	it('правила не викладені, правила застарі, мережа — кожне своє', () => {
		expect(entryErrorKey('rules-missing')).toBe('pairs.rulesMissing');
		expect(entryErrorKey('PERMISSION_DENIED: Permission denied')).toBe('pairs.rulesStale');
		expect(entryErrorKey('timeout')).toBe('pairs.netFailed');
		expect(entryErrorKey('room-full')).toBe('pairs.roomFull');
	});

	// Шматка збірки на сервері вже немає: доти це було «спробуйте ще раз» без кінця.
	it('нова збірка на сервері — «оновіть сторінку», а не «спробуйте ще раз»', () => {
		expect(
			entryErrorKey('Failed to fetch dynamically imported module: https://x/rtdbRoom.js')
		).toBe('pairs.newBuild');
	});
});

describe('роль того, кого в кімнаті ще немає', () => {
	const roster = [{ uid: 'uid-back', name: 'Вернувся' }];

	it('у розпочату партію — роль гри; у лобі й дограну — гравцем', () => {
		expect(newcomerRole(info({ status: 'playing' }), 'uid-new', 'spectator')).toBe('spectator');
		expect(newcomerRole(info({ status: 'lobby' }), 'uid-new', 'spectator')).toBe('player');
		expect(newcomerRole(info({ status: 'over' }), 'uid-new', 'spectator')).toBe('player');
	});

	it('той, хто в складі, — гравець і посеред партії', () => {
		expect(newcomerRole(info({ status: 'playing', roster }), 'uid-back', 'spectator')).toBe(
			'player'
		);
	});
});

describe('кімната для швидкої гри', () => {
	/**
	 * НАЙСТАРША — ЗА МИТТЮ СТВОРЕННЯ, а не за останнім оновленням (аудит 2026-09-26):
	 * `at` переписується щоудару серцебиття, і за ним «швидка гра» брала кімнату, яку
	 * найдовше не оновлювали.
	 *
	 * Зворотний експеримент: сортувати за `at` — червоніє.
	 */
	it('найстарша за створенням, хоч її запис оновлено щойно', () => {
		const rooms = [listed('old', { since: 100, at: 900 }), listed('new', { since: 500, at: 600 })];
		expect(quickPick(rooms, game, 2)?.code).toBe('old');
	});

	it('запис без мітки створення міряється останнім оновленням', () => {
		expect(listedSince({ at: 300 })).toBe(300);
		expect(listedSince({ since: 100, at: 300 })).toBe(100);
	});

	it('найстарша з вільних, а не найновіша', () => {
		const rooms = [
			listed('new', { at: 300 }),
			listed('old', { at: 100 }),
			listed('mid', { at: 200 })
		];
		expect(quickPick(rooms, game, 2)?.code).toBe('old');
	});

	/**
	 * Дефект копії на сторінці вікторини: «швидка гра» не звіряла версію й вела в
	 * кімнату, у яку зайти однаково не дадуть (аудит 2026-09-23).
	 */
	it('кімната іншої версії правил не пропонується', () => {
		const rooms = [listed('stale', { rulesVersion: 2, at: 50 }), listed('fresh', { at: 100 })];
		expect(quickPick(rooms, game, 2)?.code).toBe('fresh');
	});

	it('повна кімната не вільна; власний фільтр гри теж діє', () => {
		const rooms = [listed('full', { players: 2, at: 50 }), listed('ok', { at: 100 })];
		expect(quickPick(rooms, game, 2)?.code).toBe('ok');
		expect(quickPick(rooms, game, 2, () => false)).toBeNull();
	});
});
