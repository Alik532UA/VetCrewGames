import type { LobbyRoom } from '$lib/net/lobby';
import type { RoomInfo } from '$lib/net/roomTypes';

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
 * `PERMISSION_DENIED` найчастіше означає, що правила в Firebase СТАРІШІ за цю
 * збірку: клієнт уже пише нове поле, а `$other: false` у старому правилі відкидає
 * запис. Порада «спробуйте ще раз» там безглузда.
 */
export type EntryError = 'pairs.rulesMissing' | 'pairs.rulesStale' | 'pairs.netFailed';

export function entryErrorKey(reason: string): EntryError {
	if (reason === 'rules-missing') return 'pairs.rulesMissing';
	if (/permission[_ ]denied/i.test(reason)) return 'pairs.rulesStale';
	return 'pairs.netFailed';
}

/**
 * КІМНАТА ДЛЯ «ШВИДКОЇ ГРИ» — найстарша з вільних, а не найновіша.
 *
 * Список показує найновіші вгорі (так видно, що щойно зʼявилося), але заходити
 * треба до того, хто чекає ДОВШЕ — інакше кімната, створена першою, стоятиме
 * порожньою, поки біля свіжих збирається черга.
 *
 * Версія правил звіряється ТУТ, а не після спроби: зайти в кімнату з іншою
 * версією однаково не вийде, і пропонувати таку кімнату — запрошувати до відмови.
 *
 * @param seats скільки гравців уже досить, щоб кімната перестала бути «вільною»
 * @param fits власний фільтр гри (набір ігор у вікторині)
 */
export function quickPick(
	rooms: readonly LobbyRoom[],
	game: { gameId: string; rulesVersion: number },
	seats: number,
	fits: (room: LobbyRoom) => boolean = () => true
): LobbyRoom | null {
	const free = rooms
		.filter(
			(room) =>
				room.gameId === game.gameId &&
				room.rulesVersion === game.rulesVersion &&
				room.players < seats &&
				fits(room)
		)
		.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
	return free[0] ?? null;
}
