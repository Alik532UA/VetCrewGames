// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createReserve, execute, tick } from './simulation';
import {
	FEED_PER_ANIMAL,
	STRESS_BLOCKS_RELEASE,
	STRESS_PER_DAY,
	STRESS_PER_HUNGER,
	STRESS_FLOOR_PER_UNMET,
	TICKS_PER_DAY
} from './constants';
import { FEED_PRICE, feedDays, mouthsOf } from './larder';
import { equipped, modulePrice, unmetNeeds } from './modules';
import { metricsOf } from './journal';
import { speciesById } from './species';
import type { ReserveBiome, Species } from './species';
import type { ReserveCommand, ReserveState } from './types';

/**
 * Етап 13: догляд. Незакрита потреба вольєра й голод — на числах, а не на око.
 *
 * Обидва критерії тут перевіряються тим самим способом: партія проживає добу, і
 * порівнюються ДВА прогони, що відрізняються рівно однією річчю. Абсолютне
 * значення стресу нічого не доводить — воно складається з чотирьох доданків; а
 * різниця між «з укриттям» і «без укриття» доводить, що діє саме укриття.
 */

const day = (state: ReserveState, count = 1) => tick(state, TICKS_PER_DAY * count);

/** Партія, у якій за лисицею доглядають: доглядач є, корму вдосталь. */
function withFox(equip: boolean, biome: ReserveBiome = 'forest') {
	const state = createReserve(4);
	state.budget = 1_000_000;
	state.feed = 500;
	/*
	 * Репутація дає ЗЕМЛЮ: при нулі дозволена смуга — пʼять клітинок від центру, і
	 * перша версія цієї фікстури будувала за межею. Хід відмовляв, тварини не
	 * зʼявлялося, і дев'ять перевірок падали на `undefined` — тобто перевіряли не те,
	 * що збиралися.
	 */
	state.reputation = 60;
	state.dayStart = metricsOf(state);

	const move = (command: ReserveCommand) => execute(state, command, biome);
	// Клітинка подалі від центру: біля води потреба закрилася б сама, і дослід
	// перестав би бути про модуль.
	move({ type: 'build', size: 3, quality: 2, cell: { x: 20, z: 20 } });
	move({ type: 'hire', role: 'keeper' });
	move({ type: 'acquire', origin: 'rescue', speciesId: 'fox', enclosureId: 1 });
	if (equip) move({ type: 'equip', enclosureId: 1, module: 'shelter' });

	return { state, move, fox: () => state.sites[biome].animals[0] };
}

const FOX = speciesById('fox') as Species;

