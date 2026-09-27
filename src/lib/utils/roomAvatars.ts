import { AVATAR_COLORS, AVATAR_ICONS, formatAvatar, normaliseAvatar } from '$lib/config/avatars';
import type { Member } from '$lib/net/roomTypes';
import { fnv1a } from './fnv';

/**
 * АВАТАРКА В КІМНАТІ — БЕЗ ПОВТОРІВ ЗНАЧКА Й КОЛЬОРУ (рішення автора 2026-09-26 і
 * 2026-09-27: «щоб у кімнаті не було однакових аватарок і кольорів; повтор — лише коли
 * унікальні скінчилися, або в акаунтів»).
 *
 * Дві схожі плитки в одному складі роблять аватарку марною: вона існує, щоб казати «це
 * той самий, кого я бачив у лобі», а синього кота від синього пса на табло відрізнити
 * важко. Тому в межах кімнати НЕ повторюється ні значок, ні колір, і правило таке:
 *
 *  • АКАУНТ ЛИШАЄ СВОЮ ЗАВЖДИ (10-A): його аватарка — профільна, та сама на кожному
 *    пристрої, і повтор йому дозволено — зокрема з іншим акаунтом. Хто акаунт, каже
 *    поле складу `account`, і приймає його база лише від того, хто ввійшов не анонімно
 *    (`database.rules.json`).
 *  • ДАЛІ — ПЕРШИЙ ЛИШАЄ СВОЮ. Хто зайшов раніше (`order`), той і власник значка й
 *    кольору: інакше новачок забирав би аватарку в того, до кого прийшов.
 *  • НОВАЧОК ОТРИМУЄ ВІЛЬНУ, випадкову — «щоб нікому не було образливо», — сам
 *    переписує її у свій рядок складу (`takeRoomAvatar` у `controllers/roomAvatar.ts`);
 *    мовчки, якщо аватарку не вибирав, і з поясненням, якщо вибирав (9-A). Змінити її
 *    можна в лобі — лише на вільну (`takenAvatars`).
 *  • ЛИШЕ В ЛОБІ (9-A: «посеред партії ніколи»): у партії плитка — підпис, за яким інші
 *    впізнають гравця на табло, і вона не мусить мінятися від того, що хтось зайшов.
 *
 * Вільна — з невживаним значком І невживаним кольором; коли таких немає (кольорів
 * дванадцять, а в кімнаті дванадцять місць, і акаунти можуть повторювати), — з
 * невживаним значком, тоді з невживаним кольором, тоді будь-яка незайнята пара.
 *
 * ## Чому розвʼязує ПОКАЗ, а не лише запис
 *
 * Запис унікальності не гарантує: двоє, що зайшли одночасно, обидва бачили плитку
 * вільною. База цього не відкидає — правило, яке порівнювало б рядок з усіма
 * сусідами, в RTDB не пишеться. Тому розвʼязок — ЧИСТА функція від складу, і в усіх
 * учасників він однаковий: «випадкова» заміна береться з вільних пар за хешем uid і
 * солі кімнати, а не з `Math.random`. Той, кого замінили, пише її в базу сам — і
 * запис збігається з тим, що інші вже бачать, без жодного стрибка.
 *
 * Порівнюються аватарки, які ПОКАЗУЮТЬ (`normaliseAvatar`): значок, якого більше немає
 * (`star:red` зі старшої збірки), показується твариною того самого кольору, і дві такі
 * плитки в складі — той самий повтор. Рядок без аватарки не бере участі: його не
 * показують зовсім (`Avatar.showDefault`), тож і плутати нічого.
 */

/** Усі пари — заміна мусить бути ВИДИМОЮ: людина мала свою плитку. */
export const ROOM_AVATARS: readonly string[] = AVATAR_ICONS.flatMap((icon) =>
	AVATAR_COLORS.map((color) => formatAvatar(icon, color))
);

