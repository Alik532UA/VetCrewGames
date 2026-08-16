import { ORIGINS, QUALITIES, REPUTATION_MAX, REPUTATION_MIN, WAGES } from './constants';
import { MIGRATIONS } from './migrations';

// Реекспорт: для решти коду формат збереження — одні двері, а не дві.
export { MIGRATIONS };
import { ENCLOSURE_SIZES, RESERVE_BIOMES, speciesById } from './species';
import type { ReserveState } from './types';

/**
 * Формат збереження партії — версія, міграції, перевірка форми.
 *
 * Робиться ДО того, як стан ускладниться, і не з обережності: сейв тайкуна
 * ламається обовʼязково, питання лише коли. Гравець, який вклав у заповідник
 * годину, втрачає її не тоді, коли ми змінюємо стан, а тоді, коли міняємо його
 * без сходинки, якою старий сейв міг би піднятися.
 *
 * Модуль **чистий**: сховища тут немає, як немає його в усій теці (інваріант у
 * `src/structure.test.ts`). `serialize` віддає обʼєкт, `restore` приймає вже
 * розібраний JSON. Хто саме поклав його в `localStorage`, модуль не знає — і
 * тому та сама пара функцій згодом обслужить сейв, який приїхав із мережі.
 */

/**
 * Версія схеми стану.
 *
 * Піднімається щоразу, коли `ReserveState` змінює форму так, що старий сейв
 * читається неправильно. **Разом із номером додається сходинка в `MIGRATIONS`** —
 * без неї підйом версії просто викидає чужу партію.
 */
export const SCHEMA_VERSION = 4;

export interface SaveFile {
	version: number;
	state: ReserveState;
}

/** Чому сейв не застосований. Інтерфейсу цього досить, щоб пояснити людині. */
export type RestoreFailure =
	/** Збереження немає — звичайний перший запуск, не помилка. */
	| { ok: false; reason: 'empty' }
	/** Не схоже на сейв узагалі: биті дані, чужий ключ, обрізаний запис. */
	| { ok: false; reason: 'malformed'; detail: string }
	/** Сейв із новішої версії гри. Мовчки застосувати його — зіпсувати партію. */
	| { ok: false; reason: 'from-the-future'; version: number }
	/** Версія стара, а сходинки для неї немає. */
	| { ok: false; reason: 'no-migration'; version: number };

export type RestoreResult = { ok: true; state: ReserveState } | RestoreFailure;

export function serialize(state: ReserveState): SaveFile {
	return { version: SCHEMA_VERSION, state };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Число, з яким можна рахувати.
 *
 * `Number.isFinite`, а не `typeof === 'number'`: `NaN` — теж число. Загублене
 * поле дало б `undefined + 60 = NaN`, і далі бюджет назавжди лишався б `NaN`,
 * нічого не ламаючи на вигляд — тайкун просто перестав би реагувати на гроші.
 */
const isNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value);

const STAGES = ['recovering', 'healthy', 'released'];

function checkAnimal(value: unknown, index: number): string | null {
	if (!isObject(value)) return `animals[${index}] не обʼєкт`;
	if (!isNumber(value.id)) return `animals[${index}].id`;
	if (typeof value.origin !== 'string' || !(value.origin in ORIGINS))
		return `animals[${index}].origin = ${String(value.origin)}`;
	if (typeof value.speciesId !== 'string' || !speciesById(value.speciesId))
		return `animals[${index}].speciesId = ${String(value.speciesId)}`;
	if (typeof value.stage !== 'string' || !STAGES.includes(value.stage))
		return `animals[${index}].stage = ${String(value.stage)}`;
	if (!isNumber(value.enclosureId)) return `animals[${index}].enclosureId`;
	if (!isNumber(value.recovery)) return `animals[${index}].recovery`;
	if (!isNumber(value.stress)) return `animals[${index}].stress`;
	if (typeof value.releasable !== 'boolean') return `animals[${index}].releasable`;
	// `null` тут законний і означає «ще в заповіднику» — або «день невідомий»,
	// якщо партія приїхала з версії 1, де цього поля не існувало.
	if (value.releasedOnDay !== null && !isNumber(value.releasedOnDay))
		return `animals[${index}].releasedOnDay`;
	return null;
}

function checkEnclosure(value: unknown, index: number): string | null {
	if (!isObject(value)) return `enclosures[${index}] не обʼєкт`;
	if (!isNumber(value.id)) return `enclosures[${index}].id`;
	if (!isNumber(value.size) || !ENCLOSURE_SIZES.includes(value.size as never))
		return `enclosures[${index}].size = ${String(value.size)}`;
	if (!isNumber(value.quality) || !QUALITIES.includes(value.quality as never))
		return `enclosures[${index}].quality = ${String(value.quality)}`;
	if (!isNumber(value.durability) || value.durability < 0 || value.durability > 1)
		return `enclosures[${index}].durability = ${String(value.durability)}`;
	return null;
}

