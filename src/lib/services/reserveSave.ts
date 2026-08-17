import { restore, serialize, type RestoreResult } from '$lib/reserve/save';
import type { ReserveState } from '$lib/reserve/types';
import { RESERVE_BIOMES } from '$lib/reserve/species';
import { storage } from './storage';

/**
 * Тонкий місток між фондом і браузерним сховищем.
 *
 * Уся змістовна робота — версія, міграції, перевірка форми — живе в
 * `$lib/reserve/save`, який про сховище нічого не знає. Тут лишається рівно те,
 * що без браузера не робиться: дістати рядок і покласти рядок.
 *
 * Розрив саме тут, а не деінде, тому що симуляція мусить лишатися чистою: той
 * самий сейв колись приїде не з `localStorage`, а з мережі, і розбиратиме його
 * та сама пара функцій.
 */

/**
 * ОДИН ключ на весь фонд.
 *
 * Доти ключів було чотири — по одному на біом, — і кожна ділянка була окремою
 * грою з власним бюджетом. Тепер каса, обидві шкали й годинник спільні, тож і
 * документ один: чотири файли, які мусять узгоджуватися між собою, розійшлися б
 * на першому ж збереженні посеред доби.
 */
const KEY = 'reserve.fund';

/**
 * Ключі часів, коли кожен біом був окремою грою.
 *
 * Вони НЕ читаються — партії з них не переносяться. Злити чотири незалежні гри в
 * один фонд означало б вигадати минуле, якого не було: чотири стартові бюджети,
 * чотири окремі репутації й ніякої історії, як вони стали одним. Тому старі
 * записи просто прибираються, щоб не лежали в сховищі мертвим вантажем.
 */
const LEGACY_KEYS = ['reserve', ...RESERVE_BIOMES.map((biome) => `reserve.${biome}`)];

/** `false` означає, що фонд НЕ збережений — це варто показати людині. */
export function saveReserve(state: ReserveState): boolean {
	return storage.setJSON(KEY, serialize(state));
}

export function loadReserve(): RestoreResult {
	for (const key of LEGACY_KEYS) storage.remove(key);

	/*
	 * Читається сирий рядок, а не `getJSON`, і саме в цьому суть.
	 *
	 * `getJSON` повертає `null` і на «нічого не збережено», і на «збережене
	 * побилося». Перше — звичайний перший запуск, друге — втрачений заповідник,
	 * який людина будувала годину. Звести їх до одного `null` означало б мовчки
	 * почати нову партію замість того, щоб сказати, що сталося.
	 */
	const raw = storage.get(KEY);
	if (raw === null) return { ok: false, reason: 'empty' };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return { ok: false, reason: 'malformed', detail: `JSON не розбирається: ${String(error)}` };
	}

	return restore(parsed);
}

export function dropReserve(): void {
	storage.remove(KEY);
}
