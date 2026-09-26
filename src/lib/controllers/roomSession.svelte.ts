import { isDenied } from '$lib/net/denied';
import { settings } from '$lib/services/settings.svelte';
import { logService } from '$lib/services/logService.svelte';
import { playerData } from '$lib/services/playerData.svelte';
import { COUNTDOWN_MS } from '$lib/config/roomLife';
import { toast } from './toast.svelte';
import type { LobbyFeed } from './lobbyFeed.svelte';
import type { PlayerIdentity } from './playerIdentity.svelte';
import type { Member, Role, RoomTransport } from '$lib/net/roomTypes';
import type { RoomGame, RoomMatch, RoomPlace } from './roomGame';
import { liveNet, type RoomNet } from '$lib/net/roomNet';
import { entryErrorKey, entryRefusal, newcomerRole, quickPick } from '$lib/utils/roomEntry';
import { playersOf, rosterOf } from '$lib/utils/roster';
import { attachRoomPolicies } from './roomPolicies.svelte';
import { ReloadAdvice } from './reloadAdvice.svelte';

export type { RoomGame, RoomMatch, RoomPlace } from './roomGame';

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
	/**
	 * ЧОМУ СТОРІНКУ ТРЕБА ОНОВИТИ: правила бази новіші за неї або на сервері вже
	 * інша збірка (`reloadAdvice.svelte.ts`).
	 *
	 * Доти вкладка, відкрита до викладки нових правил, посеред партії не чула
	 * нічого: у «Знайди пару» кожен тап показувався й мовчки відкочувався, дошка
	 * виглядала замерзлою (аудит 2026-09-25). А вкладка, відкрита до викладки
	 * нової збірки, не могла зайти в кімнату: «спробуйте ще раз» без кінця (аудит
	 * 2026-09-26). Смуга кімнати в обох випадках каже оновити сторінку.
	 */
	readonly reload = new ReloadAdvice(() => this.net.checkRules());
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
		const host = this.match?.hostUid;
		return !!host && !this.amHost && this.online.length > 0 && !this.online.includes(host);
	}

	/** Серверний час зараз. */
	now(): number {
		return this.#transport?.now() ?? Date.now();
	}

	/** Серцебиття відкритої кімнати — тим самим транспортом, що й партія (`net/roomBeat.ts`). */
	beat(): (() => void) | undefined {
		return this.#transport ? this.net.beat(this.#transport) : undefined;
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

	/**
	 * НОМЕР ВХОДУ: росте, коли сесія виходить (`dispose`). Вхід, що доїхав після
	 * виходу, застарів: людина вже на іншій сторінці чи на формі входу, і писати
	 * адресу, присутність чи підписки від її імені він не має права. Доти вхід
	 * скасувати було нічим: «швидка гра» й одразу «назад» дописували `?room` у чужу
	 * сторінку, лишали присутність-привида з серцебиттям (господар рахував його
	 * гравцем і стартував) і ставили локальний рахунок на паузу (аудит 2026-09-26).
	 */
	#entry = 0;

	/** Зайти в кімнату або створити її. `quick` — дорога «швидкої гри» (автостарт). */
	async enter(action: 'create' | 'join', quick = false): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		const entry = this.#entry;
		const stale = () => entry !== this.#entry;
		// Свій код, а не `this.code`: невдалий вхід його вже стер, а звіт мусить сказати, куди йшли.
		let code = '';
		try {
			// Словник імен ДОЧЕКАТИСЯ: інакше в кімнату їде ключ замість імені.
			await this.player.load(settings.locale, this.lobby.takenNames);
			if (stale()) return;
			const who = this.player.forEntry(this.lobby.takenNames);
			if (action === 'create') {
				code = await this.net.createRoom({
					gameId: this.game.gameId,
					rulesVersion: this.game.rulesVersion,
					...this.game.newRoom(),
					name: who,
					country: this.player.country,
					avatar: this.player.forRoom(),
					autoStart: quick,
					isPrivate: quick ? false : this.isPrivate
				});
				if (stale()) return;
				this.code = code;
				await this.place.announce(code);
			} else {
				code = (await this.#join(who, stale)) ?? '';
				if (!code) return;
			}
			if (stale()) return;
			await this.place.remember(code);
			if (!stale()) await this.#open(code, stale);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			// Шматка збірки немає — смуга з кнопкою «оновити», а не «спробуйте ще раз».
			this.reload.noteFailure(error);
			toast.error(entryErrorKey(reason));
			// З кодом: доти звіт казав «не вдалося зайти», а в яку кімнату — ні.
			logService.error('network', 'room entry failed', {
				game: this.game.gameId,
				action,
				code: code || this.joinCode,
				reason
			});
		} finally {
			// Застарілий вхід кнопок не відпускає: ними вже володіє наступний (`dispose`).
			if (!stale()) this.busy = false;
		}
	}

	/** Зайти за кодом. `null` — не пустили (людина вже почула чому) або вхід застарів. */
	async #join(who: string, stale: () => boolean): Promise<string | null> {
		const wanted = this.joinCode.replace(/\D/g, '');
		const room = await this.net.peekRoom(wanted);
		if (stale()) return null;
		const refusal = entryRefusal(room, this.game);
		if (refusal) {
			toast.error(refusal);
			return null;
		}
		this.code = wanted;
		// Роль не передаємо: повернувшись, кожен лишається в своїй. Роль НОВАЧКА — `newcomerRole`.
		const me = await this.net.me();
		if (stale()) return null;
		const newcomer = newcomerRole(room, me, this.game.lateRole);
		const { country } = this.player;
		await this.net.joinRoom(wanted, who, undefined, country, this.player.forRoom(), newcomer);
		return wanted;
	}

	/**
	 * Підписки кімнати: матч, присутність, звʼязок, підписки гри. Сесії вони
	 * віддаються лише тоді, коли вхід доїхав до кінця, а застарілий вхід знімає все,
	 * що встиг підписати, сам.
	 */
	async #open(code: string, stale: () => boolean): Promise<void> {
		// Зупинка автоматики належить КІМНАТІ, у якій база відмовила, а сесія живе,
		// поки відкрита сторінка: доти вона переходила в кожну наступну кімнату — нова
		// «швидка гра» не рахувала відлік, а скінчена партія не ставала `over`
		// (аудит 2026-09-25).
		this.autoHalted = false;
		const stops: Array<() => void> = [];
		const abandon = () => {
			for (const stop of stops) stop();
			logService.info('network', 'room entry abandoned', { code });
		};
		try {
			const transport = await this.net.roomTransport(code);
			const me = await this.net.me();
			if (stale()) return;
			this.#transport = transport;
			this.me = me;
			const match = this.game.createMatch(me, transport);
			stops.push(match.listen());
			for (const next of [
				() => this.net.trackPresence(code),
				() =>
					this.net.watchPresence(code, (uids) => {
						if (stale()) return;
						this.online = uids;
						this.game.onPresence?.(match, uids, this.now());
					}),
				() =>
					this.net.watchConnected((online) => {
						if (!stale()) this.connected = online;
					}),
				// Підписки гри — однією відпискою, як і решта.
				async () => {
					const own = (await this.game.listen?.(code)) ?? [];
					return () => own.forEach((stop) => stop());
				}
			]) {
				stops.push(await next());
				if (stale()) return abandon();
			}
			this.#stops.push(...stops);
			// Локальний рахунок на паузі, поки триває спільна партія: бали — в кінці.
			playerData.beginOnline();
			this.match = match;
		} catch (error) {
			/*
			 * НЕВДАЛИЙ ВХІД НЕ ЛИШАЄ ПІВКІМНАТИ (аудит 2026-09-25). Доти підписка на
			 * кімнату жила далі, локальний рахунок стояв на паузі, а код і транспорт
			 * лишалися, поки на екрані вже форма входу; кожна наступна спроба додавала
			 * ще одну підписку. Найчастіша причина — застарілий шматок збірки після
			 * викладки: динамічний імпорт падає посеред входу.
			 */
			for (const stop of stops) stop();
			if (stale()) return;
			this.exitToGate();
			await this.place.exit();
			throw error;
		}
	}

	/**
	 * Відкрита кімната — у перелік. Невдача не скасовує входу: кімната працює й так.
	 *
	 * Кличе політика (`roomPolicies`), а не вхід: так кімната повертається в перелік
	 * і після перезавантаження господаря, і в нового господаря після перехоплення.
	 * Той самий код удруге перелік не пише (`LobbyFeed.publish`), а невдача не
	 * повторюється сама — лише коли знову зміниться кімната.
	 */
	async publishListing(): Promise<void> {
		const who =
			this.match?.members.find((member) => member.uid === this.me)?.name ??
			this.player.forEntry(this.lobby.takenNames);
		try {
			await this.lobby.publish({
				code: this.code,
				hostUid: this.me,
				hostName: who,
				hostCountry: this.player.country,
				hostAvatar: this.player.forRoom(),
				rulesVersion: this.game.rulesVersion,
				// Не одиниця: господар, що повернувся, чи новий після перехоплення
				// оголошує кімнату, де вже сидять люди, а лічильник наздоганяє лише
				// ЗМІНУ присутності (`roomPolicies`).
				players: Math.max(1, this.presentPlayers.length),
				since: this.match?.createdAt ?? undefined,
				...(this.match ? this.game.listingExtras?.(this.match) : {})
			});
		} catch (error) {
			logService.warn('network', 'room not published', { code: this.code, reason: String(error) });
		}
	}

	/** Швидка гра: найстаріша вільна кімната, а якщо такої немає — своя відкрита. */
	async quickGame(): Promise<void> {
		if (this.busy) return;
		const fits = this.game.fitsQuick ?? (() => true);
		const free = quickPick(this.lobby.rooms, this.game, this.game.quickSeats, fits);
		if (free) this.joinCode = free.code;
		else this.isPrivate = false;
		await this.enter(free ? 'join' : 'create', !free);
	}

	/**
	 * Вийти на форму входу. Кімнату не закриває: у ній можуть сидіти інші. І рядок
	 * складу ЛИШАЄ: це «назад», а не «піти назовсім» (`net/leave.ts`, `leaveRoom`) —
	 * імʼя тепер каже це саме (аудит 2026-09-25: доти `leave()` тут і `leaveRoom()`
	 * там означали протилежне).
	 */
	exitToGate(): void {
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
		// Вхід, що зараз у дорозі, застарів — і кнопки вже не його (`#entry`).
		this.#entry += 1;
		this.busy = false;
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
		const transport = this.#transport;
		if (!this.match || !this.amHost || !transport) return false;
		return this.act('host action denied', () => run(transport));
	}

	/**
	 * ДІЯ, ЯКУ ПОЧАЛА ЛЮДИНА, — той самий каркас, що `hostAction`, для кожного запису
	 * з екрана гри: помилка вголос і в журнал із кодом кімнати. Доти набір ігор,
	 * темп, пауза й «граємо далі» у вікторині йшли повз нього: відмова бази не
	 * казала людині нічого, а в журналі лишалося загальне «необроблена відмова
	 * промісу» без кімнати (аудит 2026-09-25). `false` — не вийшло.
	 */
	async act(label: string, run: () => Promise<unknown> | undefined): Promise<boolean> {
		try {
			await run();
			return true;
		} catch (error) {
			this.#failed(label, error);
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
		// Спершу з переліку: навпаки був би рядок кімнати, якої вже немає.
		this.lobby.unpublish();
		await this.act('room not closed', async () => {
			await this.net.closeRoom(this.code);
			await this.place.exit();
		});
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
	/**
	 * Прибрати учасника. СЕБЕ — ніколи: господар, що прибрав власний рядок, лишається
	 * присутнім, але не учасником — ходів йому база вже не приймає, а перехопити
	 * ведення не може ніхто, бо господар «на звʼязку» (аудит 2026-09-24).
	 */
	kick = async (uid: string): Promise<boolean> => {
		if (uid === this.me) return false;
		return this.hostAction((transport) => transport.removeMember(uid));
	};

	/** Змінити свою роль — у лобі й між партіями (перед реваншем), але не посеред гри. */
	async setRole(role: Role): Promise<void> {
		if (!this.match || this.match.status === 'playing') return;
		const name = this.player.forEntry(this.lobby.takenNames);
		const { country } = this.player;
		await this.act('role not changed', () =>
			this.net.joinRoom(this.code, name, role, country, this.player.forRoom(), role)
		);
	}

	/** Дія не вдалася: сказати людині й записати З КОДОМ кімнати — інакше звіт не скаже, де. */
	#failed(what: string, error: unknown): void {
		toast.error('pairs.actionFailed');
		logService.error('network', what, { code: this.code, reason: String(error) });
		if (isDenied(error)) this.reload.noteDenial(this.code);
	}
}
