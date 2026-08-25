// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import { TICKS_PER_DAY } from './constants';
import { expireRaid, maybeRaid } from './raids';
import type { ReserveEvent } from './events';
import type { ReserveCommand, ReserveState } from './types';

/**
 * ПОДІЇ ДОБИ: чи є про що сповістити й записати в журнал.
 *
 * ## Навіщо ці перевірки
 *
 * Скарга автора: «взяв тварину, а наступний день вона зникла, без сповіщення і
 * без пояснень». Причин зникнення виявилося ДВІ, і на екрані вони виглядали
 * однаково — ніяк:
 *
 *  * здоровʼя дійшло нуля (врятована приїжджає з 1–50% і без лікаря гасне);
 *  * тварину забрали браконьєри, причому НЕ обовʼязково на очах: наліт, на який
 *    не відповіли, розвʼязується сам як «ігнорувати».
 *
 * Тому найважливіше тут — не те, що подія має правильне поле, а те, що вона
 * взагалі СТАЄТЬСЯ в кожному з цих випадків. Тост і рядок журналу беруться з
 * одного потоку, тож зникла подія означає зниклу відповідь на питання «що
 * сталося».
 *
 * ## Чому тут же перевіряється й тиша
 *
 * Слухач необовʼязковий: сотні діб у решті тестів прогонюються без нього, і
 * симуляція мусить лишатися чистою. Перевірка «без слухача нічого не падає» —
 * найдешевша з можливих, а ловить вона найдорожчу помилку: `onEvent(...)`
 * замість `onEvent?.(...)` десь у глибині доби.
 */

const move = (state: ReserveState, command: ReserveCommand, at = 'savanna' as const) =>
	execute(state, command, at);

/** Прожити добу, збираючи все, про що вона оголосила. */
function liveDay(state: ReserveState, days = 1): ReserveEvent[] {
	const news: ReserveEvent[] = [];
	tick(state, TICKS_PER_DAY * days, (event) => news.push(event));
	return news;
}

/** Врятований лев у савані: приїжджає хворим і без лікаря гасне. */
function withRescuedLion(): ReserveState {
	const state = createReserve(1);
	state.budget = 1_000_000;
	move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	const enclosureId = state.sites.savanna.enclosures[0].id;
	move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId });
	return state;
}

const kinds = (news: ReserveEvent[]) => news.map((event) => event.kind);

describe('події доби', () => {
	it('перевірка жива: доба взагалі щось оголошує', () => {
		const state = withRescuedLion();

		// Корму на старті вистачає, тварина одна — але доба точно приносить хоч
		// одну подію за двадцять діб, бо без лікаря лев гасне.
		expect(liveDay(state, 20).length).toBeGreaterThan(0);
	});

	/**
	 * ГОЛОВНИЙ ВИПАДОК СКАРГИ: тварина померла — і про це сказано.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `news?.emit(...)` із гілки смерті в
	 * `siteDay` — червоніє саме цей випадок, і тварина знову зникає без слова.
	 */
	it('смерть від хвороби оголошується', () => {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		animal.health = 0.04;

		const news = liveDay(state, 1);

		expect(kinds(news)).toContain('death');
		expect(state.sites.savanna.animals, 'тварини вже немає').toHaveLength(0);
	});

	it('одужання оголошується один раз, а не щодня', () => {
		const state = withRescuedLion();
		state.sites.savanna.staff.vet = 1;
		state.sites.savanna.animals[0].health = 0.95;

		const first = liveDay(state, 1);
		const later = liveDay(state, 3);

		expect(kinds(first)).toContain('healed');
		expect(kinds(later), 'здорова тварина не одужує щодня').not.toContain('healed');
	});

	/**
	 * ДРУГА ПРИЧИНА ЗНИКНЕННЯ, і найтихіша: на наліт не відповіли, і час ухвалив
	 * рішення замість людини.
	 *
	 * Зворотний експеримент: прибрати подію з `expireRaid` — червоніє цей випадок,
	 * а тварина зникає рівно так, як описав автор.
	 */
	it('наліт, на який не відповіли, оголошується окремо від відбитого', () => {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		state.raid = { animalId: animal.id, biome: 'savanna', day: 1 };

		const news: ReserveEvent[] = [];
		expireRaid(state, 99, (event) => news.push(event));

		expect(kinds(news)).toContain('raid-expired');
		expect(state.raid, 'наліт розвʼязано').toBeNull();
	});

	it('початок нальоту оголошується', () => {
		const state = withRescuedLion();
		// Кидок нальоту залежить від зерна, тож перебираємо доби, поки не прийдуть.
		const news: ReserveEvent[] = [];
		for (let day = 5; day < 200 && !state.raid; day++) {
			maybeRaid(state, day, (event) => news.push(event));
		}

		expect(kinds(news), 'без цього вікно рішення зʼявляється без попередження').toContain('raid');
	});

	it('голод оголошується, коли корму не хапає', () => {
		const state = withRescuedLion();
		state.feed = 0;

		expect(kinds(liveDay(state, 1))).toContain('hunger');
	});

	it('пропозиція завдання від донорів оголошується', () => {
		const state = withRescuedLion();

		// Пропозиція приходить не щодня — перебираємо кілька діб.
		expect(kinds(liveDay(state, 12))).toContain('contract-offered');
	});

	/** Слухача може не бути: симуляція чиста й мусить працювати без нього. */
	it('без слухача доба проходить так само', () => {
		const withSink = withRescuedLion();
		const without = withRescuedLion();

		tick(withSink, TICKS_PER_DAY * 10, () => {});
		tick(without, TICKS_PER_DAY * 10);

		expect(JSON.stringify(without)).toBe(JSON.stringify(withSink));
	});
});
