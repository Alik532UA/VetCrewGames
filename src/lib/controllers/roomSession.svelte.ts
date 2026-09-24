import { settings } from '$lib/services/settings.svelte';
import { logService } from '$lib/services/logService.svelte';
import { playerData } from '$lib/services/playerData.svelte';
import { COUNTDOWN_MS } from '$lib/config/roomLife';
import { toast } from './toast.svelte';
import type { LobbyFeed } from './lobbyFeed.svelte';
import type { PlayerIdentity } from './playerIdentity.svelte';
import type { LobbyRoom } from '$lib/net/lobby';
import type { Member, Role, RoomStatus, RoomTransport } from '$lib/net/roomTypes';
import { liveNet, type RoomNet } from '$lib/net/roomNet';
import { entryErrorKey, entryRefusal, quickPick } from '$lib/utils/roomEntry';
import { playersOf, rosterOf } from '$lib/utils/roster';
import { attachRoomPolicies } from './roomPolicies.svelte';

/** Що сесії треба знати про матч — спільне для «Знайди пару» й вікторини. */
export interface RoomMatch {
	listen(): () => void;
	readonly members: Member[];
	readonly players: Member[];
	readonly status: RoomStatus;
	readonly hostUid: string;
	readonly countdownAt: number | null;
	readonly autoStart: boolean;
	readonly seed: number;
	readonly over: boolean;
	readonly gone: boolean;
	takeLead(): Promise<boolean>;
}

/** Чим гра відрізняється від іншої гри — рівно те, чого сесія знати не може. */
export interface RoomGame<M extends RoomMatch> {
	readonly gameId: 'pairs' | 'quiz';
	readonly rulesVersion: number;
	/** Скільки гравців потрібно, щоб почати. */
	readonly minPlayers: number;
	/** Кімната «вільна» для швидкої гри, поки гравців менше. */
	readonly quickSeats: number;
	/** Роль новачка в УЖЕ розпочатій партії. */
	readonly lateRole: Role;
	/** Чи вмикати відлік автостарту за такої кількості гравців. */
	autoStartReady(players: number): boolean;
	newRoom(): { seed: number; config: Record<string, number> };
	createMatch(me: string, transport: RoomTransport): M;
	/** Що кладе в запис переліку понад спільне (набір ігор вікторини). */
	listingExtras?(): { games?: Record<string, number> };
	fitsQuick?(room: LobbyRoom): boolean;
	/** Присутність приїхала — що з нею робить гра. */
	onPresence?(match: M, online: string[], now: number): void;
	/** Додаткові підписки на час кімнати (підсвітка наведення в парах). */
	listen?(code: string): Promise<Array<() => void>>;
	/** Бали за партію. Що їх дадуть РІВНО раз, стежить сесія. */
	award(match: M, me: string): void;
	/** Як часто цокати годиннику, мс; `null` — не цокати. */
	clockEvery(match: M): number | null;
}

/** Адреса сторінки: сесія про маршрутизацію не знає нічого. */
export interface RoomPlace {
	/** Код кімнати з адреси; порожньо — адреса без кімнати. */
	urlRoom(): string;
	/** Записати код у адресу КРОКОМ в історії. */
	remember(code: string): Promise<void>;
	/** Зі знесеної чи закритої кімнати — геть. */
	exit(): Promise<void>;
	/** Сказати СТАРІЙ кімнаті, куди переїхала гра (`?from` в адресі). */
	announce(code: string): Promise<void>;
}

/**
 * СЕСІЯ СПІЛЬНОЇ КІМНАТИ — усе між сторінкою й матчем, одним класом на обидві гри.
 *
 * Доти це жило копіями на двох сторінках: вхід, присутність, перелік, відлік,
 * нагорода, дії господаря, «назад» через адресу — 166 однакових рядків, які вже
 * розійшлися (аудит 2026-09-23): у вікторині лобі завжди показувало одного гравця
 * (лічильник не оновлювався), відлік автостарту не скасовувався, «швидка гра» не
 * звіряла версію. І жодна з цих копій не мала тесту: мережу брали напряму. Тепер
 * мережа — інтерфейс (`net/roomNet.ts`), і сесію перевіряє кімната в памʼяті.
 *
 * Разом із переїздом закрито те, чого не було НІДЕ: смуга «немає звʼязку»,
 * «кімнату закрито» замість мертвої дошки, передача ведення, коли господаря немає,
 * бали РАЗ на партію навіть після перезавантаження, годинник за серверним часом.
 *
 * Ефекти ставить `attach()` — його кличе сторінка під час ініціалізації, тож
 * вони належать компоненту й гаснуть разом із ним. Самі ефекти — у
 * `roomPolicies.svelte.ts`: там реакції на стан, тут дії на прохання людини.
 */
