// @vitest-environment node
// Чиста арифметика генератора — DOM їй не потрібен.
import { describe, expect, it, vi } from 'vitest';

/**
 * Лічильник побудов генератора.
 *
 * Через мок, а не через годинник: це точне число замість вимірювання з похибкою,
 * і воно не залежить від того, чим зайнята машина. Сама функція справжня — мок лише
 * рахує виклики й віддає те саме, тож послідовність чисел від нього не міняється.
 */
const probe = vi.hoisted(() => ({ constructions: 0 }));

vi.mock('$lib/utils/seededRandom', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/utils/seededRandom')>();
	return {
		...actual,
		seededRandom: (seed: number) => {
			probe.constructions += 1;
			return actual.seededRandom(seed);
		}
	};
});
import { roll } from './roll';
import { seededRandom } from '$lib/utils/seededRandom';
import type { ReserveState } from './types';

/**
 * Кидок кістки: та сама послідовність, але без квадрата.
 *
 * `roll()` тримає курсор генератора у `WeakMap` замість того, щоб щоразу
 * створювати генератор наново й перемотувати його `rolls` разів. Виграш
 * вимірюваний (O(n²) → O(n)), але він нічого не вартий, якщо послідовність
 * зсунулася хоч на один кидок: із того самого зерна виростає ВЕСЬ світ партії —
 * і в спільній грі два учасники отримали б різні світи з однакового числа.
 *
 * Тому головна перевірка тут — не швидкість, а тотожність: вихід `roll()`
 * звіряється з наївною перемоткою, тобто рівно з тим кодом, який стояв раніше.
 */

/** Те, що було в `roll()` до курсора. Еталон, з яким звіряємось. */
function rollByRewind(state: { seed: number; rolls: number }): number {
	const random = seededRandom(state.seed);
	for (let i = 0; i < state.rolls; i++) random();
	state.rolls += 1;
	return random();
}

/** Стану потрібні лише два поля — решта `ReserveState` до кидка не причетна. */
const fresh = (seed: number, rolls = 0) => ({ seed, rolls }) as unknown as ReserveState;

describe('кидок кістки', () => {
	it('перевірка жива: кидок віддає число в [0, 1)', () => {
		const value = roll(fresh(1));
		expect(value).toBeGreaterThanOrEqual(0);
		expect(value).toBeLessThan(1);
	});

	it('послідовність збігається з наївною перемоткою — кидок у кидок', () => {
		for (const seed of [0, 1, 42, 7919, 2 ** 31]) {
			const fast = fresh(seed);
			const slow = { seed, rolls: 0 };
			for (let i = 0; i < 300; i++) {
				expect(roll(fast), `зерно ${seed}, кидок ${i}`).toBe(rollByRewind(slow));
			}
			expect(fast.rolls, 'лічильник теж мусить збігтися').toBe(slow.rolls);
		}
	});

	it('стан із сейва продовжується з правильного місця', () => {
		/*
		 * Партію завантажили: `rolls` прийшов числом, генератора в памʼяті немає.
		 * Курсор мусить перемотатися — саме тут перемотка й лишилася потрібною.
		 */
		const loaded = fresh(99, 250);
		const reference = { seed: 99, rolls: 250 };
		for (let i = 0; i < 50; i++) {
			expect(roll(loaded)).toBe(rollByRewind(reference));
		}
	});

	it('перемотка `rolls` руками скидає курсор', () => {
		// Той самий обʼєкт, лічильник відкотили назад: продовжувати стару
		// послідовність тут не можна — це вже інше місце партії.
		const state = fresh(5);
		for (let i = 0; i < 20; i++) roll(state);

		state.rolls = 3;
		expect(roll(state)).toBe(rollByRewind({ seed: 5, rolls: 3 }));
	});

	it('заміна зерна при ТОМУ САМОМУ лічильнику теж скидає курсор', () => {
		/*
		 * Тут `rolls` навмисно НЕ чіпається: якби перевірка скинула ще й його, вона
		 * б перевіряла лічильник, а не зерно, — і зняття `cursor.seed !== state.seed`
		 * лишилося б непоміченим. Так і сталося з першою версією цього тесту:
		 * зворотний експеримент лишився зеленим, і це означало не «захист зайвий», а
		 * «перевірка дивиться не туди» (AI-AGENT-PITFALLS-v8 § 1.1).
		 */
		const state = fresh(11);
		for (let i = 0; i < 10; i++) roll(state);
		expect(state.rolls).toBe(10);

		state.seed = 12;
		expect(roll(state), 'інше зерно — інша партія').toBe(rollByRewind({ seed: 12, rolls: 10 }));
	});

	it('дві партії не перетікають одна в одну', () => {
		/*
		 * Курсор лежить у `WeakMap` за ключем-обʼєктом, і саме тому їх може бути
		 * скільки завгодно одночасно. Тести заповідника створюють їх сотнями.
		 */
		const a = fresh(1);
		const b = fresh(1);
		const refA = { seed: 1, rolls: 0 };
		const refB = { seed: 1, rolls: 0 };

		for (let i = 0; i < 100; i++) {
			// Навмисно впереміш: якби курсор був спільний, тут би все й розсипалося.
			expect(roll(a), `партія A, кидок ${i}`).toBe(rollByRewind(refA));
			roll(b);
			roll(b);
			expect(refB.rolls).toBeLessThan(500);
			rollByRewind(refB);
			rollByRewind(refB);
		}
		expect(a.rolls).toBe(100);
		expect(b.rolls).toBe(200);
	});

	it('генератор будується ОДИН раз на послідовність, а не на кожен кидок', () => {
		/*
		 * Це заміна вимірюванню часу, і заміна навмисна.
		 *
		 * Перша версія перевірки міряла `performance.now()` і твердила «учетверо
		 * більше кидків — менш ніж удесятеро більше часу». Її завернув інваріант
		 * `structure.test.ts`: ядро симуляції не має права залежати від годинника.
		 * Інваріант має рацію й ширше за свою букву — саме годинникова перевірка
		 * червоніє на завантаженому раннері, а цей коміт лагодить рівно такий випадок.
		 *
		 * Тут те саме твердження без годинника й без похибки: рахується, скільки
		 * разів побудовано генератор. Стара реалізація будувала його на КОЖЕН кидок
		 * (звідси O(n²)), нова — раз на послідовність. Число точне, тож перевірка
		 * не буває «майже зеленою».
		 */
		const state = fresh(77);

		probe.constructions = 0;
		for (let i = 0; i < 1000; i++) roll(state);

		expect(probe.constructions, 'тисяча кидків — одна побудова').toBe(1);
	});

	it('перемотка все ще будує генератор — і саме там вона й потрібна', () => {
		// Canary до перевірки вище: якби лічильник не рахував нічого, вона була б
		// зеленою й на зламаному коді.
		const loaded = fresh(78, 40);

		probe.constructions = 0;
		roll(loaded);

		expect(probe.constructions, 'стан із сейва мусить перемотатися').toBe(1);
	});
});
