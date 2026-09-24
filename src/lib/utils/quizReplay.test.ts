import { describe, expect, it } from 'vitest';
import { HELD_PER_ROUND, LATE_ANSWER_GRACE_MS, replayQuizLog } from './quizReplay';
import { PAUSE_COOLDOWN_MS, RESUME_BONUS_MS } from '$lib/config/quizOnline';
import type { Member, Move, RoomSnapshot } from '$lib/net/roomTypes';

/**
 * ПЕРЕПРОГІН ЖУРНАЛУ ВІКТОРИНИ — правила, які база перевірити не може.
 *
 * База стежить за підписом, членством, формою й часом ходу. Хто веде партію, хто
 * ставив паузу і чи раунд уже скінчився, вона не знає — це вирішує перепрогін, і
 * однаково на кожному пристрої. Доти частина цих правил жила лише в кнопках:
 * хід, дописаний руками, їх оминав (аудит 2026-09-23).
 */

const HOST = 'uid-host';
const GUEST = 'uid-guest';
const THIRD = 'uid-third';
const WATCHER = 'uid-watcher';

const members: Member[] = [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 },
	{ uid: THIRD, name: 'Третій', role: 'player', order: 3 },
	{ uid: WATCHER, name: 'Глядач', role: 'spectator', order: 4 }
];

let seq = 0;
const move = (by: string, type: string, at: number, payload: Move['payload'] = {}): Move => ({
	seq: ++seq,
	by,
	type,
	at,
	payload
});

const snapshot = (moves: Move[], hostUid = HOST): RoomSnapshot => ({
	info: {
		gameId: 'quiz',
		rulesVersion: 3,
		seed: 1,
		status: 'playing',
		hostUid,
		config: {}
	},
	members,
	moves
});

const LIMIT = 10_000;
const limitOf = () => LIMIT;

describe('хто веде партію', () => {
	it('перевірка жива: раунд господаря рахується', () => {
		const log = replayQuizLog(snapshot([move(HOST, 'round', 1000, { round: 0 })]));
		expect(log.startedAt[0]).toBe(1000);
		expect(log.leader).toBe(HOST);
	});

	it('раунд, оголошений не ведучим, не рахується', () => {
		const log = replayQuizLog(snapshot([move(GUEST, 'round', 1000, { round: 0 })]));
		expect(log.startedAt[0]).toBeUndefined();
	});

	/**
	 * ПЕРЕДАЧА ВЕДЕННЯ. Після неї `info.hostUid` уже називає нового господаря —
	 * а раунди, оголошені до передачі, мусять лишитися. Інакше минуле змінилося б
	 * заднім числом, і рахунок зіграних раундів зник би.
	 */
	it('хід lead передає ведення, а раунди до нього лишаються', () => {
		const log = replayQuizLog(
			snapshot(
				[
					move(HOST, 'round', 1000, { round: 0 }),
					move(GUEST, 'lead', 20_000, { from: HOST }),
					move(HOST, 'round', 21_000, { round: 1 }),
					move(GUEST, 'round', 22_000, { round: 1 })
				],
				GUEST
			)
		);
		expect(log.startedAt[0], 'раунд старого ведучого — до передачі').toBe(1000);
		expect(log.startedAt[1], 'після передачі раунд оголошує новий ведучий').toBe(22_000);
		expect(log.leader).toBe(GUEST);
	});

	/**
	 * ПАУЗУ ПИШЕ КОЖЕН ГРАВЕЦЬ (аудит 2026-09-24). Доти — лише ведучий, і пауза
	 * губилася саме тоді, коли зникав він. Глядач — ні: він партію не грає.
	 */
	it('паузу записує будь-який гравець, а глядач — ні', () => {
		const log = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(GUEST, 'held', 7000, { round: 0, ms: 5000 }),
				move(WATCHER, 'held', 8000, { round: 0, ms: 6000 })
			])
		);
		expect(log.held[0]).toBe(5000);
	});
});

