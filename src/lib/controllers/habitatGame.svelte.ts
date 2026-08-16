import {
	buildHabitatRound,
	getNextHabitatEntry,
	type HabitatMode,
	type HabitatRound
} from '$lib/config/habitat-game';
import { settings } from '$lib/services/settings.svelte';
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

	constructor(totalRounds = 10) {
		this.totalRounds = totalRounds;
	}

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

		if (outcome === 'correct') {
			this.sessionScore++;
			settings.addScore(1);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

	/** Повертає на стартовий екран — саме там міняється підрежим. */
	reset(): void {
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

		const entry = getNextHabitatEntry(this.#used);
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
