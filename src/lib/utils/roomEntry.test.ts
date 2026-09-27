import { describe, expect, it } from 'vitest';
import { entryErrorKey, entryRefusal, listedSince, newcomerRole } from './roomEntry';
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

	/**
	 * «КОД ЗАЙНЯТИЙ» ПІСЛЯ ВІДМОВ ПРАВИЛ — ЦЕ ВІДМОВА ПРАВИЛ (шостий аудит, R1): доти
	 * людина чула «спробуйте ще раз», хоч повтор не допомагав. Справжній зайнятий код
	 * (без причини) — і далі «спробуйте ще раз».
	 */
	it('причина під обгорткою: відмова правил — оновити сторінку', () => {
		const denied = new Error('PERMISSION_DENIED: Permission denied');
		expect(entryErrorKey('room-code-taken', denied)).toBe('pairs.rulesStale');
		expect(entryErrorKey('room-code-taken')).toBe('pairs.netFailed');
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

describe('відколи кімната в переліку', () => {
	it('мітка створення; без неї — останнє оновлення', () => {
		expect(listedSince({ at: 300 })).toBe(300);
		expect(listedSince({ since: 100, at: 300 })).toBe(100);
	});
});
