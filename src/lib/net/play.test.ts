import { describe, expect, it } from 'vitest';
import { EMPTY_PLAY, mergePlay, type PlayData } from './play';

/**
 * ЗЛИТТЯ ДАНИХ ГРАВЦЯ — єдина частина `net/play.ts`, яку можна перевірити без
 * бази, і саме вона вирішує, збережеться рахунок чи ні. Решта модуля — читання,
 * запис і підписка; їх судить `npm run check:rules` над емулятором.
 *
 * Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1): замінити `Math.max` на
 * суму — червоніє «повторне злиття нічого не додає»; замінити на «беремо
 * хмарне» — червоніє «місцевий рахунок не гине».
 */

const play = (score: number, games: PlayData['games'] = {}): PlayData => ({ score, games });

describe('злиття даних гравця', () => {
	it('місцевий рахунок не гине при вході в акаунт', () => {
		// Рівно те, від чого страждав `Slovko` до злиття: анонімний доробок
		// лишався під старим uid, і вхід виглядав як покарання за те, що людина
		// спершу грала.
		expect(mergePlay(play(120), play(30)).score).toBe(120);
	});

	it('хмарний рахунок доїжджає на новий пристрій', () => {
		expect(mergePlay(play(0), play(450)).score).toBe(450);
	});

	it('повторне злиття нічого не додає — воно ідемпотентне', () => {
		const local = play(120, { population: { best: 12, plays: 3 } });
		const cloud = play(30, { population: { best: 20, plays: 1 } });

		const once = mergePlay(local, cloud);
		const twice = mergePlay(once, cloud);
		const thrice = mergePlay(twice, once);

		// Сума дала б 150 → 180 → 330: рахунок, який росте від самого факту
		// синхронізації. Саме тому тут максимум.
		expect(once).toEqual(twice);
		expect(twice).toEqual(thrice);
	});

	it('рекорд гри — найкращий із двох, а не останній', () => {
		const merged = mergePlay(
			play(10, { memory: { best: 8, plays: 4 } }),
			play(10, { memory: { best: 12, plays: 2 } })
		);
		expect(merged.games.memory).toEqual({ best: 12, plays: 4 });
	});

	it('гра, яку знає лише один бік, лишається', () => {
		const merged = mergePlay(
			play(0, { family: { best: 3, plays: 1 } }),
			play(0, { feeding: { best: 5, plays: 2 } })
		);
		expect(Object.keys(merged.games).sort()).toEqual(['family', 'feeding']);
	});

	it('порожнеча з будь-якого боку не ламає злиття', () => {
		const local = play(7, { habitat: { best: 7, plays: 1 } });
		expect(mergePlay(local, null)).toEqual(local);
		expect(mergePlay(null, local)).toEqual(local);
		expect(mergePlay(null, null)).toEqual(EMPTY_PLAY);
	});
});
