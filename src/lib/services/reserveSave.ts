import { restore, serialize, type RestoreResult } from '$lib/reserve/save';
import type { ReserveState } from '$lib/reserve/types';
import { storage } from './storage';

/**
 * Тонкий місток між партією заповідника й браузерним сховищем.
 *
 * Уся змістовна робота — версія, міграції, перевірка форми — живе в
 * `$lib/reserve/save`, який про сховище нічого не знає. Тут лишається рівно те,
 * що без браузера не робиться: дістати рядок і покласти рядок.
 *
 * Розрив саме тут, а не деінде, тому що симуляція мусить лишатися чистою: той
 * самий сейв колись приїде не з `localStorage`, а з мережі, і розбиратиме його
 * та сама пара функцій.
 */

const KEY = 'reserve';

/** `false` означає, що партія НЕ збережена — це варто показати людині. */
export function saveReserve(state: ReserveState): boolean {
	return storage.setJSON(KEY, serialize(state));
}

export function loadReserve(): RestoreResult {
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
