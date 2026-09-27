import { isDenied } from '$lib/net/denied';
import { chunkMissing } from './staleBuild';
import type { LobbyRoom } from '$lib/net/lobby';
import type { Role, RoomInfo } from '$lib/net/roomTypes';

/**
 * ВХІД У КІМНАТУ — чисті рішення, спільні для обох спільних ігор.
 *
 * Доти ці рішення жили копіями на двох сторінках і вже встигли розійтися: у
 * вікторині «швидка гра» не звіряла версію правил, а «Знайди пару» — звіряла
 * (аудит 2026-09-23). Одна функція на обидві сторінки розійтися не може.
 */

/** Ключ повідомлення, чому в кімнату не пускаємо; `null` — пускаємо. */
export type EntryRefusal =
	| 'pairs.noRoom'
	| 'quiz.otherGame'
	| 'pairs.oldVersion'
	| 'pairs.roomOlder';

/**
 * ЧИ ПУСКАТИ В КІМНАТУ — ДО входу, за самим `info`.
 *
 * ВЕРСІЇ ПОРІВНЮЮТЬСЯ ЗА НАПРЯМКОМ, і це різні поради. Доти на будь-яку
 * невідповідність стояло «Гра оновилася, перезавантажте сторінку» — і після
 * деплою людина, що перезавантажилася посеред партії, чула, що застаріла саме вона,
 * хоча застаріла КІМНАТА: перезавантаження вже нічого не дасть, партію створено за
 * старими правилами (аудит 2026-09-23). Тепер кімната старша — «почніть нову»,
 * кімната новіша — «оновіть сторінку».
 */
export function entryRefusal(
	room: RoomInfo | null,
	game: { gameId: string; rulesVersion: number }
): EntryRefusal | null {
	if (!room) return 'pairs.noRoom';
	if (room.gameId !== game.gameId) return 'quiz.otherGame';
	if (room.rulesVersion < game.rulesVersion) return 'pairs.roomOlder';
	if (room.rulesVersion > game.rulesVersion) return 'pairs.oldVersion';
	return null;
}

/**
 * ЯКЕ ПОВІДОМЛЕННЯ НА НЕВДАЛИЙ ВХІД — три причини, і кожна вимагає іншої дії.
 *
 * «Правила не пускають» не лікується повтором, «не склалося» — лікується.
 * `PERMISSION_DENIED` означає, що редакції розійшлися — у БУДЬ-ЯКИЙ бік: правила
 * в Firebase старіші за збірку (ще не викладені) або збірка старіша за правила
 * (вкладка, відкрита до деплою). Доти порада знала лише перший бік, і людина зі
 * старою вкладкою чула, що винні правила (аудит 2026-09-24). Тепер спершу
 * «оновіть сторінку» — це правда в обох випадках, — а тоді друга причина.
 */
export type EntryError =
	| 'pairs.rulesMissing'
	| 'pairs.rulesStale'
	| 'pairs.roomFull'
	| 'pairs.newBuild'
	| 'pairs.netFailed';

/**
 * @param cause причина під обгорткою (`Error.cause`): «код зайнятий» після того, як
 *   база відмовляла на кожному коді, — це відмова правил, а не зайнятий код, і
 *   лікує її оновлення сторінки, а не повтор (шостий аудит, R1).
 */
export function entryErrorKey(reason: string, cause?: unknown): EntryError {
	if (reason === 'rules-missing') return 'pairs.rulesMissing';
	if (reason === 'room-full') return 'pairs.roomFull';
	if (isDenied(reason) || (cause !== undefined && isDenied(cause))) return 'pairs.rulesStale';
	// Шматка збірки на сервері вже немає: повтор не допоможе, допоможе оновлення
	// сторінки (аудит 2026-09-26 — доти це було «спробуйте ще раз» без кінця).
	if (chunkMissing(reason)) return 'pairs.newBuild';
	return 'pairs.netFailed';
}

/**
 * У ЯКІЙ РОЛІ ЗАХОДИТЬ ТОЙ, КОГО В КІМНАТІ ЩЕ НЕМАЄ.
 *
 * Новачок у вже розпочату партію — у тій ролі, яку йому дає гра (`lateRole`). Але
 * той, хто В СКЛАДІ партії (вийшов і вернувся), — гравець: місце в черзі в нього
 * є, і реванш мусить його бачити. Дограна партія — те саме, що лобі: наступна буде
 * реваншем, і той, хто прийшов грати, мусить у ньому бути. Доти він заходив
 * глядачем назавжди, а реваншу бракувало гравців — кімната ставала глухим кутом
 * (аудит 2026-09-25).
 */
export function newcomerRole(
	room: Pick<RoomInfo, 'status' | 'roster'> | null,
	me: string,
	lateRole: Role
): Role {
	const inRoster = room?.roster?.some((entry) => entry.uid === me) ?? false;
	const between = room?.status === 'lobby' || room?.status === 'over';
	return between || inRoster ? 'player' : lateRole;
}

/**
 * ВІДКОЛИ КІМНАТА В ПЕРЕЛІКУ — мить її створення, а для записів без неї — мить
 * останнього оновлення (аудит 2026-09-26). Одна міра й для порядку списку, й для
 * автоматичного пошуку (`utils/seekPlan.ts`): доти обидва брали `at`, який
 * переписується щоудару серцебиття.
 */
export const listedSince = (room: Pick<LobbyRoom, 'since' | 'at'>): number =>
	room.since ?? room.at ?? 0;
