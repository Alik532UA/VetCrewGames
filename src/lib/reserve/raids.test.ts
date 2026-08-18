// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import { TICKS_PER_DAY } from './constants';
import {
	AMBUSH_INJURY,
	DRONE_PRICE,
	IGNORE_LOSS,
	raidChanceOn,
	RAID_CHANCE_MAX,
	RAID_CHANCE_START,
	RAID_FIRST_DAY,
	RAID_LOST_IMPACT,
	RAID_PATIENCE_DAYS,
	RAID_SAVED_REPUTATION,
	RANGER_PROTECTION,
	resolveRaid
} from './raids';
import type { ReserveState } from './types';
import type { ReserveBiome } from './species';
import type { ReserveCommand } from './types';

/**
 * Браконьєри: подія, ціна рішень і те, за що платять рейнджерам.
 *
 * Головна перевірка тут — статистична, і саме її вимагає план: патруль мусить
 * знижувати ймовірність нальоту на 90%. Одна партія цього не показує ніколи,
 * тому перевірка йде тисячами прогонів із РІЗНИМИ зернами: те, що для однієї
 * партії випадковість, для тисячі — закон.
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

/** Заповідник із однією твариною, у якого досить грошей на будь-яку тактику. */
function withAnimal(seed: number, rangers = 0) {
	const state = createReserve(seed);
	state.budget = 1_000_000;
	home(state).staff.vet = 1;
	home(state).staff.ranger = rangers;
	move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
	return state;
}

/**
 * Скільки з `runs` партій побачили наліт за `days` діб.
 *
 * `skip` — доби, які прожили ДО підрахунку. Він потрібен саме тому, що
 * браконьєри зʼявляються не з першого дня: без нього тридобовий замір міряв би
 * тишу пільгового періоду й показував нуль незалежно від будь-яких констант.
 */
function raidRate(runs: number, days: number, rangers: number, skip = RAID_FIRST_DAY - 1): number {
	let seen = 0;
	for (let seed = 1; seed <= runs; seed++) {
		const state = withAnimal(seed, rangers);
		if (skip > 0) day(state, skip);
		let raided = false;
		for (let i = 0; i < days; i++) {
			day(state);
			if (state.raid) {
				raided = true;
				// Вирішуємо одразу, щоб наступні доби знову могли кинути кістку.
				resolveRaid(state, 'drone');
			}
		}
		if (raided) seen++;
	}
	return seen / runs;
}

