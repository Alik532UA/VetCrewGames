import {
	AVATAR_COLORS,
	AVATAR_ICONS,
	DEFAULT_AVATAR,
	formatAvatar,
	isCustomAvatar
} from '$lib/config/avatars';
import type { Member } from '$lib/net/roomTypes';

/**
 * АВАТАРКА В КІМНАТІ — ОДНА ПАРА «ЗНАЧОК + КОЛІР» НА ЛЮДИНУ (рішення автора 2026-09-26).
 *
 * Дві однакові плитки в одному складі роблять аватарку марною: вона існує, щоб
 * казати «це той самий, кого я бачив у лобі». Тому пара унікальна в межах кімнати,
 * і правило таке:
 *
 *  • ПЕРШИЙ ЛИШАЄ СВОЮ. Хто зайшов раніше (`order`), той і власник пари: інакше
 *    новачок забирав би аватарку в того, до кого прийшов.
 *  • НОВАЧОК ОТРИМУЄ ВІЛЬНУ, випадкову — «щоб нікому не було образливо», — сам
 *    переписує її у свій рядок складу (`RoomSession.takeAvatar`), і сторінка каже
 *    йому про це. Змінити її можна в лобі — лише на вільну (`takenAvatars`).
 *
 * ## Чому розвʼязує ПОКАЗ, а не лише запис
 *
 * Запис унікальності не гарантує: двоє, що зайшли одночасно, обидва бачили пару
 * вільною. База цього не відкидає — правило, яке порівнювало б рядок з усіма
 * сусідами, в RTDB не пишеться. Тому розвʼязок — ЧИСТА функція від складу, і в усіх
 * учасників він однаковий: «випадкова» заміна береться з вільних пар за хешем uid і
 * солі кімнати, а не з `Math.random`. Той, кого замінили, пише її в базу сам — і
 * запис збігається з тим, що інші вже бачать, без жодного стрибка.
 *
 * Типова плитка (`DEFAULT_AVATAR`, «не вибирав») у цьому не бере участі: її не
 * показують зовсім (`Avatar.showDefault`), тож і плутати нічого.
 */

/** Усі пари, крім типової: заміна мусить бути ВИДИМОЮ — людина мала свою плитку. */
export const ROOM_AVATARS: readonly string[] = AVATAR_ICONS.flatMap((icon) =>
	AVATAR_COLORS.map((color) => formatAvatar(icon, color))
).filter((avatar) => avatar !== DEFAULT_AVATAR);

/** FNV-1a, 32 біти: той самий хеш у всіх учасників — отже й та сама заміна. */
export function hashOf(text: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

export interface UniqueAvatars {
	/** Склад із розвʼязаними аватарками — те, що показують усі екрани кімнати. */
	members: Member[];
	/** Кого замінено: uid → нова пара. Порожньо — повторів немає. */
	swaps: Record<string, string>;
}

/** Порядок власності — за входом; однаковий `order` (старі кімнати) розводить uid. */
const byEntry = (a: Member, b: Member) =>
	a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

/**
 * Розвʼязати повтори в складі. `salt` — будь-що спільне для кімнати й стале
 * (мітка створення): з ним та сама людина в різних кімнатах отримує різні заміни.
 */
export function uniqueAvatars(members: Member[], salt: string | number): UniqueAvatars {
	const held = new Set<string>();
	const clashing: Member[] = [];
	for (const member of [...members].sort(byEntry)) {
		const avatar = member.avatar;
		if (!isCustomAvatar(avatar)) continue;
		if (held.has(avatar as string)) clashing.push(member);
		else held.add(avatar as string);
	}
	// Без повторів — той самий масив: матч не отримує «нового» складу на кожен знімок.
	if (clashing.length === 0) return { members, swaps: {} };

	const swaps: Record<string, string> = {};
	for (const member of clashing) {
		const free = ROOM_AVATARS.filter((avatar) => !held.has(avatar));
		// 111 пар на 12 місць кімнати: вільна є завжди, але межу краще назвати, ніж упасти.
		if (free.length === 0) break;
		const pick = free[hashOf(`${salt}:${member.uid}`) % free.length];
		held.add(pick);
		swaps[member.uid] = pick;
	}
	return {
		members: members.map((member) =>
			member.uid in swaps ? { ...member, avatar: swaps[member.uid] } : member
		),
		swaps
	};
}

/**
 * Пари, які тримають ІНШІ, — з іменами власників. Вибір у лобі пропонує лише решту:
 * зайняте видно, але натиснути його не можна, і підпис каже, чиє воно.
 */
export function takenAvatars(members: readonly Member[], me: string): Map<string, string> {
	const taken = new Map<string, string>();
	for (const member of members) {
		if (member.uid === me || !isCustomAvatar(member.avatar)) continue;
		taken.set(member.avatar as string, member.name);
	}
	return taken;
}
