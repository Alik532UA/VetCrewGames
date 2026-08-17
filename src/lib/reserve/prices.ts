import { QUALITY_PRICE, type Quality } from './constants';

/**
 * Скільки коштує будівля: збудувати, відремонтувати, підняти в якості.
 *
 * Три ціни живуть разом, бо друга й третя виражені через першу: ремонт — частка
 * ціни вольєра, підняття якості — різниця між двома цінами. Розкидані по файлу
 * констант, вони читалися як три незалежні числа, хоч насправді це одна крива з
 * трьома точками. Змінити базову ціну й не зрушити решту тут неможливо.
 *
 * Чому саме тут, а не в `constants.ts`: там лежать МЕЖІ й ШКАЛИ гри — скільки
 * днів у мінусі означають крах, скільки користі дає випуск. Ціни — це функції
 * від розміру та якості, і саме тому в них є що ламати.
 */

/**
 * Ціна вольєра росте КВАДРАТИЧНО з розміром: `500 × розмір²`.
 *
 * Лінійна ціна зробила б вибір розміру фальшивим — накопичив грошей, збудував
 * десятку, і жодного рішення більше немає. Квадрат тримає великі вольєри
 * рідкісними: одиничка коштує 500, четвірка (рекомендована леву) — 8 000, а
 * десятка — 50 000, тобто цілий стартовий бюджет.
 */
export const ENCLOSURE_PRICE_FACTOR = 500;

export const enclosurePrice = (size: number, quality: Quality = 2) =>
	Math.round(ENCLOSURE_PRICE_FACTOR * size * size * QUALITY_PRICE[quality]);

/** Повний ремонт коштує чверть ціни вольєра; частковий — пропорційно зносу. */
export const REPAIR_PRICE_SHARE = 0.25;
export const repairPrice = (size: number, quality: Quality, durability: number) =>
	Math.round(enclosurePrice(size, quality) * REPAIR_PRICE_SHARE * (1 - durability));

/** Підняти якість коштує різницю в ціні плюс надбавку за перебудову. */
export const UPGRADE_SURCHARGE = 1.2;
export const upgradePrice = (size: number, from: Quality, to: Quality) =>
	Math.round((enclosurePrice(size, to) - enclosurePrice(size, from)) * UPGRADE_SURCHARGE);