/**
 * Чи справді це стан заповідника.
 *
 * Перевіряється кожне поле, а не сама лише наявність обʼєкта. Сейв — це рядок
 * у сховищі, яке ділять із іншими вкладками, розширеннями й попередніми
 * версіями гри; те, що він розібрався як JSON, не означає, що це наш JSON.
 */
function checkState(value: unknown): string | null {
	if (!isObject(value)) return 'стан не обʼєкт';

	// Біом вирішує, які види тут узагалі бувають: чужа назва зробила б
	// заповідник таким, куди не приймають нікого.
	if (typeof value.biome !== 'string' || !RESERVE_BIOMES.includes(value.biome as never))
		return `biome = ${String(value.biome)}`;

	for (const field of [
		'ticks',
		'budget',
		'impact',
		'reputation',
		'collapseDays',
		'seed',
		'rolls',
		'nextAnimalId',
		'nextEnclosureId'
	])
		if (!isNumber(value[field])) return field;

	// Репутація поза 0–100 нічого не означала б, а пожертви від неї рахуються
	// прямо: значення 10 000 зробило б гроші нескінченними й тихо.
	const reputation = value.reputation as number;
	if (reputation < REPUTATION_MIN || reputation > REPUTATION_MAX)
		return `reputation = ${String(reputation)}`;

	if (!isNumber(value.lastCampaignDay)) return 'lastCampaignDay';
	if (!isNumber(value.lastOfferDay)) return 'lastOfferDay';
	if (!isNumber(value.nextContractId)) return 'nextContractId';
	// Контракти лише перевіряються на форму списку: їхній вміст ми ж і писали,
	// а глибша перевірка тут коштувала б більше, ніж боронила.
	if (!Array.isArray(value.contracts)) return 'contracts';
	if (value.offered !== null && !isObject(value.offered)) return 'offered';

	for (const field of ['gameOver', 'victory', 'subsidy'])
		if (typeof value[field] !== 'boolean') return field;

	if (!isObject(value.staff)) return 'staff';
	for (const role of Object.keys(WAGES)) if (!isNumber(value.staff[role])) return `staff.${role}`;

	if (!Array.isArray(value.enclosures)) return 'enclosures';
	for (const [index, enclosure] of value.enclosures.entries()) {
		const problem = checkEnclosure(enclosure, index);
		if (problem) return problem;
	}

	if (!Array.isArray(value.animals)) return 'animals';
	for (const [index, animal] of value.animals.entries()) {
		const problem = checkAnimal(animal, index);
		if (problem) return problem;
	}

	return null;
}

/**
 * Підняти сейв до поточної версії й перевірити, що вийшов стан.
 *
 * Сходинки й цільова версія — ПАРАМЕТРИ, а не заховані модульні сталі. Так
 * тест піднімає підставний сейв підставними сходинками й доводить, що механізм
 * ходить сходами по одній, а не перестрибує. Брати тільки сходинки, лишивши
 * ціль зашитою, було б непослідовно: драбина з двох сходинок при
 * `SCHEMA_VERSION = 1` не має сенсу.
 */
export function restore(raw: unknown, ladder = MIGRATIONS, target = SCHEMA_VERSION): RestoreResult {
	if (raw === null || raw === undefined) return { ok: false, reason: 'empty' };
	if (!isObject(raw)) return { ok: false, reason: 'malformed', detail: 'сейв не обʼєкт' };
	if (!isNumber(raw.version))
		return { ok: false, reason: 'malformed', detail: `version = ${String(raw.version)}` };

	/*
	 * Сейв із майбутнього НЕ застосовується.
	 *
	 * Спокуса «спробувати все одно» коштує дорого: новіша гра могла прибрати
	 * поле, на яке ця версія спирається, і партія поїхала б із тихо зіпсованим
	 * станом. Краще сказати людині, що гра застаріла, ніж мовчки зламати
	 * заповідник, який вона будувала.
	 */
	if (raw.version > target) return { ok: false, reason: 'from-the-future', version: raw.version };

	let state = raw.state;
	for (let version = raw.version; version < target; version++) {
		const step = ladder[version];
		if (!step) return { ok: false, reason: 'no-migration', version };
		state = step(state);
	}

	const problem = checkState(state);
	if (problem) return { ok: false, reason: 'malformed', detail: problem };

	return { ok: true, state: state as ReserveState };
}
