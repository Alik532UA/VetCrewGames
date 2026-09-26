// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	GAME_SPAN,
	POPULATION_TRIO,
	deckSeedOf,
	gameIndexOf,
	nextGameSeed,
	planGames,
	poolOf,
	type PlannedStep
} from './quizDeck';
import { ONLINE_GAMES, QUIZ_ROUNDS } from './quizOnline';

/**
 * КОЛОДА КІМНАТИ: БЕЗ ПОВТОРІВ У ПАРТІЇ Й МІЖ ПАРТІЯМИ (прохання автора 2026-09-26).
 *
 * Доти 42% партій із шістьма іграми мали точний повтор питання, а наступна партія
 * повторювала щось із попередньої в 68%.
 *
 * Зворотні експерименти: не позначати поставлене (`used`) — червоніють «у партії» й
 * «між партіями»; не зважати на тварин — червоніє «та сама тварина»; ділити раунди
 * без рівності — червоніє «порівну»; реванш без 2³¹ (нова колода) — червоніє «між
 * партіями».
 */

const ALL = ONLINE_GAMES.map((game) => game.id);
const SEEDS = Array.from({ length: 1000 }, (_, i) => 1 + i * 7919);

/** Тварини кроку — з пулу його гри, за вибраним `pick`. */
function animalsOf(step: PlannedStep): string[] {
	const pool = poolOf(step.game);
	return step.pick.split(',').flatMap((id) => pool.find((item) => item.id === id)?.animals ?? []);
}

/** Кімната на `games` партій: зерна від першого, як їх дає реванш. */
function roomGames(first: number, games: readonly string[], count: number): PlannedStep[][] {
	const out: PlannedStep[][] = [];
	let seed = first;
	for (let index = 0; index < count; index += 1) {
		out.push(planGames(seed, games, QUIZ_ROUNDS));
		seed = nextGameSeed(seed);
	}
	return out;
}

describe('пули ігор', () => {
	it('кожна гра онлайн має непорожній пул', () => {
		for (const game of ALL) expect(poolOf(game).length, game).toBeGreaterThan(0);
	});

	it('ідентифікатори в пулі не повторюються', () => {
		for (const game of ALL) {
			const ids = poolOf(game).map((item) => item.id);
			expect(new Set(ids).size, game).toBe(ids.length);
		}
	});
});

describe('програма партії', () => {
	it('та сама на кожному пристрої: чиста функція від зерна й набору', () => {
		expect(planGames(123, ALL, QUIZ_ROUNDS)).toEqual(planGames(123, [...ALL], QUIZ_ROUNDS));
	});

	it('раунди між вибраними іграми порівну (±1)', () => {
		for (const seed of SEEDS.slice(0, 50)) {
			const counts = new Map<string, number>();
			for (const step of planGames(seed, ALL, QUIZ_ROUNDS))
				counts.set(step.game, (counts.get(step.game) ?? 0) + 1);
			expect([...counts.keys()].sort()).toEqual([...ALL].sort());
			const values = [...counts.values()];
			expect(Math.max(...values) - Math.min(...values), `зерно ${seed}`).toBeLessThanOrEqual(1);
		}
	});

	it('у партії питання не повторюється', () => {
		for (const seed of SEEDS) {
			const keys = planGames(seed, ALL, QUIZ_ROUNDS).map((step) => `${step.game}:${step.pick}`);
			expect(new Set(keys).size, `зерно ${seed}`).toBe(keys.length);
		}
	});

	it('у партії та сама тварина не зʼявляється двічі — навіть у різних іграх', () => {
		for (const seed of SEEDS) {
			const animals = planGames(seed, ALL, QUIZ_ROUNDS).flatMap(animalsOf);
			expect(new Set(animals).size, `зерно ${seed}: ${animals.join(' ')}`).toBe(animals.length);
		}
	});

	it('«Хто численніший?» бере трійку різних тварин', () => {
		const steps = planGames(5, ['population'], QUIZ_ROUNDS);
		for (const step of steps) {
			const trio = step.pick.split(',');
			expect(trio).toHaveLength(POPULATION_TRIO);
			expect(new Set(trio).size).toBe(POPULATION_TRIO);
		}
	});
});

describe('облік кімнати між партіями', () => {
	it('реванш: колода та сама, номер партії наступний, зерно інше', () => {
		const first = 987_654;
		const next = nextGameSeed(first);
		expect(next).not.toBe(first);
		expect(deckSeedOf(next)).toBe(deckSeedOf(first));
		expect(gameIndexOf(next)).toBe(gameIndexOf(first) + 1);
	});

	it('стара кімната (зерно менше за 2³¹) — партія номер нуль', () => {
		expect(gameIndexOf(GAME_SPAN - 1)).toBe(0);
		expect(deckSeedOf(GAME_SPAN - 1)).toBe(GAME_SPAN - 1);
	});

	it('між партіями питання не повторюється, доки не поставлено всі питання гри', () => {
		const pool = poolOf('myths').length;
		const games = Math.floor(pool / QUIZ_ROUNDS);
		const asked = roomGames(42, ['myths'], games)
			.flat()
			.map((step) => step.pick);
		expect(asked).toHaveLength(games * QUIZ_ROUNDS);
		expect(new Set(asked).size, 'повтор до вичерпання пулу').toBe(asked.length);
	});

	it('пул вичерпано — нове коло, і в ньому знову все, лише в іншому порядку', () => {
		const pool = poolOf('feeding').length;
		// «Що їмо»: наборів 10, раундів 12 — друге коло починається вже в першій партії.
		const asked = roomGames(7, ['feeding'], 5)
			.flat()
			.map((step) => step.pick);
		const first = asked.slice(0, pool);
		const second = asked.slice(pool, pool * 2);
		expect(new Set(first).size, 'перше коло без повторів').toBe(pool);
		expect(new Set(second).size, 'друге коло без повторів').toBe(pool);
	});

	it('з усіма шістьма іграми наступна партія не повторює попередньої', () => {
		for (const first of SEEDS.slice(0, 50)) {
			const [one, two] = roomGames(first, ALL, 2).map((steps) =>
				steps.map((step) => `${step.game}:${step.pick}`)
			);
			const repeated = two.filter((key) => one.includes(key));
			expect(repeated, `зерно ${first}`).toEqual([]);
		}
	});
});
