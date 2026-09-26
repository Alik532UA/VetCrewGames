import { playerData } from '$lib/services/playerData.svelte';
import { logService } from '$lib/services/logService.svelte';
import { awayStamps, waitView, type WaitView } from '$lib/utils/awayWait';
import { ONLINE_GAMES, gamesToConfig, roomFitsGames } from '$lib/config/quizOnline';
import { QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { QuizMatch } from './quizMatch.svelte';
import type { RoomGame } from './roomGame';

/**
 * ВІКТОРИНА ДЛЯ СЕСІЇ КІМНАТИ — адаптер, стан чекання й реакції, що належать саме їй.
 *
 * Доти все це жило в маршруті, де його не бере жоден тест (аудит 2026-09-24):
 * оголошення раундів, пауза за відсутнім, набір ігор нової кімнати. Тепер —
 * клас, і його перевіряє `quizRoom.svelte.test.ts` на кімнаті в памʼяті.
 */

const CLOCK_MS = 1000;

/**
 * ГОДИННИК ПАРТІЇ ЙДЕ ЧАСТІШЕ ЗА СЕКУНДУ: на ньому смуга таймера раунду, а
 * раунд і триває сім секунд — секундні стрибки були б майже всією смугою.
 */
const ROUND_CLOCK_MS = 100;

/**
 * Скільки ведучий чекає, перш ніж оголосити раунд, який ЗАСТАВ уже простроченим.
 *
 * Прострочений з першого погляду — отже я не дивився, коли він став таким:
 * перезавантаження, приспана вкладка, щойно підхоплене ведення. Поки мене не було,
 * решта могла стояти на паузі через МЕНЕ, а записи паузи пишуться, коли вона
 * скінчилася, — тобто саме тоді, коли я повернувся. Доти ведучий оголошував
 * наступний раунд на першому ж такті, раніше, ніж ці записи доїжджали, і решта
 * втрачала залишок раунду, який простояла за вікном «Чекаємо» (аудит 2026-09-25).
 * Три секунди — стільки ж, скільки надбавка після чекання.
 */
export const LATE_ANNOUNCE_MS = 3000;

/** Двоє — мінімум, щоб змагатися. Більше вікторина витримує без змін. */
export const QUIZ_MIN_PLAYERS = 2;

/** Що реакціям треба від сесії кімнати. */
export interface QuizHost {
	readonly match: QuizMatch | null;
	readonly me: string;
	readonly clock: number;
	/** Код кімнати — для журналу: без нього рядок не скаже, де партія стояла. */
	readonly code: string;
}

export class QuizRoom {
	/**
	 * Які ігри вибрано для НОВОЇ кімнати. Типово всі: людина, яка створює кімнату
	 * не думаючи про набір, мусить отримати повну вікторину, а не порожню.
	 */
	picked = $state<string[]>(ONLINE_GAMES.map((game) => game.id));
	/** Коли гравця не стало онлайн. Ключ — `uid`; звідси відлік у вікні очікування. */
	awaySince = $state<Record<string, number>>({});

	/**
	 * Вікторина для сесії. Новачок у вже розпочату партію заходить ГРАВЦЕМ:
	 * відповідати він може з поточного раунду, а роздачі, яку він міг би
	 * перероздати, тут немає.
	 */
	readonly game: RoomGame<QuizMatch>;

	#host: QuizHost | null = null;

	/**
	 * `random` — звідки зерно нової кімнати: випадковість живе на сторінці, а не в
	 * контролері (`quizSeed.test.ts`). `factor` — множник часу раунду: у розробці
	 * раунд довший (`DEV_TIME_FACTOR`).
	 */
	constructor(random: () => number, factor = 1) {
		this.game = {
			gameId: 'quiz',
			rulesVersion: QUIZ_RULES_VERSION,
			minPlayers: QUIZ_MIN_PLAYERS,
			quickSeats: QUIZ_MIN_PLAYERS,
			lateRole: 'player',
			autoStartReady: (players) => players >= QUIZ_MIN_PLAYERS,
			// НАБІР ІГОР ЇДЕ В `config` — конверт уже дозволяє `Record<string, number>`.
			newRoom: () => ({
				seed: Math.floor(random() * 2 ** 31),
				config: gamesToConfig(this.picked)
			}),
			createMatch: (me, transport) => {
				// Нова кімната — новий відлік: позначки відсутності СТАРОЇ кімнати тут нічого не
				// означають, а той самий гравець у новій показував би чужий час (аудит 2026-09-26).
				this.awaySince = {};
				return new QuizMatch(me, transport, factor);
			},
			// Набір і в записі переліку: `rooms` перелічувати заборонено, тож фільтр списку
			// бачить про чужу кімнату рівно те, що в самому записі. Набір — КІМНАТИ, а не
			// фільтра на формі входу: доти господар, що звузив набір у лобі й
			// перезавантажився, оголошував кімнату з усіма шістьма іграми, а після
			// перехоплення — з фільтром нового господаря (аудит 2026-09-25).
			listingExtras: (match) => ({ games: gamesToConfig(match.games) }),
			// «Швидка гра» без фільтра кидала б у кімнату з іграми, які людина щойно зняла.
			fitsQuick: (room) => roomFitsGames(room.games, this.picked),
			onPresence: (match, uids, now) => {
				// ПРИСУТНІСТЬ ЇДЕ В МАТЧ, і саме це розморожує партію: раунд закінчується,
				// коли відповіли ПРИСУТНІ, а не всі, хто колись зайшов.
				match.present = uids;
				this.awaySince = awayStamps(match.players, uids, this.awaySince, now);
			},
			award: (match, me) => {
				// Глядач лише дивився — бали не його (той самий запобіжник, що в «Знайди пару»).
				if (match.iAmSpectator) return;
				playerData.awardQuizMatch(match.scores[me] ?? 0);
			},
			clockEvery: (match) => {
				if (match.countdownAt !== null && match.status !== 'playing') return CLOCK_MS;
				if (match.status === 'playing' && !match.over) return ROUND_CLOCK_MS;
				return match.away.length > 0 ? ROUND_CLOCK_MS : null;
			}
		};
	}

	/**
	 * Усе про чекання одним значенням — правила живуть у `utils/awayWait`: пауза й
	 * зникнення дають один відлік і одне вікно.
	 */
	get wait(): WaitView {
		const host = this.#host;
		return waitView(host?.match ?? null, this.awaySince, host?.clock ?? 0, host?.me ?? '');
	}

	/**
	 * Поставити реакції вікторини. Кличе сторінка під час ініціалізації, тож ефекти
	 * гаснуть разом із нею — той самий взірець, що `roomPolicies`.
	 */
	attach(host: QuizHost): void {
		this.#host = host;

		/*
		 * НАСТУПНИЙ РАУНД ОГОЛОШУЄ ВЕДУЧИЙ — ведучий із журналу, а не господар
		 * кімнати (`utils/quizReplay.ts`), — і рівно один раз: ефект перезапускається
		 * на кожен такт годинника, а «час таблу вийшов» лишається правдою, доки раунд
		 * не змінився. Відмову бази стримує пауза між спробами (`ANNOUNCE_RETRY_MS`).
		 */
		let announcing = false;
		/** Раунд, який я вперше побачив, коли й чи був він тоді вже простроченим. */
		let look = { round: -2, at: 0, late: false };
		/**
		 * Мить, коли чекання скінчилося; `Infinity` — воно триває.
		 *
		 * ПІСЛЯ ЧЕКАННЯ — ДАТИ ДОЇХАТИ ЧУЖИМ ЗАПИСАМ ПРО НЬОГО (аудит 2026-09-26). Облік
		 * чекання в кожного свій, від миті, коли ВІН його побачив: ведучий, що
		 * перезавантажився посеред чужої паузи, рахує її від перезавантаження. Доти
		 * він оголошував наступний раунд на тому самому такті, на якому паузу знято, —
		 * раніше, ніж доїжджали записи тих, хто простояв її всю, — і решта губила
		 * залишок раунду, обіцяний паузою. Той самий випадок — з чеканням на
		 * зниклого.
		 */
		let heldTill = -Infinity;
		$effect(() => {
			const match = host.match;
			if (this.wait.hold) heldTill = Infinity;
			else if (heldTill === Infinity) heldTill = host.clock;
			const leads = host.me !== '' && match?.leader === host.me;
			if (!match || !leads || match.status !== 'playing' || match.over || announcing) return;
			const due = match.round >= 0 && match.nextDue(host.clock);
			if (look.round !== match.round) look = { round: match.round, at: host.clock, late: due };
			else if (!due) look.late = false;
			// Партія щойно почалася — перший раунд оголошується без чекання.
			const next = match.round < 0 ? 0 : due ? match.round + 1 : null;
			if (next === null) return;
			// ПАРТІЯ ЧЕКАЄ — і між раундами теж. Доти наступний раунд оголошувався під
			// вікном «Чекаємо» на весь екран і йшов без жодного продовження (аудит 2026-09-25).
			// Чекання щойно скінчилося — ще `LATE_ANNOUNCE_MS` (див. `heldTill`).
			if (host.clock < heldTill + LATE_ANNOUNCE_MS) return;
			if (look.late && host.clock - look.at < LATE_ANNOUNCE_MS) return;
			announcing = true;
			void match.startRound(next).finally(() => (announcing = false));
		});

		/*
		 * Пауза раунду — наслідок стану чекання. Саме `$effect`, а не похідна: зсув
		 * дедлайну — це ЗМІНА стану партії.
		 *
		 * І В ЖУРНАЛ — коли чекання почалося й скінчилося (аудит 2026-09-25): доти
		 * звіт про «вікторина зависла» не мав з чим звіритися — ні коли партія стала,
		 * ні чи через паузу, ні скільки людей бракувало.
		 */
		let holding = false;
		$effect(() => {
			const match = host.match;
			const hold = this.wait.hold;
			match?.setHold(hold, host.clock);
			if (!match || hold === holding) return;
			holding = hold;
			logService.info('network', hold ? 'quiz hold opened' : 'quiz hold released', {
				code: host.code,
				round: match.round,
				away: match.awayOthers.length,
				paused: match.pausedBy !== null
			});
		});
	}
}
