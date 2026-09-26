import { SEEK_FETCH, seeksFromDb, type Seek, type SeekMatch, type SeekNet } from './seek';

/** Кімната збігу — рівно те, що з неї читає правило `seek/$uid/match`. */
export interface SeekRoom {
	hostUid: string;
	status: string;
	gameId: string;
	rulesVersion: number;
}

interface Entry {
	games: Seek['games'];
	at: number;
	match?: SeekMatch;
}

/**
 * ПОШУК У ПАМʼЯТІ — дзеркало правил гілки `seek` для тестів, як `LocalRoom` для кімнати.
 *
 * Правила тут ті самі, що в `database.rules.json`, і контракт обох реалізацій —
 * `seek.emulator.test.ts`: збіг лише створюється, лише господарем своєї кімнати в лобі
 * й лише на гру тієї версії, яку шукач просив; перелік — найновіші `SEEK_FETCH` записів,
 * без тих, що вже мають збіг. Кімнати дошка не тримає — їх показує `room`.
 */
export class LocalSeekBoard {
	readonly #seeks = new Map<string, Entry>();
	readonly #delivered = new Map<string, (match: SeekMatch) => void>();
	readonly #now: () => number;
	readonly #room: (code: string) => SeekRoom | null;

	constructor({
		now = Date.now,
		room = () => null
	}: { now?: () => number; room?: (code: string) => SeekRoom | null } = {}) {
		this.#now = now;
		this.#room = room;
	}

	/** Мережа пошуку очима `uid` — хто пише, той і названий, як у правилі. */
	as(uid: string): SeekNet {
		return {
			list: async () => this.#list(),
			open: async (games, onMatch) => {
				if (!Object.keys(games).some((game) => game === 'pairs' || game === 'quiz')) {
					throw new Error('PERMISSION_DENIED: seek without games');
				}
				this.#seeks.set(uid, { games: { ...games }, at: this.#now() });
				let done = false;
				this.#delivered.set(uid, (match) => {
					if (done) return;
					done = true;
					onMatch(match);
				});
				const stop = () => {
					done = true;
					this.#forget(uid);
				};
				return {
					stop,
					withdraw: async () => {
						const wasDone = done;
						const match = this.#seeks.get(uid)?.match ?? null;
						stop();
						return wasDone ? null : match;
					}
				};
			},
			claim: async (owner, match) => {
				const seek = this.#seeks.get(owner);
				const room = this.#room(match.code);
				const fits =
					seek !== undefined &&
					seek.match === undefined &&
					room !== null &&
					room.hostUid === uid &&
					room.status === 'lobby' &&
					room.gameId === match.gameId &&
					room.rulesVersion === seek.games[match.gameId];
				if (!fits) return false;
				seek.match = { ...match };
				this.#delivered.get(owner)?.(seek.match);
				return true;
			}
		};
	}

	/** Той, хто зник без виходу: `onDisconnect` у базі знімає запис сам. */
	disconnect(uid: string): void {
		this.#forget(uid);
	}

	#forget(uid: string): void {
		this.#seeks.delete(uid);
		this.#delivered.delete(uid);
	}

	/** Як запит `orderByChild('at').limitToLast(SEEK_FETCH)`: вікно — до відсіву збігів. */
	#list(): Seek[] {
		const newest = [...this.#seeks].sort(([, a], [, b]) => a.at - b.at).slice(-SEEK_FETCH);
		return seeksFromDb(Object.fromEntries(newest));
	}
}
