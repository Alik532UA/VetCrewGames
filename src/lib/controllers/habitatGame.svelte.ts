import { randomFor } from '$lib/utils/seededRandom';
import {
	buildHabitatRound,
	getNextHabitatEntry,
	type HabitatMode,
	type HabitatRound
} from '$lib/config/habitat-game';
import { settings } from '$lib/services/settings.svelte';
import { roundPoints } from '$lib/config/scoring';
import type { RoundOutcome } from '$lib/types/game';

/**
 * Стан гри «Де живем?» (концепція, гра 3).
 *
 * Два підрежими — континенти й біоми — і множинний вибір: лев живе і в
 * Африці, і в Індії. Через це «правильно» тут має три градації, а не дві:
 *
 *  * `correct` — вибрано рівно те, що треба;
 *  * `partial` — усе вибране правильне, але щось пропущено. Це не помилка
 *    знань, це неповна відповідь, і карати за неї нарівні з «не там» було б
 *    неправильно;
 *  * `incorrect` — вибрано щось зайве або не вибрано нічого правильного.
 *
 * Очко дається лише за точну відповідь: інакше «натиснути все підряд» стало
 * б виграшною стратегією.
 */
export class HabitatGameController {
	readonly totalRounds: number;

	/** `null`, доки гравець не обрав підрежим на стартовому екрані. */
	mode = $state<HabitatMode | null>(null);

	round = $state<HabitatRound | null>(null);
	roundNumber = $state(1);
	roundResults = $state<RoundOutcome[]>([]);
	sessionScore = $state(0);
	gameOver = $state(false);

	/** Обране гравцем у поточному раунді. */
	selected = $state<string[]>([]);
	checked = $state(false);

	#used: string[] = [];

	/**
	 * Джерело випадковості ПАРТІЇ — одне на всю партію, а не на раунд.
	 *
	 * Саме тому воно поле, а не виклик у `#next()`: послідовність раундів мусить
	 * відтворюватися цілком. Новий генератор на кожен раунд дав би однакове перше
	 * питання й розбіжність далі — найгірший різновид розбіжності, бо схожий на
	 * робочу гру.
	 *
	 * Без зерна тут `Math.random`: соло-партія має бути іншою щоразу. Із зерном —
	 * та сама гра в усіх учасників, і для цього досить переслати одне число.
	 */
	#random: () => number;

	constructor(totalRounds = 10, seed?: number) {
		this.totalRounds = totalRounds;
		this.#seed = seed;
		this.#random = randomFor(seed);
	}

	/** Зерно партії; `undefined` — соло, кожен захід інший. */
	readonly #seed: number | undefined;

	/** Кнопка перевірки має сенс лише тоді, коли щось обрано. */
	canCheck = $derived(!this.checked && this.selected.length > 0);

	outcome = $derived.by<RoundOutcome | null>(() => {
		if (!this.checked || !this.round) return null;
		const correct = this.round.correct;
		const hitAll = correct.every((option) => this.selected.includes(option));
		const noExtras = this.selected.every((option) => correct.includes(option));

		if (hitAll && noExtras) return 'correct';
		if (noExtras) return 'partial';
		return 'incorrect';
	});

	/** Стартовий екран: вибір підрежиму запускає партію. */
	chooseMode(mode: HabitatMode): void {
		this.mode = mode;
		this.roundNumber = 1;
		this.roundResults = [];
		this.sessionScore = 0;
		this.gameOver = false;
		this.#used = [];
		this.#next();
	}

	toggle(option: string): void {
		if (this.checked) return;
		this.selected = this.selected.includes(option)
			? this.selected.filter((item) => item !== option)
			: [...this.selected, option];
	}

	check(): void {
		if (!this.canCheck) return;
		this.checked = true;

		const outcome = this.outcome ?? 'incorrect';
		this.roundResults.push(outcome);

		/*
		 * Частковий успіх ТЕЖ коштує очок — і це головна зміна в цій грі.
		 *
		 * Доти зараховувався лише бездоганний раунд, тобто гравець, який назвав
		 * чотири зони з пʼяти, діставав рівно те саме, що й той, хто не назвав
		 * жодної. Для гри, яка НАВЧАЄ, це найгірша з можливих відповідей: вона
		 * не відрізняє «майже знаю» від «не знаю».
		 *
		 * Зайвий вибір ВІДНІМАЄ влучний. Інакше найкращою стратегією було б
		 * тицьнути всі зони підряд і зібрати повний бал за незнання. Через це
		 * надбавка за бездоганність приходить рівно тоді, коли влучено все й
		 * зайвого немає, — саме її й рахує `roundPoints`.
		 */
		const correct = this.round?.correct ?? [];
		const hits = this.selected.filter((option) => correct.includes(option)).length;
		const extras = this.selected.length - hits;
		const points = roundPoints(hits - extras, correct.length);

		if (points > 0) {
			this.sessionScore += points;
			settings.addScore(points);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

	/** Повертає на стартовий екран — саме там міняється підрежим. */
	/**
	 * Те саме зерно — та сама гра, і ПІСЛЯ «грати знову»: генератор створюється
	 * заново. Для соло це нічого не міняє (там він і був `Math.random`), а для
	 * спільної партії робить повтор передбачуваним, а не «майже тим самим».
	 */
	reset(): void {
		this.#random = randomFor(this.#seed);
		this.mode = null;
		this.round = null;
		this.checked = false;
		this.selected = [];
		this.gameOver = false;
		this.roundNumber = 1;
		this.roundResults = [];
		this.sessionScore = 0;
		this.#used = [];
	}

	#next(): void {
		this.selected = [];
		this.checked = false;

		if (!this.mode || this.roundNumber > this.totalRounds) {
			this.round = null;
			this.gameOver = this.mode !== null;
			return;
		}

		const entry = getNextHabitatEntry(this.#used, this.#random);
		if (!entry) {
			// Записи скінчилися раніше за раунди — партія завершується, а не
			// повторює те саме питання.
			this.round = null;
			this.gameOver = true;
			return;
		}

		this.#used.push(entry.animalId);

		const round = buildHabitatRound(entry, this.mode);
		if (!round) {
			// Для цього підрежиму в запису немає жодної правильної відповіді.
			// Пропускаємо, а не показуємо питання, на яке не можна відповісти.
			this.#next();
			return;
		}

		this.round = round;
	}
}
