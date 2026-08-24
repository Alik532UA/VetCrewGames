import { randomFor } from '$lib/utils/seededRandom';
import { BIN, buildFeedingRound, correctTarget, FOODS_PER_ROUND, getNextFeedingSet, type FeedingRound, type Food, type Target } from '$lib/config/feeding-game';
import { playerData } from '$lib/services/playerData.svelte';
import { GAME_ID } from '$lib/config/menu-games';
import { maxSessionPoints, roundPoints } from '$lib/config/scoring';
import type { RoundOutcome } from '$lib/types/game';

/**
 * Стан гри «Що їмо?» (концепція, гра 1).
 *
 * Дві тварини, три страви, смітник. Кожну страву треба покласти туди, куди
 * вона підходить; те, що не підходить нікому, — викинути. Підтвердження —
 * кнопкою «Погодувати», і лише після неї показується розбір КОЖНОЇ страви,
 * а не загальне «правильно/неправильно»: пояснення, чому шоколад отруйний,
 * тут цінніше за очко.
 *
 * Очко нараховується за кожну правильно покладену страву, а не за раунд
 * цілком — так само, як у грі про чисельність.
 */

/** Куди гравець поклав кожну страву: ключ — `food.id`. */
export type Placements = Record<string, Target>;

/** Місце страви: тварина, смітник — або `null`, тобто назад на стіл. */
export type Spot = Target | null;

export interface FeedingVerdict {
	food: Food;
	chosen: Target;
	correct: Target;
	isCorrect: boolean;
}

export class FeedingGameController {
	readonly totalRounds: number;

	round = $state<FeedingRound | null>(null);
	roundNumber = $state(1);
	roundResults = $state<RoundOutcome[]>([]);
	sessionScore = $state(0);
	gameOver = $state(false);

	placements = $state<Placements>({});
	fed = $state(false);

	/** Страва, яку гравець узяв: наступний клік по зоні покладе її туди. */
	picked = $state<Food | null>(null);

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

	/** Скільки страв у раунді — стільки й максимум очок за нього. */
	get foodsPerRound(): number {
		return this.round?.foods.length ?? 3;
	}

	/**
	 * Максимум за партію.
	 *
	 * Було `totalRounds * 3` — і це занижувало його на десять балів: складений
	 * раунд дає ще й `PERFECT_BONUS` за відповідь без жодної помилки, тобто
	 * 3 + 1 = 4 за раунд, а не 3. Тепер число бере `maxSessionPoints`, і надбавка
	 * враховується сама.
	 *
	 * Страв у раунді завжди три — перевірено по `config/feeding-game.ts`: усі
	 * десять раундів мають рівно три `foodIds`. Якщо колись з’явиться раунд
	 * іншого розміру, це число стане неправильним, і саме тому воно виводиться
	 * з `FOODS_PER_ROUND`, а не вписане цифрою.
	 */
	get maxScore(): number {
		return maxSessionPoints(FOODS_PER_ROUND, this.totalRounds);
	}

	/** Страви, які ще лежать «на столі». */
	unplaced = $derived(this.round?.foods.filter((food) => !(food.id in this.placements)) ?? []);

	/**
	 * Годувати можна, щойно гравець зробив хоч один хід.
	 *
	 * Раніше вимагалося розкласти всі три, і саме через це доводилося тягнути
	 * очевидне сміття у смітник, коли рішення вже прийнято. Страва, що лишилася
	 * на столі, і так рахується як викинута — `verdicts` бере `?? BIN`, — тож
	 * вимога була не правилом гри, а зайвим рухом.
	 *
	 * Один хід усе-таки потрібен: інакше кнопка активна з першої секунди раунду,
	 * і випадковий дотик коштує раунду. Відповідь «усе троє в смітник» при цьому
	 * лишається доступною — її просто треба висловити смітником.
	 */
	canFeed = $derived(!this.fed && this.round !== null && this.unplaced.length < this.foodsPerRound);

	/** Розбір кожної страви. Порожній, доки не натиснуто «Погодувати». */
	verdicts = $derived.by<FeedingVerdict[]>(() => {
		if (!this.fed || !this.round) return [];
		const animalIds = this.round.animals.map((animal) => animal.id);
		return this.round.foods.map((food) => {
			const chosen = this.placements[food.id] ?? BIN;
			const correct = correctTarget(food, animalIds);
			return { food, chosen, correct, isCorrect: chosen === correct };
		});
	});

