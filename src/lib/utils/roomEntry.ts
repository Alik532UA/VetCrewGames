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

/*
 * ЯКЕ ПОВІДОМЛЕННЯ НА НЕВДАЛИЙ ВХІД — більше не тут. Доти `entryErrorKey` зводив збій до
 * пʼяти тостів («правила не пускають», «новий білд», «спробуйте ще раз»…); тепер причину
 * називає `utils/netProblem.ts` із фактами від `controllers/diagnose.ts` — той самий тост
 * із причиною, звітом і контактами, що на хабі (прохання автора 2026-09-27). Тут лишилась
 * лише «кімната заповнена»: це відповідь бази, а не збій (`RoomSession.enter`).
 */

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
