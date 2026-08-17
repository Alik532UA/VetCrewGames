// @vitest-environment node
// Симуляція не знає ні про DOM, ні про Svelte — і перевірка теж не має знати.
import { describe, expect, it } from 'vitest';
import {
	createReserve,
	dayOf,
	execute,
	freeEnclosures,
	released,
	residents,
	tick,
	effectiveQuality
} from './simulation';
import type { ReserveCommand, ReserveState } from './types';
import {
	COLLAPSE_DAYS,
	NO_VET_REPUTATION,
	ORIGINS,
	RELEASE_IMPACT,
	RELEASE_REPUTATION,
	STARTING_BUDGET,
	STARTING_REPUTATION,
	TICKS_PER_DAY,
	CAMPAIGN_PRICE,
	CAMPAIGN_REPUTATION,
	ENCLOSURE_IMPACT,
	HEAL_IMPACT,
	HEAL_REPUTATION,
	IMPACT_TO_WIN,
	REPUTATION_DECAY_PER_DAY,
	RESERVE_RADIUS,
	WEAR_PER_DAY,
	type Quality
} from './constants';
import { enclosurePrice, repairPrice } from './prices';
import { comfortOf, RESERVE_BIOMES, speciesById, speciesOfBiome } from './species';
import { cellsOf, worldOf } from './grid';
import { CONTRACT_INTERVAL_DAYS, doneOf, MAX_ACTIVE_CONTRACTS, progressOf } from './contracts';

const day = (state: ReserveState, days = 1) => tick(state, TICKS_PER_DAY * days);
const snapshot = (state: ReserveState) => JSON.stringify(state);

/** Лев із технічного завдання: мінімум 3, рекомендований 4. */
const LION = speciesById('lion')!;

/**
 * Репутація фонду, у якого вже є імʼя.
 *
 * Партія починається з нуля, а шкала має підлогу на нулі: «нижче невідомого» не
 * буває. Тому будь-яке покарання на старті невидиме — і перевірка, що міряє
 * мінус від нуля, міряє підлогу, а не покарання. Звідси ця межа: спершу імʼя,
 * потім втрата.
 */
const KNOWN = 40;

/**
 * Заповідник із одним вольєром заданого розміру й однією твариною в ньому.
 * Гроші додаються, щоб перевірка розміру не впиралася в бюджет.
 */
function withLion(size: number, origin: keyof typeof ORIGINS = 'rescue') {
	// Лев живе в савані — заповідник має бути саме там, інакше його не приймуть.
	const state = createReserve(1, 'savanna');
	state.budget = 1_000_000;
	state.reputation = KNOWN;
	execute(state, { type: 'build', size, quality: 2, cell: { x: 0, z: 0 } });
	const result = execute(state, { type: 'acquire', origin, speciesId: 'lion', enclosureId: 1 });
	return { state, result };
}

/** Партія з кількох ходів — щоб детермінізм перевірявся не на порожньому стані. */
function play(seed: number, commands: ReserveCommand[], ticks: number): ReserveState {
	const state = createReserve(seed);
	for (const command of commands) execute(state, command);
	tick(state, ticks);
	return state;
}

const SCRIPT: ReserveCommand[] = [
	{ type: 'hire', role: 'vet' },
	{ type: 'hire', role: 'keeper' },
	// Патруль тут не декорація: без нього браконьєри крадуть тварину десь на
	// тридцятий день, і перевірка, яка міряє зовсім інше, ставала б лотереєю.
	{ type: 'hire', role: 'ranger' },
	// Різні клітинки: два вольєри на одному місці більше не ставляться.
	{ type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } },
	{ type: 'build', size: 2, quality: 2, cell: { x: 3, z: 0 } },
	// Обидва види лісові: партія за замовчуванням розгортається в лісі.
	{ type: 'acquire', origin: 'rescue', speciesId: 'wolf', enclosureId: 1 },
	{ type: 'acquire', origin: 'rescue', speciesId: 'fox', enclosureId: 2 }
];

describe('детермінізм', () => {
	/**
	 * Заразом ця перевірка показує, що тиск нової економіки справжній: два
	 * вольєри дають −4 до «Користі планеті», порятунок не компенсує нічого, і
	 * партія, у якій нікого не випустили, ЗАКІНЧУЄТЬСЯ на тридцятий день. Саме
	 * тому час зупиняється раніше за 10 000 тіків.
	 */
	it('перевірка жива: партія справді щось змінює', () => {
		const state = play(1, SCRIPT, 10_000);
		expect(state.animals.length).toBe(2);
		expect(state.enclosures.length).toBe(2);
		expect(state.impact, 'будівництво коштує користі').toBeLessThan(0);
		expect(state.gameOver, 'без жодного випуску заповідник не виживає').toBe(true);
		expect(state.ticks).toBe(COLLAPSE_DAYS * TICKS_PER_DAY);
	});

	/**
	 * Головна властивість усього ядра. Без неї спільна партія неможлива: два
	 * браузери з одного зерна розійшлися б у різні світи, і побачити це можна
	 * було б аж тоді, коли гравці почали б сперечатися, що в них на екрані.
	 */
	it('те саме зерно й ті самі ходи дають той самий стан після 10 000 тіків', () => {
		expect(snapshot(play(42, SCRIPT, 10_000))).toBe(snapshot(play(42, SCRIPT, 10_000)));
	});

	/**
	 * Зерно справді доходить до результату, а не лежить у стані декорацією.
	 *
	 * Перевірка йде діапазоном, а не парою зерен: єдиний кидок при надходженні
	 * дає «придатна» з імовірністю 0.9, тож навмання взята пара зерен збіглася б
	 * у чотирьох випадках із пʼяти — і тест доводив би лише вдалий вибір.
	 */
	it('зерно вирішує долю тварини', () => {
		const fates = new Set<boolean>();
		for (let seed = 1; seed <= 50; seed++) {
			const state = createReserve(seed, 'savanna');
			execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
			fates.add(state.animals[0].releasable);
		}
		expect(fates).toEqual(new Set([true, false]));
	});

	/**
	 * Нарізка тіків не має значення. Інакше гра на слабкому телефоні
	 * розвивалася б інакше, ніж на швидкому, — і це саме той різновид
	 * розбіжності, який у спільній партії не видно, доки не пізно.
	 */
	it('300 тіків одним викликом і 300 по одному дають однаковий стан', () => {
		const bulk = play(7, SCRIPT, 0);
		tick(bulk, TICKS_PER_DAY);

		const drip = play(7, SCRIPT, 0);
		for (let i = 0; i < TICKS_PER_DAY; i++) tick(drip, 1);

		expect(snapshot(drip)).toBe(snapshot(bulk));
	});

	it('пауза не змінює нічого', () => {
		const state = play(3, SCRIPT, 500);
		const before = snapshot(state);
		tick(state, 0);
		expect(snapshot(state)).toBe(before);
	});
});

