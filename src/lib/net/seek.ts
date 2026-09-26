import { connect } from './firebase';
import { isDenied } from './denied';
import { keepNode } from './presence';
import { logService } from '$lib/services/logService.svelte';
import type { OnlineGame } from '$lib/utils/crossGame';

/**
 * АВТОМАТИЧНИЙ ПОШУК — запис «шукаю гру» (рішення автора 2026-09-26).
 *
 * Людина вибирає, у які ігри згодна грати, і якщо вільної кімнати немає — чекає. Не в
 * кімнаті: кімната в базі завжди однієї гри, а той, хто чекає, згоден на будь-яку зі
 * своїх. Тому чекає ЗАПИС — «універсальна кімната очікування», яка ще не знає своєї гри:
 *
 * ```
 * seek/{uid}  { games: { pairs?: версія, quiz?: версія }, at, match?: { code, gameId } }
 * ```
 *
 * Версія — це версія правил гри в збірці того, хто чекає (`config/roomRules.ts`). Другий
 * шукач, чий набір перетинається, створює кімнату гри з перетину й вписує її код у
 * `match`; правило пускає це раз, лише господареві кімнати в лобі й лише для гри тієї
 * самої версії. Хто кого шукає й яку гру брати — `utils/seekPlan.ts`; тут лише мережа.
 *
 * Запис один на людину (ключ — `uid`) і гасне сам: `onDisconnect` тримає `keepNode`, як
 * присутність; застарілий, що пережив обрив, зносить прибиральник.
 */

/** Чужий (або свій) запис пошуку. */
export interface Seek {
	uid: string;
	/** Гра → версія правил, за якою ця людина грає. */
	games: Partial<Record<OnlineGame, number>>;
	/** Серверна мить запису. */
	at: number;
}

/** Збіг: кімната, куди йти. */
export interface SeekMatch {
	code: string;
	gameId: OnlineGame;
}

/** Мій запис, поки він стоїть. */
export interface SeekHandle {
	/**
	 * Зняти запис — ЛИШЕ якщо збігу ще немає, однією транзакцією. Повертає збіг, якщо
	 * він устиг: той, хто чекав і сам вирушив шукати, інакше розминувся б із тим, хто
	 * саме цієї миті знайшов його.
	 */
	withdraw(): Promise<SeekMatch | null>;
	/** Перестати чекати й зняти запис без перевірки: збіг уже прийнято або людина пішла. */
	stop(): void;
}

/** Скільки записів читати: правило пускає лише обмежений запит (як у переліку кімнат). */
export const SEEK_FETCH = 25;

/**
 * УСЕ, ЩО ПОШУКОВІ ТРЕБА ВІД МЕРЕЖІ, — інтерфейсом, як `RoomNet`: у тестах —
 * `net/localSeek.ts`, у житті — `liveSeekNet` нижче; контракт обох —
 * `seek.emulator.test.ts`.
 */
export interface SeekNet {
	/** Записи тих, хто чекає, — і мій теж, — без тих, що вже мають збіг; старші першими. */
	list(): Promise<Seek[]>;
	/** Поставити свій запис і чекати. `onMatch` кличеться раз, коли хтось вписав збіг. */
	open(games: Seek['games'], onMatch: (match: SeekMatch) => void): Promise<SeekHandle>;
	/** Вписати свою кімнату в чужий запис. `false` — хтось устиг раніше або запису вже немає. */
	claim(uid: string, match: SeekMatch): Promise<boolean>;
}

const GAMES: readonly OnlineGame[] = ['pairs', 'quiz'];

/** Збіг із сирого вузла; що завгодно інше — `null`. */
export function matchOf(raw: unknown): SeekMatch | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const { code, gameId } = raw as { code?: unknown; gameId?: unknown };
	const game = GAMES.find((known) => known === gameId);
	return typeof code === 'string' && game ? { code, gameId: game } : null;
}

