// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { SWEEP_LIMIT, SWEEP_SILENCE_MS, planSweep } from '../scripts/sweep-plan.mjs';

/**
 * ЩО ЗНОСИТЬ ПРИБИРАЛЬНИК — без бази й без ключів (аудит 2026-09-24).
 *
 * Доти рішення жило всередині скрипта, який можна запустити лише проти
 * продакшну, і зносило тільки `rooms/{code}`: запис у переліку, присутність і
 * індекс своїх кімнат лишалися назавжди, а привид присутності тримав «господаря
 * на звʼязку» в живій кімнаті.
 *
 * Зворотні експерименти: не зносити перелік без кімнати — червоніє другий; не
 * чіпати присутність живої кімнати — третій; зносити й ту, що поза межею
 * прогону, — останній.
 */

const NOW = 1_800_000_000_000;
const OLD = NOW - SWEEP_SILENCE_MS - 60_000;
const FRESH = NOW - 60_000;

const room = (aliveAt: number) => ({ info: { aliveAt } });

describe('прибиральник', () => {
	it('перевірка жива: тиха кімната йде, жива лишається', () => {
		const plan = planSweep({
			rooms: { '42': room(OLD), '43': room(FRESH) },
			lobby: null,
			presence: null,
			myRooms: null,
			now: NOW
		});
		expect(plan.doomed.map((dead) => dead.code)).toEqual(['42']);
		expect(plan.paths).toEqual(['rooms/42']);
	});

	it('разом із кімнатою — усе, що на неї вказує', () => {
		const plan = planSweep({
			rooms: { '42': room(OLD), '43': room(FRESH) },
			lobby: { quiz: { '42': {}, '43': {} }, pairs: { '7': {} } },
			presence: { '42': { a: { at: FRESH } } },
			myRooms: { a: { '42': {}, '43': {} }, b: { '99': {} } },
			now: NOW
		});
		expect(plan.paths.sort()).toEqual(
			[
				'rooms/42',
				'lobby/quiz/42',
				// Кімнати `7` немає зовсім — запис у переліку вказує в порожнє.
				'lobby/pairs/7',
				'presence/42',
				'myRooms/a/42',
				'myRooms/b/99'
			].sort()
		);
	});

	it('у живій кімнаті — лише привиди присутності, старші за тишу', () => {
		const plan = planSweep({
			rooms: { '43': room(FRESH) },
			lobby: null,
			presence: { '43': { ghost: { at: OLD }, here: { at: FRESH }, legacy: {} } },
			myRooms: null,
			now: NOW
		});
		expect(plan.paths).toEqual(['presence/43/ghost']);
	});

	/**
	 * НЕДАТОВАНА КІМНАТА ЗНОСИТЬСЯ ПЕРШОЮ (аудит 2026-09-25): жива такою не буває, а
	 * доти коди, забиті `info` без позначки чи складом без `info`, лишалися зайнятими
	 * назавжди.
	 *
	 * Зворотний експеримент: повернути `continue` без запису в мертві — червоніє.
	 */
	it('кімнату без позначки часу й без `info` зносить — жива такою не буває', () => {
		const plan = planSweep({
			rooms: { '42': { info: {} }, '43': { members: { x: {} }, moves: {} } },
			lobby: { quiz: { '42': {} } },
			presence: null,
			myRooms: null,
			now: NOW
		});
		expect(plan.undatable).toBe(2);
		expect(plan.paths).toEqual(['rooms/42', 'rooms/43', 'lobby/quiz/42']);
	});

	it('понад межу прогону — найтихіші першими, решта зі своїм переліком чекає', () => {
		const rooms = Object.fromEntries(
			Array.from({ length: SWEEP_LIMIT + 1 }, (_, index) => [
				String(10_000 + index),
				room(OLD - index * 1000)
			])
		);
		const youngest = String(10_000);
		const plan = planSweep({
			rooms,
			lobby: { quiz: { [youngest]: {} } },
			presence: null,
			myRooms: null,
			now: NOW
		});
		expect(plan.doomed).toHaveLength(SWEEP_LIMIT);
		expect(plan.left).toBe(1);
		expect(plan.paths, 'наймолодша з мертвих лишається до наступної доби').not.toContain(
			`rooms/${youngest}`
		);
		expect(plan.paths).not.toContain(`lobby/quiz/${youngest}`);
	});
});