export class RoomSession<M extends RoomMatch> {
	match = $state<M | null>(null);
	code = $state('');
	joinCode = $state('');
	isPrivate = $state(false);
	me = $state('');
	online = $state<string[]>([]);
	busy = $state(false);
	/** Звʼязок із базою. `true`, поки не доведено протилежне. */
	connected = $state(true);
	/** Годинник сторінки — СЕРВЕРНИЙ час (`transport.now()`), а не час пристрою. */
	clock = $state(Date.now());

	#stops: Array<() => void> = [];
	#transport: RoomTransport | null = null;

	constructor(
		readonly game: RoomGame<M>,
		readonly place: RoomPlace,
		readonly player: PlayerIdentity,
		readonly lobby: LobbyFeed,
		readonly net: RoomNet = liveNet
	) {}

	/**
	 * Гравці, що зараз на звʼязку, — з них складається склад старту й реваншу.
	 *
	 * Доти склад брався з УСІХ рядків `members`, а рядок не гасне сам: гість, що
	 * закрив вкладку під час відліку, потрапляв у заморожений склад, і кожна його
	 * черга коштувала решті 90 с (аудит 2026-09-24). Поки присутність не приїхала
	 * (мене самого в ній ще немає) — усі гравці кімнати: краще почати з тим, кого
	 * ще не видно, ніж не почати зовсім.
	 */
	get presentPlayers(): Member[] {
		const players = playersOf(this.match?.members ?? []);
		if (!this.online.includes(this.me)) return players;
		return players.filter((player) => this.online.includes(player.uid));
	}

	/** Чи вистачає тих, хто на звʼязку, на нову партію. */
	get canStart(): boolean {
		return this.presentPlayers.length >= this.game.minPlayers;
	}

	get amHost(): boolean {
		return this.me !== '' && this.match?.hostUid === this.me;
	}

	get myRole(): Role {
		return this.match?.members.find((member) => member.uid === this.me)?.role ?? 'player';
	}

	/** Секунди до автостарту; `null` — відліку немає. */
	get countdownLeft(): number | null {
		const at = this.match?.countdownAt ?? null;
		return at === null ? null : Math.max(0, Math.ceil((at + COUNTDOWN_MS - this.clock) / 1000));
	}

	/** Господаря немає на звʼязку (порожня присутність — ще не приїхала). */
	get hostAway(): boolean {
		const match = this.match;
		return (
			match !== null &&
			!this.amHost &&
			this.online.length > 0 &&
			!this.online.includes(match.hostUid)
		);
	}

	/** Серверний час зараз. */
	now(): number {
		return this.#transport?.now() ?? Date.now();
	}

	/** Поставити ефекти сесії. Кличе сторінка під час ініціалізації. */
	attach(): void {
		attachRoomPolicies(this);
	}

	/** Повернутися в кімнату з адреси — «код в адресі означає я вже тут був». */
	resume(): void {
		const saved = this.place.urlRoom();
		if (!saved) return;
		this.joinCode = saved;
		void this.enter('join');
	}

	/** Зайти в кімнату або створити її. `quick` — дорога «швидкої гри» (автостарт). */
	async enter(action: 'create' | 'join', quick = false): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		try {
			// Словник імен ДОЧЕКАТИСЯ: інакше в кімнату їде ключ замість імені.
			await this.player.load(settings.locale, this.lobby.takenNames);
			const who = this.player.forEntry(this.lobby.takenNames);
			if (action === 'create') {
				this.code = await this.net.createRoom({
					gameId: this.game.gameId,
					rulesVersion: this.game.rulesVersion,
					...this.game.newRoom(),
					name: who,
					country: this.player.country,
					avatar: this.player.forRoom(),
					autoStart: quick,
					isPrivate: quick ? false : this.isPrivate
				});
				await this.place.announce(this.code);
			} else if (!(await this.#join(who))) {
				return;
			}
			await this.place.remember(this.code);
			await this.#open(action === 'create' && (quick || !this.isPrivate), who);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			toast.error(entryErrorKey(reason));
			logService.error('network', 'room entry failed', { game: this.game.gameId, action, reason });
		} finally {
			this.busy = false;
		}
	}