/** Сира гілка → записи без збігу, старші першими. Без ігор чи часу — не запис. */
export function seeksFromDb(raw: unknown): Seek[] {
	const seeks: Seek[] = [];
	const all = typeof raw === 'object' && raw !== null ? raw : {};
	for (const [uid, value] of Object.entries(all as Record<string, unknown>)) {
		if (typeof value !== 'object' || value === null) continue;
		const entry = value as { games?: unknown; at?: unknown; match?: unknown };
		if (entry.match !== undefined || typeof entry.at !== 'number') continue;
		const listed = (typeof entry.games === 'object' && entry.games) || {};
		const games: Seek['games'] = {};
		for (const game of GAMES) {
			const version = (listed as Record<string, unknown>)[game];
			if (typeof version === 'number') games[game] = version;
		}
		if (Object.keys(games).length > 0) seeks.push({ uid, games, at: entry.at });
	}
	return seeks.sort((a, b) => a.at - b.at);
}

export const liveSeekNet: SeekNet = {
	async list() {
		const { db } = await connect();
		const { get, limitToLast, orderByChild, query, ref } = await import('firebase/database');
		// Запит, а не читання гілки: правило вимагає саме порядку за `at` і межі.
		const branch = query(ref(db, 'seek'), orderByChild('at'), limitToLast(SEEK_FETCH));
		return seeksFromDb((await get(branch)).val());
	},

	async open(games, onMatch) {
		const { uid, db } = await connect();
		const { onValue, ref, remove, runTransaction, serverTimestamp } =
			await import('firebase/database');
		const node = ref(db, `seek/${uid}`);
		/*
		 * СПЕРШУ ЗНЯТИ СТАРЕ. Запис минулого пошуку, який не зняли (обрив посеред виходу),
		 * міг лишитися зі збігом: правило не дає затерти збіг перезаписом, тож новий запис
		 * відхилили б, а підписка привела б у стару кімнату.
		 */
		await remove(node);
		/** Збіг прийнято або запис знято: більше не ставити його після обриву. */
		let done = false;
		const kept = await keepNode(
			`seek/${uid}`,
			() => (done ? null : { games, at: serverTimestamp() }),
			(error) => logService.warn('network', 'seek not restored', { reason: String(error) })
		);
		try {
			await kept.ready;
		} catch (error) {
			kept.stop();
			throw error;
		}
		/*
		 * СЛУХАТИ ЗБІГ — ЛИШЕ ПІСЛЯ ПЕРШОГО ЗАПИСУ. Раніше підписка встигала побачити
		 * старий збіг (коли `remove` вище не дійшов), `done` ставало `true`, і `keepNode`
		 * більше нічого не писав — `ready` не встановлювалось ніколи, і пошук висів
		 * (заміряно зворотним експериментом над емулятором). Тепер старий збіг дає
		 * відмову запису — вголос, — а новий приходить у підписку одразу: `onValue`
		 * віддає й те, що вже лежить.
		 */
		const unMatch = onValue(
			ref(db, `seek/${uid}/match`),
			(snapshot) => {
				const match = matchOf(snapshot.val());
				if (!match || done) return;
				done = true;
				onMatch(match);
			},
			(error) => logService.warn('network', 'seek not watched', { reason: String(error) })
		);
		const stop = () => {
			done = true;
			unMatch();
			kept.stop();
		};
		return {
			stop,
			async withdraw() {
				// Спершу `done`: інакше `keepNode`, що стежить за вузлом, поставив би його знову.
				const wasDone = done;
				done = true;
				const result = await runTransaction(node, (current: { match?: unknown } | null) =>
					current?.match ? undefined : null
				);
				unMatch();
				kept.stop();
				// Збіг, що вже прийшов підпискою, віддає `onMatch`, а не цей виклик.
				return result.committed || wasDone ? null : matchOf(result.snapshot.child('match').val());
			}
		};
	},

	async claim(uid, match) {
		const { db } = await connect();
		const { ref, set } = await import('firebase/database');
		try {
			await set(ref(db, `seek/${uid}/match`), { code: match.code, gameId: match.gameId });
			return true;
		} catch (error) {
			// Відмова — це «устигли раніше» або «запис уже зняли»: шукати далі, а не падати.
			if (!isDenied(error)) throw error;
			return false;
		}
	}
};
