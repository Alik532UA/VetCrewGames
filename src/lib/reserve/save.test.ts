// @vitest-environment node
// Формат збереження нічого не знає про сховище — і перевірка теж не має знати.
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, restore, SCHEMA_VERSION, serialize } from './save';
import { createReserve, execute, tick } from './simulation';
import { STARTING_REPUTATION, TICKS_PER_DAY } from './constants';
import { speciesById } from './species';
import type { ReserveState } from './types';

/** Партія, у якій уже щось сталося: порожній стан приховав би половину полів. */
function played(): ReserveState {
	// Савана: лев живе саме там, інакше заповідник його не прийме.
	const state = createReserve(42, 'savanna');
	execute(state, { type: 'hire', role: 'vet' });
	execute(state, { type: 'build', size: 4, quality: 2, cell: { x: 0, z: 0 } });
	execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'lion', enclosureId: 1 });
	tick(state, TICKS_PER_DAY * 3);
	return state;
}

describe('формат збереження', () => {
	it('перевірка жива: партія справді має що зберігати', () => {
		const state = played();
		expect(state.ticks).toBe(900);
		expect(state.animals).toHaveLength(1);
		expect(state.enclosures).toHaveLength(1);
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
			execute(state, { type: 'build', size: 5, quality: 2, cell: { x: 4, z: 0 } });
			execute(state, { type: 'acquire', origin: 'rescue', speciesId: 'leopard', enclosureId: 2 });
			tick(state, TICKS_PER_DAY * 5);
		}
		expect(JSON.stringify(saved.state)).toBe(JSON.stringify(straight));
	});
});

/**
 * Справжній сейв версії 1, записаний до того, як зʼявилися вольєри, види й
 * репутація. Це не вигадка «як воно могло виглядати» — це рівно та форма, яку
 * писала гра вчора.
 */
const SAVE_V1 = {
	version: 1,
	state: {
		ticks: 900,
		budget: 44_000,
		impact: 10,
		animals: [
			{
				id: 1,
				origin: 'rescue',
				stage: 'recovering',
				recovery: 0.3,
				stress: 0.16,
				releasable: true
			},
			{ id: 2, origin: 'official', stage: 'healthy', recovery: 1, stress: 0, releasable: false }
		],
		staff: { vet: 1, keeper: 0 },
		collapseDays: 0,
		gameOver: false,
		subsidy: false,
		seed: 208_075_745,
		rolls: 2,
		nextAnimalId: 3
	}
};

describe('справжня міграція 1 → 2', () => {
	const migrated = () => restore(structuredClone(SAVE_V1));

	it('перевірка жива: сейв версії 1 не проходить перевірку форми версії 2', () => {
		// Без сходинки той самий обʼєкт відкинуло б: у нього немає ні вольєрів,
		// ні репутації, ні виду тварини.
		expect(restore(structuredClone(SAVE_V1), {})).toMatchObject({ ok: false });
	});

	it('партія переживає оновлення гри', () => {
		const result = migrated();
		expect(result.ok, result.ok === false ? result.reason : '').toBe(true);
		if (!result.ok) return;

		expect(result.state.ticks).toBe(900);
		expect(result.state.budget).toBe(44_000);
		expect(result.state.animals).toHaveLength(2);
	});

	it('кожна тварина отримує вид і власний вольєр', () => {
		const result = migrated();
		if (!result.ok) throw new Error('міграція не пройшла');

		for (const animal of result.state.animals) {
			expect(speciesById(animal.speciesId), animal.speciesId).toBeDefined();
			const home = result.state.enclosures.find((e) => e.id === animal.enclosureId);
			expect(home, `тварині ${animal.id} не дали вольєра`).toBeDefined();
		}
		// Два вольєри на дві тварини: спільного житла не буває.
		expect(new Set(result.state.animals.map((a) => a.enclosureId)).size).toBe(2);
	});

	/**
	 * Вольєр дається РЕКОМЕНДОВАНОГО розміру.
	 *
	 * Мінімальний сповільнив би вп'ятеро те, що досі йшло на повній швидкості,
	 * — тобто покарав би гравця за оновлення гри.
	 */
	it('вольєр не тісний: швидкості лишаються базовими', () => {
		const result = migrated();
		if (!result.ok) throw new Error('міграція не пройшла');

		for (const animal of result.state.animals) {
			const species = speciesById(animal.speciesId)!;
			const home = result.state.enclosures.find((e) => e.id === animal.enclosureId)!;
			expect(home.size).toBe(species.recSize);
		}
	});

	/**
	 * Вид виводиться з `id` і зерна, а НЕ кидком генератора: кидок зсунув би
	 * `rolls`, і партія після відновлення розгорталася б інакше, ніж
	 * розгорталася б без збереження.
	 */
	it('міграція не чіпає стан генератора', () => {
		const result = migrated();
		if (!result.ok) throw new Error('міграція не пройшла');
		expect(result.state.rolls).toBe(SAVE_V1.state.rolls);
		expect(result.state.seed).toBe(SAVE_V1.state.seed);
	});

	it('одна й та сама стара партія завжди дає той самий новий світ', () => {
		const a = migrated();
		const b = migrated();
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	/**
	 * День випуску лишається невідомим — у версії 1 його ніде не було.
	 * Вигаданий нуль читався б як «випустили в перший день», тобто був би
	 * брехнею; прочерк чесніший.
	 */
	it('день випуску не вигадується', () => {
		const result = migrated();
		if (!result.ok) throw new Error('міграція не пройшла');
		expect(result.state.animals.every((a) => a.releasedOnDay === null)).toBe(true);
	});

	it('репутація починається з середини шкали', () => {
		const result = migrated();
		if (!result.ok) throw new Error('міграція не пройшла');
		expect(result.state.reputation).toBe(STARTING_REPUTATION);
	});
});

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
		['персонал зник', { version: SCHEMA_VERSION, state: { ...played(), staff: {} } }],
		['тварини не масив', { version: SCHEMA_VERSION, state: { ...played(), animals: {} } }],
		['чуже походження', { version: SCHEMA_VERSION, state: withAnimal({ origin: 'зоопарк' }) }],
		['чужа стадія', { version: SCHEMA_VERSION, state: withAnimal({ stage: 'мертва' }) }],
		['стрес рядком', { version: SCHEMA_VERSION, state: withAnimal({ stress: 'високий' }) }]
	])('%s — відмова, а не виняток', (_name, raw) => {
		const result = restore(raw);
		expect(result.ok).toBe(false);
		expect(result.ok === false && result.reason).toBe('malformed');
	});
});

/** Партія, у якій одну тварину зіпсовано заданим чином. */
function withAnimal(broken: Record<string, unknown>) {
	const state = played();
	return { ...state, animals: [{ ...state.animals[0], ...broken }] };
}