describe('вольєри', () => {
	it('перевірка жива: вольєр будується й коштує грошей', () => {
		const state = createReserve(1);
		expect(execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } })).toEqual({
			ok: true
		});
		expect(state.enclosures).toEqual([
			{ id: 1, cell: { x: 0, z: 0 }, size: 4, quality: 2, durability: 1 }
		]);
		expect(state.budget).toBe(STARTING_BUDGET - enclosurePrice(4, 2));
	});

	/**
	 * Ціна росте квадратично, і саме це робить вибір розміру справжнім.
	 * Лінійна ціна перетворила б його на «накопич і побудуй десятку».
	 */
	it('удвічі більший вольєр коштує вчетверо дорожче', () => {
		expect(enclosurePrice(8)).toBe(enclosurePrice(4) * 4);
	});

	it('розміру поза шкалою не існує', () => {
		const state = createReserve(1);
		expect(execute(state, { type: 'build', size: 11, quality: 2, cell: { x: 0, z: 0 } })).toEqual({
			ok: false,
			reason: 'bad-size'
		});
		expect(execute(state, { type: 'build', size: 0, quality: 2, cell: { x: 0, z: 0 } })).toEqual({
			ok: false,
			reason: 'bad-size'
		});
		expect(state.enclosures).toEqual([]);
	});

	/**
	 * Найголовніше правило етапу: тварина НЕ створює собі вольєр.
	 *
	 * Доти заповідник будувався сам собою — гроші є, тварина зʼявилася. Тепер
	 * місце готують заздалегідь, і це те, що робить гру грою про планування, а
	 * не про натискання кнопки «купити».
	 */
	it('без вольєра тварину не прийняти', () => {
		const state = createReserve(1, 'savanna');
		expect(
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 })
		).toEqual({ ok: false, reason: 'no-such-enclosure' });
		expect(state.animals).toEqual([]);
	});

	it('у зайнятий вольєр другу тварину не поселити', () => {
		const { state } = withLion(4);
		expect(
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'leopard', enclosureId: 1 })
		).toEqual({ ok: false, reason: 'enclosure-taken' });
	});

	/**
	 * Замалий вольєр — відмова, а не штраф. Лев у їжачій клітці не «повільніше
	 * одужує»: він там не живе.
	 */
	it('у вольєр, менший за мінімум виду, тварину не прийняти взагалі', () => {
		const { result, state } = withLion(LION.minSize - 1);
		expect(result).toEqual({ ok: false, reason: 'enclosure-too-small' });
		expect(state.animals).toEqual([]);
	});

	it('рівно мінімальний вольєр уже годиться', () => {
		const { result } = withLion(LION.minSize);
		expect(result).toEqual({ ok: true });
	});

	it('невідомого виду не буває', () => {
		const state = createReserve(1, 'savanna');
		execute(state, { type: 'build', size: 10, quality: 2, cell: { x: 0, z: 0 } });
		expect(
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'дракон', enclosureId: 1 })
		).toEqual({ ok: false, reason: 'no-such-species' });
	});

	it('порожній вольєр можна знести, зайнятий — ні', () => {
		const { state } = withLion(4);
		execute(state, { type: 'build', size: 2, quality: 2, cell: { x: 4, z: 0 } });

		expect(execute(state, { type: 'demolish', enclosureId: 1 })).toEqual({
			ok: false,
			reason: 'enclosure-taken'
		});
		expect(execute(state, { type: 'demolish', enclosureId: 2 })).toEqual({ ok: true });
		expect(state.enclosures.map((e) => e.id)).toEqual([1]);
	});

	it('випуск звільняє вольєр', () => {
		const { state } = withLion(4);
		expect(freeEnclosures(state)).toEqual([]);

		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		execute(state, { type: 'release', animalId: 1 });

		expect(freeEnclosures(state).map((e) => e.id)).toEqual([1]);
	});
});

