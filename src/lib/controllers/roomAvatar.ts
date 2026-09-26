import { DEFAULT_AVATAR } from '$lib/config/avatars';
import { sessionStore } from '$lib/services/storage';
import { takenAvatars } from '$lib/utils/roomAvatars';
import { toast } from './toast.svelte';
import type { Role } from '$lib/net/roomTypes';
import type { RoomMatch, RoomSession } from './roomSession.svelte';

/**
 * АВАТАРКА В КІМНАТІ — дії сесії, окремим модулем (рішення автора 2026-09-26: «пара
 * значок + колір — одна на кімнату; перший лишає свою, новачок отримує вільну й може
 * змінити її в лобі, лише на незайняту»).
 *
 * Окремо від `RoomSession` з тієї самої причини, що й `roomPolicies`: сесія стоїть на
 * межі розміру контролера, а тут окрема відповідь на окреме питання — «яка в мене
 * плитка в ЦІЙ кімнаті». Правило унікальності — не тут, а в чистій функції
 * (`utils/roomAvatars`), яку розкладає конверт кімнати однаково в усіх учасників;
 * тут лише запис свого рядка складу.
 */

/**
 * Про яку заміну людині вже сказали: `код:пара`. У сховищі вкладки, бо повторний
 * вхід (перезавантаження) знову пише її власну пару, заміна повторюється, а казати те
 * саме вдруге нема чого.
 */
export const SWAP_TOLD_KEY = 'room.avatarSwapTold';

/**
 * Моя аватарка В ЦІЙ КІМНАТІ — та, що бачать усі (`RoomEnvelope.members`).
 *
 * Не `player.forRoom()`: власна пара могла виявитися зайнятою, і тоді тут стоїть
 * заміна. Переписати рядок складу глобальною парою означало б повернути повтор, а
 * оголосити її в переліку — показати плитку, якої в кімнаті немає.
 */
export function roomAvatarOf<M extends RoomMatch>(session: RoomSession<M>): string | undefined {
	const mine = session.match?.members.find((member) => member.uid === session.me);
	return mine ? mine.avatar : session.player.forRoom();
}

/** Переписати свій рядок складу з іншою аватаркою; роль лишається як була. */
function rewrite<M extends RoomMatch>(
	session: RoomSession<M>,
	label: string,
	avatar: string | undefined
): Promise<boolean> {
	const name = session.player.forEntry(session.lobby.takenNames);
	const { country } = session.player;
	const role: Role = session.myRole;
	return session.act(label, () =>
		session.net.joinRoom(session.code, name, undefined, country, avatar, role)
	);
}

/**
 * Вибрати аватарку В ЛОБІ — лише вільну.
 *
 * Зайняту вибір і не пропонує (`takenAvatars`), а перевірка тут — на випадок, коли
 * пару взяли між показом і натиском. Посеред партії не міняється: плитка — підпис, за
 * яким інші впізнають гравця на табло. Це вибір ЛЮДИНИ, тож він іде й у спільний стан
 * (`chooseAvatar`: шапка, наступні кімнати, профіль), а не лише в рядок складу.
 */
export async function chooseRoomAvatar<M extends RoomMatch>(
	session: RoomSession<M>,
	avatar: string
): Promise<boolean> {
	const match = session.match;
	if (!match || match.status === 'playing') return false;
	if (takenAvatars(match.members, session.me).has(avatar)) return false;
	session.player.chooseAvatar(avatar);
	return rewrite(session, 'avatar not changed', avatar === DEFAULT_AVATAR ? undefined : avatar);
}

/** Заміна, яку ця сесія вже пише: та сама вдруге не пишеться. */
const writing = new WeakMap<object, string>();

/**
 * Мою пару вже тримає хтось раніший — записати заміну, яку всі й так бачать.
 *
 * Кличе політика (`roomPolicies`), щойно конверт кімнати назвав заміну. Запис
 * потрібен, хоч показ уже правильний: інакше заміна трималася б лише на хеші й могла
 * б змінитися з приходом наступного гравця. Глобальна аватарка людини НЕ міняється —
 * заміна належить цій кімнаті, а не людині.
 *
 * Записати — щоразу (повторний вхід знову пише власну пару, і без запису повтор
 * повернувся б), а сказати — раз на кімнату й пару (`SWAP_TOLD_KEY`).
 */
export async function takeRoomAvatar<M extends RoomMatch>(
	session: RoomSession<M>,
	swap: string
): Promise<void> {
	const key = `${session.code}:${swap}`;
	if (writing.get(session) === key) return;
	writing.set(session, key);
	if (!(await rewrite(session, 'avatar swap not written', swap))) {
		writing.delete(session);
		return;
	}
	if (sessionStore.get(SWAP_TOLD_KEY) === key) return;
	sessionStore.set(SWAP_TOLD_KEY, key);
	// Довше за типові 3 с: це не «готово», а пояснення, яке треба встигнути прочитати.
	toast.info('pairs.avatarReplaced', 8000);
}