describe('потреби вольєра', () => {
	it('у кожного виду є потреби, і ніколи всі три', () => {
		/*
		 * Вид, якому потрібно все, зробив би покупку модулів обовʼязковою — тобто
		 * податком, а не рішенням. Саме тому список навмисно куций.
		 */
		for (const species of [FOX, speciesById('elephant') as Species]) {
			expect(species.needs.length).toBeGreaterThan(0);
			expect(species.needs.length).toBeLessThan(3);
		}
	});

	it('незакрита потреба ставить ДНО стресу, якого доглядач не пробиває', () => {
		/*
		 * Міряється саме дно, а не приріст за добу. Перша версія цієї перевірки
		 * порівнювала стрес після однієї доби й отримала нуль проти нуля: обидві
		 * тварини стояли на межі шкали, бо доглядач знімає більше, ніж додавала
		 * потреба. Тобто перевірка міряла ПІДЛОГУ, а не покарання, — і саме через це
		 * стало видно, що механіку треба міняти.
		 */
		const bare = withFox(false);
		const kept = withFox(true);
		bare.fox().stress = 0.5;
		kept.fox().stress = 0.5;
		/*
		 * Сім діб, а не двадцять: з восьмої приходять браконьєри, і перша версія цієї
		 * перевірки падала на `undefined` — лисицю просто забрали. Семи діб досить:
		 * доглядач знімає 0.12 на добу, тобто пів шкали сходить за пʼять.
		 */
		day(bare.state, 7);
		day(kept.state, 7);

		expect(bare.fox().stress, 'без нори лисиця не спускається нижче дна').toBeCloseTo(
			STRESS_FLOOR_PER_UNMET,
			5
		);
		expect(kept.fox().stress, 'з норою доглядач доводить до нуля').toBe(0);
	});

	it('без доглядача незакрита потреба доводить до заборони випуску', () => {
		// Ні людини, ні нори — стрес росте щодня й переходить межу, за якою в природу
		// тварину вже не повернути.
		const state = createReserve(4);
		state.budget = 1_000_000;
		state.reputation = 60;
		state.feed = 500;
		state.dayStart = metricsOf(state);
		const move = (command: ReserveCommand) => execute(state, command, 'forest');
		move({ type: 'build', size: 3, quality: 2, cell: { x: 20, z: 20 } });
		move({ type: 'acquire', origin: 'rescue', speciesId: 'fox', enclosureId: 1 });
		day(state, 10);

		expect(state.sites.forest.animals[0].stress).toBeGreaterThan(STRESS_BLOCKS_RELEASE);
	});

	it('природна вода закриває потребу без грошей', () => {
		// Це і робить читання карти вартим часу: місце вирішує, чи платити.
		const state = createReserve(4);
		state.budget = 1_000_000;
		const pen = { id: 1, size: 3, quality: 2 as const, durability: 1 };
		expect(equipped({ ...pen, cell: { x: 0, z: 0 }, modules: [], byWater: true }, 'water')).toBe(
			true
		);
		expect(equipped({ ...pen, cell: { x: 0, z: 0 }, modules: [], byWater: false }, 'water')).toBe(
			false
		);
		void state;
	});

	it('модуль ставиться КОМАНДОЮ і коштує за розміром', () => {
		const { state, move } = withFox(false);
		const before = state.budget;

		expect(move({ type: 'equip', enclosureId: 1, module: 'shelter' })).toEqual({ ok: true });
		expect(before - state.budget).toBe(modulePrice(3));
		expect(state.sites.forest.enclosures[0].modules).toEqual(['shelter']);
	});

	it('двічі те саме не поставити', () => {
		const { move } = withFox(true);
		expect(move({ type: 'equip', enclosureId: 1, module: 'shelter' })).toEqual({
			ok: false,
			reason: 'already-equipped'
		});
	});

	it('незакриті потреби рахуються з вольєра, а не з надії', () => {
		const { state } = withFox(false);
		const pen = state.sites.forest.enclosures[0];
		expect(unmetNeeds(FOX.needs, pen)).toEqual(['shelter']);
		pen.modules.push('shelter');
		expect(unmetNeeds(FOX.needs, pen)).toEqual([]);
	});
});

