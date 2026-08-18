import { nextMilestone } from '$lib/reserve/milestones';
import type { MetricSet } from '$lib/reserve/types';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Шість плашок шапки: що в кожній написано й чи є в неї історія.
 *
 * Виведення чисел у плашки — окрема від показу робота, і саме тому вона тут: у
 * шапці лишається розкладка й події, а сюди йде питання «які плашки бувають».
 * Разом вони перестали вміщатися в межу розміру файлу, і межа не збрехала.
 *
 * Функція чиста: локаль приходить параметром, а не читається з налаштувань.
 * Інакше модуль тягнув би за собою синглтон і перестав бути перевірним.
 */

export interface Chip {
	/** Частина `data-testid`: `reserve-<id>-value`. */
	id: string;
	/**
	 * КЛЮЧ підпису, а не готовий рядок.
	 *
	 * Так треба, бо інваріант у `src/i18n-font.test.ts` читає розмітку: підпис,
	 * зібраний через `t()` тут, проходив би крізь перевірку непоміченим — і саме
	 * так у шапці спершу й опинилася кирилична «і», яку шрифт не має чим малювати.
	 * Форматування лишається в розмітці навмисно.
	 */
	labelKey: TranslationKey;
	/** Значення форматувати не треба: це числа, а цифри в шрифті є. */
	value: string;
	/** Чи показати число кольором тривоги. */
	bad: boolean;
	/** Показник, чию історію відкриває плашка; `null` — плашка без історії. */
	metric: keyof MetricSet | null;
}

export function hudStats(
	numbers: MetricSet & { day: number; manySites: boolean },
	locale: string
): Chip[] {
	const { day, budget, feed, impact, reputation, inReserve, inWild, manySites } = numbers;
	const next = nextMilestone(impact);

	return [
		{ id: 'day', labelKey: 'reserve.day', value: String(day), bad: false, metric: null },
		{
			id: 'budget',
			labelKey: 'reserve.budget',
			value: budget.toLocaleString(locale),
			bad: budget < 0,
			metric: 'budget'
		},
		{
			id: 'feed',
			labelKey: 'reserve.feed',
			value: String(feed),
			// Нуль означає голод: одужання спиняється, стрес росте втричі швидше.
			bad: feed === 0,
			metric: 'feed'
		},
		{
			id: 'impact',
			labelKey: 'reserve.impact',
			/*
			 * Показник і НАСТУПНА ВІХА поруч: інакше «34» нічого не каже про те, чи
			 * це багато. Доти тут стояла мета 10 000 — двісті випусків, тобто
			 * величина, до якої не доходив ніхто, і шкала читалася як «0%» усю партію.
			 *
			 * Коли взято все, другої половини немає зовсім: показувати недосяжну мету
			 * тому, хто вже до неї дійшов, — це рядок, який бреше.
			 */
			value: next === null ? String(impact) : `${impact} / ${next.toLocaleString(locale)}`,
			bad: impact < 0,
			metric: 'impact'
		},
		{
			id: 'reputation',
			labelKey: 'reserve.reputation',
			value: String(reputation),
			// Мінус тут значить, що громада забирає землю, — це варто побачити кольором.
			bad: reputation < 0,
			metric: 'reputation'
		},
		{
			id: 'inreserve',
			// Множина зʼявляється тоді, коли вона ПРАВДИВА, а не тоді, коли ділянок
			// чотири: у фонду з однією заселеною землею заповідник справді один.
			labelKey: manySites ? 'reserve.inReserves' : 'reserve.inReserve',
			value: String(inReserve),
			bad: false,
			metric: 'inReserve'
		},
		{
			id: 'inwild',
			labelKey: 'reserve.inWild',
			value: String(inWild),
			bad: false,
			metric: 'inWild'
		}
	];
}
