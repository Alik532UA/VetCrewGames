import type { Member, RoomSnapshot, RoomStatus, RosterEntry } from '$lib/net/roomTypes';
import { uniqueAvatars } from './roomAvatars';

/**
 * СПІЛЬНІ ПОЛЯ КІМНАТИ — ті, що обидва матчі тримають однаково.
 *
 * Доти вісім полів `info` копіювалися в `PairsMatch` і `QuizMatch` рядок у рядок,
 * і кожне нове поле кімнати мусило не забутися двічі (аудит 2026-09-25). Тепер
 * знімок розкладається тут один раз, а матч лише приймає розклад — і додає своє
 * (роздачу, програму раундів).
 *
 * Обидва матчі `implements RoomEnvelope` (аудит 2026-09-26): `Object.assign` типів не
 * перевіряє, і поле, перейменоване в конверті, у матчі мовчки лишилося б старим.
 */
export interface RoomEnvelope {
	/**
	 * Склад з УНІКАЛЬНИМИ аватарками (`uniqueAvatars`): повтор пари розвʼязано тут,
	 * один раз на обидві гри, — тож кожен екран кімнати (лобі, табло, дошка) бачить
	 * те саме, що й решта учасників.
	 */
	members: Member[];
	/**
	 * Кого з учасників замінено: uid → пара, яку показують замість його власної.
	 * Сесія переписує свій рядок складу цією парою (`RoomSession.takeAvatar`).
	 */
	avatarSwaps: Record<string, string>;
	/** Заморожений склад партії; `null` — лобі або кімната старша за поле. */
	roster: readonly RosterEntry[] | null;
	status: RoomStatus;
	hostUid: string;
	countdownAt: number | null;
	autoStart: boolean;
	/** Кімната публічна (`RoomInfo.listed`). */
	listed: boolean;
	/** Код кімнати, у яку гра переїхала; `null` — нікуди. */
	nextCode: string | null;
	/** Коли кімнату створено (серверний час); `null` — кімната старша за поле. */
	createdAt: number | null;
}

/** Розклад знімка на спільні поля. Відсутнє поле — його значення «за замовчуванням». */
export function envelopeOf(snapshot: RoomSnapshot): RoomEnvelope {
	const { info } = snapshot;
	// Сіль — мітка створення: спільна для всіх учасників і стала, поки кімната жива.
	const avatars = uniqueAvatars(snapshot.members, info.createdAt ?? 0);
	return {
		members: avatars.members,
		avatarSwaps: avatars.swaps,
		roster: info.roster ?? null,
		status: info.status,
		hostUid: info.hostUid,
		countdownAt: info.countdownAt ?? null,
		autoStart: info.autoStart === true,
		listed: info.listed === true,
		nextCode: info.nextCode ?? null,
		createdAt: info.createdAt ?? null
	};
}