describe('пауза', () => {
	it('перевірка жива: гравець ставить і знімає паузу', () => {
		const log = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(GUEST, 'pause', 2000, { round: 0 }),
				move(GUEST, 'resume', 3000, { round: 0 })
			])
		);
		expect(log.pausedBy[0]).toBeUndefined();
		expect(log.pauseUsedAt[GUEST]).toBe(3000);
	});

	it('глядач паузи не ставить — він у партії не грає', () => {
		const log = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(WATCHER, 'pause', 2000, { round: 0 })
			])
		);
		expect(log.pausedBy[0]).toBeUndefined();
	});

	it('друга пауза не переписує першу: зняти може лише той, хто ставив', () => {
		const log = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(GUEST, 'pause', 2000, { round: 0 }),
				move(THIRD, 'pause', 2500, { round: 0 })
			])
		);
		expect(log.pausedBy[0]).toBe(GUEST);
		expect(log.pausedAt[0]).toBe(2000);
	});

	it('витримка між паузами тримається журналом, а не кнопкою', () => {
		const resumedAt = 3000;
		const early = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(GUEST, 'pause', 2000, { round: 0 }),
				move(GUEST, 'resume', resumedAt, { round: 0 }),
				move(HOST, 'round', 20_000, { round: 1 }),
				move(GUEST, 'pause', resumedAt + PAUSE_COOLDOWN_MS - 1, { round: 1 })
			])
		);
		expect(early.pausedBy[1], 'пауза посеред витримки не рахується').toBeUndefined();

		const later = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(GUEST, 'pause', 2000, { round: 0 }),
				move(GUEST, 'resume', resumedAt, { round: 0 }),
				move(HOST, 'round', 20_000, { round: 1 }),
				move(GUEST, 'pause', resumedAt + PAUSE_COOLDOWN_MS, { round: 1 })
			])
		);
		expect(later.pausedBy[1], 'після витримки — знову можна').toBe(GUEST);
	});
});

describe('голоси «граємо далі»', () => {
	it('голосують гравці, а не глядачі; повторний голос нічого не додає', () => {
		const log = replayQuizLog(
			snapshot([
				move(HOST, 'round', 1000, { round: 0 }),
				move(WATCHER, 'goon', 2000, { round: 0 }),
				move(GUEST, 'goon', 2100, { round: 0 }),
				move(GUEST, 'goon', 2200, { round: 0 })
			])
		);
		expect(log.goOn[0]).toEqual([GUEST]);
	});
});

describe('відповідь зараховується лише в межах свого раунду', () => {
	const rounds = [
		move(HOST, 'round', 1000, { round: 0 }),
		move(HOST, 'round', 30_000, { round: 1 })
	];

	it('перевірка жива: вчасна відповідь рахується', () => {
		const log = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', 5000, { round: 0, correct: 1 })]),
			{
				limitOf
			}
		);
		expect(log.answers[0]?.[GUEST]).toEqual({ at: 5000, correct: 1 });
	});

	it('відповідь до початку раунду не рахується', () => {
		const log = replayQuizLog(
			snapshot([move(GUEST, 'answer', 500, { round: 0, correct: 1 }), ...rounds]),
			{ limitOf }
		);
		expect(log.answers[0]?.[GUEST]).toBeUndefined();
	});

	/**
	 * ХІД ІЗ БЕЗЗВʼЯЗКУ. Записаний, поки звʼязку не було, він доїжджає пізніше —
	 * і доти діставав мінімальні 50 очок, переписуючи вже розібране табло.
	 */
	it('відповідь після межі раунду з запасом на доїзд не рахується', () => {
		const late = 1000 + LIMIT + LATE_ANSWER_GRACE_MS + 1;
		const log = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', late, { round: 0, correct: 1 })]),
			{ limitOf }
		);
		expect(log.answers[0]?.[GUEST]).toBeUndefined();
	});

	it('відповідь, що доїхала в межах запасу, рахується — вона чесна', () => {
		const edge = 1000 + LIMIT + LATE_ANSWER_GRACE_MS;
		const log = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', edge, { round: 0, correct: 1 })]),
			{ limitOf }
		);
		expect(log.answers[0]?.[GUEST]).toBeDefined();
	});

	it('пауза раунду відсуває межу: відповідь після неї ще рахується', () => {
		const withHeld = [
			...rounds,
			move(HOST, 'held', 12_000, { round: 0, ms: 8000 }),
			move(GUEST, 'answer', 1000 + LIMIT + 7000, { round: 0, correct: 1 })
		];
		const log = replayQuizLog(snapshot(withHeld), { limitOf });
		expect(log.answers[0]?.[GUEST]).toBeDefined();
	});

	it('раунд без межі приймає відповідь аж до початку наступного', () => {
		const unlimited = () => Number.POSITIVE_INFINITY;
		const inTime = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', 29_000, { round: 0, correct: 1 })]),
			{ limitOf: unlimited }
		);
		expect(inTime.answers[0]?.[GUEST]).toBeDefined();

		const after = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', 30_001, { round: 0, correct: 1 })]),
			{ limitOf: unlimited }
		);
		expect(after.answers[0]?.[GUEST], 'наступний раунд уже почався').toBeUndefined();
	});

	it('без відомої межі перевіряється лише рамка між раундами', () => {
		const log = replayQuizLog(
			snapshot([...rounds, move(GUEST, 'answer', 25_000, { round: 0, correct: 1 })])
		);
		expect(log.answers[0]?.[GUEST]).toBeDefined();
	});
});

