import { ONLINE_GAMES, gamesToConfig } from '$lib/config/quizOnline';
import { roomLayoutFor, isCompactScreen } from '$lib/config/memory-game';

/**
 * НОВА КІМНАТА КОЖНОЇ ГРИ — без адаптера гри (рішення автора 2026-09-26, хаб «Грати онлайн»).
 *
 * Зерно й налаштування нової кімнати доти знали лише адаптери (`pairsGame`,
 * `QuizRoomState`), а ті тягнуть за собою матч, дошку й раунди. Хаб теж створює
 * кімнати — під «Автоматичний пошук», — і брати туди цілий адаптер заради двох полів
 * означало б везти партію на сторінку, де партії немає. Тому саме «яка вона, нова
 * кімната» живе тут, а адаптери кличуть це ж.
 */

/**
 * Двоє — це сама гра «Знайди пару», а не налаштування: дошка ділиться між двома чергами,
 * і автостарт — рівно на двох. Не з правил бази: там стеля 12 на всі ігри.
 */
export const PAIRS_PLAYERS = 2;

/** Двоє — мінімум, щоб змагатися у вікторині. Більше вона витримує без змін. */
export const QUIZ_MIN_PLAYERS = 2;

/** Зерно нової кімнати: 31 біт, як і доти в обох адаптерах. */
const seedFrom = (random: () => number): number => Math.floor(random() * 2 ** 31);

/**
 * «Знайди пару»: розкладка належить КІМНАТІ, а не екрану того, хто створив — сітка, різна
 * на двох пристроях, дала б різні дошки з того самого зерна. `layout` у тесті сталий, на
 * сторінці — від вікна того, хто створює.
 */
export function newPairsRoom(
	random: () => number,
	layout: () => { pairs: number; cols: number } = () => roomLayoutFor(isCompactScreen())
): { seed: number; config: Record<string, number> } {
	const { pairs, cols } = layout();
	return { seed: seedFrom(random), config: { pairs, cols } };
}

/**
 * Вікторина: набір ігор їде в `config`. Типово — усі шість (рішення автора 2026-09-26,
 * 5-A: набір правиться лише в лобі кімнати, фільтра на вході немає).
 */
export function newQuizRoom(
	random: () => number,
	games: readonly string[] = ONLINE_GAMES.map((game) => game.id)
): { seed: number; config: Record<string, number> } {
	return { seed: seedFrom(random), config: gamesToConfig(games) };
}