describe('простір і швидкість', () => {
	it('перевірка жива: рекомендований розмір дає базову швидкість', () => {
		expect(comfortOf(LION, LION.recSize)).toBe(1);
	});

	it('найменший придатний — уп’ятеро повільніше', () => {
		expect(comfortOf(LION, LION.minSize)).toBeCloseTo(0.2);
	});

	it('нижче мінімуму — не «повільно», а нуль', () => {
		expect(comfortOf(LION, LION.minSize - 1)).toBe(0);
	});

	/** Числа з технічного завдання, дослівно: лев із рекомендованим 4. */
	it.each([
		[5, 1.2],
		[6, 1.4],
		[7, 1.6],
		[8, 1.8],
		[9, 2],
		[10, 2.2]
	])('вольєр %i дає леву множник %f', (size, expected) => {
		expect(comfortOf(LION, size)).toBeCloseTo(expected);
	});

	/**
	 * Множник рахується ВІДНОСНО виду, а не за абсолютним числом.
	 *
	 * Вольєр на 5 — розкіш для їжака й тіснота для слона. Абсолютна шкала
	 * зробила б дрібні види безглуздими: вони отримували б бонус ні за що.
	 */
	it('той самий розмір означає різне для їжака й для слона', () => {
		const hedgehog = speciesById('hedgehog')!;
		const elephant = speciesById('elephant')!;
		// Для їжака (рекомендований 2) пʼятірка — розкіш понад норму…
		expect(comfortOf(hedgehog, 5)).toBeGreaterThan(1);
		// …а для слона (мінімум 7) те саме число означає, що він там не житиме.
		expect(comfortOf(elephant, 5)).toBe(0);
	});

	it('між мінімумом і рекомендованим — плавно, без стрибка', () => {
		const beaver = speciesById('beaver')!; // мінімум 2, рекомендований 4
		const middle = comfortOf(beaver, 3);
		expect(middle).toBeGreaterThan(comfortOf(beaver, 2));
		expect(middle).toBeLessThan(comfortOf(beaver, 4));
	});

	it('у просторішому вольєрі тварина одужує швидше', () => {
		const results = [LION.recSize, 10].map((size) => {
			const { state } = withLion(size);
			state.staff.vet = 1;
			day(state, 3);
			return state.animals[0].recovery;
		});
		expect(results[1]).toBeGreaterThan(results[0]);
	});

	it('у тісноті стрес сходить повільніше', () => {
		const results = [LION.minSize, 10].map((size) => {
			const { state } = withLion(size);
			state.staff.keeper = 1;
			state.animals[0].stress = 1;
			day(state);
			return state.animals[0].stress;
		});
		expect(results[0]).toBeGreaterThan(results[1]);
	});
});

describe('економіка надходження', () => {
	it('кожен канал бере свою ціну й свою плату «Користі планеті»', () => {
		for (const [origin, terms] of Object.entries(ORIGINS)) {
			const { state } = withLion(4, origin as keyof typeof ORIGINS);
			expect(state.budget, origin).toBe(
				1_000_000 - enclosurePrice(4) - terms.price - terms.logistics
			);
			// Вольєр теж коштує користі — його мінус входить у підсумок.
			expect(state.impact, origin).toBe(ENCLOSURE_IMPACT + terms.impact);
		}
	});

	/**
	 * Найгостріше місце всієї економіки: порятунок дає НУЛЬ до «Користі
	 * планеті» й ПЛЮС до репутації.
	 *
	 * З одного боку, у природи забрали особину — ланка випала. З іншого,
	 * зʼявився шанс урятувати. Сума чесно нульова: користь настане тоді, коли
	 * тварина повернеться, а не коли її привезли. Публіка ж бачить гуманний
	 * вчинок одразу — і саме цей розрив між «робити добро» і «виглядати добре»
	 * виправдовує дві шкали замість однієї.
	 */
	it('порятунок не додає користі, але додає репутації', () => {
		expect(ORIGINS.rescue.impact).toBe(0);
		expect(ORIGINS.rescue.reputation).toBeGreaterThan(0);
	});

	it('покупки мінусують: вони створюють попит', () => {
		expect(ORIGINS.official.impact).toBeLessThan(0);
		expect(ORIGINS['black-market'].impact).toBeLessThan(ORIGINS.official.impact);
		expect(ORIGINS['black-market'].reputation).toBeLessThan(0);
	});

	it('без грошей тварина не зʼявляється', () => {
		const state = createReserve(1, 'savanna');
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		state.budget = 100;
		expect(
			execute(state, { type: 'acquire', origin: 'official', speciesId: 'lion', enclosureId: 1 })
		).toEqual({ ok: false, reason: 'no-money' });
		expect(state.animals).toHaveLength(0);
	});
});

