import { describe, expect, it } from 'vitest';
import { claimsFirst, commonGames, planSeek, type SeekInput } from './seekPlan';
import type { LobbyRoom } from '$lib/net/lobby';
import type { Seek } from '$lib/net/seek';

/**
 * ХТО КОГО ЗНАХОДИТЬ В АВТОМАТИЧНОМУ ПОШУКУ (рішення автора 2026-09-26).
 *
 * Головне тут — два правила, яких не видно з екрана: береться той, хто чекає найдовше
 * (кімната чи запис), і з двох, що чекають одне одного, кімнату створює лише молодший.
 * Без другого двоє, що натиснули разом, вписали б кожен свою кімнату в запис іншого й
 * розійшлися б.
 *
 * Зворотні експерименти (прогнано): прибрати `claimsFirst` — червоніє «старший чекає»;
 * не звіряти версію кімнати — «…іншої версії — не пропонує», запису — «…але не іншої
 * версії»; брати найновішого — «найдовше».
 */

const SEATS = { pairs: 2, quiz: 2 };
const BOTH = { pairs: 4, quiz: 5 };

const room = (over: Partial<LobbyRoom> = {}): LobbyRoom => ({
	code: '42',
	hostUid: 'host',
	hostName: 'Господар',
	gameId: 'pairs',
	rulesVersion: 4,
	players: 1,
	since: 100,
	at: 150,
	...over
});

const seek = (uid: string, at: number, games: Seek['games'] = BOTH): Seek => ({ uid, at, games });

const input = (over: Partial<SeekInput> = {}): SeekInput => ({
	me: 'me',
	wanted: BOTH,
	rooms: [],
	seeks: [],
	waiting: false,
	seats: SEATS,
	random: () => 0,
	...over
});

describe('план автоматичного пошуку', () => {
	it('нікого — чекати', () => {
		expect(planSeek(input())).toEqual({ kind: 'wait' });
	});

	it('вільна кімната — зайти', () => {
		expect(planSeek(input({ rooms: [room()] }))).toEqual({
			kind: 'join',
			code: '42',
			gameId: 'pairs'
		});
	});

	it('кімнати гри, якої не вибрано, повної, своєї чи іншої версії — не пропонує', () => {
		const rooms = [
			room({ code: '1', gameId: 'quiz', rulesVersion: 5 }),
			room({ code: '2', players: 2 }),
			room({ code: '3', hostUid: 'me' }),
			room({ code: '4', rulesVersion: 3 })
		];
		expect(planSeek(input({ rooms, wanted: { pairs: 4 } }))).toEqual({ kind: 'wait' });
	});

	it('береться той, хто чекає найдовше, — кімната чи запис', () => {
		const rooms = [room({ code: 'new', since: 300 }), room({ code: 'old', since: 100 })];
		expect(planSeek(input({ rooms, seeks: [seek('s', 200)] }))).toMatchObject({ code: 'old' });
		expect(planSeek(input({ rooms, seeks: [seek('s', 50)] }))).toMatchObject({
			kind: 'claim',
			uid: 's'
		});
	});

	it('гра для запису — з перетину; обидві — навмання', () => {
		const onlyQuiz = [seek('s', 10, { quiz: 5 })];
		expect(planSeek(input({ seeks: onlyQuiz, random: () => 0 }))).toMatchObject({
			gameId: 'quiz'
		});
		const both = [seek('s', 10)];
		expect(planSeek(input({ seeks: both, random: () => 0 }))).toMatchObject({ gameId: 'pairs' });
		expect(planSeek(input({ seeks: both, random: () => 0.99 }))).toMatchObject({
			gameId: 'quiz'
		});
	});

	it('хто вибрав обидві, знаходить і того, хто вибрав одну, — але не іншої версії', () => {
		expect(planSeek(input({ seeks: [seek('s', 10, { pairs: 4 })] }))).toMatchObject({
			kind: 'claim',
			gameId: 'pairs'
		});
		expect(planSeek(input({ seeks: [seek('s', 10, { pairs: 3 })] }))).toEqual({ kind: 'wait' });
		expect(commonGames({ pairs: 4 }, { quiz: 5 })).toEqual([]);
	});

	it('двоє, що чекають, — кімнату створює молодший, а старший чекає далі', () => {
		const seeks = [seek('older', 10), seek('me', 20)];
		expect(planSeek(input({ seeks, waiting: true }))).toMatchObject({
			kind: 'claim',
			uid: 'older'
		});
		const mineFirst = [seek('me', 10), seek('younger', 20)];
		expect(planSeek(input({ seeks: mineFirst, waiting: true }))).toEqual({ kind: 'wait' });
		// Рівна мить — вирішує uid, і обидва бачать ту саму відповідь.
		expect(claimsFirst({ uid: 'b', at: 5 }, { uid: 'a', at: 5 })).toBe(true);
		expect(claimsFirst({ uid: 'a', at: 5 }, { uid: 'b', at: 5 })).toBe(false);
	});

	it('чекаю, а свого запису не видно — нікого не забираю: знайдуть мене', () => {
		expect(planSeek(input({ seeks: [seek('other', 10)], waiting: true }))).toEqual({
			kind: 'wait'
		});
	});

	it('запис, який не вдалося забрати, не пропонує знову', () => {
		const seeks = [seek('stuck', 10), seek('next', 20)];
		expect(planSeek(input({ seeks, passed: ['stuck'] }))).toMatchObject({ uid: 'next' });
		expect(planSeek(input({ seeks: [seek('stuck', 10)], passed: ['stuck'] }))).toEqual({
			kind: 'wait'
		});
	});

	it('той, хто чекає, заходить у кімнату, що відкрилася', () => {
		const seeks = [seek('me', 10)];
		expect(planSeek(input({ seeks, waiting: true, rooms: [room()] }))).toMatchObject({
			kind: 'join'
		});
	});
});
