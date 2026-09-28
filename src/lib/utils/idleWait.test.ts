import { describe, expect, it } from 'vitest';
import type { Member } from '$lib/net/roomTypes';
import {
	awaitedOf,
	idlePatienceMs,
	idlePatienceOf,
	idleView,
	noWaitDecided,
	type IdleSource
} from './idleWait';

/**
 * «ГРАТИ ДАЛІ» ДЛЯ ТОГО, ХТО ДУМАЄ (рішення автора 2026-09-27, 5-B) — правила без мережі.
 *
 * Зворотні експерименти: рахувати голоси від усіх присутніх, а не від тих, хто відповів, —
 * червоніє «удвох вирішує той, хто відповів»; не перевіряти приховану межу у `idleView` —
 * червоніє «до межі вікна немає»; не прибирати з очікуваних тих, на кого вирішили не
 * чекати, — червоніє «після рішення їх не чекають».
 */

const player = (uid: string, order: number): Member => ({
	uid,
	name: uid,
	role: 'player',
	order
});
const A = player('a', 1);
const B = player('b', 2);
const C = player('c', 3);

describe('хто вирішує не чекати', () => {
	it('перевірка жива: без голосів нічого не вирішено', () => {
		expect(noWaitDecided([], [A, B], ['a'])).toBe(false);
	});

	it('удвох вирішує той, хто відповів: питання саме про другого', () => {
		expect(noWaitDecided(['a'], [A, B], ['a'])).toBe(true);
	});

	it('утрьох, коли думає один, — потрібні обидва, хто відповів (більшість від двох)', () => {
		expect(noWaitDecided(['a'], [A, B, C], ['a', 'b'])).toBe(false);
		expect(noWaitDecided(['a', 'b'], [A, B, C], ['a', 'b'])).toBe(true);
	});

	it('голос того, хто сам іще не відповів, не рахується', () => {
		expect(noWaitDecided(['b'], [A, B], ['a'])).toBe(false);
	});
});

describe('кого чекає партія', () => {
	it('присутніх, поки не вирішено інше', () => {
		expect(awaitedOf([A, B, C], ['a', 'b'], ['a'], [])).toEqual([A, B]);
	});

	it('після рішення тих, хто думає, не чекають', () => {
		expect(awaitedOf([A, B], ['a', 'b'], ['a'], ['a'])).toEqual([A]);
	});

	it('присутність ще не приїхала — чекаємо всіх, як і доти', () => {
		expect(awaitedOf([A, B], [], [], [])).toEqual([A, B]);
	});
});

describe('вікно «Ще не вибрали відповідь»', () => {
	const source = (over: Partial<IdleSource> = {}): IdleSource => ({
		round: 0,
		unlimited: true,
		patienceAt: 10_000,
		awaited: [A, B, C],
		answered: ['a'],
		noWait: [],
		...over
	});

	it('перевірка жива: після межі той, хто відповів, бачить, кого чекають', () => {
		const view = idleView(source(), 10_000, 'a');
		expect(view.show).toBe(true);
		expect(view.idle).toEqual([B, C]);
		expect(view.needed).toBe(1);
		expect(view.voted).toBe(0);
	});

	it('до межі вікна немає: чекати — і є правило режиму', () => {
		expect(idleView(source(), 9_999, 'a').show).toBe(false);
	});

	it('той, хто думає, вікна не бачить: його дошка відкрита', () => {
		expect(idleView(source(), 20_000, 'b').show).toBe(false);
	});

	it('у раунді з межею вікна немає: там раунд кінчається сам', () => {
		expect(idleView(source({ unlimited: false }), 20_000, 'a').show).toBe(false);
	});

	it('коли всі відповіли, питати нема про кого', () => {
		expect(idleView(source({ answered: ['a', 'b', 'c'] }), 20_000, 'a').show).toBe(false);
	});

	it('свій голос видно', () => {
		const view = idleView(source({ noWait: ['a'] }), 20_000, 'a');
		expect(view.iVoted).toBe(true);
		expect(view.voted).toBe(1);
	});
});

/**
 * ПОДВІЙНА МЕЖА (прохання автора 2026-09-28): бали за швидкість — від межі рахунку, а
 * питання «не чекати?» — удвічі пізніше, однаково у вікні й у перепрогоні.
 *
 * Зворотні експерименти: `IDLE_PATIENCE_FACTOR = 1` — червоніють обидві перевірки тут,
 * «між межею рахунку й подвійною межею» в `quizMatch.svelte.test.ts` і «після подвійної
 * прихованої межі» в `quizRoom.svelte.test.ts`; подвоєння лише у вікні, а не в перепрогоні,
 * — друга з них; лише в перепрогоні — третя.
 */
describe('коли питати «не чекати?»', () => {
	it('удвічі пізніше за межу рахунку', () => {
		expect(idlePatienceMs(18_000)).toBe(36_000);
	});

	it('для перепрогону — те саме з кожного раунду, а невідома межа лишається невідомою', () => {
		const patienceOf = idlePatienceOf((round) => (round === 0 ? 30_000 : undefined));
		expect(patienceOf(0)).toBe(60_000);
		expect(patienceOf(1)).toBeUndefined();
	});
});
