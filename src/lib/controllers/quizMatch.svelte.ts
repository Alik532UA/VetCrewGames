import type { Member, RoomSnapshot, RoomTransport } from '$lib/net/roomTypes';
import {
	REVEAL_MS,
	SETTLE_MS,
	answerPoints,
	configToGames,
	quizProgramme,
	roundLimitMs,
	type QuizStep
} from '$lib/config/quizOnline';

/** Що зараз на екрані партії. */
export type QuizPhase = 'round' | 'reveal' | 'over';

/** Відповідь одного гравця на один раунд. */
interface Answer {
	/** Серверний час ходу. */
	at: number;
	/** Частка правильного: 1 — усе, 0 — нічого. */
	correct: number;
}

/**
 * Спільна вікторина: РАУНД як одиниця, рахунок як чиста функція від журналу.
 *
 * ## Чим це відрізняється від `PairsMatch`
 *
 * Той відтворює ДОШКУ: усі застосовують ті самі ходи й бачять те саме поле. Тут
 * дошки в кожного своя — усі відповідають одночасно, — але СПІЛЬНИМ став час:
 * раунд починається одним ходом господаря, і від цієї позначки кожен рахує свій
 * дедлайн.
 *
 * ## Чому старт раунду — хід, а не поле в `info`
 *
 * У `info` вміщається лише ТЕПЕРІШНІЙ раунд. Щойно він змінюється, час початку
 * попереднього зникає — і перерахувати за нього очки вже нічим. У журналі ж
 * лишається все: `at` кожного ходу ставить сервер (правило `moves/$seq` вимагає
 * позначку у вікні пʼяти секунд від `now`), тож і старт раунду, і кожна
 * відповідь мають ЧЕСНИЙ час назавжди.
 *
 * Звідси головна властивість: рахунок — чиста функція від журналу. Ніхто не
 * оголошує своїх очок; він оголошує лише «я відповів правильно», а швидкість
 * рахується з двох серверних позначок.
 *
 * ## Що лишається неперевірним
 *
 * Саме `correct`. Той, хто відкрив консоль, може написати одиницю, відповівши
 * хибно, і жоден учасник цього не виявить — дошки в нього немає. Це властивість
 * одночасної гри з приватними дошками: щоб перевіряти й це, дошка мусила б бути
 * спільною, тобто це була б інша гра.
 *
 * Половина, яку підробляли легше за все — множник за швидкість, — тепер закрита,
 * і це головна різниця з попередньою моделью, де в журнал їхало саме число очок.
 */
export class QuizMatch {
	/** Скільки ходів журналу вже врахували. */
	applied = $state(0);
	status = $state<'lobby' | 'playing' | 'over'>('lobby');
	members = $state<Member[]>([]);
	hostUid = $state('');
	/** Зерно кімнати. Із нього виводиться програма — однакова в усіх. */
	seed = $state(0);
	autoStart = $state(false);
	countdownAt = $state<number | null>(null);
	/** Які ігри вибрані в кімнаті. Порожньо — ще не приїхав знімок. */
	games = $state<string[]>([]);

	/** Серверний час початку кожного раунду. Ключ — номер раунду. */
	startedAt = $state<Record<number, number>>({});
	/** Відповіді: раунд → гравець → коли й наскільки правильно. */
	answers = $state<Record<number, Record<string, Answer>>>({});

	readonly #me: string;
	readonly #transport: RoomTransport;
	/** Множник часу: у `dev` раунд довший. Передається, а не читається тут. */
	readonly #factor: number;

	constructor(me: string, transport: RoomTransport, factor = 1) {
		this.#me = me;
		this.#transport = transport;
		this.#factor = factor;
	}

	listen(): () => void {
		return this.#transport.watch((snapshot) => this.#apply(snapshot));
	}

