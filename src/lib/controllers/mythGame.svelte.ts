import { randomFor } from '$lib/utils/seededRandom';
import { getNextQuestion, type GameQuestion } from '$lib/config/myth-game';
import { settings } from '$lib/services/settings.svelte';
import { maxSessionPoints, roundPoints } from '$lib/config/scoring';
import { storage } from '$lib/services/storage';
import type { RoundOutcome } from '$lib/types/game';

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

export type ActiveQuestion = GameQuestion & {
	answered: boolean;
	selectedTrue: boolean | null;
	isCorrect: boolean;
};

/** Ключ сховища: питання, які вже показувалися в попередніх сесіях. */
const SHOWN_KEY = 'shown_myths';

export class MythGameController {
	readonly totalRounds: number;

	/**
	 * Максимум за партію — З ПРАВИЛА РАХУНКУ, а не з числа раундів.
	 *
	 * Раунд тут бінарний, тобто коштує `BINARY_POINTS` (три), і саме тому
	 * знаменником не може бути `totalRounds`: десять раундів дають 30 балів, а
	 * не 10. Екран підсумку показував саме 10 — заміряно автором.
	 *
	 * `maxSessionPoints` існує в `config/scoring.ts` із тестами й доти не
	 * викликалася ніде. Тепер зміна ціни відповіді в одному місці міняє й це
	 * число: правити знаменник руками більше не треба.
	 */
	get maxScore(): number {
		return maxSessionPoints(1, this.totalRounds);
	}

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

	/**
	 * Гідрація зі сховища й перше питання. Викликає компонент один раз.
	 *
	 * **У партії із зерном сховище НЕ читається.** «Показане назавжди» — це
	 * місцева пам'ять цього браузера, і в двох учасників вона різна. Спільна
	 * партія, яка на неї спирається, розвела б гравців із того самого зерна на
	 * різні питання — розбіжність, схожа на робочу гру, і тому найгірша. Соло
	 * читає й далі: там пам'ять про показане і є та річ, яка не дає повторів.
	 */
	start(): void {
		this.#usedEver = this.#seed === undefined ? (storage.getJSON<string[]>(SHOWN_KEY) ?? []) : [];
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
			// Бінарний раунд коштує три очки: одиниця була б несумірна з раундом,
			// де відповідей три (config/scoring.ts).
			const points = roundPoints(1, 1);
			this.sessionScore += points;
			settings.addScore(points);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

	/** «Зіграти ще раз» на екрані підсумку. */
	/**
	 * Те саме зерно — та сама гра, і ПІСЛЯ «грати знову»: генератор створюється
	 * заново. Для соло це нічого не міняє (там він і був `Math.random`), а для
	 * спільної партії робить повтор передбачуваним, а не «майже тим самим».
	 */
	reset(): void {
		this.#random = randomFor(this.#seed);
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

		let question = getNextQuestion([...this.#usedThisGame, ...this.#usedEver], this.#random);

		// Питання скінчилися не в цій партії, а взагалі: пам'ять про попередні
		// сесії скидається, і колода починається з початку. Наскрізний запис —
		// одразу, а не ефектом (SVELTE-CORE-v8 § 1.9).
		if (!question) {
			this.#usedEver = [];
			this.#persistUsed();
			question = getNextQuestion(this.#usedThisGame, this.#random);
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