/**
 * ПАУЗА В ЖУРНАЛІ — НАЙБІЛЬШЕ, А НЕ СУМА, І В МЕЖАХ (аудит 2026-09-24).
 *
 * Паузу тепер пише кожен гравець, у кого чекання скінчилося, — сукупним числом за
 * раунд. Одне чекання, записане трьома, дає три близькі числа; сума дала б
 * потрійну паузу. А що писати тепер може кожен, то й межі: пауза не довша, ніж
 * раунд існував, і не більше чотирьох різних чисел від одного автора.
 *
 * Зворотні експерименти: повернути суму — червоніє перший; прибрати межу часу —
 * другий; межу кількості — третій; рахувати межу за кожен хід, а не за число, —
 * четвертий; брати `spent` без стелі — шостий.
 */
describe('пауза в журналі', () => {
	const round0 = move(HOST, 'round', 1000, { round: 0 });

	it('одне чекання від трьох авторів — найбільше число, а не сума', () => {
		const log = replayQuizLog(
			snapshot([
				round0,
				move(HOST, 'held', 9000, { round: 0, ms: 7000 }),
				move(GUEST, 'held', 9100, { round: 0, ms: 7400 }),
				move(THIRD, 'held', 9200, { round: 0, ms: 7100 })
			])
		);
		expect(log.held[0]).toBe(7400);
	});

	it('пауза не довша, ніж раунд існував у мить запису', () => {
		const log = replayQuizLog(
			snapshot([round0, move(GUEST, 'held', 2000, { round: 0, ms: 86_400_000 })])
		);
		expect(log.held[0]).toBe(2000 - 1000 + RESUME_BONUS_MS * HELD_PER_ROUND);
	});

	it('від одного автора в раунді — не більше чотирьох різних пауз', () => {
		const writes = Array.from({ length: HELD_PER_ROUND + 1 }, (_, index) =>
			move(GUEST, 'held', 60_000 + index * 1000, { round: 0, ms: 1000 * (index + 1) })
		);
		const log = replayQuizLog(snapshot([round0, ...writes]));
		expect(log.held[0], "п'ятий запис дедлайну не рухає").toBe(1000 * HELD_PER_ROUND);
	});

	it('одне чекання з багатьма зниклими не зʼїдає межі кількості', () => {
		// Хід на кожного зниклого, і всі несуть ту саму тривалість — це ОДНЕ число.
		const one = (at: number, ms: number) =>
			['a', 'b', 'c', 'd', 'e'].map((uid, index) =>
				move(HOST, 'held', at + index, { round: 0, ms, uid, spent: ms - RESUME_BONUS_MS })
			);
		const log = replayQuizLog(snapshot([round0, ...one(20_000, 8000), ...one(40_000, 16_000)]));
		expect(log.held[0]).toBe(16_000);
	});

	it('пільга: найбільше за раунд, сума за партію', () => {
		const log = replayQuizLog(
			snapshot([
				round0,
				move(HOST, 'held', 9000, { round: 0, ms: 7000, uid: THIRD, spent: 4000 }),
				move(GUEST, 'held', 9100, { round: 0, ms: 7500, uid: THIRD, spent: 4500 }),
				move(HOST, 'round', 20_000, { round: 1 }),
				move(HOST, 'held', 30_000, { round: 1, ms: 5000, uid: THIRD, spent: 2000 })
			])
		);
		expect(log.spentByRound[0][THIRD]).toBe(4500);
		expect(log.graceSpent[THIRD]).toBe(6500);
	});

	it('витрачене не більше за зараховану паузу', () => {
		const log = replayQuizLog(
			snapshot([
				round0,
				move(GUEST, 'held', 9000, { round: 0, ms: 7000, uid: THIRD, spent: 86_400_000 })
			])
		);
		expect(log.graceSpent[THIRD]).toBe(7000);
	});

	/**
	 * Хід, що заповнив дірку в нумерації, лежить у журналі РАНІШЕ за оголошення
	 * раунду, хоч записаний пізніше. Перший прохід ще не знає початку раунду — тому
	 * пауза рахується другим.
	 */
	it('пауза з меншим номером, ніж оголошення раунду, однаково рахується', () => {
		const early = { ...move(GUEST, 'held', 9000, { round: 0, ms: 7000 }), seq: 0 };
		const log = replayQuizLog(snapshot([early, round0]));
		expect(log.held[0]).toBe(7000);
	});

	it('пауза до початку раунду не рахується', () => {
		const log = replayQuizLog(snapshot([round0, move(GUEST, 'held', 500, { round: 0, ms: 400 })]));
		expect(log.held[0]).toBeUndefined();
	});
});
