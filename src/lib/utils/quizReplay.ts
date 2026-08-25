import type { RoomSnapshot } from '$lib/net/roomTypes';

/** Відповідь одного гравця на один раунд. */
export interface QuizAnswer {
	/** Серверний час ходу. */
	at: number;
	/** Частка правильного: 1 — усе, 0 — нічого. */
	correct: number;
}

/** Усе, що перепрогін журналу дає партії. */
export interface QuizLog {
	/** Коли почався кожен раунд — серверним часом. */
	startedAt: Record<number, number>;
	answers: Record<number, Record<string, QuizAnswer>>;
	/** Голоси «грати далі» за раундами. */
	goOn: Record<number, string[]>;
	/** Пауза, записана господарем, за раундами. */
	held: Record<number, number>;
	/** Скільки пільги витратив кожен за партію. */
	graceSpent: Record<string, number>;
	/** Хто поставив паузу в кожному раунді. */
	pausedBy: Record<number, string>;
	/** Коли поставив — серверним часом. */
	pausedAt: Record<number, number>;
	/** Коли гравець останній раз ЗНІМАВ паузу — для витримки. */
	pauseUsedAt: Record<string, number>;
}

/**
 * ПЕРЕПРОГІН ЖУРНАЛУ ВІКТОРИНИ: стан партії як чиста функція від ходів.
 *
 * ## Навіщо окремий модуль
 *
 * Контролер стоїть на межі розміру (300 рядків), а це не його робота: тут немає
 * ні мережі, ні реактивності — лише згортка ходів у числа. Заразом правила
 * зарахування стають перевірними без транспорту зовсім.
 *
 * ## Журнал перечитується З НУЛЯ, і порядок ходів не має значення
 *
 * Рахунок — сума незалежних доданків, тож пропуск у нумерації (хід ще не приїхав)
 * нічого не ламає: він додасться, коли приїде. У «Знайди пару» інакше — там кожен
 * хід міняє дошку, і пропуск зупиняє все.
 *
 * ## Що тут перевіряється, а що правило бази
 *
 * База стежить за підписом (`by == auth.uid`), формою й часом. Вона НЕ знає, хто
 * господар і хто ставив паузу, — тому «оголосив раунд не господар» і «зняв не той,
 * хто ставив» відкидає перепрогін. Тобто такий хід у журналі лежить, але нічого не
 * означає, і означає це однаково в усіх.
 */
export function replayQuizLog(snapshot: RoomSnapshot): QuizLog {
	const startedAt: Record<number, number> = {};
	const answers: Record<number, Record<string, QuizAnswer>> = {};
	const goOn: Record<number, string[]> = {};
	const held: Record<number, number> = {};
	const graceSpent: Record<string, number> = {};
	const pausedBy: Record<number, string> = {};
	const pausedAt: Record<number, number> = {};
	const pauseUsedAt: Record<string, number> = {};

	for (const move of snapshot.moves) {
		const round = Number(move.payload?.round);
		if (!Number.isInteger(round) || round < 0) continue;
		// Час ходу ставить СЕРВЕР. Хід без нього не рахується: без часу очки
		// порахувати нічим, а вигадати їх — це те саме, що дати клієнту право
		// назвати свою швидкість.
		const at = Number(move.at);
		if (!Number.isFinite(at)) continue;

		if (move.type === 'round') {
			// Лише господар оголошує раунди. Правило бази цього не перевіряє —
			// підписати хід чужим uid не можна, але оголосити раунд від себе може
			// будь-хто. Тому перевірка тут: інакше гість зміг би перескочити раунд.
			if (move.by !== snapshot.info.hostUid) continue;
			// Перше оголошення виграє: повторне не мусить рухати дедлайн.
			if (startedAt[round] === undefined) startedAt[round] = at;
			continue;
		}

		if (move.type === 'pause') {
			pausedBy[round] = move.by;
			pausedAt[round] = at;
			continue;
		}

		if (move.type === 'resume') {
			// Знімає лише той, хто ставив: інакше «продовжити» стало б чужим правом,
			// а для цього є голосування присутніх.
			if (pausedBy[round] !== move.by) continue;
			delete pausedBy[round];
			delete pausedAt[round];
			pauseUsedAt[move.by] = at;
			continue;
		}

		if (move.type === 'held') {
			// Лише господар: інакше кожен дописував би собі час.
			if (move.by !== snapshot.info.hostUid) continue;
			const ms = Number(move.payload?.ms);
			if (Number.isFinite(ms) && ms > 0) held[round] = (held[round] ?? 0) + ms;

			const uid = move.payload?.uid;
			const spent = Number(move.payload?.spent);
			if (typeof uid === 'string' && Number.isFinite(spent) && spent > 0) {
				graceSpent[uid] = (graceSpent[uid] ?? 0) + spent;
			}
			continue;
		}

		if (move.type === 'goon') {
			// ОДИН ГРАВЕЦЬ — ОДИН ГОЛОС у раунді. Повторний нічого не додає:
			// інакше повторне натискання саме собою давало б «більшість».
			const forRound = (goOn[round] ??= []);
			if (!forRound.includes(move.by)) forRound.push(move.by);
			continue;
		}

		if (move.type !== 'answer') continue;
		const correct = Number(move.payload?.correct);
		if (!Number.isFinite(correct)) continue;

		const forRound = (answers[round] ??= {});
		// ОДИН РАУНД — ОДНА ВІДПОВІДЬ. Повторна нічого не додає: інакше повтор
		// надсилання давав би подвійні очки.
		if (forRound[move.by] === undefined) forRound[move.by] = { at, correct };
	}

	return { startedAt, answers, goOn, held, graceSpent, pausedBy, pausedAt, pauseUsedAt };
}
