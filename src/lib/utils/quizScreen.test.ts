// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isFinalTable, playedRounds } from './quizScreen';

/**
 * ФІНАЛ — ТАБЛО ОСТАННЬОГО РАУНДУ (прохання автора 2026-09-26).
 *
 * Зворотний експеримент: фінал лише при `over` — червоніє «табло останнього
 * раунду вже фінал»; смужки без щойно зіграного раунду — червоніє «на таблі».
 */

const TOTAL = 12;

describe('фінал вікторини', () => {
	it('табло останнього раунду вже фінал — ще до запису кінця партії', () => {
		expect(isFinalTable(false, 'reveal', TOTAL - 1, TOTAL)).toBe(true);
	});

	it('партію записано скінченою — фінал', () => {
		expect(isFinalTable(true, 'over', TOTAL, TOTAL)).toBe(true);
	});

	it('табло передостаннього раунду — ще ні', () => {
		expect(isFinalTable(false, 'reveal', TOTAL - 2, TOTAL)).toBe(false);
	});

	it('сам останній раунд, поки питання на екрані, — ще ні', () => {
		expect(isFinalTable(false, 'round', TOTAL - 1, TOTAL)).toBe(false);
	});

	it('програма ще не приїхала — не фінал', () => {
		expect(isFinalTable(false, 'reveal', -1, 0)).toBe(false);
	});
});

describe('зіграні раунди на смужках', () => {
	it('на таблі щойно зіграний раунд — уже зіграний', () => {
		expect(playedRounds(false, 3, TOTAL)).toBe(4);
	});

	it('у фіналі — усі', () => {
		expect(playedRounds(true, TOTAL, TOTAL)).toBe(TOTAL);
	});

	it('до першого раунду — нуль', () => {
		expect(playedRounds(false, -1, TOTAL)).toBe(0);
	});
});
