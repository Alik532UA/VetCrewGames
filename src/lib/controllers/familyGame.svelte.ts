import { buildRound, getNextPuzzle, type FamilyRound } from '$lib/config/family-game';
import type { Animal } from '$lib/config/population-game';
import { settings } from '$lib/services/settings.svelte';
import type { RoundOutcome } from '$lib/types/game';

/**
 * Стан гри «Хто з іншої родини?» (концепція, гра 5).
 *
 * Правило одне: з чотирьох карток три належать до однієї біологічної групи,
 * і треба клікнути четверту. Після кліку дошка завмирає й показує пояснення —
 * саме воно, а не очко, є метою гри.
 *
 * Контролер створює компонент (`new`), а не модуль: партія має гинути разом
 * зі сторінкою (SVELTE-CORE-v8 § 3.1, § 1.4).
 */
export class FamilyGameController {
	readonly totalRounds: number;

	round = $state<FamilyRound | null>(null);
	roundNumber = $state(1);
	roundResults = $state<RoundOutcome[]>([]);
	sessionScore = $state(0);
	gameOver = $state(false);

	/** Картка, яку обрав гравець. `null`, доки він не відповів. */
	chosen = $state<Animal | null>(null);

	/** Набори, показані в цій партії: повторів у межах партії не буває. */
	#used: string[] = [];

	constructor(totalRounds = 10) {
		this.totalRounds = totalRounds;
	}

	get answered(): boolean {
		return this.chosen !== null;
	}

	/** Чи вгадав гравець. Має сенс лише після відповіді. */
	get isCorrect(): boolean {
		return this.chosen !== null && this.chosen.id === this.round?.oddAnimal.id;
	}

	start(): void {
		this.#next();
	}

	choose(animal: Animal): void {
		if (!this.round || this.answered) return;

		this.chosen = animal;
		const correct = animal.id === this.round.oddAnimal.id;
		this.roundResults.push(correct ? 'correct' : 'incorrect');

		if (correct) {
			this.sessionScore++;
			settings.addScore(1);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

	reset(): void {
		this.roundNumber = 1;
		this.roundResults = [];
		this.sessionScore = 0;
		this.gameOver = false;
		this.#used = [];
		this.#next();
	}

	#next(): void {
		this.chosen = null;

		if (this.roundNumber > this.totalRounds) {
			this.round = null;
			this.gameOver = true;
			return;
		}

		// Наборів менше, ніж могло б знадобитися раундів, тож коли вони
		// вичерпуються — партія просто завершується достроково. Показувати той
		// самий набір удруге гірше: гравець уже знає відповідь.
		const puzzle = getNextPuzzle(this.#used);
		if (!puzzle) {
			this.round = null;
			this.gameOver = true;
			return;
		}

		const round = buildRound(puzzle);
		if (!round) {
			// Набір посилається на тварину, якої немає в каталозі. Пропускаємо
			// його, а не показуємо порожню картку; інваріант у тесті стежить,
			// щоб таких наборів не було взагалі.
			this.#used.push(puzzle.id);
			this.#next();
			return;
		}

		this.#used.push(puzzle.id);
		this.round = round;
	}
}
