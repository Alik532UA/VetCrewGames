import type { QuizAnswer } from './quizReplay';
import { answerPoints } from '$lib/config/quizOnline';
import type { RoundStatus } from '$lib/types/game';

/**
 * РАХУНОК СПІЛЬНОЇ ВІКТОРИНИ — чиста функція від журналу, і тут це буквально.
 *
 * ## Чому окремим модулем
 *
 * `QuizMatch` уперся в межу розміру (309 рядків коду при межі 300), а канон межу
 * піднімати забороняє. Розріз проведений там, де він і так був: контролер
 * оголошував «рахунок — чиста функція від журналу» в докблоці, але саму арифметику
 * тримав усередині класу — тобто перевіряти її можна було лише через контролер із
 * транспортом і підпискою.
 *
 * Тепер це видно з підпису: на вхід — журнал, на вихід — числа. Ні `$state`, ні
 * годинника, ні мережі.
 *
 * ## Чому межа раунду приходить функцією
 *
 * Ціна відповіді залежить від того, скільки той раунд тривав, а це знає лише
 * контролер: тривалість виводиться з ГРИ раунду, гра — з програми, програма — із
 * зерна кімнати й набору вибраних ігор. Тягнути сюди весь цей ланцюг означало б
 * тягнути й `quizProgramme`, тобто перенести межу розміру, а не прибрати причину.
 */

/** Усе про журнал, що потрібно рахунку. Нічого, крім даних. */
export interface QuizLogView {
	/** Відповіді: раунд → гравець → коли й наскільки правильно. */
	answers: Record<number, Record<string, QuizAnswer>>;
	/** Серверний час початку кожного раунду. */
	startedAt: Record<number, number>;
	/** Хто в партії. Потрібні, щоб у кожного був нуль, а не порожнеча. */
	players: string[];
	/**
	 * Скільки тривав раунд `round`, мс. Нуль або `undefined` — раунду немає в
	 * програмі, і його відповіді не рахуються зовсім.
	 */
	limitOf: (round: number) => number | undefined;
}

/** Порожній рахунок: у КОЖНОГО нуль, а не відсутнє значення. */
function zeros(players: string[]): Record<string, number> {
	const out: Record<string, number> = {};
	for (const uid of players) out[uid] = 0;
	return out;
}

/**
 * Підсумковий рахунок кожного за всю партію.
 *
 * Очки виводяться з двох СЕРВЕРНИХ позначок (початок раунду й час відповіді) та
 * оголошеної правильності, тож будь-хто може перерахувати їх сам і отримати те
 * саме число.
 */
export function totalScores(view: QuizLogView): Record<string, number> {
	const out = zeros(view.players);
	for (const [key, byPlayer] of Object.entries(view.answers)) {
		const round = Number(key);
		const start = view.startedAt[round];
		const limit = view.limitOf(round);
		if (start === undefined || limit === undefined || limit === 0) continue;

		for (const [uid, answer] of Object.entries(byPlayer)) {
			out[uid] = (out[uid] ?? 0) + answerPoints(answer.at, start, limit, answer.correct);
		}
	}
	return out;
}

/**
 * Скільки очок дав САМЕ ЦЕЙ раунд — кожному.
 *
 * Табло між раундами показує приріст, а не лише підсумок: «+90» відповідає на
 * питання «як я щойно зіграв», якого сума не бачить.
 *
 * Гравець без відповіді має нуль, а не відсутнє значення: нуль — це відповідь
 * («не встиг»), а порожнеча читалася б як «ще не порахували».
 */
export function roundGains(view: QuizLogView, round: number): Record<string, number> {
	const out = zeros(view.players);
	const start = view.startedAt[round];
	const limit = view.limitOf(round);
	if (start === undefined || limit === undefined || limit === 0) return out;

	for (const [uid, answer] of Object.entries(view.answers[round] ?? {})) {
		out[uid] = answerPoints(answer.at, start, limit, answer.correct);
	}
	return out;
}

/**
 * Результати гравця по ЗІГРАНИХ раундах — для смужок прогресу.
 *
 * Довжина — рівно число зіграних раундів (`played`). Далі масив закінчується, і
 * «поточний» та «майбутні» домальовує сам індикатор: тримати їх тут означало б
 * вирішувати за нього, який раунд поточний, — а це він знає й так.
 *
 * Раунд без відповіді — `incorrect`, а не порожнеча: «не встиг» коштує стільки ж,
 * скільки «схибив», і на смужці мусить читатися так само. Порожнеча читалася б як
 * «ще не зіграно».
 *
 * Три стани, а не два: «Де живем?» і «Хто численніший?» дають частковий успіх за
 * побудовою, і зводити його до «неправильно» означало б не відрізняти «майже
 * знав» від «не знав».
 */
export function roundOutcomes(
	answers: Record<number, Record<string, QuizAnswer>>,
	played: number,
	uid: string
): RoundStatus[] {
	const out: RoundStatus[] = [];
	for (let round = 0; round < played; round += 1) {
		const share = answers[round]?.[uid]?.correct;
		if (share === undefined || share <= 0) out.push('incorrect');
		else if (share >= 1) out.push('correct');
		else out.push('partial');
	}
	return out;
}
