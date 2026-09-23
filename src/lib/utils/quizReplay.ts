import type { RoomSnapshot } from '$lib/net/roomTypes';
import { PAUSE_COOLDOWN_MS } from '$lib/config/quizOnline';

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
	/** Пауза, записана ведучим, за раундами. */
	held: Record<number, number>;
	/** Скільки пільги витратив кожен за партію. */
	graceSpent: Record<string, number>;
	/** Хто поставив паузу в кожному раунді. */
	pausedBy: Record<number, string>;
	/** Коли поставив — серверним часом. */
	pausedAt: Record<number, number>;
	/** Коли гравець останній раз ЗНІМАВ паузу — для витримки. */
	pauseUsedAt: Record<string, number>;
	/**
	 * ХТО ВЕДЕ ПАРТІЮ ЗАРАЗ — чиї `round` і `held` рахуються.
	 *
	 * Спершу це господар кімнати. Хід `lead` передає роль авторові ходу — а
	 * законним цей хід робить ПРАВИЛО БАЗИ: воно пускає його лише разом зі зміною
	 * `info/hostUid` на автора й лише тоді, коли попереднього господаря немає в
	 * присутності (див. `database.rules.json`, `moves/$seq`).
	 */
	leader: string;
}

/** Що перепрогону потрібно знати, крім самого журналу. */
export interface ReplayOptions {
	/**
	 * Скільки триває раунд, мс. `undefined` — невідомо (тоді межа часу для
	 * відповідей не перевіряється); `NO_LIMIT` — раунд без межі.
	 */
	limitOf?: (round: number) => number | undefined;
}

/**
 * Скільки відповідь може ЗАПІЗНИТИСЯ за межу раунду й усе ще зарахуватися.
 *
 * `at` ставить сервер у мить, коли запис ДОЇХАВ, а не коли людина натиснула.
 * Автопідтвердження спрацьовує за 300 мс до межі (`QuizBoard`), і на поганому
 * звʼязку воно доїжджає вже після неї — такий хід чесний. Три секунди покривають
 * це з запасом; а те, що приходить пізніше, — хід, записаний без звʼязку й
 * дописаний, коли звʼязок повернувся, тобто відповідь на питання, яке вже
 * розібрали на таблі.
 */
export const LATE_ANSWER_GRACE_MS = 3000;

/**
 * ПЕРЕПРОГІН ЖУРНАЛУ ВІКТОРИНИ: стан партії як чиста функція від ходів.
 *
 * ## Навіщо окремий модуль
 *
 * Контролер стоїть на межі розміру (300 рядків), а це не його робота: тут немає
 * ні мережі, ні реактивності — лише згортка ходів у числа. Заразом правила
 * зарахування стають перевірними без транспорту зовсім.
 *
 * ## Журнал перечитується З НУЛЯ
 *
 * Рахунок — сума незалежних доданків, тож пропуск у нумерації (хід ще не приїхав)
 * нічого не ламає: він додасться, коли приїде. І відлуння запису, яке база
 * відкинула, теж нічого не ламає: наступний знімок перечитується цілком.
 *
 * ## Що тут перевіряється, а що правило бази
 *
 * База стежить за підписом (`by == auth.uid`), членством, формою й часом. Вона НЕ
 * знає, хто веде партію, хто ставив паузу і чи раунд уже скінчився, — тому
 * «оголосив раунд не ведучий», «пауза від глядача», «друга пауза поверх першої»,
 * «пауза посеред витримки» й «відповідь на розібране питання» відкидає перепрогін.
 * Такий хід у журналі лежить, але нічого не означає — і однаково в усіх.
 */
