import { habitatModeOf, type QuizStep } from '$lib/config/quizOnline';
import { POPULATION_TRIO } from '$lib/utils/quizDeck';
import { FamilyGameController, familySettled, type FamilyView } from './familyGame.svelte';
import {
	answerKeyOf,
	FeedingGameController,
	feedingReview,
	type FeedingView
} from './feedingGame.svelte';
import { HabitatGameController, habitatReview, type HabitatView } from './habitatGame.svelte';
import { MythGameController, type ActiveQuestion } from './mythGame.svelte';
import {
	PopulationGameController,
	populationReview,
	type PopulationView
} from './populationGame.svelte';

/**
 * ОДНЕ МІСЦЕ, ДЕ СТВОРЮЄТЬСЯ ГРА ОДНОГО РАУНДУ ВІКТОРИНИ.
 *
 * ## Чому це окремий модуль, а не рядки в дошці
 *
 * Бо саме там воно й було — і одна з п'яти ігор через це не працювала взагалі.
 * `QuizBoard` писав `new PopulationGameController(ROUNDS_PER_STEP, step.seed)`,
 * а підпис цього контролера, ЄДИНОГО з п'яти, починається не з кількості
 * раундів: `(slotCount, totalRounds, seed?)`. Тобто в кімнаті виходило
 * `slotCount = 1`, `totalRounds = зерно` (близько мільярда) і `seed = undefined`.
 *
 * На екрані це виглядало так: одна комірка «НАЙМЕНША» замість трьох, у кожного
 * гравця СВОЇ тварини (бо без зерна контролер бере `Math.random`), і раунд, який
 * неможливо ні закінчити, ні зарахувати — `gameOver` при мільярді раундів не
 * настане ніколи. Автор надіслав два знімки з різними тваринами й написав:
 * «гра поломана, різні тварини і немає трьох варіантів».
 *
 * ЧОМУ ГЕЙТ ЦЬОГО НЕ ЛОВИВ. `quizSeed.test.ts` доводить детермінізм усіх п'яти
 * ігор — і конструює їх ПРАВИЛЬНО (`new PopulationGameController(3, 4, seed)`).
 * Тобто перевірявся контролер, а не місце виклику; помилка жила рівно між ними.
 * Тепер місце виклику одне, і `quizGame.test.ts` перевіряє саме його.
 *
 * ## Чому дискримінований союз, а не спільний інтерфейс
 *
 * Дошки різні: `MythCard` приймає питання, `HabitatBoard` — контролер і
 * підрежим, `FeedingBoard` — контролер і мішені. Спільний інтерфейс тут
 * означав би зводити п'ять різних дошок до найменшого спільного, тобто
 * втратити те, чим вони відрізняються. Союз лишає компілятору роботу: додав
 * гру — і `switch` у дошці перестає бути повним.
 */

/**
 * Один крок програми — це РІВНО ОДИН раунд контролера.
 *
 * Саме це зробило раундову модель дешевою: усі контролери приймають
 * `(totalRounds, seed)`, тож «одне питання» — це партія на один раунд, а не
 * нова механіка роздачі.
 */
export const ROUNDS_PER_STEP = 1;

/**
 * Скільки карток розставляють у «Хто численніший?».
 *
 * Три — стільки ж, скільки в соло-грі, і стільки ж, скільки перевіряє
 * `quizSeed.test.ts`. Одна картка, яка стояла тут через переставлені аргументи,
 * робила гру не простішою, а безглуздою: «розташуй від найменшої до найбільшої»
 * при одній картці не має відповіді, яку можна помилити.
 */
export const POPULATION_SLOTS = POPULATION_TRIO;

export type QuizGame =
	| { kind: 'myths'; game: MythGameController }
	| { kind: 'feeding'; game: FeedingGameController }
	| { kind: 'habitat'; game: HabitatGameController; mode: 'continents' | 'biomes' }
	| { kind: 'family'; game: FamilyGameController }
	| { kind: 'population'; game: PopulationGameController };

