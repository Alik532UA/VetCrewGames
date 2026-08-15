import { getNextQuestion, type GameQuestion } from '$lib/config/myth-game';
import { settings } from '$lib/services/settings.svelte';
import { storage } from '$lib/services/storage';

/**
 * Стан гри «Правда чи міф?».
 *
 * Логіка живе тут, а не в `+page.svelte` (SVELTE-CORE-v8 § 3.1, HIGH). Ціна
 * попереднього розкладу була не теоретична: `myth-game.ts` уже експортував
 * `getNextQuestion()`, і той навіть мав тест — але сторінка ним не
 * користувалася, а повторювала вибір питання власним кодом. Тобто тест
 * перевіряв функцію, якої застосунок не викликає, і читався як покриття
 * ігрової логіки. Тепер функція одна, і тестується саме вона.
 *
 * Контролер створює компонент (`new MythGameController()`), а не модуль: стан
 * партії має гинути разом зі сторінкою. Через це `reset()` тут не «на запас» —
 * він відповідає сценарію «зіграти ще раз» на екрані підсумку
 * (SVELTE-CORE-v8 § 1.4).
 */

/** Підмножина `RoundStatus` із `RoundIndicator`: гра дає лише два результати. */
export type RoundOutcome = 'correct' | 'incorrect';

export type ActiveQuestion = GameQuestion & {
	answered: boolean;
	selectedTrue: boolean | null;
	isCorrect: boolean;
};

/** Ключ сховища: питання, які вже показувалися в попередніх сесіях. */
const SHOWN_KEY = 'shown_myths';

export class MythGameController {
	readonly totalRounds: number;

	current = $state<ActiveQuestion | null>(null);
	roundNumber = $state(1);
	roundResults = $state<RoundOutcome[]>([]);
	sessionScore = $state(0);
	gameOver = $state(false);

	/**
	 * Обидва списки — звичайні поля, а не `$state`: розмітка їх не читає,
	 * і глибокий проксі на них означав би плату за спостереження, якого ніхто
	 * не використовує (SVELTE-CORE-v8 § 1.3).
	 */
	#usedThisGame: string[] = [];
	#usedEver: string[] = [];

	constructor(totalRounds = 10) {
		this.totalRounds = totalRounds;
	}

	/** Гідрація зі сховища й перше питання. Викликає компонент один раз. */
	start(): void {
		this.#usedEver = storage.getJSON<string[]>(SHOWN_KEY) ?? [];
		this.#next();
	}

	answer(choice: boolean): void {
		const question = this.current;
		if (!question || question.answered) return;

		question.selectedTrue = choice;
		question.isCorrect = choice === question.isTrue;
		question.answered = true;

		this.roundResults.push(question.isCorrect ? 'correct' : 'incorrect');

		if (question.isCorrect) {
			this.sessionScore++;
			settings.addScore(1);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

	/** «Зіграти ще раз» на екрані підсумку. */
	reset(): void {
		this.roundNumber = 1;
		this.roundResults = [];
		this.sessionScore = 0;
		this.gameOver = false;
		this.#usedThisGame = [];
		this.#next();
	}

	#next(): void {
		if (this.roundNumber > this.totalRounds) {
			this.current = null;
			this.gameOver = true;
			return;
		}

		let question = getNextQuestion([...this.#usedThisGame, ...this.#usedEver]);

		// Питання скінчилися не в цій партії, а взагалі: пам'ять про попередні
		// сесії скидається, і колода починається з початку. Наскрізний запис —
		// одразу, а не ефектом (SVELTE-CORE-v8 § 1.9).
		if (!question) {
			this.#usedEver = [];
			this.#persistUsed();
			question = getNextQuestion(this.#usedThisGame);
		}

		// Не лишилося навіть без обмежень — колода коротша за кількість раундів.
		if (!question) return;

		this.current = { ...question, answered: false, selectedTrue: null, isCorrect: false };
		this.#usedThisGame.push(question.id);
		this.#usedEver.push(question.id);
		this.#persistUsed();
	}

	/**
	 * Копія, а не сам масив. Фасад одразу робить `JSON.stringify`, тож на
	 * поведінку це не впливає, — але віддавати назовні посилання на поле, яке
	 * зараз-таки мутують `push`-ом, означає, що будь-хто інший (мок у тесті,
	 * майбутній асинхронний запис) побачить не той стан, який йому передавали.
	 */
	#persistUsed(): void {
		storage.setJSON(SHOWN_KEY, [...this.#usedEver]);
	}
}