describe('браконьєри', () => {
	it('перевірка жива: наліт таки трапляється', () => {
		// Довгий обрій навмисно: перші декади коштують 1% за добу, тож на короткому
		// відрізку наліт майже не трапляється — і це саме те, чого від рампи й хотіли.
		expect(raidRate(200, 120, 0, 0)).toBeGreaterThan(0.2);
	});

	/**
	 * Критерій плану: патруль знижує ймовірність нападу на 90%.
	 *
	 * Порівнюються ЧАСТКИ партій, що побачили наліт, а не самі ймовірності: гра
	 * має справу з партіями, а не з формулами. Допуск ±3 відсоткові пункти — це
	 * шум десяти тисяч кидків, а не запас на помилку.
	 */
	it('рейнджери знижують імовірність нальоту на 90% (10 000 прогонів)', () => {
		const days = 3;
		const bare = raidRate(5_000, days, 0);
		const guarded = raidRate(5_000, days, 1);

		// Очікування рахуємо з тієї самої функції, з якої грає гра. Обрій короткий і
		// цілком усередині першої декади, тож шанс на всіх трьох добах однаковий.
		const chance = raidChanceOn(0);
		const expectBare = 1 - (1 - chance) ** days;
		const expectGuarded = 1 - (1 - chance * (1 - RANGER_PROTECTION)) ** days;

		expect(bare).toBeGreaterThan(expectBare - 0.03);
		expect(bare).toBeLessThan(expectBare + 0.03);
		expect(guarded).toBeGreaterThan(expectGuarded - 0.03);
		expect(guarded).toBeLessThan(expectGuarded + 0.03);
		// І головне: удесятеро рідше, а не «трохи рідше».
		expect(guarded).toBeLessThan(bare / 5);
	});

	/**
	 * Рампа: +1% за декаду до стелі.
	 *
	 * Перевіряється сама функція, а не частка партій: тут ідеться про форму кривої,
	 * і 10 000 кидків на кожну точку коштували б секунд заради того, що видно
	 * точно.
	 */
	it('шанс росте на відсоток за декаду й спиняється на стелі', () => {
		expect(raidChanceOn(0)).toBeCloseTo(RAID_CHANCE_START);
		expect(raidChanceOn(9)).toBeCloseTo(RAID_CHANCE_START);
		expect(raidChanceOn(10)).toBeCloseTo(0.02);
		expect(raidChanceOn(25)).toBeCloseTo(0.03);
		// Стеля не пробивається навіть через триста діб.
		expect(raidChanceOn(300)).toBe(RAID_CHANCE_MAX);
		// Крива тільки росте: жодна пізніша доба не безпечніша за ранішу.
		for (let d = 1; d < 200; d++)
			expect(raidChanceOn(d)).toBeGreaterThanOrEqual(raidChanceOn(d - 1));
	});
	it('до восьмого дня браконьєрів немає зовсім', () => {
		expect(raidRate(300, RAID_FIRST_DAY - 1, 0, 0)).toBe(0);
	});

	it('у порожньому заповіднику крати нікого', () => {
		const state = createReserve(1);
		state.budget = 1_000_000;
		day(state, RAID_FIRST_DAY + 20);
		expect(state.raid).toBeNull();
	});

	/** Дрон платить грошима — і майже завжди тварина лишається на місці. */
	it('дрон коштує грошей', () => {
		const state = raided(1);
		const before = state.budget;
		expect(move(state, { type: 'raid', tactic: 'drone' })).toEqual({ ok: true });
		expect(before - state.budget).toBe(DRONE_PRICE);
		expect(state.raid).toBeNull();
	});

	it('засідку без патруля влаштувати нікому', () => {
		const state = raided(1);
		expect(move(state, { type: 'raid', tactic: 'ambush' })).toEqual({
			ok: false,
			reason: 'no-ranger'
		});
		// Відмова не закриває подію: вибір лишається за людиною.
		expect(state.raid).not.toBeNull();
	});

	it('без нальоту вирішувати нічого', () => {
		const state = withAnimal(1);
		expect(move(state, { type: 'raid', tactic: 'ignore' })).toEqual({
			ok: false,
			reason: 'no-raid'
		});
	});

	/**
	 * Наліт НЕ додає «Користі планеті», навіть відбитий.
	 *
	 * Це не дрібниця балансу: якби відбитий наліт додавав користі, найкращою
	 * стратегією стало б чекати на браконьєрів замість випускати тварин.
	 */
	it('відбитий наліт платить репутацією, але не користю', () => {
		let saved = 0;
		for (let seed = 1; seed <= 60 && saved < 1; seed++) {
			const state = raided(seed);
			state.reputation = 40;
			const impact = state.impact;
			const reputation = state.reputation;
			move(state, { type: 'raid', tactic: 'drone' });

			if (home(state).animals.length === 1) {
				saved++;
				expect(state.impact, 'відбитий наліт додав користі').toBe(impact);
				expect(state.reputation).toBe(reputation + RAID_SAVED_REPUTATION);
			}
		}
		expect(saved, 'жоден наліт не вдалося відбити — перевірка мертва').toBe(1);
	});

	it('утрачена тварина забирає користь і репутацію', () => {
		let lost = 0;
		for (let seed = 1; seed <= 60 && lost < 1; seed++) {
			const state = raided(seed);
			state.reputation = 40;
			const impact = state.impact;
			move(state, { type: 'raid', tactic: 'ignore' });

			if (home(state).animals.length === 0) {
				lost++;
				expect(state.impact).toBe(impact + RAID_LOST_IMPACT);
				expect(state.reputation).toBeLessThan(40);
			}
		}
		expect(lost, 'жодного разу не втратили тварину — перевірка мертва').toBe(1);
	});

	/** Байдужість справді дорога: тварину забирають частіше, ніж лишають. */
	it('ігнорування коштує тварини в більшості випадків', () => {
		let lost = 0;
		const runs = 400;
		for (let seed = 1; seed <= runs; seed++) {
			const state = raided(seed);
			move(state, { type: 'raid', tactic: 'ignore' });
			if (home(state).animals.length === 0) lost++;
		}
		expect(lost / runs).toBeGreaterThan(IGNORE_LOSS - 0.06);
		expect(lost / runs).toBeLessThan(IGNORE_LOSS + 0.06);
	});

	it('засідка іноді коштує рейнджера', () => {
		let injured = 0;
		const runs = 400;
		for (let seed = 1; seed <= runs; seed++) {
			const state = raided(seed, 1);
			move(state, { type: 'raid', tactic: 'ambush' });
			if (home(state).staff.ranger === 0) injured++;
		}
		expect(injured / runs).toBeGreaterThan(AMBUSH_INJURY - 0.06);
		expect(injured / runs).toBeLessThan(AMBUSH_INJURY + 0.06);
	});

	/**
	 * Наліт, на який не відповіли, розвʼязується сам.
	 *
	 * Інакше найдешевшою тактикою було б закрити вкладку: подія висіла б вічно, а
	 * ціни не було б жодної.
	 */
	it('невирішений наліт закривається сам як «ігнорувати»', () => {
		const state = raided(1);
		day(state, RAID_PATIENCE_DAYS + 1);
		expect(state.raid).toBeNull();
	});

	it('чорний ринок розриває чинні контракти', () => {
		const state = withAnimal(1);
		state.contracts = [
			{
				id: 1,
				goal: 'release',
				titleKey: 'reserve.contract.release',
				amount: 1,
				startedAt: 0,
				dueDay: 40,
				reward: 12_000,
				penalty: 8
			}
		];
		state.offered = { ...state.contracts[0], id: 2 };

		// Ліва половина ділянки: у фонду без імені земля — десять клітинок на десять.
		move(state, { type: 'build', size: 4, quality: 2, cell: { x: -4, z: 0 } });
		move(state, {
			type: 'acquire',
			origin: 'black-market',
			speciesId: 'leopard',
			enclosureId: 2
		});

		expect(state.contracts, 'контракт лишився після чорного ринку').toEqual([]);
		expect(state.offered).toBeNull();
	});
});

/** Партія, у якій наліт САМЕ ЗАРАЗ. Шукається перебором зерен, а не підробкою. */
function raided(seed: number, rangers = 0): ReserveState {
	for (let attempt = seed; attempt < seed + 200; attempt++) {
		const state = withAnimal(attempt, rangers);
		for (let i = 0; i < 40; i++) {
			day(state);
			if (state.raid) return state;
		}
	}
	throw new Error('за 200 зерен жодного нальоту — це вже не випадковість');
}