	/** Зайти за кодом. `false` — не пустили, і людина вже почула чому. */
	async #join(who: string): Promise<boolean> {
		const wanted = this.joinCode.replace(/\D/g, '');
		const room = await this.net.peekRoom(wanted);
		const refusal = entryRefusal(room, this.game);
		if (refusal) {
			toast.error(refusal);
			return false;
		}
		this.code = wanted;
		/*
		 * Роль не передаємо: повернувшись, кожен лишається в своїй. Новачок у вже
		 * розпочату партію — у тій ролі, яку йому дає гра. Але той, хто В СКЛАДІ
		 * партії (вийшов і вернувся), — гравець: місце в черзі в нього є, і реванш
		 * мусить його бачити (`rosterOf` бере гравців із рядків складу).
		 */
		const me = await this.net.me();
		const inRoster = room?.roster?.some((entry) => entry.uid === me) ?? false;
		const newcomer = room?.status === 'lobby' || inRoster ? 'player' : this.game.lateRole;
		await this.net.joinRoom(
			this.code,
			who,
			undefined,
			this.player.country,
			this.player.forRoom(),
			newcomer
		);
		return true;
	}

	/** Підписки кімнати: матч, присутність, звʼязок, підписки гри, перелік. */
	async #open(listed: boolean, who: string): Promise<void> {
		const transport = await this.net.roomTransport(this.code);
		this.#transport = transport;
		this.me = await this.net.me();
		const match = this.game.createMatch(this.me, transport);
		this.#stops.push(match.listen());
		// Локальний рахунок на паузі, поки триває спільна партія: бали — в кінці.
		playerData.beginOnline();
		this.#stops.push(await this.net.trackPresence(this.code));
		this.#stops.push(
			await this.net.watchPresence(this.code, (uids) => {
				this.online = uids;
				this.game.onPresence?.(match, uids, this.now());
			})
		);
		this.#stops.push(await this.net.watchConnected((online) => (this.connected = online)));
		for (const stop of (await this.game.listen?.(this.code)) ?? []) this.#stops.push(stop);
		if (listed) await this.#publish(who);
		this.match = match;
	}

	/** Відкрита кімната — у перелік. Невдача не скасовує входу: кімната працює й так. */
	async #publish(who: string): Promise<void> {
		try {
			await this.lobby.publish({
				code: this.code,
				hostUid: this.me,
				hostName: who,
				hostCountry: this.player.country,
				hostAvatar: this.player.forRoom(),
				rulesVersion: this.game.rulesVersion,
				players: 1,
				...this.game.listingExtras?.()
			});
		} catch (error) {
			logService.warn('network', 'room not published', { code: this.code, reason: String(error) });
		}
	}

	/** Швидка гра: найстаріша вільна кімната, а якщо такої немає — своя відкрита. */
	async quickGame(): Promise<void> {
		if (this.busy) return;
		const free = quickPick(this.lobby.rooms, this.game, this.game.quickSeats, (room) =>
			this.game.fitsQuick ? this.game.fitsQuick(room) : true
		);
		if (free) {
			this.joinCode = free.code;
			await this.enter('join');
			return;
		}
		this.isPrivate = false;
		await this.enter('create', true);
	}

	/** Вийти на форму входу. Кімнату не закриває: у ній можуть сидіти інші. */
	leave(): void {
		this.dispose();
		this.match = null;
		this.code = '';
		this.online = [];
		this.connected = true;
		this.#transport = null;
	}

	/**
	 * Зняти всі підписки. Кличе й сторінка, коли розмонтовується, — і тоді теж
	 * знімається пауза локального рахунку: доти вона лишалася, і соло-ігри після
	 * онлайн-кімнати не додавали очок до перезавантаження.
	 */
	dispose(): void {
		playerData.endOnline();
		for (const stop of this.#stops) stop();
		this.#stops = [];
		this.lobby.unpublish();
	}

	/**
	 * АВТОМАТИКА ГОСПОДАРЯ ЗУПИНЕНА: відлік і автостарт більше не пишуть самі.
	 *
	 * Вмикається першою ж відмовою бази на автоматичному записі. Доти відмова
	 * ставала вічним колом: SDK показує свій запис одразу й відкочує його, коли база
	 * відмовила, — і політика «відлік вийшов → почати» бачила відкат як новий стан і
	 * стартувала знову, із частотою мережі, ~12 разів на секунду (звіт автора
	 * 2026-09-24: новий клієнт проти правил, що ще не знали `info/roster`). Людина
	 * й далі може натиснути «Почати» — і почує відмову, але сама база більше не
	 * засипається однаковими записами.
	 */
	autoHalted = $state(false);

	/** Дія господаря — один каркас: перевірка, транспорт, помилка вголос. `false` — не вийшло. */
	async hostAction(run: (transport: RoomTransport) => Promise<void>): Promise<boolean> {
		if (!this.match || !this.amHost || !this.#transport) return false;
		try {
			await run(this.#transport);
			return true;
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'host action denied', { code: this.code, reason: String(error) });
			return false;
		}
	}

	/** Почати партію. `auto` — це відлік, а не людина: невдача зупиняє автоматику. */
	async start(auto = false): Promise<void> {
		const match = this.match;
		if (!match || (auto && this.autoHalted)) return;
		if (!this.canStart) {
			toast.info('pairs.needPlayers');
			return;
		}
		// Склад заморожується тим самим записом, що й старт (`RoomInfo.roster`).
		const started = await this.hostAction((transport) =>
			transport.setStatus('playing', rosterOf(this.presentPlayers))
		);
		if (!started) {
			if (auto) this.autoHalted = true;
			return;
		}
		// Партія, що вже йде, у переліку обіцяла б гру, а давала роль глядача. Лише
		// ПІСЛЯ старту: доти невдалий старт ще й прибирав кімнату з переліку.
		this.lobby.unpublish();
	}

	/** Закрити кімнату — ЯВНОЮ дією: «пішов назовсім» від «перезавантажив» не відрізнити. */
	async close(): Promise<void> {
		if (!this.match || !this.amHost) return;
		try {
			// Спершу з переліку: навпаки був би рядок кімнати, якої вже немає.
			this.lobby.unpublish();
			await this.net.closeRoom(this.code);
			await this.place.exit();
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'room not closed', { reason: String(error) });
		}
	}

	// Зерно реваншу — з тієї самої дороги, що й зерно нової кімнати: випадковість
	// живе на сторінці, а не в контролері (`quizSeed.test.ts`).
	/**
	 * Реванш — з тими, хто в кімнаті й на звʼязку ЗАРАЗ, і лише коли їх досить.
	 *
	 * Доти мінімуму тут не перевіряв ніхто: господар, від якого пішов суперник,
	 * перезапускав партію сам із собою — «вигравав» її й отримував бали за
	 * перемогу на кожному реванші, бо разовість нагороди тримається на зерні, а
	 * зерно в реванша нове (аудит 2026-09-24).
	 */
	rematch = async () => {
		if (!this.canStart) {
			toast.info('pairs.needPlayers');
			return;
		}
		await this.hostAction((transport) =>
			transport.restart(this.game.newRoom().seed, rosterOf(this.presentPlayers))
		);
	};
	switchAutoStart = (on: boolean) => this.hostAction((transport) => transport.setAutoStart(on));
	kick = (uid: string) => this.hostAction((transport) => transport.removeMember(uid));

	async setRole(role: Role): Promise<void> {
		if (!this.match || this.match.status !== 'lobby') return;
		try {
			await this.net.joinRoom(
				this.code,
				this.player.forEntry(this.lobby.takenNames),
				role,
				this.player.country,
				this.player.forRoom(),
				role
			);
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'role not changed', { reason: String(error) });
		}
	}
}
