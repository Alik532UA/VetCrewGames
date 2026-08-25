import type { Member, RoomSnapshot, RoomTransport } from '$lib/net/roomTypes';
import {
	RESUME_BONUS_MS,
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

	/**
	 * ХТО ЗАРАЗ ОНЛАЙН — приходить іззовні, з `presence`.
	 *
	 * Не з журналу й не зі складу кімнати: `members` не прибираються ніколи (їх
	 * пише кожен про себе й лише про себе), а `presence` гасне сама —
	 * `onDisconnect` знімає запис, коли вкладка зникла.
	 *
	 * Порожній список означає «присутність ще НЕ ПРИЇХАЛА», а не «нікого немає»:
	 * підписка встає за такт після входу, і за цей такт раунд не мусить вважатися
	 * закінченим. Тому нижче порожнеча трактується як «чекаємо всіх».
	 */
	present = $state<string[]>([]);

	/** Серверний час початку кожного раунду. Ключ — номер раунду. */
	startedAt = $state<Record<number, number>>({});
	/** Голоси «граємо далі» за раундами. Порожньо — ніхто не голосував. */
	#goOnVotes = $state<Record<number, string[]>>({});
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

	/**
	 * Гравці, чиєї відповіді партія справді чекає.
	 *
	 * Доти чекали ВСІХ зі складу — і партія через це замерзала назавжди: той, хто
	 * закрив вкладку, лишається в `members` (їх ніхто не прибирає), відповіді від
	 * нього не буде ніколи, тож «усі відповіли» не ставало правдою й кожен
	 * наступний раунд крутив таймер до кінця. Автор сказав це прямо: «при виході
	 * одного з гравців немає вікна очікування».
	 *
	 * Дві порожнечі трактуються як «чекаємо всіх», і обидві — навмисно:
	 * присутність, яка ще не приїхала, і кімната, у якій за мить не стало нікого.
	 * Інакше раунд закінчувався б сам собою на порожньому списку.
	 */
	get awaited(): Member[] {
		const players = this.players;
		if (this.present.length === 0) return players;
		const here = players.filter((player) => this.present.includes(player.uid));
		return here.length > 0 ? here : players;
	}

	/**
	 * Гравці, яких чекають, а вони не онлайн. Для вікна очікування.
	 *
	 * Порожньо, поки присутність не приїхала: показати «немає зв'язку» в перший
	 * такт означало б написати це про кожного, включно з собою.
	 */
	get away(): Member[] {
		if (this.present.length === 0) return [];
		return this.players.filter((player) => !this.present.includes(player.uid));
	}

	/** Чи відповіли всі, кого чекають. */
	get everyoneAnswered(): boolean {
		const awaited = this.awaited;
		return awaited.length > 0 && awaited.every((player) => this.answered.includes(player.uid));
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

	/**
	 * Скільки очок дав САМЕ ЦЕЙ раунд — кожному.
	 *
	 * Табло між раундами показує приріст, а не лише підсумок: «+90» відповідає на
	 * питання «як я щойно зіграв», якого сума не бачить. Рахується тут, а не в
	 * компоненті, з тієї самої причини, що й уся решта рахунку: це чиста функція
	 * від журналу, і два місця з тією самою арифметикою розійшлися б непомітно.
	 *
	 * Гравець без відповіді в цьому раунді має нуль, а не відсутнє значення: нуль
	 * — це відповідь («не встиг»), а порожнеча читалася б як «ще не порахували».
	 */
	get roundGains(): Record<string, number> {
		const out: Record<string, number> = {};
		for (const player of this.players) out[player.uid] = 0;

		const round = this.round;
		const start = this.startedAt[round];
		if (start === undefined) return out;

		const game = this.programme[round]?.game;
		if (game === undefined) return out;
		const limit = roundLimitMs(game, this.#factor);

		for (const [uid, answer] of Object.entries(this.answers[round] ?? {})) {
			out[uid] = answerPoints(answer.at, start, limit, answer.correct);
		}
		return out;
	}

	get myScore(): number {
		return this.scores[this.#me] ?? 0;
	}

	/**
	 * ЧАС, ВІДДАНИЙ ЗА ЧЕКАННЯ: пауза плюс надбавка після неї.
	 *
	 * Вікно очікування перекриває питання, тож поки воно висить, раунд не мусить
	 * витрачатися. Пауза тут — не спинений таймер, а зсув дедлайну: у цьому
	 * контролері немає жодного таймера навмисно (час приходить аргументом, інакше
	 * перевірка мусила б чекати справжні секунди).
	 *
	 * ЧОМУ ЦЕ РАХУЄТЬСЯ МІСЦЕВО, а не журналом. Умова паузи вже місцева: хто
	 * присутній — це присутність, і на ній тримається і вікно очікування, і кінець
	 * раунду по `awaited`. Писати паузу в журнал означало б новий тип ходу з
	 * власним правилом бази, а заразом і те, що пауза не станеться взагалі, якщо в
	 * господаря обірвався зв'язок — тобто рівно тоді, коли вона потрібна.
	 *
	 * МЕЖА ЧЕСНОСТІ: розбіжність між гравцями обмежена дрижанням присутності
	 * (RTDB віддає її за секунду-дві). Хто саме оголошує наступний раунд, це не
	 * зачіпає — оголошує господар, і його рішення лишається єдиним.
	 */
	#heldMs = $state(0);
	#holdSince: number | null = null;

	/**
	 * Увімкнути або зняти паузу очікування.
	 *
	 * Кличе екран: умова («когось немає І він ще не відповів І пільговий час не
	 * вичерпано») складається з присутності й пільги, а їх тримає сторінка.
	 * Зняття паузи додає надбавку — один раз на кожне чекання, а не на секунду.
	 */
	setHold(active: boolean, now: number): void {
		if (active) {
			this.#holdSince ??= now;
			return;
		}
		if (this.#holdSince === null) return;
		this.#heldMs += Math.max(0, now - this.#holdSince) + RESUME_BONUS_MS;
		this.#holdSince = null;
	}

	/** Скільки часу вже віддано за чекання, разом із поточною паузою. */
	heldMs(now: number): number {
		const running = this.#holdSince === null ? 0 : Math.max(0, now - this.#holdSince);
		return this.#heldMs + running;
	}

	/**
	 * Коли поточний раунд мусить закінчитися, за серверним часом.
	 *
	 * Дві причини закінчитися, і ближча перемагає: вийшов час або відповіли всі
	 * (тоді ще секунда, щоб останній побачив власну відповідь на дошці).
	 * `null` — раунду немає.
	 *
	 * `now` потрібен саме для паузи: поки вона триває, дедлайн їде разом із часом,
	 * тобто стоїть на місці на екрані.
	 */
	deadlineAt(now = 0): number | null {
		const start = this.startedAt[this.round];
		if (start === undefined) return null;

		const byTime = start + this.limitMs + this.heldMs(now);
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

		const deadline = this.deadlineAt(now);
		if (deadline === null) return 'round';
		return now >= deadline ? 'reveal' : 'round';
	}

	/**
	 * Скільки лишилося до кінця раунду. Для смуги таймера.
	 *
	 * Від ДЕДЛАЙНУ, а не від межі часу: коли відповіли всі, дедлайн переїжджає на
	 * секунду після останньої відповіді — і смуга мусить це показати. Доти вона
	 * рахувалася від `start + limitMs` і бігла далі на екрані, де раунд уже
	 * фактично закінчився.
	 */
	leftMs(now: number): number {
		const deadline = this.deadlineAt(now);
		if (deadline === null) return 0;
		return Math.max(0, deadline - now);
	}

	/** Чи час господареві оголошувати наступний раунд. */
	nextDue(now: number): boolean {
		const deadline = this.deadlineAt(now);
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

	/**
	 * ГОЛОС «ГРАЄМО ДАЛІ БЕЗ НЬОГО» — звичайний хід у журналі.
	 *
	 * Правил бази правити не довелося: конверт ходу вже дозволяє свій тип (рядок до
	 * 16 знаків) і числа в payload, підпис перевіряє сама база (`by == auth.uid`),
	 * час ставить сервер, а повторний запис того самого номера відкидається. Тобто
	 * голосування вкладається в наявну модель ЦІЛКОМ.
	 *
	 * Номер раунду їде разом із голосом: чекання буває в кожному раунді, і голос за
	 * попередній не має права зняти паузу в наступному.
	 */
	async voteGoOn(): Promise<void> {
		if (this.round < 0 || this.goOn.includes(this.#me)) return;
		await this.#transport.append({
			seq: this.applied + 1,
			by: this.#me,
			type: 'goon',
			payload: { round: this.round }
		});
	}

	/** Хто вже проголосував «граємо далі» в ЦЬОМУ раунді. */
	get goOn(): string[] {
		return this.#goOnVotes[this.round] ?? [];
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
		const goOnVotes: Record<number, string[]> = {};

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

			if (move.type === 'goon') {
				// ОДИН ГРАВЕЦЬ — ОДИН ГОЛОС у раунді. Повторний нічого не додає:
				// інакше повторне натискання саме собою давало б «більшість».
				const forRound = (goOnVotes[round] ??= []);
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

		this.startedAt = startedAt;
		this.answers = answers;
		this.#goOnVotes = goOnVotes;
		this.applied = snapshot.moves.length;
	}
}
