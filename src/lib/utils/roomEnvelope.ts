import type { Member, RoomSnapshot, RoomStatus, RosterEntry } from '$lib/net/roomTypes';

/**
 * СПІЛЬНІ ПОЛЯ КІМНАТИ — ті, що обидва матчі тримають однаково.
 *
 * Доти вісім полів `info` копіювалися в `PairsMatch` і `QuizMatch` рядок у рядок,
 * і кожне нове поле кімнати мусило не забутися двічі (аудит 2026-09-25). Тепер
 * знімок розкладається тут один раз, а матч лише приймає розклад — і додає своє
 * (роздачу, програму раундів).
 */
export interface RoomEnvelope {
	members: Member[];
	/** Заморожений склад партії; `null` — лобі або кімната старша за поле. */
	roster: RosterEntry[] | null;
	status: RoomStatus;
	hostUid: string;
	countdownAt: number | null;
	autoStart: boolean;
	/** Кімната публічна (`RoomInfo.listed`). */
	listed: boolean;
	/** Код кімнати, у яку гра переїхала; `null` — нікуди. */
	nextCode: string | null;
}

/** Розклад знімка на спільні поля. Відсутнє поле — його значення «за замовчуванням». */
export function envelopeOf(snapshot: RoomSnapshot): RoomEnvelope {
	const { info } = snapshot;
	return {
		members: snapshot.members,
		roster: info.roster ?? null,
		status: info.status,
		hostUid: info.hostUid,
		countdownAt: info.countdownAt ?? null,
		autoStart: info.autoStart === true,
		listed: info.listed === true,
		nextCode: info.nextCode ?? null
	};
}