describe('репутація', () => {
	/**
	 * Новий фонд НІХТО не знає.
	 *
	 * Половина шкали на старті означала б двісті монет пожертв щодня ні за що — і
	 * гру, у якій перші рішення нічого не варті. Імʼя доводиться зробити: порятунок,
	 * одужання, випуск, кампанія.
	 */
	it('перевірка жива: партія починається з нуля репутації', () => {
		expect(STARTING_REPUTATION).toBe(0);
		expect(createReserve(1).reputation).toBe(STARTING_REPUTATION);
	});

	/**
	 * Гра ДОЗВОЛЯЄ взяти хвору тварину без ветеринара: забрати її з біди краще,
	 * ніж лишити там. Але це те, за що фонд критикують, — звідси мінус, а не
	 * заборона.
	 */
	it('тварина без ветеринара коштує репутації, але проходить', () => {
		const { state, result } = withLion(4);
		expect(result).toEqual({ ok: true });
		expect(state.reputation).toBe(KNOWN + ORIGINS.rescue.reputation + NO_VET_REPUTATION);
	});

	it('із ветеринаром докору немає', () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		state.reputation = KNOWN;
		execute(state, { type: 'hire', role: 'vet' });
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
		expect(state.reputation).toBe(KNOWN + ORIGINS.rescue.reputation);
	});

	it('чорний ринок бʼє і по репутації, і по «Користі планеті»', () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		// Без імені мінус двадцять пʼять просто вперся б у нуль, і перевірка міряла б
		// підлогу шкали замість ціни чорного ринку.
		state.reputation = KNOWN;
		execute(state, { type: 'hire', role: 'vet' });
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'black-market', speciesId: 'lion', enclosureId: 1 });

		expect(state.reputation).toBe(KNOWN + ORIGINS['black-market'].reputation);
		expect(state.impact).toBe(ENCLOSURE_IMPACT + ORIGINS['black-market'].impact);
	});

	/**
	 * Найбільша нагорода гри піднімає ОБИДВІ шкали.
	 *
	 * Інакше випуск був би суто оборонним: плюс до показника, який лише
	 * боронить від програшу, і жодної копійки, бо гроші йдуть від репутації.
	 */
	it('випуск підіймає обидві шкали', () => {
		const { state } = withLion(4);
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		const before = { impact: state.impact, reputation: state.reputation };

		execute(state, { type: 'release', animalId: 1 });

		expect(state.impact - before.impact).toBe(RELEASE_IMPACT);
		expect(state.reputation - before.reputation).toBe(RELEASE_REPUTATION);
	});

	it('репутація не виходить за 0 і 100', () => {
		const state = createReserve(1, 'savanna');
		state.budget = 10_000_000;
		state.reputation = 2;
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'black-market', speciesId: 'lion', enclosureId: 1 });
		expect(state.reputation).toBe(0);

		state.reputation = 98;
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		execute(state, { type: 'release', animalId: 1 });
		expect(state.reputation).toBe(100);
	});

	it('пожертви йдуть за репутацією, а не за «Користю планеті»', () => {
		const state = createReserve(1);
		state.impact = 500; // великий підсумок, але про фонд ніхто не знає
		state.reputation = 0;
		const before = state.budget;
		day(state);
		expect(state.budget, 'нульова репутація дала гроші').toBeLessThanOrEqual(before);
	});
});

describe('випуск у дику природу', () => {
	const readyToRelease = (releasable: boolean) => {
		const { state } = withLion(4);
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable });
		return state;
	};

	it('дає найбільшу нагороду в грі й записує день', () => {
		const state = readyToRelease(true);
		day(state, 7);

		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({ ok: true });
		expect(state.animals[0].stage).toBe('released');
		// Сім діб прожито — випуск стався на восьмий день, і саме він записаний.
		expect(state.animals[0].releasedOnDay, 'день випуску не записано').toBe(8);
	});

	it('хвору не випустити', () => {
		const state = readyToRelease(true);
		state.animals[0].stage = 'recovering';
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'not-healthy'
		});
	});

	it('народжену в неволі не випустити, хоч би якою здоровою вона була', () => {
		const state = readyToRelease(false);
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'not-releasable'
		});
	});

	it('заляканої не випустити: у природі вона не виживе', () => {
		const state = readyToRelease(true);
		state.animals[0].stress = 1;
		expect(execute(state, { type: 'release', animalId: 1 })).toEqual({
			ok: false,
			reason: 'too-stressed'
		});
	});
});

describe('два списки замість одного', () => {
	/**
	 * «Мешканці» — це ті, хто В заповіднику. Випущені живуть у природі, і
	 * тримати їх у тому самому списку означало б показувати заповідник
	 * більшим, ніж він є, — а заразом ховати головне досягнення гри в кінці
	 * переліку.
	 */
	it('випущений залишає список мешканців і потрапляє в окремий', () => {
		const { state } = withLion(4);
		execute(state, { type: 'build', size: 5, quality: 2, cell: { x: 4, z: 0 } });
		execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'leopard', enclosureId: 2 });

		expect(residents(state)).toHaveLength(2);
		expect(released(state)).toEqual([]);

		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		execute(state, { type: 'release', animalId: 1 });

		expect(residents(state).map((a) => a.id)).toEqual([2]);
		expect(released(state).map((a) => a.id)).toEqual([1]);
	});

	it('випущені не їдять і не займають місця', () => {
		const { state } = withLion(4);
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		execute(state, { type: 'release', animalId: 1 });

		// Репутація знімається ДО доби: наприкінці кожної вона спадає на 0.5, а
		// пожертви рахуються з неї — інакше два заповідники порівнювалися б із
		// різними репутаціями й розійшлися б рівно на 2 монети.
		const reputation = state.reputation;
		const before = state.budget;
		day(state);
		const withReleased = before - state.budget;

		const empty = createReserve(1, 'savanna');
		empty.budget = 1_000_000;
		empty.reputation = reputation;
		execute(empty, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		const emptyBefore = empty.budget;
		day(empty);

		expect(emptyBefore - empty.budget, 'випущена тварина все ще щось коштує').toBe(withReleased);
	});
});

