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

/**
 * Ключ на КОЖНУ ділянку окремо.
 *
 * Один спільний ключ означав би, що вибір нового біома стирає попередній
 * заповідник, — а партії в лісі й у савані мусять тривати паралельно, як
 * тривають дві різні гри.
 */
const keyOf = (biome: string) => `reserve.${biome}`;

/** Ключ часів, коли партія була одна на всю гру. Лишився тільки щоб її забрати. */
const LEGACY_KEY = 'reserve';

/** `false` означає, що партія НЕ збережена — це варто показати людині. */
export function saveReserve(state: ReserveState): boolean {
	return storage.setJSON(keyOf(state.biome), serialize(state));
}

export function loadReserve(biome: string): RestoreResult {
	/*
	 * Читається сирий рядок, а не `getJSON`, і саме в цьому суть.
	 *
	 * `getJSON` повертає `null` і на «нічого не збережено», і на «збережене
	 * побилося». Перше — звичайний перший запуск, друге — втрачений заповідник,
	 * який людина будувала годину. Звести їх до одного `null` означало б мовчки
	 * почати нову партію замість того, щоб сказати, що сталося.
	 */
	const raw = storage.get(keyOf(biome));
	if (raw === null) return adoptLegacy(biome) ?? { ok: false, reason: 'empty' };

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return { ok: false, reason: 'malformed', detail: `JSON не розбирається: ${String(error)}` };
	}

	return restore(parsed);
}

/**
 * Партія, збережена ДО поділу сховища по ділянках.
 *
 * Доти ключ був один на всю гру. Просто перестати його читати означало б, що
 * заповідник, який людина будувала годину, зник разом з оновленням, — і жодного
 * слова про це. Тому старий запис переїжджає під ключ СВОГО біома: у ліс саванна
 * не потрапить.
 *
 * Нечитабельний старий запис лишається на місці й видається за «нічого не
 * збережено». Це навмисно: попередження про побитий сейв на ділянці, яку людина
 * щойно вибрала вперше, було б шумом, а сам рядок нікуди не дівається.
 */
function adoptLegacy(biome: string): RestoreResult | null {
	const raw = storage.get(LEGACY_KEY);
	if (raw === null) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}

	/*
	 * Біом питається в ВІДНОВЛЕНОГО стану, а не в сирого запису: у найстарших
	 * сейвах поля `biome` немає зовсім, і типовий йому дає саме драбина міграцій.
	 * Перевіряти сире поле означало б викинути ті сейви, які найбільше потребують
	 * переїзду.
	 */
	const result = restore(parsed);
	if (!result.ok || result.state.biome !== biome) return null;

	storage.setJSON(keyOf(biome), serialize(result.state));
	storage.remove(LEGACY_KEY);
	return result;
}

export function dropReserve(biome: string): void {
	storage.remove(keyOf(biome));
}
