import { seededRandom } from '$lib/utils/seededRandom';
import { REPUTATION_MAX, REPUTATION_MIN } from './constants';
import type { ReserveState } from './types';

/**
 * Дві дії, які потрібні і правилам, і добі: кидок і зміна репутації.
 *
 * Жили в `simulation.ts`, поки випадковість була потрібна лише при надходженні
 * тварини. Браконьєри кидають кістку в кінці доби — а `day.ts` не може імпортувати
 * `simulation.ts`, бо той імпортує його: вийшло б коло. Тому обидві переїхали
 * сюди, і заразом зникло дублювання — межі шкали репутації доти повторювалися в
 * `day.ts` двома окремими рядками.
 */

/**
 * Черговий кидок генератора.
 *
 * Генератор щоразу створюється наново й проганяється `rolls` разів. Дорожче за
 * збережений обʼєкт — і навмисно: стан лишається звичайними даними, які можна
 * серіалізувати, порівняти й покласти в сейв.
 *
 * Кількість кидків — частина стану. Тому будь-яка нова випадковість мусить
 * кидати кістку ЗАВЖДИ, а не лише коли результат потрібен: інакше два однакові
 * сейви розійшлися б залежно від того, чи стався кидок, якого не було видно.
 */
export function roll(state: ReserveState): number {
	const random = seededRandom(state.seed);
	for (let i = 0; i < state.rolls; i++) random();
	state.rolls += 1;
	return random();
}

/** Репутація живе в межах 0–100: поза ними вона перестала б щось означати. */
export function addReputation(state: ReserveState, delta: number): void {
	state.reputation = Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, state.reputation + delta));
}
