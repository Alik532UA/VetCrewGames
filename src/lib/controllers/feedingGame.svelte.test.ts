import { existsSync } from 'node:fs';
import { PERFECT_BONUS } from '$lib/config/scoring';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { animals } from '$lib/config/population-game';
import { BIN, correctTarget, feedingSets, foods } from '$lib/config/feeding-game';
import { uk } from '$lib/i18n/translations/uk';

const settingsMock = { addScore: vi.fn() };
vi.mock('$lib/services/settings.svelte', () => ({ settings: settingsMock }));

const { FeedingGameController } = await import('./feedingGame.svelte');

describe('дані «Що їмо?»', () => {
	const animalIds = new Set(animals.map((animal) => animal.id));
	const foodIds = new Set(foods.map((food) => food.id));

	it('перевірка жива: набори й страви знайдено', () => {
		expect(feedingSets.length).toBeGreaterThan(3);
		expect(foods.length).toBeGreaterThan(5);
	});

	it('кожна тварина й кожна страва набору існують', () => {
		const missing: string[] = [];
		for (const set of feedingSets) {
			for (const id of set.animalIds)
				if (!animalIds.has(id)) missing.push(`${set.id}: тварина ${id}`);
			for (const id of set.foodIds) if (!foodIds.has(id)) missing.push(`${set.id}: страва ${id}`);
		}
		expect(missing, missing.join('\n')).toEqual([]);
	});

	/**
	 * Найважливіша перевірка даних. Страва, що підходить ОБОМ тваринам раунду,
	 * дала б питання з двома правильними відповідями — і гравець програвав би
	 * за правильну дію. Оком у таблиці з десяти наборів це не видно.
	 */
	it('жодна страва не підходить обом тваринам одразу', () => {
		const bad: string[] = [];
		for (const set of feedingSets) {
			for (const foodId of set.foodIds) {
				const food = foods.find((f) => f.id === foodId)!;
				const matches = set.animalIds.filter((id) => food.suitableFor.includes(id));
				if (matches.length > 1) bad.push(`${set.id}: ${foodId} пасує ${matches.join(' і ')}`);
			}
		}
		expect(bad, bad.join('\n')).toEqual([]);
	});

	it('у кожному наборі є що віддати кожній тварині й що викинути', () => {
		// Без цього набір вироджується: або комусь нічого не дістається, або
		// смітник не потрібен і гра зводиться до «розклади дві картки».
		const bad: string[] = [];
		for (const set of feedingSets) {
			const targets = set.foodIds.map((foodId) =>
				correctTarget(foods.find((f) => f.id === foodId)!, set.animalIds)
			);
			for (const animalId of set.animalIds) {
				if (!targets.includes(animalId)) bad.push(`${set.id}: ${animalId} лишається голодним`);
			}
			if (!targets.includes(BIN)) bad.push(`${set.id}: немає жодної страви у смітник`);
		}
		expect(bad, bad.join('\n')).toEqual([]);
	});

	it('страва без жодної придатної тварини має пояснення небезпеки', () => {
		const missing = foods
			.filter((food) => food.suitableFor.length === 0 && !food.hazardKey)
			.map((food) => food.id);
		expect(missing, `у смітник, але без пояснення: ${missing.join(', ')}`).toEqual([]);
	});

	it('усі ключі назв і пояснень є у словнику', () => {
		const keys = foods.flatMap((food) =>
			[food.nameKey, food.goodKey, food.hazardKey].filter(Boolean)
		) as string[];
		const missing = keys.filter((key) => !(key in uk));
		expect(missing, `ключів немає в перекладах: ${missing.join(', ')}`).toEqual([]);
	});

	/**
	 * Файл із зображенням існує для КОЖНОЇ страви.
	 *
	 * `asset()` шляхи не перевіряє: страва без файлу дає порожню картку, яка не
	 * падає ніде — ні в збірці, ні в тестах. Видно її лише оком на зібраному
	 * сайті, і то якщо саме ця страва випала в раунді.
	 */
	it('у кожної страви є файл зображення', () => {
		const missing = foods
			.map((food) => `static/images/food/${food.id}.webp`)
			.filter((path) => !existsSync(path));
		expect(missing, `немає файлів: ${missing.join(', ')}`).toEqual([]);
	});

	it('id наборів і страв унікальні', () => {
		expect(new Set(feedingSets.map((s) => s.id)).size).toBe(feedingSets.length);
		expect(new Set(foods.map((f) => f.id)).size).toBe(foods.length);
	});
});