	start(): void {
		this.#next();
	}

	/**
	 * Взяти страву або зняти вибір повторним кліком.
	 *
	 * Брати можна і те, що вже лежить у зоні: рішення міняється одним рухом —
	 * взяв і поклав деінде, — а не «поверни на стіл, потім клади заново».
	 */
	pick(food: Food): void {
		if (this.fed) return;
		this.picked = this.picked?.id === food.id ? null : food;
	}

	/**
	 * Перекласти страву, хоч би де вона зараз лежала. `null` — назад на стіл.
	 *
	 * Єдиний шлях запису до `placements`: `place()` і `takeBack()` — це він
	 * же, просто з іншого боку. Три окремі присвоєння розійшлися б, щойно
	 * додасться четверте місце.
	 */
	moveTo(food: Food, spot: Spot): void {
		if (this.fed) return;
		if (spot === null) {
			const { [food.id]: _removed, ...rest } = this.placements;
			this.placements = rest;
		} else {
			this.placements = { ...this.placements, [food.id]: spot };
		}
		this.picked = null;
	}

	/** Покласти взяту страву до тварини або в смітник. */
	place(target: Target): void {
		if (this.picked) this.moveTo(this.picked, target);
	}

	/** Повернути страву на стіл — доки не погодували. */
	takeBack(food: Food): void {
		this.moveTo(food, null);
	}

	/** Страви, покладені до конкретної цілі. Потрібне розмітці для зон. */
	placedAt(target: Target): Food[] {
		return (this.round?.foods ?? []).filter((food) => this.placements[food.id] === target);
	}

	feed(): void {
		if (!this.canFeed) return;

		/*
		 * Те, що лишилося на столі, їде у смітник — по-справжньому, а не лише в
		 * підрахунку. Рахувалося воно так і раніше (`?? BIN` у розборі), але на
		 * екрані лишалося на столі, і гравець бачив стан, якого вже немає:
		 * рішення прийнято, а страва наче ще в грі.
		 *
		 * Заразом це звільняє стіл, і в порожній контейнер стає кнопка «Далі».
		 */
		const leftovers = Object.fromEntries(this.unplaced.map((food) => [food.id, BIN]));
		this.placements = { ...this.placements, ...leftovers };

		this.fed = true;
		this.picked = null;

		const correct = this.verdicts.filter((verdict) => verdict.isCorrect).length;

		let outcome: RoundOutcome = 'incorrect';
		if (correct === this.foodsPerRound) outcome = 'correct';
		else if (correct > 0) outcome = 'partial';
		this.roundResults.push(outcome);

		if (correct > 0) {
			// По очку за страву й надбавка за раунд без жодної помилки: три з трьох
			// це не «на одну краще, ніж дві» (config/scoring.ts).
			const points = roundPoints(correct, this.foodsPerRound);
			this.sessionScore += points;
			playerData.addScore(points);
		}
	}

	nextRound(): void {
		this.roundNumber++;
		this.#next();
	}

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
		this.#used = [];
		this.#next();
	}


	/**
	 * Кінець партії — і рекорд гри пишеться РІВНО ТУТ, один раз.
	 *
	 * Перевірка `gameOver` на вході не про обережність: партія закінчується з
	 * кількох місць (раунди скінчилися, набори скінчилися), і кожне з них раніше
	 * просто ставило прапорець. Рекорд, записаний двічі, зіпсував би `plays` —
	 * тобто число партій, яких не було.
	 */
	#finish(): void {
		if (this.gameOver) return;
		this.gameOver = true;
		playerData.finishGame(GAME_ID.feeding, this.sessionScore);
	}
	#next(): void {
		this.placements = {};
		this.picked = null;
		this.fed = false;

		if (this.roundNumber > this.totalRounds) {
			this.round = null;
			this.#finish();
			return;
		}

		const set = getNextFeedingSet(this.#used, this.#random);
		if (!set) {
			// Наборів менше, ніж раундів: партія завершується достроково, а не
			// показує той самий стіл удруге.
			this.round = null;
			this.#finish();
			return;
		}

		this.#used.push(set.id);

		const round = buildFeedingRound(set);
		if (!round) {
			// Набір посилається на тварину або страву, якої немає в каталозі.
			this.#next();
			return;
		}

		this.round = round;
	}
}
