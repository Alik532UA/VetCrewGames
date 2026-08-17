import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { pickOne, randomFor } from '$lib/utils/seededRandom';

/*
 * Налаштування підмінені, як і в решті тестів контролерів: справжній синглтон у
 * конструкторі питає `window.matchMedia`, якого в jsdom немає. Рахунок сайту до
 * детермінізму раундів не має жодного стосунку.
 */
vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk' }
}));

const { FamilyGameController } = await import('./familyGame.svelte');
const { FeedingGameController } = await import('./feedingGame.svelte');
const { HabitatGameController } = await import('./habitatGame.svelte');
const { MythGameController } = await import('./mythGame.svelte');
const { PopulationGameController } = await import('./populationGame.svelte');

/**
 * Те саме зерно — та сама вікторина. У всіх пʼятьох іграх.
 *
 * Це передумова спільної партії, а не педантизм: раунди роздає не сервер, а
 * кожен клієнт сам із зерна. Якщо послідовність питань залежить від
 * `Math.random()`, двоє гравців у одній кімнаті побачать різні питання — і
 * помітить це гравець, а не тест.
 *
 * Перевіряється саме ПОСЛІДОВНІСТЬ, а не перший раунд. Один генератор на партію
 * дає відтворюваний хвіст; генератор на кожен раунд дав би однакове перше
 * питання й розбіжність далі — найгірший різновид розбіжності, бо схожий на
 * робочу гру.
 */

const SEED = 20260817;

/** Прогнати партію до кінця й записати, ЩО саме показали. */
const familyRun = (seed?: number) => {
	const game = new FamilyGameController(6, seed);
	game.start();
	const seen: string[] = [];
	while (!game.gameOver && game.round) {
		seen.push(game.round.id);
		game.choose(game.round.oddAnimal);
		game.nextRound();
	}
	return seen;
};

const feedingRun = (seed?: number) => {
	const game = new FeedingGameController(6, seed);
	game.start();
	const seen: string[] = [];
	while (!game.gameOver && game.round) {
		seen.push(game.round.id);
		game.nextRound();
	}
	return seen;
};

const habitatRun = (seed?: number) => {
	const game = new HabitatGameController(6, seed);
	// Ця гра починається з ВИБОРУ підрежиму, і без нього раунда немає взагалі.
	game.chooseMode('biomes');
	const seen: string[] = [];
	while (!game.gameOver && game.round) {
		seen.push(game.round.animal.id);
		game.nextRound();
	}
	return seen;
};

const mythRun = (seed?: number) => {
	const game = new MythGameController(6, seed);
	game.start();
	const seen: string[] = [];
	while (!game.gameOver && game.current) {
		seen.push(game.current.id);
		game.answer(true);
		game.nextRound();
	}
	return seen;
};

const populationRun = (seed?: number) => {
	/*
	 * Тут раунд — це САМ РОЗКЛАД карток, а не питання: гра одна на всю партію,
	 * тож порівнюються послідовні розклади. `startRound()` кличе сторінка, не
	 * конструктор.
	 */
	const game = new PopulationGameController(3, 4, seed);
	const seen: string[] = [];
	for (let round = 0; round < 4; round++) {
		game.startRound();
		seen.push(game.sourceAnimals.map((animal) => animal?.id).join('+'));
	}
	return seen;
};

const RUNS: Array<[string, (seed?: number) => string[]]> = [
	['родина', familyRun],
	['що їмо', feedingRun],
	['де живем', habitatRun],
	['міфи', mythRun],
	['кого більше', populationRun]
];

describe('те саме зерно — та сама вікторина', () => {
	it.each(RUNS)('%s: два прогони з одним зерном ідентичні', (_name, run) => {
		const first = run(SEED);
		expect(first.length, 'партія мусила показати раунди').toBeGreaterThan(1);
		expect(run(SEED)).toEqual(first);
	});

	it.each(RUNS)('%s: інше зерно дає іншу партію', (_name, run) => {
		/*
		 * Перевірка ЖИВА: без неї «детермінізм» проходив би й на функції, яка
		 * завжди віддає той самий перший набір. Зерна підібрані так, щоб відрізнялися
		 * саме послідовності, а не лише перший елемент.
		 */
		expect(run(SEED)).not.toEqual(run(SEED + 1));
	});

	it.each(RUNS)('%s: без зерна партії різні (майже завжди)', (_name, run) => {
		/*
		 * Соло має бути іншим щоразу — інакше друга спроба тієї самої вікторини
		 * нічого не навчає. Порівнюються пʼять прогонів: збіг усіх пʼятьох
		 * випадково неймовірний, а одиничний збіг двох цілком можливий.
		 */
		const runs = Array.from({ length: 5 }, () => run().join('|'));
		expect(new Set(runs).size).toBeGreaterThan(1);
	});
});

describe('джерело випадковості', () => {
	it('без зерна це саме Math.random, а не власний генератор', () => {
		// Нуль — законне зерно, і трактувати його як «зерна немає» означало б
		// мати одну партію, яка мовчки грає інакше.
		expect(randomFor()).toBe(Math.random);
		expect(randomFor(0)).not.toBe(Math.random);
	});

	it('вибір одного елемента не виходить за межі списку', () => {
		const items = ['a', 'b', 'c'];
		// Межові значення генератора: 0 і майже 1. Класична помилка на одиницю
		// дала б тут `undefined` на другому.
		expect(pickOne(items, () => 0)).toBe('a');
		expect(pickOne(items, () => 0.999999)).toBe('c');
		expect(pickOne([], Math.random)).toBeNull();
	});
});

describe('випадковість вікторин іде ЛИШЕ через зерно', () => {
	/**
	 * Структурний замок: `Math.random()` у наборах даних і контролерах вікторин
	 * заборонений.
	 *
	 * Перевірки вище доводять, що зараз усе відтворюється. Але наступна гра або
	 * наступний раунд додасться рядком `Math.random()` — і спільна партія
	 * розійдеться там, де ніхто не дивиться. Тут це видно одразу.
	 */
	const DIRS = ['src/lib/config', 'src/lib/controllers'];

	it('ні в конфігах, ні в контролерах немає Math.random()', () => {
		const guilty: string[] = [];
		for (const dir of DIRS) {
			for (const file of readdirSync(dir)) {
				if (!file.endsWith('.ts') || file.includes('.test.')) continue;
				const text = readFileSync(join(dir, file), 'utf8');
				for (const [index, line] of text.split('\n').entries()) {
					// Комментарі не рахуються: там ця назва цитується навмисно.
					const code = line.trim();
					if (code.startsWith('*') || code.startsWith('//')) continue;
					if (code.includes('Math.random')) guilty.push(`${dir}/${file}:${index + 1}`);
				}
			}
		}
		expect(guilty, `випадковість повз зерно:\n${guilty.join('\n')}`).toEqual([]);
	});
});
