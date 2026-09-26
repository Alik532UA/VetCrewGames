import { describe, expect, it } from 'vitest';
import { RESUME_BONUS_MS } from '$lib/config/quizOnline';
import { QuizHold } from './quizHold';

/**
 * ОДНЕ ЧЕКАННЯ ВІКТОРИНИ — облік без мережі (аудит 2026-09-24).
 *
 * Три рішення, кожне з яких ламається одним рядком і жодного не видно на екрані
 * одразу: основа береться на ПОЧАТКУ чекання (інакше чужий запис про те саме
 * чекання рахувався б двічі), пільга — за ПРОМІЖКАМИ (інакше повернення зниклого
 * не коштувало б нічого), автор паузи платить за все чекання (інакше пауза, знята
 * ним самим, була б безплатною).
 *
 * Зворотні експерименти: брати основу з кожного виклику — червоніє перший;
 * закривати проміжки лише при відпусканні — другий; не памʼятати автора паузи —
 * третій.
 */
describe('одне чекання', () => {
	it('основа — з початку чекання: пізніший журнал до неї не додається', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 0, 0, {}, [], null);
		// Хтось уже відпустив те саме чекання й записав 7 с — у мене воно ще триває.
		hold.hold(4_000, 0, 7_000, {}, [], null);

		expect(hold.release(5_000)?.total).toBe(4_000 + RESUME_BONUS_MS);
	});

	it('кожен зниклий платить свій проміжок, а не все чекання', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 0, 0, {}, ['a'], null);
		hold.hold(3_000, 0, 0, {}, ['a', 'b'], null);
		hold.hold(5_000, 0, 0, {}, ['b'], null);

		const released = hold.release(9_000);

		expect(released?.spent).toEqual({ a: 4_000, b: 6_000 });
		expect(released?.total).toBe(8_000 + RESUME_BONUS_MS);
	});

	it('автор паузи платить за все чекання, навіть знявши її сам', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 0, 0, {}, [], 'p');
		// «Продовжити» — паузи вже немає, а чекання ще відпускається.
		hold.hold(2_000, 0, 0, {}, [], null);

		expect(hold.release(6_000)?.spent).toEqual({ p: 5_000 });
	});

	it('витрачене нарощується поверх того, що вже в журналі за цей раунд', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 0, 0, { a: 2_000 }, ['a'], null);

		expect(hold.release(5_000)?.spent).toEqual({ a: 6_000 });
	});

	it('пауза рахується поверх основи й раз на чекання', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 3, 7_000, {}, [], null);

		expect(hold.release(2_000)).toEqual({ round: 3, total: 8_000 + RESUME_BONUS_MS, spent: {} });
		expect(hold.release(3_000), 'друге відпускання того самого чекання').toBeNull();
	});

	it('поточне чекання видно лише в його раунді', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 2, 500, {}, [], null);

		expect(hold.heldNow(4_000, 2)).toBe(3_500);
		expect(hold.heldNow(4_000, 3)).toBeNull();
	});

	it('скинуте чекання забувається без запису', () => {
		const hold = new QuizHold();
		hold.hold(1_000, 0, 0, {}, ['a'], null);
		hold.reset();

		expect(hold.release(5_000)).toBeNull();
		expect(hold.heldNow(5_000, 0)).toBeNull();
	});
});

/**
 * ЧЕКАННЯ НАЛЕЖИТЬ РАУНДУ (аудит 2026-09-25): доти раунд запамʼятовувався на
 * першому такті назавжди, і наступний раунд ішов без продовження під вікном
 * «Чекаємо», а відпущене писалося в раунд, що давно скінчився.
 *
 * Зворотний експеримент: не відпускати на зміні раунду — червоніє перший.
 */
describe('чекання й зміна раунду', () => {
	const tick = (round: number, away: string[] = ['x']) => ({
		round,
		base: 0,
		spentBase: {},
		away,
		pausedBy: null
	});

	it('раунд змінився посеред чекання — старе відпущене, нове триває в новому', () => {
		const hold = new QuizHold();
		expect(hold.follow(1_000, tick(4))).toBeNull();

		const released = hold.follow(5_000, tick(5));

		expect(released?.round).toBe(4);
		expect(released?.total).toBe(4_000 + RESUME_BONUS_MS);
		expect(hold.heldNow(7_000, 5), 'новий раунд стоїть від миті зміни').toBe(2_000);
		expect(hold.heldNow(7_000, 4)).toBeNull();
	});

	it('чекання скінчилося — відпущене повертається раз', () => {
		const hold = new QuizHold();
		hold.follow(1_000, tick(0));

		expect(hold.follow(3_000, null)?.round).toBe(0);
		expect(hold.follow(4_000, null)).toBeNull();
	});
});
