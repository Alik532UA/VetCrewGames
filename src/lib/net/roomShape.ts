import type { Member, Move, RoomInfo, RoomSnapshot, RosterEntry } from './roomTypes';

/**
 * ФОРМА КІМНАТИ В БАЗІ ↔ ФОРМА В КОДІ — в одному місці й без мережі.
 *
 * Дві причини тримати це окремо від `rtdbRoom.ts`. Перша — перевірність: це чисті
 * функції, і як саме склад, журнал і `info` читаються з бази, видно в
 * `roomShape.test.ts` без SDK і без емулятора. Друга — розмір: транспорт стояв на
 * межі (`structure.test.ts`), а кожне нове поле кімнати додавало саме сюди.
 */

/** `info` так, як воно лежить у базі: склад там — мапа, а не черга. */
export type RawInfo = Omit<RoomInfo, 'roster'> & { roster?: unknown };

/** Склад у базі — мапа за `uid`: так правило може спитати «чи він у складі». */
export type RosterRecord = Record<string, { name: string; seat: number }>;

/**
 * Склад для запису.
 *
 * МАПОЮ ЗА `uid`, а не масивом, і це потрібне ПРАВИЛУ, а не коду. Масив у RTDB —
 * це ключі `0`, `1`, `2`, і спитати «чи є цей uid у складі» правило не може:
 * перебору в мові правил немає. Мапою — може одним `child(auth.uid).exists()`, і
 * саме на цьому стоїть перехоплення ведення: забрати його посеред партії може лише
 * той, хто в ній грає (аудит 2026-09-24). Порядок черги — у `seat`.
 */
export function rosterToRecord(roster: readonly RosterEntry[]): RosterRecord {
	return Object.fromEntries(roster.map(({ uid, name }, seat) => [uid, { name, seat }]));
}

/** Склад із бази — у порядку черги. Щось не того вигляду — пропускається. */
export function rosterFromRecord(record: unknown): RosterEntry[] | undefined {
	if (typeof record !== 'object' || record === null) return undefined;
	const entries = Object.entries(record as Record<string, { name?: unknown; seat?: unknown }>)
		.filter(([, value]) => typeof value?.name === 'string' && typeof value?.seat === 'number')
		.sort(
			([uidA, a], [uidB, b]) =>
				(a.seat as number) - (b.seat as number) || (uidA < uidB ? -1 : uidA > uidB ? 1 : 0)
		)
		.map(([uid, value]) => ({ uid, name: value.name as string }));
	return entries.length > 0 ? entries : undefined;
}

/** `info` із бази: склад — із мапи в чергу, решта — як лежить. */
export function infoFromDb(raw: RawInfo): RoomInfo {
	const { roster, ...rest } = raw;
	const party = rosterFromRecord(roster);
	return party ? { ...rest, roster: party } : rest;
}

/**
 * Знімок кімнати з сирого значення вузла `rooms/{code}`. `null` — кімнати немає.
 *
 * Номер ходу — З КЛЮЧА, а не з поля `seq`. Правило бази тримає ключ рівно в шести
 * цифрах, а поле — лише в межах тих самих шести, тож єдина правда про місце ходу
 * в журналі — ключ: розійтися з ним поле може лише в чужих руках, і тоді порядок
 * на різних пристроях розійшовся б теж.
 *
 * Порядок ЗАДАЄМО самі: покладатися на порядок ключів обʼєкта означало б грати
 * партію в різній послідовності на різних пристроях.
 */
export function snapshotFromDb(
	value: {
		info?: RawInfo;
		members?: Record<string, Omit<Member, 'uid'>>;
		moves?: Record<string, Move>;
	} | null
): RoomSnapshot | null {
	if (!value?.info) return null;
	return {
		info: infoFromDb(value.info),
		members: Object.entries(value.members ?? {}).map(([uid, member]) => ({ uid, ...member })),
		moves: Object.entries(value.moves ?? {})
			.map(([key, move]) => ({ ...move, seq: Number(key) }))
			.filter((move) => Number.isInteger(move.seq))
			.sort((a, b) => a.seq - b.seq)
	};
}

/**
 * КЛЮЧ ХОДУ — номер рівно шістьма цифрами (правило `moves/$seq`).
 *
 * RTDB упорядковує рядки лексикографічно, і при однаковій довжині це те саме, що
 * за числом: без вирівнювання «10» став би між «1» і «2». Одна функція на всіх, хто
 * пише ходи (`rtdbRoom`, `leave`): доти вирівнювання стояло трьома копіями (аудит
 * 2026-09-25), і четверта розійшлася б із ними першою ж правкою.
 */
export const moveKey = (seq: number): string => String(seq).padStart(6, '0');