describe('FeedingGameController', () => {
	beforeEach(() => settingsMock.addScore.mockReset());

	const started = (rounds = 10) => {
		const game = new FeedingGameController(rounds);
		game.start();
		return game;
	};

	/** Розкласти всі страви правильно. */
	const solve = (game: InstanceType<typeof FeedingGameController>) => {
		const ids = game.round!.animals.map((a) => a.id);
		for (const food of game.round!.foods) {
			game.pick(food);
			game.place(correctTarget(food, ids));
		}
	};

	it('start() накриває стіл: дві тварини й три страви', () => {
		const game = started();
		expect(game.round!.animals).toHaveLength(2);
		expect(game.round!.foods).toHaveLength(3);
		expect(game.unplaced).toHaveLength(3);
		expect(game.canFeed, 'годувати нічим, доки нічого не розкладено').toBe(false);
	});

	it('страва кладеться лише після того, як її взяли', () => {
		const game = started();
		const food = game.round!.foods[0];

		game.place(BIN);
		expect(game.placements, 'нічого не брали — нічого й не поклали').toEqual({});

		game.pick(food);
		game.place(BIN);
		expect(game.placements[food.id]).toBe(BIN);
		expect(game.picked, 'після викладання руки порожні').toBeNull();
	});

	it('повторний клік по взятій страві знімає вибір', () => {
		const game = started();
		const food = game.round!.foods[0];

		game.pick(food);
		game.pick(food);

		expect(game.picked).toBeNull();
	});

	/**
	 * Рішення міняється одним рухом. Раніше страву, яку вже поклали, не можна
	 * було взяти знову — доводилося повертати її на стіл і класти заново, і
	 * саме це читалося як «вибрав — і все».
	 */
	it('покладену страву можна взяти й перекласти до іншої тварини', () => {
		const game = started();
		const [first, second] = game.round!.animals;
		const food = game.round!.foods[0];

		game.pick(food);
		game.place(first.id);
		expect(game.placements[food.id]).toBe(first.id);

		game.pick(food);
		expect(game.picked?.id, 'узяти можна й те, що вже лежить у зоні').toBe(food.id);
		expect(game.placements[food.id], 'поки не поклали — страва лишається на місці').toBe(first.id);

		game.place(second.id);
		expect(game.placements[food.id]).toBe(second.id);
		expect(game.placedAt(first.id), 'у першої тварини вона більше не лежить').toEqual([]);
	});

	it('moveTo() кладе страву, хоч би що було в руках', () => {
		const game = started();
		const [first, second] = game.round!.animals;
		const [food, other] = game.round!.foods;

		game.pick(other);
		game.moveTo(food, first.id);

		expect(game.placements[food.id], 'кнопка «кому віддати» не залежить від вибору').toBe(first.id);
		expect(game.picked, 'після прямого ходу руки порожні').toBeNull();

		game.moveTo(food, second.id);
		expect(game.placements[food.id]).toBe(second.id);

		game.moveTo(food, null);
		expect(game.placements[food.id], 'null — це назад на стіл').toBeUndefined();
		expect(game.unplaced.map((f) => f.id)).toContain(food.id);
	});

	it('після годування стіл не приймає ні moveTo, ні pick', () => {
		const game = started();
		solve(game);
		game.feed();
		const [food] = game.round!.foods;
		const before = { ...game.placements };

		game.moveTo(food, BIN);
		game.pick(food);

		expect(game.placements).toEqual(before);
		expect(game.picked).toBeNull();
	});

	it('страву можна забрати зі столу назад, доки не погодували', () => {
		const game = started();
		const food = game.round!.foods[0];
		game.pick(food);
		game.place(BIN);

		game.takeBack(food);

		expect(game.placements[food.id]).toBeUndefined();
		expect(game.unplaced.map((f) => f.id)).toContain(food.id);
	});

	/**
	 * Страву, що лишилася на столі, і так рахують як викинуту. Вимагати, щоб її
	 * фізично поклали у смітник, означало зайвий рух після вже прийнятого
	 * рішення — саме на це й скаржилися.
	 */
	it('годувати можна, щойно зроблено бодай один хід', () => {
		const game = started();
		expect(game.canFeed, 'нічого не розкладено — годувати нема чим').toBe(false);

		const [first] = game.round!.foods;
		game.pick(first);
		game.place(game.round!.animals[0].id);

		expect(game.canFeed, 'один хід зроблено — цього досить').toBe(true);
		expect(game.unplaced, 'решта лишається на столі').toHaveLength(2);
	});

	it('залишене на столі рахується так само, як викинуте', () => {
		const game = started();
		const ids = game.round!.animals.map((a) => a.id);
		// Кладемо лише те, що комусь підходить; зайве не чіпаємо взагалі.
		for (const food of game.round!.foods) {
			const correct = correctTarget(food, ids);
			if (correct === BIN) continue;
			game.pick(food);
			game.place(correct);
		}
		const leftOnTable = game.unplaced.map((f) => f.id);
		expect(leftOnTable.length, 'у наборі є що викинути').toBeGreaterThan(0);

		game.feed();

		expect(game.unplaced, 'стіл після годування порожній').toEqual([]);
		expect(
			game.placedAt(BIN).map((f) => f.id),
			'залишки видно у смітнику, а не лише в підрахунку'
		).toEqual(leftOnTable);

		for (const id of leftOnTable) {
			const verdict = game.verdicts.find((v) => v.food.id === id)!;
			expect(verdict.chosen, `${id}: лишене на столі — це смітник`).toBe(BIN);
			expect(verdict.isCorrect, `${id}: і зараховане правильно`).toBe(true);
		}
		expect(game.roundResults.at(-1)).toBe('correct');
	});

	it('після годування кнопка гасне', () => {
		const game = started();
		solve(game);
		expect(game.canFeed).toBe(true);
		game.feed();
		expect(game.canFeed, 'двічі за раунд не годують').toBe(false);
	});

	it('повністю правильний раунд дає очко за кожну страву', () => {
		const game = started();
		solve(game);

		game.feed();

		expect(game.verdicts.every((v) => v.isCorrect)).toBe(true);
		// Бездоганний раунд дістає надбавку: три страви з трьох це інша якість
		// відповіді, ніж дві (config/scoring.ts).
		expect(game.sessionScore).toBe(3 + PERFECT_BONUS);
		expect(settingsMock.addScore).toHaveBeenCalledWith(3 + PERFECT_BONUS);
		expect(game.roundResults).toEqual(['correct']);
	});

	it('частково правильний раунд дає partial і очки лише за влучання', () => {
		const game = started();
		const ids = game.round!.animals.map((a) => a.id);
		const [first, ...rest] = game.round!.foods;

		// Першу навмисно не туди, решту правильно.
		const wrong = correctTarget(first, ids) === BIN ? ids[0] : BIN;
		game.pick(first);
		game.place(wrong);
		for (const food of rest) {
			game.pick(food);
			game.place(correctTarget(food, ids));
		}

		game.feed();

		expect(game.roundResults).toEqual(['partial']);
		// Дві з трьох — рівно два очки: надбавки за частковий раунд немає.
		expect(game.sessionScore).toBe(2);
	});

	it('розбір показує і те, що обрали, і те, що було правильно', () => {
		const game = started();
		solve(game);
		game.feed();

		expect(game.verdicts).toHaveLength(3);
		for (const verdict of game.verdicts) {
			expect(verdict.chosen).toBe(verdict.correct);
			expect(verdict.food.nameKey).toBeTruthy();
		}
	});

	it('після годування стіл завмирає', () => {
		const game = started();
		solve(game);
		game.feed();
		const frozen = { ...game.placements };

		game.pick(game.round!.foods[0]);
		game.place(BIN);
		game.takeBack(game.round!.foods[1]);
		game.feed();

		expect(game.placements).toEqual(frozen);
		expect(game.roundResults, 'повторне годування не додає результату').toHaveLength(1);
	});

	it('наступний раунд прибирає зі столу все', () => {
		const game = started();
		solve(game);
		game.feed();

		game.nextRound();

		expect(game.placements).toEqual({});
		expect(game.fed).toBe(false);
		expect(game.verdicts).toEqual([]);
		expect(game.unplaced).toHaveLength(3);
	});

	it('набори не повторюються в межах партії', () => {
		const game = started(5);
		const seen = [game.round!.id];
		for (let i = 1; i < 5; i++) {
			game.nextRound();
			seen.push(game.round!.id);
		}
		expect(new Set(seen).size, `повтор: ${seen.join(', ')}`).toBe(seen.length);
	});

	it('коли набори вичерпано, партія завершується, а не зациклюється', () => {
		const game = new FeedingGameController(feedingSets.length + 3);
		game.start();
		for (let i = 0; i < feedingSets.length + 2; i++) game.nextRound();

		expect(game.gameOver).toBe(true);
		expect(game.round).toBeNull();
	});

	it('reset() повертає партію на початок', () => {
		const game = started(2);
		solve(game);
		game.feed();
		game.nextRound();
		game.nextRound();
		expect(game.gameOver).toBe(true);

		game.reset();

		expect(game.roundNumber).toBe(1);
		expect(game.sessionScore).toBe(0);
		expect(game.gameOver).toBe(false);
		expect(game.round).not.toBeNull();
	});
});
