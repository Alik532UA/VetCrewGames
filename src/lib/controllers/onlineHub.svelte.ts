import { settings } from '$lib/services/settings.svelte';
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
 * іншої гри». Тепер форма одна, а гру вирішує кімната:
 *
 *  • «Автоматичний пошук» — `AutoSearch` над обома іграми, які людина ввімкнула;
 *  • «Створити» — гра, тоді окреме вікно «хто зможе зайти», тоді сторінка гри з наміром
 *    (`?create`, `RoomPlace.creating`);
 *  • «Підключитися» — код без вибору гри: гру каже сама кімната (`peekRoom`);
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

export class OnlineHubState {
	joinCode = $state('');
	/** Поки хаб питає кімнату за кодом, кнопки не приймають повторних натискань. */
	busy = $state(false);
	/** Гра, для якої відкрите вікно «хто зможе зайти»; `null` — вікна немає. */
	creating = $state<OnlineGame | null>(null);
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

	/**
	 * «Підключитися» — гру каже кімната: код без вибору гри.
	 *
	 * Збій — тостом із причиною, як і в пошуку (прохання автора 2026-09-27): доти тут
	 * стояло «Не вдалося зайти в кімнату. Спробуйте ще раз» і на відмову правил, і на
	 * дефект коду, де жоден повтор не допоможе. «Такої кімнати немає» й «це кімната іншої
	 * гри» лишаються звичайними тостами: це відповідь бази, а не збій.
	 */
	async join(): Promise<void> {
		const code = this.joinCode.replace(/\D/g, '');
		if (this.busy || this.#searching() || code.length < CODE_MIN) return;
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

	/** «Створити» → гра: відкрити вікно «хто зможе зайти». */
	openCreate(gameId: OnlineGame): void {
		if (!this.#searching()) this.creating = gameId;
	}

	/** Вибір у вікні — на сторінку гри з наміром. */
	async create(isPrivate: boolean): Promise<void> {
		const gameId = this.creating;
		if (!gameId) return;
		await this.#sign();
		this.routes.create(gameId, isPrivate);
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
