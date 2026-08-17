// @vitest-environment node
// Формат збереження нічого не знає про сховище — і перевірка теж не має знати.
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, restore, SCHEMA_VERSION, serialize } from './save';
import { createReserve, execute, tick } from './simulation';
import { TICKS_PER_DAY } from './constants';
import type { ReserveBiome } from './species';
import type { ReserveCommand, ReserveState } from './types';

/**
 * Хід на ділянці. Типова земля — савана: там живе лев, на якому все й перевіряють.
 */
const move = (state: ReserveState, command: ReserveCommand, at: ReserveBiome = 'savanna') =>
	execute(state, command, at);

/** Земля, на якій ідуть перевірки: тварини, вольєри й штат живуть саме тут. */
const home = (state: ReserveState, at: ReserveBiome = 'savanna') => state.sites[at];

/** Партія, у якій уже щось сталося: порожній стан приховав би половину полів. */
function played(): ReserveState {
	// Савана: лев живе саме там, інакше заповідник його не прийме.
	const state = createReserve(42);
	move(state, { type: 'hire', role: 'vet' });
	move(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	move(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
	tick(state, TICKS_PER_DAY * 3);
	return state;
}

describe('формат збереження', () => {
	it('перевірка жива: партія справді має що зберігати', () => {
		const state = played();
		expect(state.ticks).toBe(900);
		expect(home(state).animals).toHaveLength(1);
		expect(home(state).enclosures).toHaveLength(1);
	});

	it('сейв несе номер версії схеми', () => {
		expect(serialize(played()).version).toBe(SCHEMA_VERSION);
	});

	it('що зберегли, те й повернулося', () => {
		const state = played();
		const back = restore(JSON.parse(JSON.stringify(serialize(state))));

		expect(back.ok).toBe(true);
		expect(back.ok && back.state).toEqual(state);
	});

	/**
	 * Найважливіша властивість сейва в детермінованій грі.
	 *
	 * Відновлений світ мусить розвиватися далі ТОЧНО так само, як розвивався б
	 * без збереження. Інакше сейв тихо створює розвилку: обидві партії живі,
	 * обидві правдоподібні, і побачити розбіжність можна аж на десятому дні.
	 * Саме тому стан генератора (`seed` і `rolls`) лежить у самому стані.
	 */
	it('відновлена партія розвивається так само, як нерозірвана', () => {
		const straight = played();
		const saved = restore(JSON.parse(JSON.stringify(serialize(played()))));
		expect(saved.ok).toBe(true);
		if (!saved.ok) return;

		for (const state of [straight, saved.state]) {
			move(state, { type: 'build', size: 5, quality: 2, cell: { x: 6, z: 0 } });
			move(state, { type: 'acquire', origin: 'rescue', speciesId: 'leopard', enclosureId: 2 });
			tick(state, TICKS_PER_DAY * 5);
		}
		expect(JSON.stringify(saved.state)).toBe(JSON.stringify(straight));
	});
});

/*
 * Перевірок старої драбини тут більше немає — разом із самою драбиною.
 *
 * До появи фонду документ описував ОДНУ ділянку й дожив до сьомої версії сімома
 * сходинками. Фонд — інший документ під іншим ключем, і зливати чотири незалежні
 * партії в одну означало б вигадати минуле, якого не було. Перевіряти сходинки,
 * якими вже нікому не підніматися, — це тримати зелений гейт над мертвим кодом.
 *
 * Механізм при цьому лишився: нижче він перевіряється на ПІДРОБЛЕНІЙ драбині, і
 * саме тому перша ж зміна форми фонду знайде і робочий підйом, і його перевірку.
 */

describe('драбина міграцій', () => {
	it('реєстр містить рівно ті сходинки, яких потребує поточна версія', () => {
		// Від версії 1 до 2 — одна сходинка. Дірка в драбині означала б, що
		// підйом версії просто викидає чужу партію.
		for (let version = 1; version < SCHEMA_VERSION; version++) {
			expect(MIGRATIONS[version], `немає сходинки ${version} → ${version + 1}`).toBeTypeOf(
				'function'
			);
		}
	});

	const ladder = {
		1: (state: unknown) => ({ ...(state as object), budget: 111 }),
		2: (state: unknown) => ({ ...(state as object), impact: 222 })
	};

	it('сейв версії 1 доходить до поточної, проходячи КОЖНУ сходинку', () => {
		const old = { version: 1, state: { ...played(), budget: 0, impact: 0 } };
		// Три версії попереду — щоб було видно, що механізм іде сходами,
		// а не стрибає одразу на останню.
		const result = restore(old, ladder, 3);

		expect(result.ok).toBe(true);
		expect(result.ok && result.state.budget, 'сходинку 1→2 пропущено').toBe(111);
		expect(result.ok && result.state.impact, 'сходинку 2→3 пропущено').toBe(222);
	});

	it('сейв поточної версії не чіпають узагалі', () => {
		const state = played();
		const result = restore({ version: 3, state }, ladder, 3);
		expect(result.ok && result.state).toEqual(state);
	});

	it('пропущена сходинка не мовчить', () => {
		const result = restore({ version: 1, state: played() }, { 2: ladder[2] }, 3);
		expect(result).toEqual({ ok: false, reason: 'no-migration', version: 1 });
	});
});

describe('сейв, якому не можна вірити', () => {
	/**
	 * Сейв із новішої гри не застосовується — і це не перестраховка.
	 *
	 * Новіша версія могла прибрати поле, на яке спирається ця; партія поїхала б
	 * із тихо зіпсованим станом. Сказати людині, що гра застаріла, дешевше, ніж
	 * зламати заповідник, який вона будувала годину.
	 */
	it('сейв із майбутнього не застосовується мовчки', () => {
		const result = restore({ version: SCHEMA_VERSION + 1, state: played() });
		expect(result).toEqual({ ok: false, reason: 'from-the-future', version: SCHEMA_VERSION + 1 });
	});

	it('відсутнього збереження вистачає, щоб просто почати нову партію', () => {
		expect(restore(null)).toEqual({ ok: false, reason: 'empty' });
		expect(restore(undefined)).toEqual({ ok: false, reason: 'empty' });
	});

	/**
	 * Розібраний JSON — ще не наш JSON.
	 *
	 * Сховище спільне з іншими вкладками, розширеннями й попередніми версіями
	 * гри. Головна ціль тут не «биті дані», а ПРАВДОПОДІБНІ: загублене число
	 * дало б `undefined + 60 = NaN`, і бюджет назавжди лишився б `NaN`, нічого
	 * не ламаючи на вигляд — тайкун просто перестав би реагувати на гроші.
	 */
	it.each([
		['не обʼєкт', 'просто рядок'],
		['масив замість сейва', [1, 2, 3]],
		['версія рядком', { version: '1', state: played() }],
		['версія відсутня', { state: played() }],
		['стану немає', { version: SCHEMA_VERSION }],
		['стан не обʼєкт', { version: SCHEMA_VERSION, state: 'нічого' }],
		['поле загубилося', { version: SCHEMA_VERSION, state: { ...played(), budget: undefined } }],
		['NaN замість числа', { version: SCHEMA_VERSION, state: { ...played(), budget: NaN } }],
		['персонал зник', { version: SCHEMA_VERSION, state: withSite({ staff: {} }) }],
		['тварини не масив', { version: SCHEMA_VERSION, state: withSite({ animals: {} }) }],
		['ділянка зникла', { version: SCHEMA_VERSION, state: withoutSite() }],
		['чуже походження', { version: SCHEMA_VERSION, state: withAnimal({ origin: 'зоопарк' }) }],
		['чужа стадія', { version: SCHEMA_VERSION, state: withAnimal({ stage: 'мертва' }) }],
		['стрес рядком', { version: SCHEMA_VERSION, state: withAnimal({ stress: 'високий' }) }]
	])('%s — відмова, а не виняток', (_name, raw) => {
		const result = restore(raw);
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.reason).toBe('malformed');
	});
});

/** Фонд, у якому саванну ділянку зіпсовано заданим чином. */
function withSite(broken: Record<string, unknown>) {
	const state = played();
	return { ...state, sites: { ...state.sites, savanna: { ...home(state), ...broken } } };
}

/**
 * Фонд без однієї землі.
 *
 * Найдорожча з поломок: `state.sites[biome]` дає `undefined`, і перший же тік
 * валиться на `site.animals` — уже після того, як сейв визнали добрим.
 */
function withoutSite() {
	const state = played();
	const sites = { ...state.sites } as Record<string, unknown>;
	delete sites.tundra;
	return { ...state, sites };
}

/** Партія, у якій одну тварину зіпсовано заданим чином. */
function withAnimal(broken: Record<string, unknown>) {
	const state = played();
	return withSite({ animals: [{ ...home(state).animals[0], ...broken }] });
}