/**
 * Гра для кроку програми. `null` — гра з НОВІШОЇ збірки, грати її нічим.
 *
 * Зерно кроку йде в контролер завжди й останнім аргументом — тобто те, чого
 * бракувало «Хто численніший?». Без нього роздача бере `Math.random`, і партія
 * перестає бути спільною, лишаючись на вигляд робочою.
 */
export function createQuizGame(step: QuizStep): QuizGame | null {
	// «Де живем?» — це дві гри набору (континенти й природні зони), тож розбір
	// ідентифікатора йде першим: обидві ведуть до того самого контролера.
	const mode = habitatModeOf(step.game);
	if (mode !== null) {
		return {
			kind: 'habitat',
			game: new HabitatGameController(ROUNDS_PER_STEP, step.seed, step.pick),
			mode
		};
	}

	switch (step.game) {
		case 'myths':
			return { kind: 'myths', game: new MythGameController(ROUNDS_PER_STEP, step.seed, step.pick) };
		case 'feeding':
			return {
				kind: 'feeding',
				game: new FeedingGameController(ROUNDS_PER_STEP, step.seed, step.pick)
			};
		case 'family':
			return {
				kind: 'family',
				game: new FamilyGameController(ROUNDS_PER_STEP, step.seed, step.pick)
			};
		case 'population':
			return {
				kind: 'population',
				game: new PopulationGameController(POPULATION_SLOTS, ROUNDS_PER_STEP, step.seed, step.pick)
			};
		default:
			return null;
	}
}

/**
 * Роздати перший раунд.
 *
 * Три гри починаються `start()`, «Де живем?» — вибором підрежиму (без нього
 * раунду немає зовсім), а «Хто численніший?» не починається тут НІКОЛИ: її
 * `ensureRound()` кличе сама дошка в `onMount`, і та сама дошка стоїть на
 * соло-сторінці. Другий виклик тут роздав би картки двічі й показав би другий
 * розклад замість першого.
 */
export function startQuizGame(created: QuizGame): void {
	if (created.kind === 'habitat') {
		created.game.chooseMode(created.mode);
		return;
	}
	if (created.kind === 'population') return;
	created.game.start();
}

/*
 * РОЗБІР РАУНДУ, ЩО ВЖЕ СКІНЧИВСЯ — для табла між раундами (прохання автора 2026-09-28:
 * «між раундами — оновлений рахунок, а нижче пояснення відповідей минулого раунду»).
 *
 * Будується з ТОГО САМОГО контролера, на якому гравець щойно грав (`QuizBoard` із
 * `settled` лишається тим самим екземпляром), тож розбір показує його власну відповідь.
 * Коли відповіді не було — час вийшов раніше, — розбір показує правильну: без оцінки в
 * «Правда чи міф?», «Хто з іншої родини?» і «Де живем?», відповіддю-ключем у «Що їмо?».
 * Дошки в цьому стані нічого не натискають: усі дії розбору — порожні.
 */

/** «Правда чи міф?»: питання «відповідане» — інакше дошка не покаже пояснення. */
export const settledQuestion = (question: ActiveQuestion): ActiveQuestion =>
	question.answered ? question : { ...question, answered: true, isCorrect: false };

export const settledHabitat = (game: HabitatGameController): HabitatView =>
	game.round ? habitatReview({ round: game.round, selected: game.selected }) : game;

export const settledFamily = (game: FamilyGameController): FamilyView =>
	game.round ? familySettled(game.round, game.chosen) : game;

/** Не нагодував нічого — відповідь-ключ, а не «усе в смітнику» (`answerKeyOf`). */
export const settledFeeding = (game: FeedingGameController): FeedingView =>
	game.round
		? feedingReview({
				round: game.round,
				placements: game.fed ? game.placements : answerKeyOf(game.round)
			})
		: game;

export const settledPopulation = (game: PopulationGameController): PopulationView =>
	populationReview({ slots: game.slots, correctOrder: game.correctOrder });
