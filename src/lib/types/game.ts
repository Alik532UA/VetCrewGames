/**
 * Спільні типи ігор.
 *
 * `RoundStatus` жив у `RoundIndicator.svelte`, і це змушувало контролери
 * імпортувати тип із КОМПОНЕНТА — тобто залежність текла в зворотний бік
 * (SVELTE-CORE-v8 § 3.5: `components → controllers → services → utils`).
 * Тут його місце: і контролер, і індикатор беруть його звідси.
 */
export type RoundStatus = 'pending' | 'correct' | 'incorrect' | 'partial';

/** Результат раунду, який гра справді може видати: «ще не зіграно» тут не буває. */
export type RoundOutcome = Exclude<RoundStatus, 'pending'>;