describe('банкрутство', () => {
	/**
	 * Мінус має бути глибший за денні пожертви.
	 *
	 * Раніше вистачало −1, бо пожертви йшли від «Користі планеті», а вона на
	 * старті нульова. Тепер гроші дає репутація, і 47 пунктів приносять 188 за
	 * день — заповідник вибирався б із мінуса сам, ще до того, як субсидія
	 * встигла б увімкнутися.
	 */
	const broke = () => {
		const { state } = withLion(4);
		state.budget = -1000;
		day(state);
		return state;
	};

	it('мінус у бюджеті вмикає субсидію, а не кінець гри', () => {
		const state = broke();
		expect(state.subsidy).toBe(true);
		expect(state.gameOver, 'бідність — не провал').toBe(false);
	});

	it('субсидія глушить розширення, зокрема будівництво', () => {
		const state = broke();
		for (const command of [
			{ type: 'acquire', origin: 'rescue', speciesId: 'leopard', enclosureId: 1 },
			{ type: 'hire', role: 'vet' },
			{ type: 'build', size: 1, quality: 2, cell: { x: 0, z: 0 } }
		] as ReserveCommand[]) {
			expect(execute(state, command), command.type).toEqual({ ok: false, reason: 'subsidy-mode' });
		}
	});

	it('але не глушить виживання: час іде, тварини лікуються', () => {
		const state = broke();
		state.staff.vet = 1;
		const before = state.animals[0].recovery;
		day(state);
		expect(state.animals[0].recovery).toBeGreaterThan(before);
	});

	it('вихід у плюс знімає режим', () => {
		const state = broke();
		state.budget = 10_000;
		day(state);
		expect(state.subsidy).toBe(false);
	});
});

describe('умова програшу', () => {
	const inTheRed = (days: number) => {
		const state = createReserve(1);
		state.impact = -1;
		day(state, days);
		return state;
	};

	it(`${COLLAPSE_DAYS} днів поспіль у мінусі — кінець гри`, () => {
		expect(inTheRed(COLLAPSE_DAYS).gameOver).toBe(true);
	});

	it(`${COLLAPSE_DAYS - 1} днів поспіль — ще ні`, () => {
		const state = inTheRed(COLLAPSE_DAYS - 1);
		expect(state.gameOver).toBe(false);
		expect(state.collapseDays).toBe(COLLAPSE_DAYS - 1);
	});

	/**
	 * Саме через це лічильник і скидається: гра карає за постійну шкоду, а не
	 * за тридцять поганих днів, розкиданих по партії.
	 */
	it(`${COLLAPSE_DAYS} днів із перервою — не кінець гри`, () => {
		const state = createReserve(1);
		state.impact = -1;
		day(state, COLLAPSE_DAYS - 1);

		state.impact = 1;
		day(state);
		expect(state.collapseDays, 'вихід у плюс обнуляє лічильник').toBe(0);

		state.impact = -1;
		day(state, COLLAPSE_DAYS - 1);
		expect(state.gameOver).toBe(false);
	});

	it('після кінця гри ходи не приймаються й час стоїть', () => {
		const state = inTheRed(COLLAPSE_DAYS);
		const before = snapshot(state);

		expect(execute(state, { type: 'build', size: 1, quality: 2, cell: { x: 0, z: 0 } })).toEqual({
			ok: false,
			reason: 'game-over'
		});
		tick(state, 1000);
		expect(snapshot(state)).toBe(before);
	});
});

describe('час', () => {
	/** Перший день — ПЕРШИЙ: партія починається в дні 1, а не в дні 0. */
	it('день настає рівно на межі тіків', () => {
		const state = createReserve(1);
		expect(dayOf(state), 'партія починається з першого дня').toBe(1);
		tick(state, TICKS_PER_DAY - 1);
		expect(dayOf(state)).toBe(1);
		tick(state, 1);
		expect(dayOf(state)).toBe(2);
	});
});

describe('біом вирішує, кого сюди привозять', () => {
	it('перевірка жива: у кожного біома є кого приймати', () => {
		for (const biome of RESERVE_BIOMES) {
			expect(speciesOfBiome(biome).length, biome).toBeGreaterThan(2);
		}
	});

	/**
	 * Лева в тундру не привезуть — і це не обмеження заради складності.
	 * Заповідник у тундрі з левом навчав би рівно протилежного тому, заради
	 * чого гра робиться.
	 */
	it('вид, який тут не живе, не приймають', () => {
		const state = createReserve(1, 'tundra');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 10, quality: 3, cell: { x: 0, z: 0 } });

		expect(
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 })
		).toEqual({ ok: false, reason: 'wrong-biome' });
	});

	it('той самий вид у своєму біомі проходить', () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		expect(
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 })
		).toEqual({ ok: true });
	});

	/** Складність біома — це те, наскільки дорогі його мешканці. */
	it('савана дорожча за ліс: її види потребують більших вольєрів', () => {
		const cost = (biome: (typeof RESERVE_BIOMES)[number]) =>
			speciesOfBiome(biome).reduce((sum, s) => sum + enclosurePrice(s.recSize, 2), 0) /
			speciesOfBiome(biome).length;
		expect(cost('savanna')).toBeGreaterThan(cost('forest'));
	});
});