export function replayQuizLog(snapshot: RoomSnapshot, options: ReplayOptions = {}): QuizLog {
	const players = new Set(
		snapshot.members.filter((member) => member.role === 'player').map((member) => member.uid)
	);

	/*
	 * ПЕРШИЙ ВЕДУЧИЙ — той, у кого роль забрав ПЕРШИЙ хід `lead`, а не нинішній
	 * `info.hostUid`. Після передачі `info` називає вже нового господаря, і за ним
	 * раунди, оголошені до передачі, перестали б рахуватися — тобто минуле
	 * змінилося б заднім числом.
	 */
	const firstLead = snapshot.moves.find(
		(move) => move.type === 'lead' && typeof move.payload?.from === 'string'
	);
	let leader = firstLead ? String(firstLead.payload?.from) : snapshot.info.hostUid;

	const startedAt: Record<number, number> = {};
	const goOn: Record<number, string[]> = {};
	const held: Record<number, number> = {};
	const graceSpent: Record<string, number> = {};
	const pausedBy: Record<number, string> = {};
	const pausedAt: Record<number, number> = {};
	const pauseUsedAt: Record<string, number> = {};
	const answered: Array<{ round: number; by: string } & QuizAnswer> = [];

	for (const move of snapshot.moves) {
		// Час ходу ставить СЕРВЕР. Хід без нього не рахується: без часу очки
		// порахувати нічим, а вигадати їх — це те саме, що дати клієнту право
		// назвати свою швидкість.
		const at = Number(move.at);
		if (!Number.isFinite(at)) continue;

		if (move.type === 'lead') {
			leader = move.by;
			continue;
		}

		const round = Number(move.payload?.round);
		if (!Number.isInteger(round) || round < 0) continue;

		if (move.type === 'round') {
			// Лише ведучий оголошує раунди: підписати хід чужим uid не можна, але
			// оголосити раунд від себе може будь-хто, і без цієї перевірки гість
			// перескочив би раунд.
			if (move.by !== leader) continue;
			// Перше оголошення виграє: повторне не мусить рухати дедлайн.
			if (startedAt[round] === undefined) startedAt[round] = at;
			continue;
		}

		if (move.type === 'pause') {
			/*
			 * ПАУЗУ СТАВИТЬ ГРАВЕЦЬ, ОДНУ ЗА РАЗ І НЕ ЧАСТІШЕ ЗА ВИТРИМКУ.
			 *
			 * Доти перевірок не було тут зовсім: друга пауза переписувала першу (тобто
			 * забирала в її автора право зняти), глядач міг спинити партію, у якій не
			 * грає, а хвилинна витримка трималася лише кнопкою — хід, дописаний руками,
			 * її оминав (аудит 2026-09-23).
			 */
			if (!players.has(move.by)) continue;
			if (pausedBy[round] !== undefined) continue;
			const used = pauseUsedAt[move.by];
			if (used !== undefined && at < used + PAUSE_COOLDOWN_MS) continue;
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
			// Лише ведучий: інакше кожен дописував би собі час.
			if (move.by !== leader) continue;
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
			// Голосують ГРАВЦІ. ОДИН ГРАВЕЦЬ — ОДИН ГОЛОС у раунді: повторний нічого
			// не додає, інакше повторне натискання саме собою давало б «більшість».
			if (!players.has(move.by)) continue;
			const forRound = (goOn[round] ??= []);
			if (!forRound.includes(move.by)) forRound.push(move.by);
			continue;
		}

		if (move.type !== 'answer') continue;
		const correct = Number(move.payload?.correct);
		if (!Number.isFinite(correct)) continue;
		answered.push({ round, by: move.by, at, correct });
	}

	/*
	 * ВІДПОВІДІ — ДРУГИМ ПРОХОДОМ, бо межа раунду залежить від ПОЧАТКУ наступного,
	 * а він може лежати в журналі й пізніше за відповідь.
	 *
	 * Зараховується лише відповідь, що лягла В РАУНД: не раніше його початку, не
	 * пізніше початку наступного, а для раунду з межею — не пізніше межі з
	 * паузами й запасом на доїзд. Доти рахувалося все: хід, записаний без звʼязку
	 * й дописаний хвилиною пізніше, діставав мінімальні 50 очок і переписував
	 * табло вже розібраного раунду (аудит 2026-09-23).
	 */
	const answers: Record<number, Record<string, QuizAnswer>> = {};
	for (const entry of answered) {
		const start = startedAt[entry.round];
		if (start === undefined || entry.at < start) continue;
		// Строго ПІЗНІШЕ: відповідь, що доїхала в ту саму мілісекунду, що й оголошення
		// наступного раунду, чесна — вона їхала, поки раунд ще йшов.
		const next = startedAt[entry.round + 1];
		if (next !== undefined && entry.at > next) continue;
		const limit = options.limitOf?.(entry.round);
		if (
			limit !== undefined &&
			Number.isFinite(limit) &&
			entry.at > start + limit + (held[entry.round] ?? 0) + LATE_ANSWER_GRACE_MS
		) {
			continue;
		}
		const forRound = (answers[entry.round] ??= {});
		// ОДИН РАУНД — ОДНА ВІДПОВІДЬ. Повторна нічого не додає: інакше повтор
		// надсилання давав би подвійні очки.
		if (forRound[entry.by] === undefined) {
			forRound[entry.by] = { at: entry.at, correct: entry.correct };
		}
	}

	return {
		startedAt,
		answers,
		goOn,
		held,
		graceSpent,
		pausedBy,
		pausedAt,
		pauseUsedAt,
		leader
	};
}
