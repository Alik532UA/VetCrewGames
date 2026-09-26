import { listedSince } from './roomEntry';
import type { LobbyRoom } from '$lib/net/lobby';
import type { Seek } from '$lib/net/seek';
import type { OnlineGame } from './crossGame';

/**
 * ХТО КОГО ЗНАХОДИТЬ В АВТОМАТИЧНОМУ ПОШУКУ — чиста функція (рішення автора 2026-09-26).
 *
 * Людина вибрала ігри, у які згодна грати. Кандидатів два роди: відкрита кімната гри з
 * цього набору, де господар чекає сам, і чужий запис пошуку (`net/seek.ts`), чий набір
 * перетинається з моїм. Береться той, хто чекає НАЙДОВШЕ: кімната — від миті створення
 * (`listedSince`), запис — від свого `at`. Гра для запису — з перетину наборів, а коли
 * обидві — навмання: саме так «хто вибрав обидві» знаходить і того, хто вибрав одну.
 *
 * Версія правил звіряється тут, а не після спроби: зайти в кімнату іншої версії не
 * вийде, і пропонувати таку — запрошувати до відмови (те саме, що `quickPick`).
 *
 * ## Двоє, що чекають одне одного
 *
 * Натиснули майже разом — жоден не побачив іншого, і обидва поставили запис. Тепер вони
 * бачать одне одного, і якби кімнату створювали обидва, кожен вписав би свою в запис
 * іншого, і розійшлися б по різних кімнатах. Тому кімнату створює лише МОЛОДШИЙ
 * (`claimsFirst`: пізніший `at`, а при рівності — більший `uid`), а старший чекає далі.
 */

/** Гра → версія правил, за якою грає ця збірка. */
export type GameVersions = Partial<Record<OnlineGame, number>>;

/** Що робити цим кроком пошуку. */
export type SeekStep =
	| { kind: 'join'; code: string; gameId: OnlineGame }
	| { kind: 'claim'; uid: string; gameId: OnlineGame }
	| { kind: 'wait' };

export interface SeekInput {
	me: string;
	/** Ігри, у які я згоден грати, з версіями моєї збірки. */
	wanted: GameVersions;
	/** Відкриті кімнати обох ігор. */
	rooms: readonly LobbyRoom[];
	/** Записи пошуку без збігу — і мій серед них, якщо я вже чекаю. */
	seeks: readonly Seek[];
	/** Мій запис стоїть: тоді з записів беру лише старших за себе. */
	waiting: boolean;
	/**
	 * Записи, які цей пошук уже пробував забрати, і не вийшло. Без цього запис, що
	 * лишається в переліку, а правило його не віддає, брався б знову й знову — кожен
	 * раз зі створеною й закритою кімнатою (знайшов зворотний експеримент).
	 */
	passed?: readonly string[];
	/** Скільки гравців робить кімнату гри вже не вільною (`newRoom.ts`). */
	seats: Record<OnlineGame, number>;
	random: () => number;
}

const GAMES: readonly OnlineGame[] = ['pairs', 'quiz'];

/** Ігри, у які зіграємо обидва, — лише тієї самої версії правил. */
export function commonGames(mine: GameVersions, theirs: GameVersions): OnlineGame[] {
	return GAMES.filter((game) => mine[game] !== undefined && theirs[game] === mine[game]);
}

/** Чи `me` створює кімнату для `other`, коли обидва чекають: так — якщо `other` старший. */
export function claimsFirst(
	me: Pick<Seek, 'uid' | 'at'>,
	other: Pick<Seek, 'uid' | 'at'>
): boolean {
	return other.at < me.at || (other.at === me.at && other.uid < me.uid);
}

interface Candidate {
	since: number;
	step: { kind: 'join'; code: string; gameId: OnlineGame } | { kind: 'claim'; uid: string };
	games: OnlineGame[];
}

export function planSeek(input: SeekInput): SeekStep {
	const { me, wanted, rooms, seeks, waiting, seats, random, passed } = input;
	const candidates: Candidate[] = [];
	for (const room of rooms) {
		const gameId = GAMES.find((game) => game === room.gameId);
		if (!gameId || wanted[gameId] === undefined || room.rulesVersion !== wanted[gameId]) continue;
		if (room.hostUid === me || room.players >= seats[gameId]) continue;
		candidates.push({
			since: listedSince(room),
			step: { kind: 'join', code: room.code, gameId },
			games: [gameId]
		});
	}
	const mine = seeks.find((seek) => seek.uid === me) ?? null;
	for (const seek of seeks) {
		if (seek.uid === me || passed?.includes(seek.uid)) continue;
		const games = commonGames(wanted, seek.games);
		if (games.length === 0) continue;
		// Чекаю й сам — лише старшого за себе; свого запису не видно — чекаю, поки знайдуть мене.
		if (waiting && (mine === null || !claimsFirst(mine, seek))) continue;
		candidates.push({ since: seek.at, step: { kind: 'claim', uid: seek.uid }, games });
	}
	const oldest = candidates.sort((a, b) => a.since - b.since)[0];
	if (!oldest) return { kind: 'wait' };
	if (oldest.step.kind === 'join') return oldest.step;
	// Навмання — лише для вибраного: випадковість не витрачається на тих, кого не беремо.
	const gameId =
		oldest.games[Math.min(oldest.games.length - 1, Math.floor(random() * oldest.games.length))];
	return { kind: 'claim', uid: oldest.step.uid, gameId };
}