export interface UniqueAvatars {
	/** Склад із розвʼязаними аватарками — те, що показують усі екрани кімнати. */
	members: Member[];
	/** Кого замінено: uid → нова пара. Порожньо — повторів немає. */
	swaps: Record<string, string>;
}

/** Порядок власності — за входом; однаковий `order` (старі кімнати) розводить uid. */
const byEntry = (a: Member, b: Member) =>
	a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0);

const iconOf = (avatar: string) => avatar.slice(0, avatar.indexOf(':'));
const colorOf = (avatar: string) => avatar.slice(avatar.indexOf(':') + 1);

/** Що вже тримають у кімнаті: значки, кольори й самі пари. */
class Held {
	readonly icons = new Set<string>();
	readonly colors = new Set<string>();
	readonly pairs = new Set<string>();

	add(avatar: string): void {
		this.icons.add(iconOf(avatar));
		this.colors.add(colorOf(avatar));
		this.pairs.add(avatar);
	}

	/** Повтор — той самий значок або той самий колір. */
	clashes(avatar: string): boolean {
		return this.icons.has(iconOf(avatar)) || this.colors.has(colorOf(avatar));
	}

	/** Вільні пари — від найкращих до крайніх (докблок модуля). */
	free(): readonly string[] {
		const open = ROOM_AVATARS.filter((avatar) => !this.pairs.has(avatar));
		const tiers = [
			open.filter((a) => !this.icons.has(iconOf(a)) && !this.colors.has(colorOf(a))),
			open.filter((a) => !this.icons.has(iconOf(a))),
			open.filter((a) => !this.colors.has(colorOf(a))),
			open
		];
		return tiers.find((tier) => tier.length > 0) ?? [];
	}
}

/**
 * Розвʼязати повтори в складі. `salt` — будь-що спільне для кімнати й стале
 * (мітка створення): з ним та сама людина в різних кімнатах отримує різні заміни.
 * `frozen` — партія йде або скінчилася: тоді не міняється нічого (9-A).
 */
export function uniqueAvatars(
	members: Member[],
	salt: string | number,
	frozen = false
): UniqueAvatars {
	if (frozen) return { members, swaps: {} };
	const held = new Held();
	const ordered = [...members].sort(byEntry);
	// Акаунти — першими й без заміни: повтор їм дозволено.
	for (const member of ordered) {
		const avatar = normaliseAvatar(member.avatar);
		if (member.account === true && avatar !== '') held.add(avatar);
	}
	const clashing: Member[] = [];
	for (const member of ordered) {
		const avatar = normaliseAvatar(member.avatar);
		if (member.account === true || avatar === '') continue;
		if (held.clashes(avatar)) clashing.push(member);
		else held.add(avatar);
	}
	// Без повторів — той самий масив: матч не отримує «нового» складу на кожен знімок.
	if (clashing.length === 0) return { members, swaps: {} };

	const swaps: Record<string, string> = {};
	for (const member of clashing) {
		const free = held.free();
		// 216 пар на 12 місць кімнати: вільна є завжди, але межу краще назвати, ніж упасти.
		if (free.length === 0) break;
		// Той самий хеш у всіх учасників — отже й та сама заміна.
		const pick = free[fnv1a(`${salt}:${member.uid}`) % free.length];
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
 * Пари, які вибір у лобі НЕ пропонує, — з іменами власників: кожна, чий значок чи колір
 * уже тримає хтось інший. Зайняте видно, але натиснути його не можна, і підпис каже,
 * чиє воно. Той самий захист і для акаунта: свій повтор він приносить із профілю, а
 * вибором у лобі не витісняє нікого.
 */
export function takenAvatars(members: readonly Member[], me: string): Map<string, string> {
	const taken = new Map<string, string>();
	for (const member of members) {
		const avatar = normaliseAvatar(member.avatar);
		if (member.uid === me || avatar === '') continue;
		for (const pair of ROOM_AVATARS) {
			if (iconOf(pair) === iconOf(avatar) || colorOf(pair) === colorOf(avatar)) {
				taken.set(pair, member.name);
			}
		}
	}
	return taken;
}
