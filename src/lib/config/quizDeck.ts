import { myths } from './myth-game';
import { feedingSets } from './feeding-game';
import { habitatEntries } from './habitat-game';
import { familyPuzzles } from './family-game';
import { animals } from './population-game';
import { seededRandom, shuffle } from '$lib/utils/seededRandom';

/**
 * КОЛОДА КІМНАТИ: ПИТАННЯ ВІКТОРИНИ БЕЗ ПОВТОРІВ (прохання автора 2026-09-26).
 *
 * ## Що було не так
 *
 * Кожен із дванадцяти раундів тягнув гру й питання незалежно, з поверненням, а
 * кожен раунд — окремий контролер на один раунд, тож захист від повторів, який є
 * в самих іграх, онлайн не спрацьовував ніколи. Заміряно: з усіма шістьма іграми
 * 42% партій мали точний повтор, а наступна партія повторювала щось із попередньої
 * в 68%.
 *
 * ## Що тепер (рішення автора з варіантів)
 *
 *  - у ПАРТІЇ та сама ТВАРИНА не зʼявляється двічі — навіть у різних іграх (два
 *    режими «Де живе», два міфи про одну тварину);
 *  - у КІМНАТІ питання не повторюється в наступних партіях, доки не поставлено всі
 *    питання цієї гри; тоді колода перемішується заново — нове коло;
 *  - раунди діляться між вибраними іграми ПОРІВНУ (±1), порядок випадковий.
 *
 * ## Облік кімнати — у самому зерні, без нового поля в базі
 *
 * Зерно партії — `колода + номер партії × 2³¹` (`nextGameSeed`): молодші розряди —
 * колода кімнати (перше зерно, випадкове при створенні), старші — котра це партія.
 * Реванш додає 2³¹, тож колода та сама, а номер наступний, і кожен клієнт сам
 * відтворює, які питання вже були: проганяє партії кімнати від першої. Зерно й далі
 * різне в кожної партії — разовість нагороди тримається саме на ньому. Стара
 * кімната із зерном < 2³¹ — просто партія номер нуль.
 *
 * Програма — чиста функція від (зерна, набору ігор): усі учасники отримують ті самі
 * питання, як і доти з `quizProgramme`.
 */

/** Питання однієї гри: ідентифікатор і тварини, про яких воно. */
export interface QuizItem {
	id: string;
	animals: readonly string[];
}

/** Крок програми з вибраним питанням: `pick` — ідентифікатор (у «Чисельності» — трійка). */
export interface PlannedStep {
	game: string;
	seed: number;
	pick: string;
}

/** Скільки тварин у раунді «Хто численніший?» — стільки ж, скільки карток на дошці. */
export const POPULATION_TRIO = 3;

/** Скільки зерен на кімнату: номер партії — старші розряди зерна. */
export const GAME_SPAN = 2 ** 31;

export const deckSeedOf = (seed: number): number => seed % GAME_SPAN;
export const gameIndexOf = (seed: number): number => Math.floor(seed / GAME_SPAN);
/** Зерно наступної партії в тій самій кімнаті: колода та сама, номер наступний. */
export const nextGameSeed = (seed: number): number => seed + GAME_SPAN;

/**
 * Пул кожної гри онлайн — у порядку даних; перемішує колода кімнати. «Де живе»
 * у двох режимах — два пули: тварина без списку в режимі в ньому не питається.
 */
export function poolOf(game: string): readonly QuizItem[] {
	switch (game) {
		case 'myths':
			return myths.map((myth) => ({ id: myth.id, animals: [myth.animalId] }));
		case 'feeding':
			return feedingSets.map((set) => ({ id: set.id, animals: set.animalIds }));
		case 'habitat-continents':
			return habitatEntries
				.filter((entry) => entry.continents.length > 0)
				.map((entry) => ({ id: entry.animalId, animals: [entry.animalId] }));
		case 'habitat-biomes':
			return habitatEntries
				.filter((entry) => entry.biomes.length > 0)
				.map((entry) => ({ id: entry.animalId, animals: [entry.animalId] }));
		case 'family':
			return familyPuzzles.map((puzzle) => ({
				id: puzzle.id,
				animals: [...puzzle.groupIds, puzzle.oddId]
			}));
		case 'population':
			return animals.map((animal) => ({ id: animal.id, animals: [animal.id] }));
		default:
			return [];
	}
}

/** Скільки пунктів пулу бере один раунд: у «Чисельності» — трійку тварин. */
const perRound = (game: string): number => (game === 'population' ? POPULATION_TRIO : 1);

/**
 * Зерно з кількох чисел — щоб колода кожної гри, кожне коло й кожна партія мали
 * свій потік, а не сусідні ділянки одного. Множники — непарні константи Кнута.
 */