	get players(): Member[] {
		return this.members
			.filter((member) => member.role === 'player')
			.sort((a, b) => a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
	}

	/** Програма партії — список раундів. Порожня, доки не приїхало зерно. */
	get programme(): QuizStep[] {
		if (this.seed === 0) return [];
		return quizProgramme(this.seed, this.games);
	}

	/**
	 * Номер поточного раунду — найбільший, який оголосив господар.
	 *
	 * `-1` означає «партія почалася, але жодного раунду ще не оголошено». Це
	 * законний стан, а не помилка: господар пише перший раунд окремим ходом, і між
	 * `status: playing` та цим ходом проходить мить.
	 */
	get round(): number {
		const numbers = Object.keys(this.startedAt).map(Number);
		return numbers.length === 0 ? -1 : Math.max(...numbers);
	}

	/** Крок програми для поточного раунду. `null` — раунду ще немає. */
	get step(): QuizStep | null {
		return this.programme[this.round] ?? null;
	}

	/** Скільки триває поточний раунд. Нуль — раунду немає. */
	get limitMs(): number {
		const step = this.step;
		return step === null ? 0 : roundLimitMs(step.game, this.#factor);
	}

	/** Хто вже відповів у поточному раунді. Саме ФАКТ, без правильності. */
	get answered(): string[] {
		return Object.keys(this.answers[this.round] ?? {});
	}

	/** Чи відповів я в поточному раунді. */
	get iAnswered(): boolean {
		return this.answered.includes(this.#me);
	}

	/** Чи відповіли всі гравці. */
	get everyoneAnswered(): boolean {
		const players = this.players;
		return players.length > 0 && players.every((player) => this.answered.includes(player.uid));
	}

	/**
	 * Рахунок кожного — сума очок за всі раунди.
	 *
	 * Рахується ТУТ, а не приходить у журналі: очки — функція від двох серверних
	 * позначок і оголошеної правильності, тож будь-хто може перерахувати їх сам і
	 * отримати те саме число.
	 */
	get scores(): Record<string, number> {
		const out: Record<string, number> = {};
		for (const player of this.players) out[player.uid] = 0;

		const programme = this.programme;
		for (const [key, byPlayer] of Object.entries(this.answers)) {
			const round = Number(key);
			const start = this.startedAt[round];
			if (start === undefined) continue;
			const game = programme[round]?.game;
			if (game === undefined) continue;
			const limit = roundLimitMs(game, this.#factor);

			for (const [uid, answer] of Object.entries(byPlayer)) {
				out[uid] = (out[uid] ?? 0) + answerPoints(answer.at, start, limit, answer.correct);
			}
		}
		return out;
	}

	get myScore(): number {
		return this.scores[this.#me] ?? 0;
	}

	/**
	 * Коли поточний раунд мусить закінчитися, за серверним часом.
	 *
	 * Дві причини закінчитися, і ближча перемагає: вийшов час або відповіли всі
	 * (тоді ще секунда, щоб останній побачив власну відповідь на дошці).
	 * `null` — раунду немає.
	 */
	deadlineAt(): number | null {
		const start = this.startedAt[this.round];
		if (start === undefined) return null;

		const byTime = start + this.limitMs;
		if (!this.everyoneAnswered) return byTime;

		const last = Math.max(...Object.values(this.answers[this.round] ?? {}).map((a) => a.at));
		return Math.min(byTime, last + SETTLE_MS);
	}

	/**
	 * Що показувати ЗАРАЗ. Час передається, а не читається з годинника.
	 *
	 * Той самий підхід, що в межі очікування «Знайди пару»: контролер не тримає
	 * таймера, бо тоді його неможливо перевірити тестом — тест мусив би чекати
	 * справжні секунди.
	 */
	phase(now: number): QuizPhase {
		if (this.status === 'over') return 'over';
		if (this.round >= this.programme.length && this.programme.length > 0) return 'over';

		const deadline = this.deadlineAt();
		if (deadline === null) return 'round';
		return now >= deadline ? 'reveal' : 'round';
	}

	/** Скільки секунд лишилося в раунді, зверху обмежено. Для смуги таймера. */
	leftMs(now: number): number {
		const start = this.startedAt[this.round];
		if (start === undefined) return 0;
		return Math.max(0, start + this.limitMs - now);
	}

	/** Чи час господареві оголошувати наступний раунд. */
	nextDue(now: number): boolean {
		const deadline = this.deadlineAt();
		if (deadline === null) return false;
		return now >= deadline + REVEAL_MS;
	}

	get over(): boolean {
		return this.programme.length > 0 && this.round >= this.programme.length;
	}

	/**
	 * Оголосити свою відповідь.
	 *
	 * Номер раунду їде РАЗОМ із відповіддю, а не мається на увазі: два ходи, що
	 * приїхали не в тому порядку, інакше зарахувалися б як відповіді на різні
	 * раунди. Повторна відповідь на той самий раунд відкидається при застосуванні.
	 */
	async answer(correct: number): Promise<void> {
		if (this.iAnswered || this.round < 0) return;
		await this.#transport.append({
			seq: this.applied + 1,
			by: this.#me,
			type: 'answer',
			payload: { round: this.round, correct }
		});
	}

	/** Оголосити початок раунду. Пише лише господар. */
	async startRound(round: number): Promise<void> {
		if (this.startedAt[round] !== undefined) return;
		await this.#transport.append({
			seq: this.applied + 1,
			by: this.#me,
			type: 'round',
			payload: { round }
		});
	}

	#apply(snapshot: RoomSnapshot): void {
		this.members = snapshot.members;
		this.status = snapshot.info.status;
		this.hostUid = snapshot.info.hostUid;
		this.seed = snapshot.info.seed;
		this.autoStart = snapshot.info.autoStart === true;
		this.countdownAt = snapshot.info.countdownAt ?? null;
		this.games = configToGames(snapshot.info.config);

		/*
		 * Журнал перечитується З НУЛЯ, і порядок ходів не має значення.
		 *
		 * Рахунок — сума незалежних доданків, тож пропуск у нумерації (хід ще не
		 * приїхав) нічого не ламає: він додасться, коли приїде. У «Знайди пару»
		 * інакше — там кожен хід міняє дошку, і пропуск зупиняє все.
		 */
		const startedAt: Record<number, number> = {};
		const answers: Record<number, Record<string, Answer>> = {};

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

			if (move.type !== 'answer') continue;
			const correct = Number(move.payload?.correct);
			if (!Number.isFinite(correct)) continue;

			const forRound = (answers[round] ??= {});
			// ОДИН РАУНД — ОДНА ВІДПОВІДЬ. Повторна нічого не додає: інакше повтор
			// надсилання давав би подвійні очки.
			if (forRound[move.by] === undefined) forRound[move.by] = { at, correct };
		}

		this.startedAt = startedAt;
		this.answers = answers;
		this.applied = snapshot.moves.length;
	}
}