describe('якість вольєра', () => {
	const built = (quality: Quality) => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 4, quality, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
		state.staff.vet = 1;
		return state;
	};

	it('перевірка жива: якість записується у вольєр', () => {
		expect(built(3).enclosures[0]).toMatchObject({ quality: 3, durability: 1 });
	});

	it('дорожча якість коштує дорожче', () => {
		expect(enclosurePrice(4, 3)).toBeGreaterThan(enclosurePrice(4, 2));
		expect(enclosurePrice(4, 2)).toBeGreaterThan(enclosurePrice(4, 1));
	});

	/**
	 * Два множники, а не один, бо це два різні рішення гравця: розмір вирішує,
	 * хто тут поміститься, якість — наскільки йому тут добре.
	 */
	it('у кращому вольєрі того самого розміру одужують швидше', () => {
		const speeds = ([1, 2, 3] as Quality[]).map((q) => {
			const state = built(q);
			day(state, 3);
			return state.animals[0].recovery;
		});
		expect(speeds[1]).toBeGreaterThan(speeds[0]);
		expect(speeds[2]).toBeGreaterThan(speeds[1]);
	});

	it('якості поза шкалою не буває', () => {
		const state = createReserve(1);
		expect(
			execute(state, { type: 'build', size: 4, quality: 9 as Quality, cell: { x: 0, z: 0 } })
		).toEqual({
			ok: false,
			reason: 'bad-quality'
		});
	});

	it('якість можна підняти, але не опустити', () => {
		const state = built(1);
		expect(execute(state, { type: 'upgrade', enclosureId: 1, quality: 3 })).toEqual({ ok: true });
		expect(state.enclosures[0].quality).toBe(3);

		expect(execute(state, { type: 'upgrade', enclosureId: 1, quality: 1 })).toEqual({
			ok: false,
			reason: 'not-an-upgrade'
		});
	});
});

describe('знос і ремонт', () => {
	const aged = (days: number) => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 4, quality: 3, cell: { x: 0, z: 0 } });
		day(state, days);
		return state;
	};

	it('перевірка жива: новий вольєр цілий', () => {
		expect(aged(0).enclosures[0].durability).toBe(1);
	});

	it('вольєр зношується щодня', () => {
		expect(aged(10).enclosures[0].durability).toBeCloseTo(1 - 10 * WEAR_PER_DAY);
	});

	it('порожній вольєр зношується так само: він стоїть під дощем', () => {
		const state = aged(10);
		expect(state.animals).toHaveLength(0);
		expect(state.enclosures[0].durability).toBeLessThan(1);
	});

	/**
	 * Падіння якості СХОДИНКАМИ, а не плавно: гравець має побачити, що вольєр
	 * став гіршим, а не здогадуватися, чому числа поповзли.
	 */
	it('зношений вольєр падає в якості', () => {
		const state = aged(0);
		const enclosure = state.enclosures[0];

		enclosure.durability = 0.8;
		expect(effectiveQuality(enclosure), 'цілий — повна якість').toBe(3);

		enclosure.durability = 0.5;
		expect(effectiveQuality(enclosure), 'потертий — на щабель нижче').toBe(2);

		enclosure.durability = 0.1;
		expect(effectiveQuality(enclosure), 'руїна — на два щаблі').toBe(1);
	});

	it('нижче першої якості не падає', () => {
		const state = aged(0);
		state.enclosures[0].quality = 1;
		state.enclosures[0].durability = 0;
		expect(effectiveQuality(state.enclosures[0])).toBe(1);
	});

	it('ремонт повертає міцність і коштує тим більше, чим гірший стан', () => {
		const state = aged(20);
		const worn = state.enclosures[0].durability;
		const before = state.budget;

		expect(execute(state, { type: 'repair', enclosureId: 1 })).toEqual({ ok: true });
		expect(state.enclosures[0].durability).toBe(1);
		expect(before - state.budget).toBe(repairPrice(4, 3, worn));
	});

	it('цілий вольєр ремонтувати нема сенсу, і гра про це каже', () => {
		const state = aged(0);
		expect(execute(state, { type: 'repair', enclosureId: 1 })).toEqual({
			ok: false,
			reason: 'already-sound'
		});
	});

	it('підняття якості заразом оновлює вольєр', () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 4, quality: 1, cell: { x: 0, z: 0 } });
		day(state, 20);
		expect(state.enclosures[0].durability).toBeLessThan(1);

		execute(state, { type: 'upgrade', enclosureId: 1, quality: 3 });
		expect(state.enclosures[0].durability).toBe(1);
	});
});