function mix(...parts: number[]): number {
	let h = 0x811c9dc5;
	for (const part of parts) {
		h = Math.imul(h ^ (part >>> 0), 0x01000193) >>> 0;
		h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
	}
	return h >>> 0;
}

/** Число з назви гри: колода кожної гри — свій потік, незалежно від набору. */
function gameKey(game: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < game.length; i += 1) h = Math.imul(h ^ game.charCodeAt(i), 0x01000193) >>> 0;
	return h;
}

/** Колода однієї гри в кімнаті: порядок кола, що вже поставлено, котре коло. */
interface GameDeck {
	order: QuizItem[];
	used: Set<string>;
	cycle: number;
}

function deckFor(deck: number, game: string, cycle: number): QuizItem[] {
	return shuffle(poolOf(game), seededRandom(mix(deck, gameKey(game), cycle)));
}

/** Раунди між вибраними іграми порівну (±1): хто дістане зайвий — випадково. */
function balancedGames(games: readonly string[], rounds: number, random: () => number): string[] {
	const each = Math.floor(rounds / games.length);
	const lucky = new Set(shuffle(games, random).slice(0, rounds % games.length));
	const list = games.flatMap((game) => Array<string>(each + (lucky.has(game) ? 1 : 0)).fill(game));
	return shuffle(list, random);
}

/**
 * ЧЕРГА ДОБОРУ — від найтіснішої гри до найвільнішої. Порядок РАУНДІВ від цього не
 * залежить (його дає `balancedGames`), лише те, хто вибирає питання першим.
 * Заміряно: коли «Родина» (дванадцять загадок, по чотири тварини) добирала
 * останньою, усі її загадки вже мали зайняту тварину, і та сама тварина
 * траплялася двічі. «Хто численніший?» — останнім: із 85 тварин трійка без
 * повторів знайдеться майже завжди.
 */
const PICK_ORDER = ['family', 'feeding', 'habitat-biomes', 'habitat-continents', 'myths', 'population'];
const pickRank = (game: string): number => {
	const rank = PICK_ORDER.indexOf(game);
	return rank < 0 ? PICK_ORDER.length : rank;
};

/**
 * Скільки вузлів пошуку на партію. Розвʼязок без повтору тварин знаходиться за
 * десятки вузлів; межа — щоб партія, де його немає зовсім, не перебирала все.
 */
const SEARCH_BUDGET = 5000;

/** Що гра бере в цій партії: решту кола — всю, і скільки добрати з вибору. */
interface Draw {
	game: string;
	/** Решта кола, що вичерпується в цій партії, — береться ВСЯ: правило кола. */
	forced: QuizItem[];
	/** З чого добирати: ще не поставлені в колі або, коли коло скінчилося, наступні кола. */
	choices: QuizItem[];
	/** Із котрого кола кожен варіант (поточне — для невичерпаного кола). */
	origin: number[];
	take: number;
	/** Коло вичерпується в цій партії — колода переходить на наступне. */
	rolls: boolean;
}

function drawFor(state: GameDeck, deck: number, game: string, count: number): Draw {
	const unused = state.order.filter((item) => !state.used.has(item.id));
	if (unused.length > count) {
		const origin = unused.map(() => state.cycle);
		return { game, forced: [], choices: unused, origin, take: count, rolls: false };
	}
	const take = count - unused.length;
	const forced = new Set(unused.map((item) => item.id));
	const choices: QuizItem[] = [];
	const origin: number[] = [];
	/*
	 * Повтор питання В ПАРТІЇ — лише коли пул менший за раунди («Що їмо» — десять
	 * наборів на дванадцять раундів): тоді свіжі з нового кола йдуть першими, а
	 * якщо не вистачає й цілого кола — наступні кола по черзі.
	 */
	for (let cycle = state.cycle + 1; choices.length < take || cycle === state.cycle + 1; cycle += 1) {
		const next = deckFor(deck, game, cycle);
		const fresh = cycle === state.cycle + 1 ? next.filter((item) => !forced.has(item.id)) : next;
		const again = cycle === state.cycle + 1 ? next.filter((item) => forced.has(item.id)) : [];
		for (const item of [...fresh, ...again]) {
			choices.push(item);
			origin.push(cycle);
		}
	}
	return { game, forced: unused, choices, origin, take, rolls: true };
}

/**
 * ВИБІР БЕЗ ПОВТОРУ ТВАРИН — пошуком, а не жадібно. Жадібний добір брав перший
 * вільний пункт і на пізніших партіях кімнати, коли колоди вже частково вибрано,
 * лишав решті самі збіги: заміряно 12,6% партій із повтором тварини для всіх шести
 * ігор і 90% для «Що їмо» разом із «Родиною». Пошук перебирає поєднання (не
 * перестановки) у порядку колоди, тож випадковість вибору та сама. Немає
 * розвʼязку — жадібно, з найменшою кількістю збігів.
 */
