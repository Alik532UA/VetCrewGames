// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import { deltaOf, JOURNAL_DAYS, metricsOf } from './journal';
import {
	CAMPAIGN_PRICE,
	CAMPAIGN_REPUTATION,
	DONATION_PER_REPUTATION,
	TICKS_PER_DAY
} from './constants';
import { enclosurePrice } from './prices';
import type { ReserveState } from './types';
import type { ReserveBiome } from './species';
import type { ReserveCommand } from './types';

/**
 * Історія показників по днях.
 *
 * Перевіряється саме те, чого не видно з коду: журнал записує РЕЗУЛЬТАТ доби, а
 * не свою здогадку про неї. Тому головна перевірка — не «поле існує», а «сума
 * записаних різниць дорівнює тому, що насправді сталося з числом».
 */

const day = (state: ReserveState, days = 1) => tick(state, TICKS_PER_DAY * days);

/**
 * Хід на ділянці. Типова земля — «savanna»: там живе більшість перевірок цього файлу.
 *
 * Де важлива інша земля, вона названа третім аргументом: перевірка «вид не з цього
 * біома» без цього не мала б сенсу.
 */
const move = (state: ReserveState, command: ReserveCommand, at: ReserveBiome = 'savanna') =>
	execute(state, command, at);

/** Земля, на якій ідуть перевірки: тварини, вольєри й штат живуть саме тут. */
const home = (state: ReserveState, at: ReserveBiome = 'savanna') => state.sites[at];

function playing() {
	const state = createReserve(1);
	state.budget = 1_000_000;
	state.reputation = 40;
	home(state).staff.vet = 1;
	/*
	 * Зріз доби доводиться освіжити, і це не обхід перевірки, а її умова.
	 *
	 * Журнал міряє різницю від початку доби — а перевірка щойно ВРУЧНУ додала
	 * фонду майже мільйон, чого в грі не робить жоден хід. Без освіження перший
	 * день містив би цей мільйон, і всі наступні числа зсунулися б на нього.
	 */
	state.dayStart = metricsOf(state);
	return state;
}

describe('журнал показників', () => {
	it('перевірка жива: доба лишає рядок з різницею', () => {
		const state = playing();
		const before = state.budget;
		day(state);

		expect(state.journal).toHaveLength(1);
		expect(state.journal[0].day).toBe(1);
		expect(state.journal[0].budget, 'записана не та різниця').toBe(state.budget - before);
	});

	it('нова партія починається з порожньої історії й зрізу сьогоднішніх чисел', () => {
		const state = createReserve(1);
		expect(state.journal).toEqual([]);
		expect(state.dayStart).toEqual(metricsOf(state));
	});

	/**
	 * Головна властивість: журнал ЗАМІРЯЄ, а не вгадує.
	 *
	 * Гроші змінюються в десятьох місцях, і жодне з них про журнал не знає. Якщо
	 * сума днів розійдеться з реальною зміною бюджету, значить якийсь хід
	 * пройшов повз замір — рівно та помилка, якої не видно на екрані.
	 */
	it('сума днів дорівнює тому, що сталося з бюджетом', () => {
		const state = playing();
		const start = metricsOf(state);

		move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		day(state, 3);
		move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
		move(state, { type: 'campaign' });
		day(state, 2);
		move(state, { type: 'hire', role: 'keeper' });
		day(state);

		const sum = state.journal.reduce((total, entry) => total + entry.budget, 0);
		// Незакрита доба в журнал ще не потрапила — тож порівнюємо із зрізом її початку.
		expect(sum).toBe(state.dayStart.budget - start.budget);
	});

	it('прийом і випуск видно в лічильниках', () => {
		const state = playing();
		move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
		day(state);

		expect(state.journal[0].inReserve, 'приїзд тварини не помічено').toBe(1);

		home(state).animals[0].stage = 'healthy';
		home(state).animals[0].releasable = true;
		home(state).animals[0].stress = 0;
		move(state, { type: 'release', animalId: 1 });
		day(state);

		const last = state.journal[1];
		expect(last.inReserve).toBe(-1);
		expect(last.inWild).toBe(1);
	});

	/** Сейв не має рости без межі: історія за третій тиждень нікому не потрібна. */
	it('журнал тримає лише останні дні', () => {
		const state = playing();
		day(state, JOURNAL_DAYS + 5);

		expect(state.journal).toHaveLength(JOURNAL_DAYS);
		// Лишається саме ХВІСТ: останній день — це останній прожитий.
		expect(state.journal.at(-1)?.day).toBe(JOURNAL_DAYS + 5);
		expect(state.journal[0].day).toBe(6);
	});

	it('кампанія видна в репутації того самого дня', () => {
		const quiet = playing();
		day(quiet);

		const state = playing();
		const before = state.reputation;
		move(state, { type: 'campaign' });
		day(state);

		// Спад репутації за добу теж у цій різниці — тому порівнюємо з фактом.
		expect(state.journal[0].reputation).toBe(round(state.reputation - before));

		/*
		 * День із кампанією дорожчий за тихий НЕ рівно на її ціну: піднята репутація
		 * того самого вечора приносить пожертви, і частину витрати кампанія повертає
		 * сама. Саме тому тут різниця двох днів, а не порівняння з ціною.
		 */
		expect(quiet.journal[0].budget - state.journal[0].budget).toBe(
			CAMPAIGN_PRICE - CAMPAIGN_REPUTATION * DONATION_PER_REPUTATION
		);
	});

	it('різниця дробової репутації не показує сміття з плаваючої коми', () => {
		const after = { budget: 0, impact: 0, reputation: 39.5, inReserve: 0, inWild: 0 };
		const before = { budget: 0, impact: 0, reputation: 40, inReserve: 0, inWild: 0 };
		expect(deltaOf(after, before).reputation).toBe(-0.5);
	});

	it('журнал не заважає детермінізму', () => {
		const one = playing();
		const two = playing();
		for (const state of [one, two]) {
			move(state, { type: 'build', size: 3, quality: 1, cell: { x: 5, z: 5 } });
			day(state, 4);
		}
		expect(JSON.stringify(one)).toBe(JSON.stringify(two));
		// Ціна вольєра тут ні до чого — але саме вона мусить стояти в журналі.
		expect(one.journal[0].budget).toBeLessThan(-enclosurePrice(3, 1) + 1);
	});
});

const round = (value: number) => Math.round(value * 100) / 100;
