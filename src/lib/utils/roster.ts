import type { Member, RoomStatus, RosterEntry } from '$lib/net/roomTypes';

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

/**
 * ГРАВЦІ ВІКТОРИНИ — склад старту й ті, хто долучився посеред партії.
 *
 * Доти вікторина брала гравців із поточних `members` і не читала складу зовсім,
 * хоч сесія його писала, а правило перехоплення на нього спиралося (аудит
 * 2026-09-25). Наслідків було три, і всі видно на екрані:
 *
 *  - хто в лобі натиснув «Назад» (рядок лишається) або колишній господар після
 *    перехоплення ставав «відсутнім гравцем» з нульового раунду — вікно
 *    «Чекаємо: …» на весь екран у кожному раунді;
 *  - хто вийшов, зникав із табло разом з усіма своїми відповідями — і переможець
 *    дограної партії мінявся, коли люди виходили з підсумку;
 *  - новачок посеред партії ставав першим кандидатом на ведення, якого правило не
 *    пускає (`leadCandidates`).
 *
 * Тепер: склад старту — завжди, навіть хто вийшов (імʼя зі складу). Понад нього —
 * гравець кімнати, що ДОЛУЧИВСЯ: `joined` каже, чи він тут або вже відповідав.
 * Відсутній, що партії не грав, у ній не рахується зовсім — ні в таблі, ні в
 * чеканні. У лобі складу ще немає, і гравці — просто гравці кімнати.
 */
export function openPartyOf(
	members: readonly Member[],
	roster: readonly RosterEntry[] | null,
	status: RoomStatus,
	joined: (uid: string) => boolean
): Member[] {
	if (status === 'lobby' || !roster?.length) return playersOf(members);
	const party = partyOf(members, roster);
	const late = playersOf(members).filter(
		(member) => !roster.some((entry) => entry.uid === member.uid) && joined(member.uid)
	);
	return [...party, ...late.map((member, index) => ({ ...member, order: party.length + index }))];
}

/** Що бере з матчу `quizPartyOf` — поля `QuizMatch`, без самого класу. */
export interface QuizPartySource {
	readonly members: readonly Member[];
	readonly roster: readonly RosterEntry[] | null;
	readonly status: RoomStatus;
	readonly present: readonly string[];
	readonly answers: Readonly<Record<number, Readonly<Record<string, unknown>>>>;
}

/** Гравці вікторини: долучився — отже він це я, він тут або вже відповідав. */
export function quizPartyOf(source: QuizPartySource, me: string): Member[] {
	return openPartyOf(source.members, source.roster, source.status, (uid) => {
		if (uid === me || source.present.includes(uid)) return true;
		return Object.values(source.answers).some((round) => round[uid] !== undefined);
	});
}

/**
 * Хто з партії ще В КІМНАТІ. Пішов назовсім (рядка немає) — на таблі лишається з
 * очками, а чекати його нема чого: саме цього просив автор — «кімната дізнається,
 * що гравець остаточно вийшов, і його не варто чекати».
 */
export function stayingOf(players: readonly Member[], members: readonly Member[]): Member[] {
	return players.filter((player) => members.some((row) => row.uid === player.uid));
}

/**
 * Хто може ПІДХОПИТИ ведення — ті самі умови, що в правилі `info/hostUid`: посеред
 * партії лише той, хто в замороженому складі; у лобі й після партії — гравець
 * кімнати за СВОЇМ рядком складу (`members`), а не за роллю в партії.
 *
 * Доти кандидатів брали з `players`, і у вікторині першим міг стати новачок, якого
 * правило не пускає: він пробував щотакту, база щоразу відмовляла, а партія
 * лишалася без ведучого (аудит 2026-09-25). А після партії правило теж пускало
 * лише склад — і вікторина, де лишився тільки той, хто долучився посеред партії,
 * не мала кому почати реванш (шостий аудит, S1). Рядок, а не партія: у партії
 * «Знайди пару» кожен зі складу — гравець, навіть якщо між партіями він став
 * глядачем, а правило дивиться саме на рядок.
 */
export function leadCandidates(
	players: readonly Member[],
	members: readonly Member[],
	status: RoomStatus,
	roster: readonly RosterEntry[] | null
): Member[] {
	if (status !== 'playing') return playersOf(members);
	return players.filter((player) => roster?.some((entry) => entry.uid === player.uid) ?? false);
}
