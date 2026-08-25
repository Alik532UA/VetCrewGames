// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import { TICKS_PER_DAY } from './constants';
import { expireRaid, maybeRaid } from './raids';
import { RECOVERY_PER_VET_DAY, STRESS_RELIEF_PER_DAY } from './constants';
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

/**
 * ВИБІР, КОЛИ ПРАЦІВНИКА НЕМА: питання, перевірка, наслідок.
 *
 * Технічне завдання автора: «Робимо для кожної дії, що немає працівника вибір:
 * 1. Найняти працівника 2. Зробити самому… І поріг це більше 70% правильних
 * відповідей, тоді зараховується успішна дія».
 *
 * Перевіряється тут те, що симуляція мусить знати САМА: коли питати й що робить
 * успіх. Саму перевірку (пʼять раундів) грає екран, і її результат приїжджає
 * готовим — інакше світ перестав би бути чистою функцією від ходів.
 */
describe('дія без працівника', () => {
	/**
	 * ПИТАЮТЬ ЛИШЕ ПРО ТИХ, ХТО САМ НЕ ВИТЯГНЕ.
	 *
	 * Вище межі самоодужання лікар лише прискорює, тобто питання там нема про що:
	 * тварина не помре. Нижче межі відсутність лікаря означає смерть — і саме тоді
	 * рішення варте того, щоб спинити час.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати умову `animal.health <=
	 * HEALTH_SELF_RECOVERY_ABOVE` — червоніє другий випадок, і гра питає про
	 * здорових.
	 */
	it('питає про хвору тварину, коли лікаря немає', () => {
		const state = withRescuedLion();
		state.sites.savanna.animals[0].health = 0.3;

		const news = liveDay(state, 1);

		expect(kinds(news)).toContain('needs-care');
	});

	it('не питає про ту, що витягне сама', () => {
		const state = withRescuedLion();
		// Вище межі самоодужання: лікар прискорює, але вже не рятує.
		state.sites.savanna.animals[0].health = 0.8;

		const news = liveDay(state, 1);

		expect(kinds(news), 'питання про здорову тварину — шум').not.toContain('needs-care');
	});

	it('не питає, коли ветеринар є', () => {
		const state = withRescuedLion();
		state.sites.savanna.animals[0].health = 0.3;
		state.sites.savanna.staff.vet = 1;

		expect(kinds(liveDay(state, 1))).not.toContain('needs-care');
	});

	/**
	 * «ЗРОБИВ САМ» дає РІВНО день роботи працівника — не більше й не менше.
	 *
	 * Більше зробило б найм податком для тих, хто не хоче грати в міні-ігри;
	 * менше — зробило б перевірку марною.
	 */
	it('успішна перевірка лікує на день ветеринара', () => {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		animal.health = 0.3;

		move(state, { type: 'self-care', role: 'vet', animalId: animal.id, ok: true });

		expect(animal.health).toBeCloseTo(0.3 + RECOVERY_PER_VET_DAY, 5);
	});

	/** Провал — законний хід: день витрачено, нічого не змінилося. */
	it('провал не міняє нічого, але лишається ходом', () => {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		animal.health = 0.3;

		const result = move(state, { type: 'self-care', role: 'vet', animalId: animal.id, ok: false });

		expect(result.ok, 'хід відбувся, просто не вийшло').toBe(true);
		expect(animal.health).toBe(0.3);
	});

	it('доглядач знімає стрес на свій день', () => {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		animal.stress = 0.5;

		move(state, { type: 'self-care', role: 'keeper', animalId: animal.id, ok: true });

		expect(animal.stress).toBeCloseTo(0.5 - STRESS_RELIEF_PER_DAY, 5);
	});

	it('тварини вже немає — хід відкидається', () => {
		const state = withRescuedLion();

		const result = move(state, { type: 'self-care', role: 'vet', animalId: 999, ok: true });

		expect(result).toEqual({ ok: false, reason: 'no-such-animal' });
	});
});

/**
 * БРАКОНЬЄРИ: «вийти самому» вирішує перевірка, а не кубик.
 *
 * Прохання автора — щоб захист від браконьєрів теж був дією з вибором. Тактика
 * `self` не має власної ймовірності: якби вона її мала, гравець грав би пʼять
 * раундів, а долю тварини однаково вирішував би кидок.
 *
 * Другий інваріант тут важливіший за перший: КИДОК УСЕ ОДНО РОБИТЬСЯ. Стан
 * генератора лежить у сейві, тож пропущений кидок зсунув би всю подальшу партію
 * в інший світ.
 */
describe('вийти на браконьєрів самому', () => {
	function withRaid() {
		const state = withRescuedLion();
		const animal = state.sites.savanna.animals[0];
		state.raid = { animalId: animal.id, biome: 'savanna', day: 1 };
		return { state, animalId: animal.id };
	}

	it('успішна перевірка лишає тварину', () => {
		const { state, animalId } = withRaid();

		move(state, { type: 'raid', tactic: 'self', ok: true });

		expect(state.sites.savanna.animals.some((a) => a.id === animalId)).toBe(true);
		expect(state.raid).toBeNull();
	});

	it('провал коштує тварини', () => {
		const { state, animalId } = withRaid();

		move(state, { type: 'raid', tactic: 'self', ok: false });

		expect(state.sites.savanna.animals.some((a) => a.id === animalId)).toBe(false);
	});

	/**
	 * Зворотний експеримент (§ 1.1): зробити кидок умовним (`if (tactic !==
	 * 'self')`) — червоніє цей випадок, бо генератор лишиться на тому самому місці.
	 */
	it('кидок робиться навіть тоді, коли його результат не потрібен', () => {
		const { state } = withRaid();
		const before = state.rolls;

		move(state, { type: 'raid', tactic: 'self', ok: true });

		expect(state.rolls, 'інакше та сама партія розгорнеться в інший світ').toBeGreaterThan(before);
	});
});
