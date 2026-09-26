import type { NewRoom } from './rtdbRoom';
import type { Member, RoomInfo, RoomTransport } from './roomTypes';
import { startRoomBeat } from './roomBeat';

/**
 * УСЕ, ЩО СЕСІЇ КІМНАТИ ПОТРІБНО ВІД МЕРЕЖІ, — одним інтерфейсом.
 *
 * Доти обидві сторінки спільної гри кликали мережу напряму, і тому їхня
 * оркестровка — вхід, присутність, перелік, відлік, нагорода, дії господаря — не
 * мала жодного тесту: без бази її нема на чому перевірити (аудит 2026-09-23).
 * `RoomSession` бере мережу з цього інтерфейсу, і тест підставляє кімнату в
 * памʼяті.
 *
 * Модулі мережі — ДИНАМІЧНИМИ імпортами: SDK бази не мусить лежати в першому
 * завантаженні сторінки.
 */
export interface RoomNet {
	createRoom(options: NewRoom): Promise<string>;
	/**
	 * Зайти або повернутися. `newcomer` — роль того, кого в складі ще немає (у
	 * розпочату партію «Знайди пару» новачок заходить глядачем).
	 */
	joinRoom(
		code: string,
		name: string,
		role: Member['role'] | undefined,
		country: string | undefined,
		avatar: string | undefined,
		newcomer: Member['role']
	): Promise<void>;
	peekRoom(code: string): Promise<RoomInfo | null>;
	roomTransport(code: string): Promise<RoomTransport>;
	closeRoom(code: string): Promise<void>;
	/** Хто я в базі — `uid` сесії. */
	me(): Promise<string>;
	trackPresence(code: string): Promise<() => void>;
	watchPresence(code: string, onChange: (online: string[]) => void): Promise<() => void>;
	watchConnected(onChange: (connected: boolean) => void): Promise<() => void>;
	/** Серцебиття кімнати, поки вона на екрані. */
	beat(code: string): () => void;
	/** Чи діють у базі ті самі правила, що лежать у цій збірці (`net/rulesLive.ts`). */
	checkRules(): Promise<'fresh' | 'stale' | 'unknown'>;
}

/** Справжня мережа. */
export const liveNet: RoomNet = {
	createRoom: async (options) => (await import('./rtdbRoom')).createRoom(options),
	joinRoom: async (code, name, role, country, avatar, newcomer) =>
		(await import('./rtdbRoom')).joinRoom(code, name, role, country, avatar, newcomer),
	peekRoom: async (code) => (await import('./rtdbRoom')).peekRoom(code),
	roomTransport: async (code) => (await import('./rtdbRoom')).roomTransport(code),
	closeRoom: async (code) => (await import('./rtdbRoom')).closeRoom(code),
	me: async () => (await (await import('./firebase')).connect()).uid,
	trackPresence: async (code) => (await import('./presence')).trackPresence(code),
	watchPresence: async (code, onChange) =>
		(await import('./presence')).watchPresence(code, onChange),
	watchConnected: async (onChange) => (await import('./presence')).watchConnected(onChange),
	beat: (code) => startRoomBeat(code),
	checkRules: async () => (await (await import('./rulesLive')).checkLiveRules()).state
};