describe('дві шкали розходяться саме там, де це щось означає', () => {
	const savanna = () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		state.staff.vet = 1;
		// Фонд із іменем: «у сумі нуль» і «сама спадає» від нуля не перевіряються.
		state.reputation = KNOWN;
		return state;
	};

	/**
	 * Будівництво САМЕ ПО СОБІ природі не допомагає.
	 *
	 * Майже кожен тайкун нараховує очки за будівництво. Тут воно витрата:
	 * ресурси спалено, земля зайнята, жодної врятованої тварини. Публіці ж
	 * байдуже — хтось бачить благі наміри, хтось піар, і в сумі нуль.
	 */
	it('вольєр забирає користь і не дає репутації', () => {
		const state = savanna();
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });

		expect(state.impact).toBe(ENCLOSURE_IMPACT);
		expect(state.reputation, 'публіка розділилася — у сумі нуль').toBe(KNOWN);
	});

	/** Кампанія — дзеркальний випадок: природі нуль, репутації плюс. */
	it('кампанія в соцмережах додає лише репутації', () => {
		const state = savanna();
		const impact = state.impact;

		expect(execute(state, { type: 'campaign' })).toEqual({ ok: true });
		expect(state.impact, 'допис нікого не врятував').toBe(impact);
		expect(state.reputation).toBe(KNOWN + CAMPAIGN_REPUTATION);
	});

	it('кампанія коштує грошей і буває раз на день', () => {
		const state = savanna();
		const before = state.budget;

		execute(state, { type: 'campaign' });
		expect(before - state.budget).toBe(CAMPAIGN_PRICE);
		expect(execute(state, { type: 'campaign' })).toEqual({ ok: false, reason: 'campaign-done' });

		day(state);
		expect(execute(state, { type: 'campaign' }), 'новий день — новий привід').toEqual({ ok: true });
	});

	it('одужання дає мало користі й багато репутації', () => {
		const state = savanna();
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });

		const before = { impact: state.impact, reputation: state.reputation };
		state.animals[0].recovery = 0.99;
		day(state);

		expect(state.animals[0].stage).toBe('healthy');
		expect(state.impact - before.impact).toBe(HEAL_IMPACT);
		// Спад репутації за ту саму добу теж треба врахувати.
		expect(state.reputation - before.reputation).toBeCloseTo(
			HEAL_REPUTATION - REPUTATION_DECAY_PER_DAY
		);
	});

	/**
	 * Публіка забуває. Без цього шкала 0–100 насичується за три тварини, і
	 * репутація перестає бути рішенням — стає туторіалом.
	 */
	it('репутація сама спадає, поки нічого не відбувається', () => {
		const state = savanna();
		day(state, 4);
		expect(state.reputation).toBeCloseTo(KNOWN - 4 * REPUTATION_DECAY_PER_DAY);
	});

	it('спад не заганяє репутацію нижче нуля', () => {
		const state = savanna();
		state.reputation = 0;
		day(state, 5);
		expect(state.reputation).toBe(0);
	});
});

describe('перемога', () => {
	const ready = () => {
		const state = createReserve(1, 'savanna');
		state.budget = 1_000_000;
		execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
		execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
		Object.assign(state.animals[0], { stage: 'healthy', recovery: 1, stress: 0, releasable: true });
		return state;
	};

	it('перевірка жива: звичайний випуск перемоги не дає', () => {
		const state = ready();
		execute(state, { type: 'release', animalId: 1 });
		expect(state.victory).toBe(false);
	});

	/**
	 * Перемога настає лише за «Користю планеті» — не за грошима й не за
	 * репутацією. Гроші й слава тут засоби, а не мета.
	 */
	it('поріг користі завершує партію перемогою', () => {
		const state = ready();
		state.impact = IMPACT_TO_WIN - RELEASE_IMPACT;
		execute(state, { type: 'release', animalId: 1 });

		expect(state.impact).toBeGreaterThanOrEqual(IMPACT_TO_WIN);
		expect(state.victory).toBe(true);
		expect(state.gameOver, 'перемога — не поразка').toBe(false);
	});

	it('після перемоги ходів більше немає', () => {
		const state = ready();
		state.impact = IMPACT_TO_WIN;
		state.victory = true;
		expect(execute(state, { type: 'campaign' })).toEqual({ ok: false, reason: 'game-over' });
	});
});

