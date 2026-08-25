// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rankedByPhase, scoreBefore } from './revealOrder';
import type { Member } from '$lib/net/roomTypes';

/**
 * ТАБЛО МІЖ РАУНДАМИ: спершу МИНУЛІ місця, потім нові.
 *
 * ## Що ловить цей файл
 *
 * Скарга автора: «одразу гравці на своїх нових місцях — не видно, на якому місці
 * був гравець до цього раунду і як змінилось його положення».
 *
 * Доти порядок був один і той самий від першого кадру — підсумковий. Числа при
 * цьому бігли, тобто анімація була, але відповідала лише на «скільки в мене очок»,
 * а не на «що змінилося». Причина такого вибору в коді була записана й слушна:
 * сортувати за ПОКАЗАНИМ числом означало б, що рядки їдуть безперервно протягом
 * набору. Дві фази знімають обидві проблеми: під час набору порядок не міняється
 * зовсім, а після паузи всі рядки їдуть разом.
 *
 * Сам переїзд малює `animate:flip` — його тут не перевірити, у jsdom немає ні
 * справжніх кадрів, ні розкладки. Перевіряється правило порядку, і саме в ньому
 * дефект і був.
 */

const member = (uid: string, order: number): Member =>
	({ uid, name: uid, role: 'player', order }) as Member;

/** Троє гравців: після раунду третій обганяє другого. */
const players = [member('a', 1), member('b', 2), member('c', 3)];
const scores = { a: 300, b: 150, c: 200 };
const gains = { a: 0, b: 0, c: 100 };

describe('порядок на таблі', () => {
	it('до переїзду — місця МИНУЛОГО раунду', () => {
		// Було: a 300, c 100, b 150 → a, b, c.
		expect(rankedByPhase(players, scores, gains, false).map((p) => p.uid)).toEqual(['a', 'b', 'c']);
	});

	it('після переїзду — місця за підсумком', () => {
		// Стало: a 300, c 200, b 150 → c обігнав b.
		expect(rankedByPhase(players, scores, gains, true).map((p) => p.uid)).toEqual(['a', 'c', 'b']);
	});

	/**
	 * Перевірка жива: якби дві фази давали той самий порядок, тест нічого не
	 * стверджував би. Набір даних вибраний так, щоб зміна була.
	 */
	it('фази справді різні на цих даних', () => {
		expect(rankedByPhase(players, scores, gains, false).map((p) => p.uid)).not.toEqual(
			rankedByPhase(players, scores, gains, true).map((p) => p.uid)
		);
	});

	it('рівний рахунок розводить порядок входу, а не випадок', () => {
		const tied = [member('x', 2), member('y', 1)];
		const same = { x: 100, y: 100 };
		const none = { x: 0, y: 0 };

		// `y` увійшов раніше, тож стоїть вище — і в обох фазах однаково.
		expect(rankedByPhase(tied, same, none, false).map((p) => p.uid)).toEqual(['y', 'x']);
		expect(rankedByPhase(tied, same, none, true).map((p) => p.uid)).toEqual(['y', 'x']);
	});

	it('гравець без запису в рахунку не ламає порядок', () => {
		const withNew = [...players, member('d', 4)];
		expect(rankedByPhase(withNew, scores, gains, true).map((p) => p.uid)).toEqual([
			'a',
			'c',
			'b',
			'd'
		]);
	});
});

describe('рахунок до раунду', () => {
	it('це підсумок мінус приріст', () => {
		expect(scoreBefore('c', scores, gains)).toBe(100);
	});

	it('без приросту дорівнює підсумку', () => {
		expect(scoreBefore('a', scores, gains)).toBe(300);
	});
});
