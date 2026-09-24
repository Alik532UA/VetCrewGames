import type { Member, RosterEntry } from '$lib/net/roomTypes';

/**
 * Гравці кімнати в порядку входу — те, з чого складається черга.
 *
 * **Тайбрейк за `uid` обовʼязковий:** однакові `order` правило бази виключити не
 * вміє, а без тайбрейка порядок різниться між пристроями — чому це страшніше за
 * вкрадену чергу, розписано в `src/cloud-database.test.ts`.
 *
 * Одна функція на обидві гри: доти той самий рядок сортування жив копіями в
 * `PairsMatch` і `QuizMatch`, а склад, який заморожує старт, мусить збігатися з
 * ними до символу.
 */
export function playersOf(members: readonly Member[]): Member[] {
	return members
		.filter((member) => member.role === 'player')
		.sort((a, b) => a.order - b.order || (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
}

/** Склад, який заморожує старт: гравці зараз, у порядку черги, з іменами. */
export function rosterOf(members: readonly Member[]): RosterEntry[] {
	return playersOf(members).map(({ uid, name }) => ({ uid, name }));
}

/**
 * Гравці ПАРТІЇ: із замороженого складу, а коли його немає — з поточних `members`.
 *
 * Той, хто вийшов, лишається тут — з іменем зі складу й роллю гравця: черга й
 * рахунок у нього ті самі, а хід його забирають через межу очікування, як у
 * будь-кого, хто стоїть (`controllers/turnLimit.ts`). Пішов НАЗОВСІМ (хід
 * `leave`) — його черги пропускаються одразу (`PairsMatch.left`). Хто
 * повернувся, — знову зі своїм рядком складу (прапор, аватар), але місце в черзі
 * лишається те, що дав старт.
 */
export function partyOf(
	members: readonly Member[],
	roster: readonly RosterEntry[] | undefined
): Member[] {
	if (!roster?.length) return playersOf(members);
	return roster.map((entry, order): Member => {
		const member = members.find((candidate) => candidate.uid === entry.uid);
		return member
			? { ...member, role: 'player', order }
			: { uid: entry.uid, name: entry.name, role: 'player', order };
	});
}
