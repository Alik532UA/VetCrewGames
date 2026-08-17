import type { MetricSet, ReserveState } from './types';

/**
 * Історія показників по днях: на скільки й коли змінилося кожне число.
 *
 * «Бюджет 34 200» не каже нічого про те, чи справи йдуть добре. Каже різниця:
 * −1 800 за день означає, що фонд проїдає запас, а +900 — що пожертв уже досить
 * на утримання. Саме цю різницю показує підказка над показником.
 *
 * Записується ЗАМІРОМ, а не втручанням у кожен хід.
 *
 * Гроші змінюються в десятьох місцях — будівництво, ремонт, підняття якості,
 * наймання, кампанія, щоденні витрати, пожертви, штрафи, винагороди. Дописати
 * рядок журналу в кожному означало б десять місць, де його можна забути, і
 * жодного способу дізнатися, що забули. Тому журнал бере зріз на початку доби й
 * порівнює його з кінцем: одне місце, і воно не може розійтися з правилами, бо
 * читає їхній РЕЗУЛЬТАТ.
 *
 * Ціна рішення: за що саме змінився бюджет, журнал не знає — лише на скільки.
 * Для підказки цього досить; розклад «звідки і куди» був би окремою задачею з
 * окремим форматом.
 */

/** Скільки останніх днів тримаємо. Далі історія нікому не цікава, а сейв росте. */
export const JOURNAL_DAYS = 14;

/** Зріз усіх показників, які показує шапка. */
export function metricsOf(state: ReserveState): MetricSet {
	let inReserve = 0;
	let inWild = 0;
	for (const animal of state.animals) {
		if (animal.stage === 'released') inWild++;
		else inReserve++;
	}
	return {
		budget: state.budget,
		impact: state.impact,
		reputation: state.reputation,
		inReserve,
		inWild
	};
}

/** Зріз партії, у якій ще нічого не сталося: тварин немає, числа стартові. */
export const startMetrics = (budget: number, reputation: number): MetricSet => ({
	budget,
	impact: 0,
	reputation,
	inReserve: 0,
	inWild: 0
});

/** Різниця двох зрізів. Нуль лишається нулем — підказка сама вирішить, чи показувати. */
export function deltaOf(after: MetricSet, before: MetricSet): MetricSet {
	return {
		budget: after.budget - before.budget,
		impact: after.impact - before.impact,
		reputation: round(after.reputation - before.reputation),
		inReserve: after.inReserve - before.inReserve,
		inWild: after.inWild - before.inWild
	};
}

/**
 * Репутація дробова (спад 0.5 на день), і без округлення різниця виходила б
 * «−0.5000000000000007». У підказці це читається як помилка, а не як число.
 */
const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Закрити добу: записати, на скільки все змінилося, і почати новий відлік.
 *
 * Викликається В КІНЦІ `endOfDay`, після всіх нарахувань, — інакше в журнал
 * потрапив би день без своїх же витрат.
 */
export function closeDay(state: ReserveState, day: number): void {
	const now = metricsOf(state);
	state.journal.push({ day, ...deltaOf(now, state.dayStart) });
	// Викидаємо найдавніше, а не обрізаємо з кінця: цікавий саме хвіст.
	if (state.journal.length > JOURNAL_DAYS) {
		state.journal.splice(0, state.journal.length - JOURNAL_DAYS);
	}
	state.dayStart = now;
}
