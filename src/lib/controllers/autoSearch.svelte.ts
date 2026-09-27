import { PAIRS_RULES_VERSION, QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { logService } from '$lib/services/logService.svelte';
import { planSeek, type GameVersions, type SeekStep } from '$lib/utils/seekPlan';
import { logFailure, type Diagnosis } from './diagnose';
import { PAIRS_PLAYERS, QUIZ_MIN_PLAYERS } from './newRoom';
import { toast } from './toast.svelte';
import type { LobbyRoom } from '$lib/net/lobby';
import type { Seek, SeekHandle, SeekMatch, SeekNet } from '$lib/net/seek';
import type { OnlineGame } from '$lib/utils/crossGame';

/**
 * «АВТОМАТИЧНИЙ ПОШУК» НА ХАБІ «ГРАТИ ОНЛАЙН» (рішення автора 2026-09-26).
 *
 * Людина вмикає ігри, у які згодна грати (хоч одну), і натискає «шукати». Далі — кроками,
 * кожен вирішує `utils/seekPlan.ts`:
 *
 *  • є відкрита кімната або чужий запис пошуку, що чекає довше за всіх, — туди: у кімнату
 *    заходимо, а для запису створюємо кімнату гри з перетину й вписуємо її в запис;
 *  • нікого — ставимо свій запис («універсальна кімната очікування», `net/seek.ts`) і
 *    раз на `SEEK_POLL_MS` дивимося знову: так двоє, що натиснули разом, знаходять одне
 *    одного, а той, хто чекає, помічає кімнату, що відкрилася.
 *
 * Хто вирушає шукати з відкритим записом, спершу знімає його ТРАНЗАКЦІЄЮ
 * (`SeekHandle.withdraw`): збіг, що саме їхав, інакше розвів би двох по різних кімнатах.
 *
 * ## Кімната під збіг — приватна, і партнера чекають ТУТ
 *
 * Створена для запису кімната поза переліком (її знає лише той, кого знайшли) і з
 * автостартом. Той, хто її створив, лишається на хабі, доки партнер не зʼявиться в її
 * присутності, а тоді йде туди сам. Не прийшов за `PARTNER_WAIT_MS` (запис-привид: вкладка
 * зникла, а сервер ще не помітив) — кімната закривається, і пошук іде далі. Так уся
 * механіка пошуку живе тут, а сторінка кімнати про пошук не знає нічого. Перехоплення
 * ведення цим секундам не заважає: воно чекає `LEAD_AFTER_MS`, тобто двадцять.
 */

/** Як часто той, хто чекає, дивиться знову: записи пошуку читаються запитом, а не підпискою. */
export const SEEK_POLL_MS = 4000;

/** Скільки той, хто створив кімнату під збіг, чекає партнера, перш ніж шукати далі. */
export const PARTNER_WAIT_MS = 20_000;

/** Пауза після запису, який забрати не вдалося: наступний крок — не одразу. */
export const CLAIM_RETRY_MS = 1000;

/**
 * `searching` — крок пошуку в дорозі; `waiting` — мій запис стоїть; `found` — пару знайдено:
 * або йдемо в кімнату, або чекаємо в ній партнера.
 */
export type SearchPhase = 'idle' | 'searching' | 'waiting' | 'found';

/**
 * КРОК, НА ЯКОМУ ПОШУК УПАВ, — для журналу (прохання автора 2026-09-27). Кожен крок —
 * інше правило бази, і «Permission denied» без кроку не каже, котре з них відмовило:
 *
 *  • `sign-in`     — вхід (анонімний) і підпис гравця;
 *  • `list`        — запит записів `seek` (правило пускає лише обмежений запит за `at`);
 *  • `open`        — свій запис `seek/{uid}`;
 *  • `withdraw`    — зняти свій запис транзакцією, перш ніж забирати чужий;
 *  • `create-room` — кімната під збіг, `rooms/{code}`;
 *  • `claim`       — вписати кімнату в чужий запис, `seek/{uid}/match`.
 */
export type SearchStep = 'sign-in' | 'list' | 'open' | 'withdraw' | 'create-room' | 'claim';

/** Усе, що пошуку треба від мережі й сторінки, — щоб тест підставив своє. */
export interface SearchDeps {
	seek: SeekNet;
	me(): Promise<string>;
	/** Відкриті кімнати обох ігор, як їх зараз бачить хаб. */
	rooms(): readonly LobbyRoom[];
	/** Приватна кімната гри з автостартом, від мого імені. Повертає код. */
	createRoom(gameId: OnlineGame): Promise<string>;
	closeRoom(code: string): Promise<void>;
	/** Скільки в кімнаті інших — підписка (`net/presence.ts`, `watchOthers`). */
	watchOthers(code: string, onCount: (others: number) => void): Promise<() => void>;
	/** Піти в кімнату: сторінка гри з `?room`. */
	go(gameId: OnlineGame, code: string): void;
	random: () => number;
	/**
	 * Чи є мережа взагалі (`navigator.onLine`). Без неї пошук не падає, а висить: `get()`
	 * бази не відмовляє, а чекає звʼязку, — тож «немає звʼязку» кажемо ДО першого кроку.
	 */
	online(): boolean;
	/** Назвати причину збою (`controllers/diagnose.ts`). Не кидає. */
	diagnose(error: unknown): Promise<Diagnosis>;
}

const VERSIONS: Record<OnlineGame, number> = {
	pairs: PAIRS_RULES_VERSION,
	quiz: QUIZ_RULES_VERSION
};
const SEATS: Record<OnlineGame, number> = { pairs: PAIRS_PLAYERS, quiz: QUIZ_MIN_PLAYERS };

export class AutoSearch {
	/** У які ігри людина згодна грати. Обидві — типово (рішення автора, 3-A). */
	games = $state<OnlineGame[]>(['quiz', 'pairs']);
	phase = $state<SearchPhase>('idle');

	/** Номер пошуку: росте на скасуванні й на збігу, і все, що доїхало пізніше, застаріло. */
	#run = 0;
	#handle: SeekHandle | null = null;
	/** Кімната, створена під збіг, поки партнер не прийшов: скасування мусить її закрити. */
	#room: string | null = null;
	/** Розбудити те, що зараз чекає (паузу між кроками чи партнера), — на скасуванні. */
	#wake: (() => void) | null = null;
	/**
	 * Записи, які цей пошук пробував забрати, і не вийшло (`SeekInput.passed`). Масив, а не
	 * `Set`: реактивність тут не потрібна, а `Set` у рунічному файлі проєкт забороняє.
	 */
	#passed: string[] = [];
	/** Що пошук робить цієї миті — щоб збій назвав крок (`SearchStep`). */
	#step: SearchStep = 'sign-in';

	constructor(readonly deps: SearchDeps) {}

	/** Вмикнути чи вимкнути гру. Останню не вимкнути: пошук без жодної гри не знайшов би нічого. */
	toggle(game: OnlineGame): void {
		if (this.phase !== 'idle') return;
		const on = this.games.includes(game);
		if (on && this.games.length === 1) return;
		this.games = on ? this.games.filter((other) => other !== game) : [...this.games, game];
	}

	async start(): Promise<void> {
		if (this.phase !== 'idle') return;
		// Нова спроба — стара причина вже нічого не каже.
		toast.dismissProblems();
		if (!this.deps.online()) {
			toast.problem('offline');
			logService.warn('network', 'auto search offline', { games: [...this.games] });
			return;
		}
		const run = ++this.#run;
		const stale = () => run !== this.#run;
		const wanted: GameVersions = Object.fromEntries(
			this.games.map((game) => [game, VERSIONS[game]])
		);
		this.phase = 'searching';
		this.#passed = [];
		logService.info('network', 'auto search started', { games: [...this.games] });
		try {
			this.#step = 'sign-in';
			const me = await this.deps.me();
			while (!stale()) {
				const seeks = await this.#seeks(stale);
				if (stale()) return;
				const step: SeekStep =
					seeks === null
						? { kind: 'wait' }
						: planSeek({
								me,
								wanted,
								rooms: this.deps.rooms(),
								seeks,
								waiting: this.#handle !== null,
								passed: this.#passed,
								seats: SEATS,
								random: this.deps.random
							});
				if (step.kind === 'wait') {
					if (!(await this.#wait(run, wanted))) return;
					continue;
				}
				// Я чекав — спершу зняти свій запис, не розминувшись зі збігом, що саме їде.
				if (this.#handle) {
					const handle = this.#handle;
					this.#handle = null;
					this.#step = 'withdraw';
					const match = await handle.withdraw();
					if (stale()) return;
					if (match) return this.#arrive(match.gameId, match.code);
					this.phase = 'searching';
				}
				if (step.kind === 'join') return this.#arrive(step.gameId, step.code);
				await this.#claim(run, step.uid, step.gameId);
			}
		} catch (error) {
			if (stale()) return;
			await this.#fail(error);
		}
	}

	/**
	 * ПОШУК УПАВ — прибрати за собою одразу, а причину назвати, щойно її зʼясовано
	 * (прохання автора 2026-09-27). Доти тут був тост «Пошук гри не вдався — спробуйте ще
	 * раз» на будь-яку причину; тепер тост каже саму причину (`toast.problem`).
	 *
	 * Поки йде діагноз (звірка правил і опитування версії, до `PROBE_WAIT_MS`), фаза лишається
	 * «шукаємо»: кнопка «Скасувати» працює, а натиск «шукати» вдруге не почне другого пошуку
	 * поверх першого. Скасували посеред діагнозу — тоста не буде: людина вже пішла далі.
	 */
	async #fail(error: unknown): Promise<void> {
		const context = { step: this.#step, games: [...this.games], waiting: this.#handle !== null };
		this.#release();
		const run = this.#run;
		const diagnosis = await this.deps.diagnose(error);
		logFailure('auto search failed', error, diagnosis, context);
		if (run !== this.#run) return;
		this.phase = 'idle';
		toast.problem(diagnosis.problem);
	}

	/** Перестати шукати: запис знімається, кімната під збіг (якщо партнер ще не прийшов) закривається. */
	cancel(): void {
		if (this.phase === 'idle') return;
		// Після збігу скасовувати вже нічого — сторінка просто йде в кімнату (`dispose`).
		if (this.phase !== 'found' || this.#room !== null) {
			logService.info('network', 'auto search cancelled', { phase: this.phase });
		}
		this.#abandon();
	}

	#abandon(): void {
		this.#release();
		this.phase = 'idle';
	}

	/** Зупинити все, що пошук тримає: запис, чекання, кімнату під збіг. Фазу не чіпає. */
	#release(): void {
		this.#run += 1;
		this.#handle?.stop();
		this.#handle = null;
		this.#wake?.();
		if (this.#room !== null) void this.#close(this.#room);
		this.#room = null;
	}

	/**
	 * Записи пошуку. Поки мій запис стоїть, невдале читання (обрив на мить) пошуку не
	 * зупиняє — `null`, і на наступному кроці спробуємо знову: запис живий і без нього.
	 */
	async #seeks(stale: () => boolean): Promise<Seek[] | null> {
		this.#step = 'list';
		try {
			return await this.deps.seek.list();
		} catch (error) {
			if (this.#handle === null || stale()) throw error;
			logService.warn('network', 'seek list not read', { reason: String(error) });
			return null;
		}
	}

	/** Поставити свій запис (якщо його ще немає) і почекати до наступного кроку. `false` — застаріло. */
	async #wait(run: number, wanted: GameVersions): Promise<boolean> {
		if (!this.#handle) {
			this.#step = 'open';
			const handle = await this.deps.seek.open(wanted, (match) => this.#matched(run, match));
			if (run !== this.#run) {
				handle.stop();
				return false;
			}
			this.#handle = handle;
			this.phase = 'waiting';
		}
		await this.#pause(SEEK_POLL_MS);
		return run === this.#run;
	}

	/** Збіг приїхав підпискою. */
	#matched(run: number, match: SeekMatch): void {
		if (run === this.#run) this.#arrive(match.gameId, match.code);
	}

	/** Пару знайдено — іти в кімнату. Пошук на цьому скінчився: запис знято, чекання — теж. */
	#arrive(gameId: OnlineGame, code: string): void {
		this.#run += 1;
		this.#handle?.stop();
		this.#handle = null;
		this.#wake?.();
		this.phase = 'found';
		logService.info('network', 'auto search found', { gameId, code });
		this.deps.go(gameId, code);
	}

	/** Створити кімнату під чужий запис і вписати її туди; не вийшло — кімнату закрити й шукати далі. */
	async #claim(run: number, uid: string, gameId: OnlineGame): Promise<void> {
		this.#step = 'create-room';
		const code = await this.deps.createRoom(gameId);
		if (run !== this.#run) return void this.#close(code);
		this.#room = code;
		this.#step = 'claim';
		const claimed = await this.deps.seek.claim(uid, { code, gameId });
		if (run !== this.#run) return;
		if (claimed) {
			this.phase = 'found';
			const arrived = await this.#partner(code);
			if (run !== this.#run) return;
			if (arrived) {
				this.#room = null;
				return this.#arrive(gameId, code);
			}
			logService.info('network', 'seek partner did not come', { code, gameId });
		}
		this.#room = null;
		this.#passed.push(uid);
		await this.#close(code);
		if (run !== this.#run) return;
		this.phase = 'searching';
		// Не лягло — не одразу знову; партнера, що не прийшов, уже й так чекали.
		if (!claimed) await this.#pause(CLAIM_RETRY_MS);
	}

	/** Чи зʼявився в кімнаті хтось, крім мене, за `PARTNER_WAIT_MS`. */
	#partner(code: string): Promise<boolean> {
		return new Promise((resolve) => {
			let done = false;
			let off: (() => void) | null = null;
			const finish = (arrived: boolean) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				off?.();
				this.#wake = null;
				resolve(arrived);
			};
			const timer = setTimeout(() => finish(false), PARTNER_WAIT_MS);
			this.#wake = () => finish(false);
			this.deps
				.watchOthers(code, (others) => {
					if (others > 0) finish(true);
				})
				.then((stop) => (done ? stop() : (off = stop)))
				.catch(() => finish(false));
		});
	}

	#pause(ms: number): Promise<void> {
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.#wake = null;
				resolve();
			}, ms);
			this.#wake = () => {
				clearTimeout(timer);
				this.#wake = null;
				resolve();
			};
		});
	}

	/** Закрити кімнату, під яку збіг не склався. Не кидає: пошук від цього не залежить. */
	async #close(code: string): Promise<void> {
		try {
			await this.deps.closeRoom(code);
		} catch (error) {
			logService.warn('network', 'seek room not closed', { code, reason: String(error) });
		}
	}
}