function chooseItems(draws: Draw[]): Map<string, number[]> {
	const seen = new Map<string, number>();
	const add = (item: QuizItem) =>
		item.animals.forEach((animal) => seen.set(animal, (seen.get(animal) ?? 0) + 1));
	const drop = (item: QuizItem) =>
		item.animals.forEach((animal) => {
			const left = (seen.get(animal) ?? 1) - 1;
			if (left > 0) seen.set(animal, left);
			else seen.delete(animal);
		});
	const clashes = (item: QuizItem) => item.animals.filter((animal) => seen.has(animal)).length;
	draws.forEach((draw) => draw.forced.forEach(add));

	const steps = [...draws]
		.sort((a, b) => pickRank(a.game) - pickRank(b.game))
		.flatMap((draw) => Array<Draw>(draw.take).fill(draw));
	const chosen = new Map(draws.map((draw) => [draw.game, [] as number[]]));
	let budget = SEARCH_BUDGET;

	const search = (step: number): boolean => {
		if (step === steps.length) return true;
		if ((budget -= 1) < 0) return false;
		const draw = steps[step];
		const mine = chosen.get(draw.game) as number[];
		for (let at = (mine.at(-1) ?? -1) + 1; at < draw.choices.length; at += 1) {
			const item = draw.choices[at];
			if (clashes(item) > 0) continue;
			mine.push(at);
			add(item);
			if (search(step + 1)) return true;
			mine.pop();
			drop(item);
		}
		return false;
	};

	if (!search(0)) {
		for (const mine of chosen.values()) mine.length = 0;
		seen.clear();
		draws.forEach((draw) => draw.forced.forEach(add));
		for (const draw of steps) {
			const mine = chosen.get(draw.game) as number[];
			let best = -1;
			for (let at = 0; at < draw.choices.length; at += 1) {
				if (mine.includes(at)) continue;
				if (best < 0 || clashes(draw.choices[at]) < clashes(draw.choices[best])) best = at;
			}
			mine.push(best);
			add(draw.choices[best]);
		}
	}
	return chosen;
}

/** Одна партія кімнати поверх колод, що лишилися від попередніх. */
function planOne(
	deck: number,
	gameIndex: number,
	games: readonly string[],
	rounds: number,
	decks: Map<string, GameDeck>
): PlannedStep[] {
	const order = balancedGames(games, rounds, seededRandom(mix(deck, gameIndex, 0x5eed)));
	const need = new Map<string, number>();
	for (const game of order) need.set(game, (need.get(game) ?? 0) + perRound(game));

	const draws = [...need].map(([game, count]) => {
		let state = decks.get(game);
		if (!state) {
			state = { order: deckFor(deck, game, 0), used: new Set(), cycle: 0 };
			decks.set(game, state);
		}
		return drawFor(state, deck, game, count);
	});
	const picked = chooseItems(draws);

	// Колоди — на наступну партію: поставлене позначено, вичерпане коло змінено тим,
	// з якого добирали останнім.
	const queues = new Map<string, QuizItem[]>();
	for (const draw of draws) {
		const state = decks.get(draw.game) as GameDeck;
		const taken = picked.get(draw.game) ?? [];
		if (draw.rolls) {
			const last = Math.max(state.cycle + 1, ...taken.map((at) => draw.origin[at]));
			state.cycle = last;
			state.order = deckFor(deck, draw.game, last);
			state.used = new Set(
				taken.filter((at) => draw.origin[at] === last).map((at) => draw.choices[at].id)
			);
		} else taken.forEach((at) => state.used.add(draw.choices[at].id));
		queues.set(draw.game, [...draw.forced, ...taken.map((at) => draw.choices[at])]);
	}

	return order.map((game, round) => {
		const items = (queues.get(game) as QuizItem[]).splice(0, perRound(game));
		return {
			game,
			seed: mix(deck, gameIndex, round) % GAME_SPAN,
			pick: items.map((item) => item.id).join(',')
		};
	});
}

/** Остання програма: `programme` читають кілька разів на кожен такт годинника. */
let cached: { key: string; steps: PlannedStep[] } | null = null;

/**
 * Програма партії із зерна: ті самі кроки на кожному пристрої, питання — з колоди
 * кімнати, без повторів у партії й до вичерпання пулу між партіями.
 */
export function planGames(
	seed: number,
	games: readonly string[],
	rounds: number
): PlannedStep[] {
	const key = `${seed}|${games.join(',')}|${rounds}`;
	if (cached?.key === key) return cached.steps;
	const deck = deckSeedOf(seed);
	const decks = new Map<string, GameDeck>();
	let steps: PlannedStep[] = [];
	for (let index = 0; index <= gameIndexOf(seed); index += 1) {
		steps = planOne(deck, index, games, rounds, decks);
	}
	cached = { key, steps };
	return steps;
}