describe('контракти зі спонсорами', () => {
	const running = () => {
		const state = createReserve(1, 'forest');
		state.budget = 1_000_000;
		return state;
	};

	it('перевірка жива: спочатку пропозицій немає', () => {
		expect(running().offered).toBeNull();
	});

	it('пропозиція приходить не одразу, а за розкладом', () => {
		const state = running();
		day(state, CONTRACT_INTERVAL_DAYS - 1);
		expect(state.offered, 'спонсор прийшов раніше строку').toBeNull();

		day(state);
		expect(state.offered, 'спонсор так і не прийшов').not.toBeNull();
	});

	/**
	 * Лічильник переставляється на момент ПРИЙНЯТТЯ, а не видачі. Інакше
	 * пропозиція, що повисіла кілька днів, приходила б наполовину виконаною
	 * тим, що гравець робив, поки думав.
	 */
	it('умова рахується від моменту прийняття', () => {
		const state = running();
		day(state, CONTRACT_INTERVAL_DAYS);
		const offer = state.offered!;
		state.reputation = 70;

		expect(execute(state, { type: 'accept', contractId: offer.id })).toEqual({ ok: true });
		const taken = state.contracts[0];
		expect(doneOf(state, taken), 'контракт прийшов частково виконаним').toBe(0);
	});

	it('невиконаний контракт нагороди не дає', () => {
		const state = running();
		day(state, CONTRACT_INTERVAL_DAYS);
		execute(state, { type: 'accept', contractId: state.offered!.id });

		expect(execute(state, { type: 'claim', contractId: state.contracts[0].id })).toEqual({
			ok: false,
			reason: 'contract-unfinished'
		});
	});

	it('виконаний контракт платить і зникає', () => {
		const state = running();
		day(state, CONTRACT_INTERVAL_DAYS);
		execute(state, { type: 'accept', contractId: state.offered!.id });

		const contract = state.contracts[0];
		// Доводимо умову до виконання прямо, хоч би що вона міряла.
		contract.startedAt = progressOf(state, contract.goal) - contract.amount;
		const before = state.budget;

		expect(execute(state, { type: 'claim', contractId: contract.id })).toEqual({ ok: true });
		expect(state.budget - before).toBe(contract.reward);
		expect(state.contracts).toEqual([]);
	});

	/**
	 * Провал коштує РЕПУТАЦІЇ, а не грошей: спонсор нічого не забирає, але про
	 * невиконану обіцянку дізнаються. Саме тому брати все підряд невигідно.
	 */
	it('прострочений контракт забирає репутацію', () => {
		const state = running();
		// Імʼя доводиться дати ДО підписання, а не після.
		//
		// Штраф видно лише тому, у кого є що втрачати, — але контракт міряє ПРИРІСТ
		// від дня підписання. Сорок репутації, вкинуті після, зарахувалися б як
		// виконана обіцянка, і перевірка сперечалася б сама з собою.
		state.reputation = KNOWN;
		day(state, CONTRACT_INTERVAL_DAYS);
		execute(state, { type: 'accept', contractId: state.offered!.id });

		const contract = state.contracts[0];
		const reputation = state.reputation;
		/*
		 * Доба вважається пропущеною лише тоді, коли вона СКІНЧИЛАСЯ: прострочення
		 * рахує кінець доби, а `dayOf` каже, який день іде. Звідси й друга доба —
		 * дожити до дедлайну недосить, треба його перейти.
		 */
		day(state, contract.dueDay - dayOf(state) + 2);

		expect(state.contracts, 'прострочений контракт лишився в списку').toEqual([]);
		expect(state.reputation).toBeLessThan(reputation - contract.penalty + 1);
	});

	it('більше двох контрактів одночасно не беруть', () => {
		const state = running();
		for (let i = 0; i < MAX_ACTIVE_CONTRACTS; i++) {
			day(state, CONTRACT_INTERVAL_DAYS);
			execute(state, { type: 'accept', contractId: state.offered!.id });
		}
		expect(state.contracts).toHaveLength(MAX_ACTIVE_CONTRACTS);

		// Третю пропозицію підставляємо руками: чекати наступної марно, бо поки
		// місця немає, спонсори й не приходять — а перший контракт тим часом
		// устиг би прострочитися й звільнити місце.
		state.offered = { ...state.contracts[0], id: 999, dueDay: 9999 };
		expect(execute(state, { type: 'accept', contractId: 999 })).toEqual({
			ok: false,
			reason: 'too-many-contracts'
		});
	});

	it('контракти переживають збереження', () => {
		const state = running();
		day(state, CONTRACT_INTERVAL_DAYS);
		execute(state, { type: 'accept', contractId: state.offered!.id });

		const copy = JSON.parse(JSON.stringify(state));
		expect(copy.contracts).toHaveLength(1);
		expect(copy.contracts[0].goal).toBe(state.contracts[0].goal);
	});
});

describe('межа ділянки', () => {
	const rich = () => {
		const state = createReserve(1, 'forest');
		state.budget = 100_000_000;
		return state;
	};

	const buildAt = (state: ReserveState, x: number, z: number) =>
		execute(state, { type: 'build', size: 1, quality: 1, cell: { x, z } });

	it('перевірка жива: у центрі ділянки будувати можна', () => {
		expect(buildAt(rich(), 0, 0)).toEqual({ ok: true });
	});

	/**
	 * Ділянка має межі, і вони не декоративні. Без цієї перевірки гравець ставив
	 * би вольєри де завгодно, а пунктир на карті означав би рівно нічого.
	 */
	it('за межею ділянки будувати не дають', () => {
		const state = rich();
		// Клітинка 100 — це 220 світових одиниць, тобто далеко за парканом.
		expect(buildAt(state, 100, 0)).toEqual({ ok: false, reason: 'out-of-bounds' });
		expect(state.enclosures).toEqual([]);
	});

	/**
	 * Перевіряється КОЖНА клітинка сліду, а не лише кут: великий вольєр кутом
	 * може стояти в межах, коли протилежний бік уже за парканом.
	 */
	it('великий вольєр не звисає за межу кутом', () => {
		const state = rich();
		const edge = Math.floor(RESERVE_RADIUS / 2.2);
		// Одиничка на самому краю проходить…
		expect(buildAt(state, edge, 0).ok, 'край не тримає навіть одиничку').toBe(true);
		// …а десятка з тим самим кутом уже ні: її слід — чотири клітинки.
		expect(
			execute(state, { type: 'build', size: 10, quality: 1, cell: { x: edge, z: 0 } })
		).toEqual({ ok: false, reason: 'out-of-bounds' });
	});

	it('на зайняту клітинку другий вольєр не поставити', () => {
		const state = rich();
		expect(buildAt(state, 2, 2)).toEqual({ ok: true });
		expect(buildAt(state, 2, 2)).toEqual({ ok: false, reason: 'cell-taken' });
	});

	/** Слід великого вольєра теж зайнятий увесь, а не лише його кут. */
	it('сусідня клітинка під слідом великого вольєра теж зайнята', () => {
		const state = rich();
		execute(state, { type: 'build', size: 9, quality: 1, cell: { x: 0, z: 0 } });
		expect(cellsOf({ x: 0, z: 0 }, 9).length, 'слід великого вольєра завузький').toBeGreaterThan(1);
		expect(buildAt(state, 1, 1)).toEqual({ ok: false, reason: 'cell-taken' });
	});

	it('усі збудовані вольєри стоять у межах', () => {
		const state = rich();
		for (let cx = -5; cx <= 5; cx++) buildAt(state, cx, 0);

		for (const enclosure of state.enclosures) {
			const spot = worldOf(enclosure.cell);
			expect(Math.hypot(spot.x, spot.z)).toBeLessThanOrEqual(RESERVE_RADIUS);
		}
	});
});
