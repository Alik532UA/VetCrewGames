// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	SWEEP_LIMIT,
	SWEEP_MAX_AGE_MS,
	SWEEP_SILENCE_MS,
	confirmedPaths,
	planSweep
} from '../scripts/sweep-plan.mjs';

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
/** Кімната, у якій хтось є: стеля прогону — лише для таких. */
const inhabited = (aliveAt: number, createdAt?: number) => ({
	info: { aliveAt, createdAt },
	members: { a: { name: 'А', role: 'player', order: 1 } }
});

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
			// Присутність у мертвій кімнаті — стара: свіжа означала б живу вкладку, і її
			// прибиральник лишає (див. «свіжий запис… без кімнати лишаються»).
			presence: { '42': { a: { at: OLD } } },
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

	/**
	 * ВКАЗІВНИК, ЖИВИЙ ЗА ВЛАСНИМ ГОДИННИКОМ, — НЕ ПРИВИД (аудит 2026-09-25): кімната,
	 * створена після читання `rooms`, у знімку відсутня, а її свіжий запис переліку
	 * й індексу вже є.
	 *
	 * Зворотний експеримент: прибрати перевірку `fresh` — червоніє.
	 */
	it('свіжий запис переліку, присутність і індекс без кімнати лишаються, старі — ні', () => {
		const plan = planSweep({
			rooms: {},
			lobby: { pairs: { '42': { at: FRESH }, '43': { at: OLD } } },
			presence: { '42': { a: { at: FRESH } }, '43': { a: { at: OLD } } },
			myRooms: { u: { '42': { at: FRESH }, '43': { at: OLD } } },
			now: NOW
		});
		expect(plan.paths).toEqual(['lobby/pairs/43', 'presence/43', 'myRooms/u/43']);
	});

	/**
	 * ЗНОСИТЬСЯ ЛИШЕ ТЕ, НА ЧОМУ ЗІЙШЛИСЯ ДВА ПЛАНИ (аудит 2026-09-25): кімнату,
	 * створену під тим самим кодом між читанням і записом, запис знищив би.
	 */
	it('кімнату, що зʼявилася між двома читаннями, не зносить разом із її вказівниками', () => {
		const pointers = { lobby: { pairs: { '42': {} } }, presence: null, myRooms: null, now: NOW };
		const first = planSweep({ rooms: { '42': room(OLD) }, ...pointers });
		const second = planSweep({ rooms: { '42': room(FRESH) }, ...pointers });
		expect(first.paths, 'перевірка жива: перший план зносить').toContain('rooms/42');

		expect(confirmedPaths(first, second)).toEqual([]);
	});

	it('понад межу прогону — найтихіші першими, решта зі своїм переліком чекає', () => {
		const rooms = Object.fromEntries(
			Array.from({ length: SWEEP_LIMIT + 1 }, (_, index) => [
				String(10_000 + index),
				inhabited(OLD - index * 1000)
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

	/**
	 * КІМНАТА СТАРША ЗА ДВІ ДОБИ ЙДЕ, ХАЙ ЩО ЇЇ ТРИМАЄ (аудит 2026-09-26): позначку
	 * життя пише будь-який учасник, тож кімнату, яку тримає скрипт, тиша не зносила б
	 * ніколи, а коди вичерпні.
	 *
	 * Зворотний експеримент: прибрати межу віку — червоніє.
	 */
	it('кімната, старша за межу віку, йде й тоді, коли її тримають живою', () => {
		const plan = planSweep({
			rooms: {
				'42': inhabited(FRESH, NOW - SWEEP_MAX_AGE_MS - 60_000),
				'43': inhabited(FRESH, NOW - SWEEP_MAX_AGE_MS + 60_000)
			},
			lobby: null,
			presence: null,
			myRooms: null,
			now: NOW
		});
		expect(plan.doomed.map((dead) => dead.code)).toEqual(['42']);
		expect(plan.overAge).toBe(1);
	});

	/**
	 * ПОРОЖНІ МЕРТВІ — УСІ, А НЕ ДВІСТІ НА ДОБУ (аудит 2026-09-26): у кімнаті без
	 * складу й присутності нікого не зачепити навіть зіпсованим полем.
	 *
	 * Зворотний експеримент: застосувати стелю й до порожніх — червоніє.
	 */
	it('порожні мертві кімнати йдуть усі, навіть понад межу прогону', () => {
		const rooms = Object.fromEntries(
			Array.from({ length: SWEEP_LIMIT + 5 }, (_, index) => [String(20_000 + index), room(OLD)])
		);
		const plan = planSweep({ rooms, lobby: null, presence: null, myRooms: null, now: NOW });
		expect(plan.doomed).toHaveLength(SWEEP_LIMIT + 5);
		expect(plan.left).toBe(0);
		expect(plan.empty).toBe(SWEEP_LIMIT + 5);
	});

	it('кімната з присутністю — не порожня, навіть без складу', () => {
		const rooms = Object.fromEntries(
			Array.from({ length: SWEEP_LIMIT + 1 }, (_, index) => [String(30_000 + index), room(OLD)])
		);
		const presence = Object.fromEntries(
			Object.keys(rooms).map((code) => [code, { a: { at: OLD } }])
		);
		const plan = planSweep({ rooms, lobby: null, presence, myRooms: null, now: NOW });
		expect(plan.left).toBe(1);
	});
});
