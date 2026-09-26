import { describe, expect, it } from 'vitest';
import { matchOf, seeksFromDb } from './seek';

/**
 * ЗАПИС ПОШУКУ З БАЗИ — без мережі (рішення автора 2026-09-26, «Автоматичний пошук»).
 * Поведінку гілки над справжніми правилами тримає `seek.emulator.test.ts`; тут — лише
 * розбір сирого знімка, який приходить і від старшої збірки, і від зіпсованого клієнта.
 *
 * Зворотні експерименти: не відсівати записи зі збігом — червоніє перший; не сортувати —
 * другий; пускати невідому гру — третій.
 */
describe('розбір пошуку', () => {
	it('запис зі збігом — не кандидат, а без часу чи ігор — не запис', () => {
		const seeks = seeksFromDb({
			a: { games: { pairs: 4 }, at: 10 },
			b: { games: { pairs: 4 }, at: 11, match: { code: '42', gameId: 'pairs' } },
			c: { games: { pairs: 4 } },
			d: { at: 12 },
			e: 'зламаний'
		});
		expect(seeks).toEqual([{ uid: 'a', games: { pairs: 4 }, at: 10 }]);
	});

	it('старші першими', () => {
		const seeks = seeksFromDb({
			young: { games: { quiz: 5 }, at: 30 },
			old: { games: { quiz: 5 }, at: 10 },
			middle: { games: { pairs: 4 }, at: 20 }
		});
		expect(seeks.map((seek) => seek.uid)).toEqual(['old', 'middle', 'young']);
	});

	it('лише відомі ігри з числовою версією', () => {
		const seeks = seeksFromDb({
			a: { games: { pairs: 4, chess: 1, quiz: '5' }, at: 10 },
			b: { games: { chess: 1 }, at: 11 }
		});
		expect(seeks).toEqual([{ uid: 'a', games: { pairs: 4 }, at: 10 }]);
		expect(seeksFromDb(null)).toEqual([]);
	});

	it('збіг — лише з рядковим кодом і відомою грою', () => {
		expect(matchOf({ code: '42', gameId: 'quiz' })).toEqual({ code: '42', gameId: 'quiz' });
		expect(matchOf({ code: 42, gameId: 'quiz' })).toBeNull();
		expect(matchOf({ code: '42', gameId: 'chess' })).toBeNull();
		expect(matchOf(null)).toBeNull();
	});
});
