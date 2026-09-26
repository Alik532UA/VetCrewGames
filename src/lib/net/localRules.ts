import { MOVE_SEQ_MAX } from './roomShape';
import type { Member, Move, RoomInfo, RosterEntry } from './roomTypes';

/**
 * ДЗЕРКАЛО ПРАВИЛ БАЗИ ДЛЯ КІМНАТИ В ПАМʼЯТІ (`LocalRoom`) — в одному місці.
 *
 * Правила спільної партії перевіряються на `LocalRoom`, тож чого б вона не
 * пропустила, того й тести не побачать. Тут ті самі умови, що в
 * `database.rules.json`, чистими функціями; контракт транспорту
 * (`transport.emulator.test.ts`) звіряє їх зі справжніми правилами над емулятором.
 *
 * `caller` — хто пише, якщо транспорт це знає (`LocalTransportOptions.as`). Без
 * нього перевіряється все, крім особи: так поводилися всі тести до появи поля
 * (аудит 2026-09-26 — доти підставка не знала, хто за нею сидить, і гість на ній
 * міняв налаштування й починав партію, чого база не дає).
 */

/** Що бачить правило: стан кімнати ДО запису. */
export interface RoomState {
	info: RoomInfo;
	members: readonly Member[];
	moves: readonly Move[];
	/** Хто на звʼязку; `null` — присутність не задано, тобто господар на місці. */
	present: ReadonlySet<string> | null;
}

const count = (max: number) => (value: unknown) =>
	typeof value === 'number' && value >= 0 && value <= max;
const short = (value: unknown) => typeof value === 'string' && value.length <= 32;

/** Поля ходу та їхні межі — ті самі, що в правилі `moves/$seq/payload`. */
const PAYLOAD: Record<string, (value: unknown) => boolean> = {
	index: count(999),
	from: short,
	round: count(9999),
	correct: count(1),
	ms: count(86_400_000),
	uid: short,
	spent: count(86_400_000)
};

/** Номер ходу — від 1 до `MOVE_SEQ_MAX`, як у правилі `moves/$seq`. */
export const validSeq = (seq: number): boolean =>
	Number.isInteger(seq) && seq >= 1 && seq <= MOVE_SEQ_MAX;

/** Поля ходу — рівно ті, що пускає правило: відомі імена з їхніми межами. */
export function validPayload(payload: Move['payload']): boolean {
	if (payload === undefined) return true;
	return Object.entries(payload).every(([key, value]) => {
		const rule = PAYLOAD[key];
		return rule !== undefined && rule(value);
	});
}

/** Правило `info/roster`: кожен — гравець складу кімнати, імʼя — його. */
export function rosterAllowed(roster: readonly RosterEntry[], members: readonly Member[]): boolean {
	return roster.every((entry) =>
		members.some(
			(member) => member.uid === entry.uid && member.role === 'player' && member.name === entry.name
		)
	);
}

/** Писати `info` — лише господареві (правило `info/.write`). */
export const hostOnly = (state: RoomState, caller?: string): boolean =>
	caller === undefined || caller === state.info.hostUid;

/** Прибрати рядок складу — себе завжди, іншого — лише господар (`members/$uid`). */
export const removeAllowed = (state: RoomState, uid: string, caller?: string): boolean =>
	caller === undefined || caller === uid || caller === state.info.hostUid;

/** Позначка життя — від учасника кімнати (`info/aliveAt`). */
export const touchAllowed = (state: RoomState, caller?: string): boolean =>
	caller === undefined || state.members.some((member) => member.uid === caller);

/**
 * Правило `moves/$seq`: лише створити, лише від себе й лише учасником; посеред
 * партії «Знайди пару» — лише склад старту; `lead` — лише як частина передачі.
 */
export function moveAllowed(state: RoomState, move: Move, caller?: string): boolean {
	const { info, members, moves } = state;
	if (caller !== undefined && move.by !== caller) return false;
	if (!members.some((member) => member.uid === move.by)) return false;
	// Поза партією — лише `lead` (A2): у лобі й після партії гри немає.
	if (info.status !== 'playing' && move.type !== 'lead') return false;
	const party = info.status !== 'playing' || info.gameId === 'quiz';
	if (!party && !(info.roster ?? []).some((entry) => entry.uid === move.by)) return false;
	if (!validSeq(move.seq) || !validPayload(move.payload)) return false;
	if (moves.some((existing) => existing.seq === move.seq)) return false;
	if (move.type === 'lead') {
		return move.by === info.hostUid && move.payload?.from === info.hostUid;
	}
	return true;
}

/**
 * Правило `moves` (стерти журнал) разом зі `status`/`seed` (A2): посеред партії журнал
 * стирає лише реванш — із новим зерном; дубль старту партію не зітре.
 */
export const wipeAllowed = (state: RoomState, seed: number): boolean =>
	state.info.status !== 'playing' || seed !== state.info.seed;

/** Правило `info/config` (A2): у лобі або разом із порожнім журналом. */
export const configAllowed = (state: RoomState): boolean =>
	state.info.status === 'lobby' || state.moves.length === 0;

/**
 * Правило `info/hostUid` разом із ходом `lead`: автор — гравець (у лобі) чи зі
 * складу (посеред партії), він на звʼязку, господаря на звʼязку немає, у `from` —
 * саме господар, номер вільний.
 */
export function leadAllowed(state: RoomState, move: Move, caller?: string): boolean {
	const { info, members, moves, present } = state;
	if (caller !== undefined && move.by !== caller) return false;
	const author = members.find((member) => member.uid === move.by);
	const inParty =
		info.status === 'lobby'
			? author?.role === 'player'
			: (info.roster ?? []).some((entry) => entry.uid === move.by);
	const hostAway = present !== null && !present.has(info.hostUid);
	const authorHere = present !== null && present.has(move.by);
	if (!inParty || !hostAway || !authorHere) return false;
	if (move.type !== 'lead' || move.payload?.from !== info.hostUid) return false;
	return validSeq(move.seq) && !moves.some((existing) => existing.seq === move.seq);
}
