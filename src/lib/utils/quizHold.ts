import { RESUME_BONUS_MS } from '$lib/config/quizOnline';

/** Що лишає по собі відпущене чекання — те, що йде в журнал. */
export interface ReleasedHold {
	/** Раунд, у якому чекання ПОЧАЛОСЯ: у наступному воно нічого не означає. */
	round: number;
	/** Скільки раунд простояв СУКУПНО, з надбавкою, — поверх основи. */
	total: number;
	/** Кому скільки пільги списати СУКУПНО за раунд — поверх основи. */
	spent: Record<string, number>;
}

/**
 * ОДНЕ ЧЕКАННЯ ВІКТОРИНИ — від першого такту до відпускання.
 *
 * Окремо від `QuizMatch`, бо це облік, а не партія: тут немає ні мережі, ні
 * реактивності, лише числа від часу, і їх видно в `quizHold.test.ts` без
 * транспорту. Контролер стояв на межі розміру (`structure.test.ts`), а саме цей
 * облік і виріс, коли паузу почав писати кожен гравець (аудит 2026-09-24).
 *
 * ## Основа — у мить, коли чекання ПОЧАЛОСЯ
 *
 * Раунд, пауза й витрачена пільга, які вже були в журналі. Не в мить
 * відпускання, і це не дрібниця: присутність доїжджає до гравців у різні миті,
 * тож хтось відпускає те саме чекання першим і пише своє число, а в мене воно ще
 * триває. Нарощувати поверх ЙОГО числа означало б рахувати те саме чекання двічі.
 * Чужий запис про те саме чекання — не основа, а конкурент, і його вирішує `max`
 * у перепрогоні (`quizReplay.ts`, `countHolds`).
 *
 * ## Пільга — за проміжками, а не за миттю відпускання
 *
 * Доти пільгу списували тим, кого немає В МИТЬ ВІДПУСКАННЯ, — а чекання
 * відпускається найчастіше саме тому, що зниклий повернувся. Тобто в звичайному
 * випадку не списувалося нічого, і повний відлік вертався щоразу; так само й
 * пауза, знята її автором: у мить відпускання її вже немає. Тепер проміжок
 * рахується від миті, коли людини не стало, до миті, коли вона повернулася, а
 * автор паузи платить за все чекання.
 */
export class QuizHold {
	#since: number | null = null;
	#round = -1;
	#base = 0;
	#spentBase: Record<string, number> = {};
	#awayFrom: Record<string, number> = {};
	#awayMs: Record<string, number> = {};
	#pausers: string[] = [];

	/**
	 * Чекання триває — кличеться щотакту. Перший виклик відкриває його й запамʼятовує
	 * основу; кожен наступний оновлює, кого немає і хто ставив паузу.
	 */
	hold(
		now: number,
		round: number,
		base: number,
		spentBase: Readonly<Record<string, number>>,
		away: readonly string[],
		pausedBy: string | null
	): void {
		if (this.#since === null) {
			this.#since = now;
			this.#round = round;
			this.#base = base;
			this.#spentBase = { ...spentBase };
		}
		this.#track(now, away);
		if (pausedBy !== null && !this.#pausers.includes(pausedBy)) this.#pausers.push(pausedBy);
	}

	/** Відпустити. `null` — чекання не було. Надбавка — раз на чекання, а не на виклик. */
	release(now: number): ReleasedHold | null {
		if (this.#since === null) return null;
		const since = this.#since;
		this.#track(now, []);

		const own: Record<string, number> = { ...this.#awayMs };
		for (const uid of this.#pausers) own[uid] = Math.max(own[uid] ?? 0, now - since);
		const spent: Record<string, number> = {};
		for (const [uid, ms] of Object.entries(own)) {
			if (ms > 0) spent[uid] = (this.#spentBase[uid] ?? 0) + ms;
		}

		const released = {
			round: this.#round,
			total: this.#base + Math.max(0, now - since) + RESUME_BONUS_MS,
			spent
		};
		this.reset();
		return released;
	}

	/** Скільки раунд `round` уже простояв разом із цим чеканням; `null` — у ньому чекання немає. */
	heldNow(now: number, round: number): number | null {
		if (this.#since === null || this.#round !== round) return null;
		return this.#base + Math.max(0, now - this.#since);
	}

	/** Забути чекання без запису — нова партія (реванш) його не успадковує. */
	reset(): void {
		this.#since = null;
		this.#round = -1;
		this.#base = 0;
		this.#spentBase = {};
		this.#awayFrom = {};
		this.#awayMs = {};
		this.#pausers = [];
	}

	/** Відкрити проміжки тим, кого немає, і закрити тим, хто повернувся. */
	#track(now: number, away: readonly string[]): void {
		for (const uid of away) this.#awayFrom[uid] ??= now;
		for (const [uid, from] of Object.entries(this.#awayFrom)) {
			if (away.includes(uid)) continue;
			this.#awayMs[uid] = (this.#awayMs[uid] ?? 0) + Math.max(0, now - from);
			delete this.#awayFrom[uid];
		}
	}
}