describe('корм', () => {
	it('порція за тварину на добу — і саме стільки зникає з комори', () => {
		const { state } = withFox(true);
		const before = state.feed;
		day(state);
		expect(before - state.feed).toBe(FEED_PER_ANIMAL * mouthsOf(state));
	});

	it('брак корму спиняє одужання ПОВНІСТЮ', () => {
		/*
		 * Єдина причина в грі, яка діє так: решта — множники, вони роблять довше.
		 * Тому й перевіряється рівністю нулю, а не «менше ніж».
		 */
		const fed = withFox(true);
		fed.move({ type: 'hire', role: 'vet' });
		day(fed.state);
		expect(fed.fox().recovery, 'із кормом лікування йде').toBeGreaterThan(0);

		const hungry = withFox(true);
		hungry.move({ type: 'hire', role: 'vet' });
		hungry.state.feed = 0;
		day(hungry.state);
		expect(hungry.fox().recovery).toBe(0);
	});

	it('голод дорожчий за будь-яку іншу причину стресу', () => {
		// Обидві тварини починають із середини шкали: на нулі різницю зжувала б межа.
		const fed = withFox(true);
		fed.fox().stress = 0.5;
		day(fed.state);
		const hungry = withFox(true);
		hungry.fox().stress = 0.5;
		hungry.state.feed = 0;
		day(hungry.state);

		const gap = hungry.fox().stress - fed.fox().stress;
		expect(gap).toBeCloseTo(STRESS_PER_HUNGER, 5);
		expect(STRESS_PER_HUNGER).toBeGreaterThan(STRESS_PER_DAY * 2);
	});

	it('порцій не хопило — голодує САМЕ СТІЛЬКИ, скільком не дісталося', () => {
		// Два роти, одна порція: рівно один лишається голодним.
		const state = createReserve(4);
		state.budget = 1_000_000;
		state.reputation = 60;
		state.dayStart = metricsOf(state);
		const move = (command: ReserveCommand) => execute(state, command, 'forest');
		move({ type: 'build', size: 3, quality: 2, cell: { x: 20, z: 20 } });
		move({ type: 'build', size: 3, quality: 2, cell: { x: 30, z: 30 } });
		move({ type: 'equip', enclosureId: 1, module: 'shelter' });
		move({ type: 'equip', enclosureId: 2, module: 'shelter' });
		move({ type: 'acquire', origin: 'rescue', speciesId: 'fox', enclosureId: 1 });
		move({ type: 'acquire', origin: 'rescue', speciesId: 'fox', enclosureId: 2 });
		move({ type: 'hire', role: 'keeper' });
		// З середини шкали: на нулі різницю зжувала б межа, і перевірка порівнювала б
		// підлогу з підлогою.
		for (const animal of state.sites.forest.animals) animal.stress = 0.5;
		state.feed = 1;
		day(state);

		const stress = state.sites.forest.animals.map((a) => a.stress).sort((a, b) => a - b);
		expect(stress[1] - stress[0]).toBeCloseTo(STRESS_PER_HUNGER, 5);
		expect(state.feed).toBe(0);
	});

	it('купівля йде КОМАНДОЮ, і ціна за порцію одна', () => {
		const { state, move } = withFox(true);
		const before = state.budget;
		const stock = state.feed;

		expect(move({ type: 'restock', portions: 40 })).toEqual({ ok: true });
		expect(state.feed - stock).toBe(40);
		expect(before - state.budget).toBe(40 * FEED_PRICE);
	});

	it('нуль порцій і півпорції не купуються', () => {
		const { move } = withFox(true);
		expect(move({ type: 'restock', portions: 0 })).toEqual({ ok: false, reason: 'bad-amount' });
		expect(move({ type: 'restock', portions: 2.5 })).toEqual({ ok: false, reason: 'bad-amount' });
	});

	it('запас рахується днями, а не порціями', () => {
		// Саме це число й показує панель: «на скільки вистачить» — питання гравця.
		expect(feedDays(30, 3)).toBe(10);
		expect(feedDays(2, 3)).toBe(0);
		expect(feedDays(5, 0), 'без тварин запас не витрачається').toBe(Infinity);
	});

	it('випущені більше не їдять', () => {
		const { state, fox } = withFox(true);
		// `releasable` кидається кісткою при надходженні, тож для цієї перевірки його
		// ставлять прямо: питання тут про корм, а не про те, кому пощастило.
		Object.assign(fox(), { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		expect(mouthsOf(state)).toBe(1);
		execute(state, { type: 'release', animalId: 1 }, 'forest');
		expect(mouthsOf(state)).toBe(0);
	});
});

describe('усе — через команди (інваріант етапу 10)', () => {
	it('той самий набір ходів дає той самий стан', () => {
		/*
		 * Корм і модулі не мають власної випадковості, але роздача порцій має
		 * ПОРЯДОК — і саме він міг би розійтися між двома прогонами.
		 */
		const run = () => {
			const { state } = withFox(true);
			state.feed = 3;
			day(state, 4);
			return JSON.stringify(state);
		};
		expect(run()).toBe(run());
	});
});
