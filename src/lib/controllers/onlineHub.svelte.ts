import { settings } from '$lib/services/settings.svelte';
import { storage } from '$lib/services/storage';
import { isCompactScreen } from '$lib/config/memory-game';
import { PAIRS_RULES_VERSION, QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { listedSince } from '$lib/utils/roomEntry';
import { isOnlineGame, type OnlineGame } from '$lib/utils/crossGame';
import { liveNet, type RoomNet } from '$lib/net/roomNet';
import { liveSeekNet, type SeekNet } from '$lib/net/seek';
import { AutoSearch } from './autoSearch.svelte';
import { diagnose, logFailure, type ProblemProbe } from './diagnose';
import { newPairsRoom, newQuizRoom } from './newRoom';
import { toast } from './toast.svelte';
import type { LobbyFeed, ResumeRoom } from './lobbyFeed.svelte';
import type { PlayerIdentity } from './playerIdentity.svelte';
import type { LobbyRoom } from '$lib/net/lobby';

/**
 * ХАБ «ГРАТИ ОНЛАЙН» — усе до кімнати, для обох ігор разом (рішення автора 2026-09-26).
 *
 * Доти кожна гра мала власну форму входу на своїй сторінці: швидка гра, імʼя, створити,
 * зайти за кодом, перелік — і код кімнати іншої гри там давав глухий кут «ця кімната для
 * іншої гри». Тепер форма одна, а гру вирішує кімната. Три дороги — три кнопки, і кожна
 * відкриває СВОЄ ВІКНО (рішення автора 2026-09-27, 6-A і 7-A), тож на хабі лишаються
 * лише вони, «хто я» й перелік:
 *
 *  • «Автоматичний пошук» — вікно з іграми, які запамʼятовуються, і «Шукати»; стан і
 *    «Скасувати» — у тому самому вікні (`AutoSearch` над обома іграми);
 *  • «Створити кімнату» — два екрани одного вікна: гра, тоді «хто зможе зайти», тоді
 *    сторінка гри з наміром (`?create`, `RoomPlace.creating`);
 *  • «Підключитися» — вікно з кодом без вибору гри: гру каже сама кімната (`peekRoom`);
 *  • перелік — відкриті кімнати, свої партії й кімнати друзів обох ігор, із позначкою гри.
 *
 * У кімнату хаб не заходить сам: він лише зберігає підпис гравця (сторінка кімнати читає
 * його зі сховища) і веде на сторінку гри. Кімнату під збіг автоматичного пошуку
 * створює тут — це єдиний запис у базу, який хаб робить від себе.
 */

/** Що хабу треба від мережі кімнат: частина `RoomNet` і «хто ще в кімнаті». */
export type HubNet = Pick<RoomNet, 'createRoom' | 'closeRoom' | 'peekRoom' | 'me'> & {
	watchOthers(code: string, onCount: (others: number) => void): Promise<() => void>;
};

export const liveHubNet: HubNet = {
	createRoom: (options) => liveNet.createRoom(options),
	closeRoom: (code) => liveNet.closeRoom(code),
	peekRoom: (code) => liveNet.peekRoom(code),
	me: () => liveNet.me(),
	watchOthers: async (code, onCount) =>
		(await import('$lib/net/presence')).watchOthers(code, onCount)
};

/** Куди веде хаб — переходи робить сторінка (`goto` і мова адреси). */
export interface HubRoutes {
	/** У кімнату гри: `?room=…&move=1` — людина вже вирішила, вікна «вас запросили» не треба. */
	room(gameId: OnlineGame, code: string): void;
	/** На сторінку гри з наміром створити кімнату. */
	create(gameId: OnlineGame, isPrivate: boolean): void;
}

const VERSIONS: Record<OnlineGame, number> = {
	pairs: PAIRS_RULES_VERSION,
	quiz: QUIZ_RULES_VERSION
};

/** Код кімнати — лише цифри, до пʼяти (та сама межа, що в полі, `room-code.test.ts`). */
export const CODE_MIN = 2;
export const CODE_MAX = 5;

/** Три дороги хабу — і три його вікна. */
export type HubWindowKind = 'search' | 'create' | 'join';

/** Відкрите вікно. У створення два екрани: `game: null` — вибір гри, далі — «хто зможе зайти». */
export type HubWindow =
	| { kind: 'search' }
	| { kind: 'join' }
	| { kind: 'create'; game: OnlineGame | null };

/** Ігри автоматичного пошуку — памʼять пристрою (6-A: «вибір ігор, які запамʼятовуються»). */
export const SEARCH_GAMES_KEY = 'online.searchGames';

/** Збережений вибір ігор, якщо він чинний: лише відомі ігри, без повторів, хоч одна. */
function rememberedGames(raw: unknown): OnlineGame[] | null {
	if (!Array.isArray(raw)) return null;
	const games = raw.filter(
		(game, at): game is OnlineGame => isOnlineGame(game) && raw.indexOf(game) === at
	);
	return games.length > 0 ? games : null;
}

export class OnlineHubState {
	joinCode = $state('');
	/** Поки хаб питає кімнату за кодом чи йде створювати, кнопки не приймають повторів. */
	busy = $state(false);
	/** Відкрите вікно; `null` — хаб із трьома кнопками. */
	opened = $state<HubWindow | null>(null);
	/**
	 * Кнопка, з якої відкрили вікно, що щойно закрилося, — фокус вертається на неї. `null`
	 * на першому показі: тоді фокус лишається там, де його поставив браузер.
	 */
	returnFocus = $state<HubWindowKind | null>(null);
	readonly search: AutoSearch;

	/**
	 * @param probe звідки факти для причини збою (`controllers/diagnose.ts`): сторінка дає
	 *   `liveProbe(updated.check)`, тест — свої.
	 */
	constructor(
		readonly player: PlayerIdentity,
		readonly feeds: Record<OnlineGame, LobbyFeed>,
		readonly routes: HubRoutes,
		readonly random: () => number,
		readonly probe: ProblemProbe,
		readonly net: HubNet = liveHubNet,
		seek: SeekNet = liveSeekNet
	) {
		this.search = new AutoSearch({
			seek,
			/*
			 * ПІДПИС — ПЕРШИМ КРОКОМ ПОШУКУ, а не перед ним: так його збій іде тією самою
			 * дорогою, що й решта (крок `sign-in`, тост із причиною). Доти `startSearch`
			 * підписував до `start()`, і відсутній шматок словника імен ставав
			 * необробленою відмовою промісу, а кнопка не казала нічого.
			 */
			me: async () => {
				await this.#sign();
				return this.net.me();
			},
			rooms: () => this.rooms,
			createRoom: (gameId) => this.#seekRoom(gameId),
			closeRoom: (code) => this.net.closeRoom(code),
			watchOthers: (code, onCount) => this.net.watchOthers(code, onCount),
			go: (gameId, code) => this.routes.room(gameId, code),
			random,
			online: () => probe.online(),
			diagnose: (error) => diagnose(error, probe)
		});
		const games = rememberedGames(storage.getJSON<unknown>(SEARCH_GAMES_KEY));
		if (games) this.search.games = games;
	}

	/** Відкриті кімнати обох ігор — найновіші вгорі, як і в переліку однієї гри. */
	get rooms(): LobbyRoom[] {
		return [...this.feeds.pairs.rooms, ...this.feeds.quiz.rooms].sort(
			(a, b) => listedSince(b) - listedSince(a)
		);
	}

	/** Свої партії обох ігор. */
	get own(): ResumeRoom[] {
		return [...this.feeds.quiz.own, ...this.feeds.pairs.own];
	}

	/** Друзі — той самий перелік в обох стрічках (він не залежить від гри); без повторів. */
	get friends(): string[] {
		const all = [...this.feeds.quiz.friends, ...this.feeds.pairs.friends];
		return all.filter((uid, at) => all.indexOf(uid) === at);
	}

	get hasMore(): boolean {
		return this.feeds.quiz.hasMore || this.feeds.pairs.hasMore;
	}

	/** Перелік не читається — хоч однієї гри: правила однакові, тож це майже завжди обидві. */
	get unavailable(): boolean {
		return this.feeds.quiz.unavailable || this.feeds.pairs.unavailable;
	}

	get takenNames(): string[] {
		return this.rooms.map((room) => room.hostName);
	}

	/** Ефекти хабу — кличе сторінка під час ініціалізації, тож вони гаснуть разом із нею. */
	attach(): void {
		$effect(() => void this.player.load(settings.locale, this.takenNames));
		for (const feed of Object.values(this.feeds)) {
			$effect(() => feed.watch((names) => this.player.settle(names)));
			$effect(() => feed.load());
		}
	}

	/** Сторінка йде — пошук зупиняється (запис знімається, кімната під збіг закривається). */
	dispose(): void {
		this.search.cancel();
	}

	/** Відкрити вікно дороги. Поки пошук іде, відкривається лише його власне. */
	open(kind: HubWindowKind): void {
		if (kind !== 'search' && this.#searching()) return;
		this.opened = kind === 'create' ? { kind, game: null } : { kind };
	}

	/** «Створити кімнату» → гра: другий екран того самого вікна. */
	chooseGame(game: OnlineGame): void {
		if (this.opened?.kind === 'create') this.opened = { kind: 'create', game };
	}

	/**
	 * «Назад»: із «хто зможе зайти» — до вибору гри, звідусіль іще — на хаб. Пошук, що
	 * йде, свого вікна не закриває: вийти з нього можна лише «Скасувати» — інакше пошук
	 * ішов би далі за закритим вікном, а решта дорог відповідала б «спершу скасуйте».
	 */
	back(): void {
		const opened = this.opened;
		if (!opened || this.busy) return;
		if (opened.kind === 'create' && opened.game) {
			this.opened = { kind: 'create', game: null };
			return;
		}
		if (opened.kind === 'search' && this.search.phase !== 'idle') return;
		this.returnFocus = opened.kind;
		this.opened = null;
	}

	/** Увімкнути чи вимкнути гру пошуку — і запамʼятати вибір на пристрої. */
	toggleGame(game: OnlineGame): void {
		this.search.toggle(game);
		storage.setJSON(SEARCH_GAMES_KEY, [...this.search.games]);
	}

	/**
	 * «Підключитися» — гру каже кімната: код без вибору гри.
	 *
	 * Збій — тостом із причиною, як і в пошуку (прохання автора 2026-09-27): доти тут
	 * стояло «Не вдалося зайти в кімнату. Спробуйте ще раз» і на відмову правил, і на
	 * дефект коду, де жоден повтор не допоможе. «Такої кімнати немає» й «це кімната іншої
	 * гри» лишаються звичайними тостами: це відповідь бази, а не збій.
	 *
	 * Закороткий код — теж тост, а не тиша: кнопка не сіріє (`aria-disabled` лише закриває
	 * натиск), і доти натиск на неї з однією цифрою не робив нічого й не казав чому.
	 */
	async join(): Promise<void> {
		const code = this.joinCode.replace(/\D/g, '');
		if (this.busy || this.#searching()) return;
		if (code.length < CODE_MIN) return toast.info('online.codeFull');
		toast.dismissProblems();
		// Без мережі читання кімнати не падає, а висить — кажемо одразу.
		if (!this.probe.online()) return toast.problem('offline');
		this.busy = true;
		try {
			const room = await this.net.peekRoom(code);
			if (!room) return toast.error('pairs.noRoom');
			if (!isOnlineGame(room.gameId)) return toast.error('quiz.otherGame');
			await this.enter(code, room.gameId);
		} catch (error) {
			const diagnosis = await diagnose(error, this.probe);
			logFailure('hub join failed', error, diagnosis, { code });
			toast.problem(diagnosis.problem);
		} finally {
			this.busy = false;
		}
	}

	/** Зайти в кімнату з переліку чи за кодом — підписом, що стоїть у полі. */
	async enter(code: string, gameId: OnlineGame): Promise<void> {
		if (this.#searching()) return;
		await this.#sign();
		this.routes.room(gameId, code);
	}

	/**
	 * Вибір «хто зможе зайти» — на сторінку гри з наміром.
	 *
	 * `busy` лишається піднятим і після переходу: сторінка вже йде, а другий натиск за ці
	 * мілісекунди повів би вдруге (доти вікно отримувало `busy={false}` завжди). Збій
	 * підпису — тостом із причиною, як і в підключенні, а не необробленою відмовою.
	 */
	async create(isPrivate: boolean): Promise<void> {
		const opened = this.opened;
		if (opened?.kind !== 'create' || !opened.game || this.busy) return;
		this.busy = true;
		try {
			await this.#sign();
			this.routes.create(opened.game, isPrivate);
		} catch (error) {
			this.busy = false;
			const diagnosis = await diagnose(error, this.probe);
			logFailure('hub create failed', error, diagnosis, { gameId: opened.game });
			toast.problem(diagnosis.problem);
		}
	}

	/**
	 * Автоматичний пошук — підписом, що стоїть у полі зараз: у пошуку він уже не міняється.
	 * Підпис — перший крок самого пошуку (`me` у конструкторі).
	 */
	async startSearch(): Promise<void> {
		await this.search.start();
	}

	/** Закрити свою покинуту кімнату просто з переліку. */
	async close(code: string, gameId: string): Promise<void> {
		const feed = isOnlineGame(gameId) ? this.feeds[gameId] : null;
		if (!feed || !(await feed.close(code))) toast.error('pairs.actionFailed');
	}

	/**
	 * ПОКИ ПОШУК ІДЕ, ІНШІ ДОРОГИ ЗАКРИТІ: друга дорога вела б у другу кімнату, а запис
	 * пошуку лишився б чекати. Кнопки при цьому не сіріють (`aria-disabled` у проєкті лише
	 * закриває натиск), тож натиск чує пояснення, а не тишу.
	 */
	#searching(): boolean {
		if (this.search.phase === 'idle') return false;
		toast.info('online.searchBusy');
		return true;
	}

	/**
	 * ПІДПИС ГРАВЦЯ — У СХОВИЩЕ, перш ніж іти з хабу: сторінка кімнати читає імʼя й прапор
	 * звідти (`PlayerIdentity.forEntry`). Словник імен мусить приїхати: інакше порожнє поле
	 * дало б у кімнату ключ замість імені.
	 */
	async #sign(): Promise<string> {
		await this.player.load(settings.locale, this.takenNames);
		return this.player.forEntry(this.takenNames);
	}

	/** Кімната під збіг автоматичного пошуку: приватна, з автостартом, від мого імені. */
	async #seekRoom(gameId: OnlineGame): Promise<string> {
		const name = await this.#sign();
		const fresh = gameId === 'pairs' ? newPairsRoom(this.random) : newQuizRoom(this.random);
		return this.net.createRoom({
			gameId,
			rulesVersion: VERSIONS[gameId],
			...fresh,
			name,
			country: this.player.country,
			avatar: this.player.forRoom(),
			autoStart: true,
			isPrivate: true,
			compact: gameId === 'pairs' ? isCompactScreen() : undefined
		});
	}
}
