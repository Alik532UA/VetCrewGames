// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	BINARY_POINTS,
	isSuccess,
	maxRoundPoints,
	maxSessionPoints,
	PERFECT_BONUS,
	roundPoints,
	SUCCESS_SHARE
} from './scoring';

describe('спільний рахунок вікторин', () => {
	it('перевірка жива: сталі оголошені й додатні', () => {
		expect(BINARY_POINTS).toBeGreaterThan(0);
		expect(PERFECT_BONUS).toBeGreaterThan(0);
	});

	it('бінарний раунд: правильно — три очки, ні — нуль', () => {
		expect(roundPoints(1, 1)).toBe(BINARY_POINTS);
		expect(roundPoints(0, 1)).toBe(0);
	});

	/** Приклад із технічного завдання: 0 / 1 / 2 / 4 за три страви. */
	it('складений раунд із трьох: 0, 1, 2 і 4 за бездоганний', () => {
		expect(roundPoints(0, 3)).toBe(0);
		expect(roundPoints(1, 3)).toBe(1);
		expect(roundPoints(2, 3)).toBe(2);
		expect(roundPoints(3, 3)).toBe(3 + PERFECT_BONUS);
	});

	it('бонус лише за бездоганний раунд, і лише в складеному', () => {
		// Дві частини з двох — теж бездоганно.
		expect(roundPoints(2, 2)).toBe(2 + PERFECT_BONUS);
		// А одна з двох — ні.
		expect(roundPoints(1, 2)).toBe(1);
	});

	it('зайве або відʼємне не ламає шкалу', () => {
		// Більше правильних, ніж частин, не буває — але якщо прийде, це не має
		// давати очок понад максимум.
		expect(roundPoints(9, 3)).toBe(maxRoundPoints(3));
		expect(roundPoints(-2, 3)).toBe(0);
	});

	it('максимум збігається з тим, що справді можна взяти', () => {
		expect(maxRoundPoints(1)).toBe(roundPoints(1, 1));
		expect(maxRoundPoints(3)).toBe(roundPoints(3, 3));
		expect(maxSessionPoints(3, 5)).toBe(maxRoundPoints(3) * 5);
	});

	it('поріг — СТРОГО більше за частку, а не «не менше»', () => {
		const max = 100;
		expect(isSuccess(SUCCESS_SHARE * max, max), 'рівно на межі — ще не успіх').toBe(false);
		expect(isSuccess(SUCCESS_SHARE * max + 1, max)).toBe(true);
	});

	/**
	 * Числа, які побачить гравець: п'ять раундів кожної форми.
	 *
	 * Бінарна гра має максимум 15, складена з трьох — 20. Поріг у кожної свій, і
	 * саме тому він рахується від власного максимуму, а не від спільного числа.
	 */
	it('пʼять раундів: скільки треба, щоб дія зарахувалася', () => {
		const binaryMax = maxSessionPoints(1, 5);
		expect(binaryMax).toBe(15);
		// Три з пʼяти — 9 очок, це 60%: не досить.
		expect(isSuccess(roundPoints(1, 1) * 3, binaryMax)).toBe(false);
		// Чотири з пʼяти — 12 очок, 80%: досить.
		expect(isSuccess(roundPoints(1, 1) * 4, binaryMax)).toBe(true);

		const tripleMax = maxSessionPoints(3, 5);
		expect(tripleMax).toBe(20);
		// Пʼять бездоганних раундів — 20 очок.
		expect(isSuccess(roundPoints(3, 3) * 5, tripleMax)).toBe(true);
		// Усі раунди по дві страви з трьох — 10 очок, 50%: не досить.
		expect(isSuccess(roundPoints(2, 3) * 5, tripleMax)).toBe(false);
	});

	it('порожня партія не зараховується як успіх', () => {
		expect(isSuccess(0, 0)).toBe(false);
	});
});
