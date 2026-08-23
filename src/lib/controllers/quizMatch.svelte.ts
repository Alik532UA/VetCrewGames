import type { Member, RoomSnapshot, RoomTransport } from '$lib/net/roomTypes';
import { configToGames, quizProgramme, type QuizStep } from '$lib/config/quizOnline';

/**
 * Спільна вікторина: програма з зерна, рахунок із журналу.
 *
 * ## Чим це відрізняється від `PairsMatch`
 *
 * Той відтворює ДОШКУ з журналу ходів: усі застосовують ті самі ходи й
 * отримують той самий стан. Тут дошки в кожного своя, і в журнал їде лише
 * результат кроку. Тому цей адаптер не «грає» нічого — він рахує, хто на якому
 * кроці й скільки набрав.
 *
 * Ціна цієї моделі (результат неперевірний) названа в `config/quizOnline.ts`, і
 * там же — чому інакше було б неможливо для одночасної гри.
 *
 * ## Що тут інваріант
 *
 * **Один крок — один запис від гравця.** Повторний результат того самого кроку
 * ВІДКИДАЄТЬСЯ, і це не косметика: без цього гравець, чий запис не доїхав із
 * першого разу, надіслав би його вдруге й отримав подвійні очки. База від цього
 * не захищає — номер у журналі в другого запису інший, тож правило «лише
 * створити» тут не діє.
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
	 * Скільки кроків уже закрив кожен гравець і скільки набрав.
	 *
	 * Плаский `Record`, а не два: обидва числа міняються ОДНИМ записом (результат
	 * кроку), і розділені вони давали б стан, у якому крок уже зарахований, а очки
	 * ще ні.
	 */
	progress = $state<Record<string, { step: number; score: number }>>({});

	readonly #me: string;
	readonly #transport: RoomTransport;

	constructor(me: string, transport: RoomTransport) {
		this.#me = me;
		this.#transport = transport;
	}

	listen(): () => void {
		return this.#transport.watch((snapshot) => this.#apply(snapshot));
	}

	/** Гравці партії, у порядку входу. Глядачі не грають. */
	get players(): Member[] {
		return this.members
			.filter((member) => member.role === 'player')
			.sort((a, b) => a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
	}

	/** Програма партії. Порожня, доки не приїхали зерно й набір ігор. */
	get programme(): QuizStep[] {
		if (this.seed === 0) return [];
		return quizProgramme(this.seed, this.games);
	}

	/** На якому кроці я зараз. Дорівнює довжині програми — я закінчив. */
	get myStep(): number {
		return this.progress[this.#me]?.step ?? 0;
	}

	get myScore(): number {
		return this.progress[this.#me]?.score ?? 0;
	}

	/** Крок, який мені грати. `null` — програми ще немає або я вже закінчив. */
	get currentStep(): QuizStep | null {
		const programme = this.programme;
		return this.myStep < programme.length ? programme[this.myStep] : null;
	}

	/** Скільком гравцям лишилося грати. Нуль — партія скінчилася для всіх. */
	get playing(): number {
		const total = this.programme.length;
		if (total === 0) return this.players.length;
		return this.players.filter((player) => (this.progress[player.uid]?.step ?? 0) < total).length;
	}

	get over(): boolean {
		return this.status === 'playing' && this.programme.length > 0 && this.playing === 0;
	}

	/**
	 * Оголосити результат свого кроку.
	 *
	 * Номер кроку їде РАЗОМ з очками, а не мається на увазі. Без нього два записи,
	 * що приїхали не в тому порядку, зарахувалися б як два різні кроки — а вони
	 * могли бути одним, надісланим двічі.
	 */
	async finishStep(points: number): Promise<void> {
		const step = this.myStep;
		if (step >= this.programme.length) return;
		await this.#transport.append({
			seq: this.applied + 1,
			by: this.#me,
			type: 'step',
			payload: { step, points }
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
		 * Журнал перечитується З НУЛЯ, а не догортається.
		 *
		 * У «Знайди пару» ходи застосовуються по одному, бо кожен міняє дошку. Тут
		 * рахунок — це СУМА журналу, і перечитати його цілком дешевше, ніж тримати
		 * інваріант «застосовано рівно до N»: журнал вікторини має стільки записів,
		 * скільки кроків × гравців, тобто десятки.
		 *
		 * Побічно це закриває найгіршу дірку: пропуск у нумерації (хід ще не
		 * приїхав) не зупиняє рахунок, бо порядок тут не має значення — сума не
		 * залежить від того, чий крок прийшов першим.
		 */
		const progress: Record<string, { step: number; score: number }> = {};
		for (const move of snapshot.moves) {
			if (move.type !== 'step') continue;
			const step = Number(move.payload?.step);
			const points = Number(move.payload?.points);
			if (!Number.isInteger(step) || !Number.isFinite(points)) continue;

			const seen = progress[move.by] ?? { step: 0, score: 0 };
			// ОДИН КРОК — ОДИН РАЗ. Повторний запис того самого кроку нічого не
			// додає: інакше повтор надсилання давав би подвійні очки.
			if (step !== seen.step) continue;
			progress[move.by] = { step: seen.step + 1, score: seen.score + points };
		}

		this.progress = progress;
		this.applied = snapshot.moves.length;
	}
}
