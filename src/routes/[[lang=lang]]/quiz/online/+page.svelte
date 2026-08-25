<script lang="ts">
	import { withRoom, withoutRoom } from '$lib/utils/roomUrl';
	import { awayStamps, waitView } from '$lib/utils/awayWait';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { startRoomBeat } from '$lib/net/roomBeat';
	import { COUNTDOWN_MS } from '$lib/config/roomLife';
	import { playerData } from '$lib/services/playerData.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import {
		DEV_TIME_FACTOR,
		ONLINE_GAMES,
		gamesToConfig,
		roomFitsGames
	} from '$lib/config/quizOnline';
	import type { Role, RoomTransport } from '$lib/net/roomTypes';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import QuizRooms from '$lib/components/quiz/QuizRooms.svelte';
	import QuizLobby from '$lib/components/quiz/QuizLobby.svelte';
	import QuizRoom from '$lib/components/quiz/QuizRoom.svelte';
	import type { PageData } from './$types';

	/** Дані маршруту: словник цієї сторінки, завантажений у `+page.ts`. */
	let { data }: { data: PageData } = $props();

	/**
	 * СПІЛЬНА ВІКТОРИНА: усі відповідають одночасно, кожен на своєму екрані.
	 *
	 * Модель партії й ціна, яку вона коштує (рахунок неперевірний), розписані в
	 * `config/quizOnline.ts`. Тут — тільки мережа й показ.
	 *
	 * ## БОРГ, НАЗВАНИЙ ЧИСЛОМ
	 *
	 * Мережева обв'язка тут та сама, що на `pairs/online`: вхід у кімнату,
	 * присутність, перелік кімнат, свої партії, «назад» через адресу, дії лідера.
	 * Приблизно 120 рядків повторюються майже дослівно.
	 *
	 * Це борг, а не задум. Правильний розв'язок — витягти загальний
	 * `RoomSession<M>` із фабрикою матчу, і він вимагає переписати робочу сторінку
	 * «Знайди пару», яку автор саме зараз перевіряє руками. Тому борг записаний у
	 * `PROJECT-CONTEXT.md` числом (120 рядків, два файли), і зменшити його треба
	 * ОДНИМ рефакторингом обох сторінок, а не третьою копією.
	 *
	 * Що з `pairs` перевикористано як є: `OnlineGate`, `RoomList`, `OnlineLobby`.
	 * Вони не знають ні про гру, ні про мережу — саме тому й підійшли.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Рядки вікторини ДОВАНТАЖУЮТЬСЯ окремим чанком (`i18n/quiz`).
	 *
	 * Причина заміряна: головний словник імпортує всі чотири мови статично, тобто
	 * вони лежать у першому payload КОЖНОГО відвідувача, а ці одинадцять рядків
	 * потрібні лише в кімнаті — і саме вони перевищили бюджет кореневого layout
	 * (120,5 КБ проти 120).
	 *
	 * У стані лежить СЛОВНИК, а перекладач похідний: функція в `$state` не
	 * оновлювала екран — рядки лишалися ключами, хоч словник і приїхав. Той самий
	 * взірець, що на сторінці акаунта, і та сама причина.
	 */
	/*
	 * Словник приходить пропом із `load` (`+page.ts`), а не з `onMount`: інакше
	 * сирі ключі лишаються в пререндері назавжди. `?? key` — запобіжник на
	 * невідому мову.
	 */
	const text = $derived((key: string) => data.quizText[key] ?? key);

	/**
	 * Версія ПРАВИЛ спільної вікторини. Різні версії в кімнату не пускають.
	 *
	 * Своя, не спільна з «Знайди пару»: правила там інші, і кімнати не змішуються
	 * (`gameId` різний). Одиниця — перша редакція.
	 */
	const RULES_VERSION = 1;
	const CLOCK_MS = 1000;

	/** Двоє — мінімум, щоб змагатися. Більше вікторина витримує без змін. */
	const MIN_PLAYERS = 2;

	let match = $state<QuizMatch | null>(null);
	let code = $state('');
	let joinCode = $state('');
	let isPrivate = $state(false);
	/** Перелік кімнат і свої партії — спільний контролер, див. `lobbyFeed`. */
	// Перелік читається з гілки СВОЄЇ гри: кімнати «Знайди пару» тут не з'являються.
	const lobby = new LobbyFeed('quiz');
	let me = $state('');
	let online = $state<string[]>([]);
	/** Коли гравця не стало онлайн. Ключ — `uid`; звідси відлік у вікні очікування. */
	let awaySince = $state<Record<string, number>>({});
	let busy = $state(false);
	let stops: Array<() => void> = [];
	let clock = $state(Date.now());
	const player = new PlayerIdentity(Math.random);

	/**
	 * Які ігри вибрано для НОВОЇ кімнати.
	 *
	 * Типово всі: людина, яка створює кімнату не думаючи про набір, мусить
	 * отримати повну вікторину, а не порожню.
	 */
	let picked = $state<string[]>(ONLINE_GAMES.map((game) => game.id));

	const takenNames = $derived(lobby.takenNames);
	const amHost = $derived(Boolean(me) && match?.hostUid === me);
	const joinUrl = $derived(browser && code !== '' ? page.url.href : '');

	const roomFromUrl = () => (browser ? (page.url.searchParams.get('room') ?? '') : '');

	/**
	 * Записати код у адресу — КРОКОМ в історії, і саме через `goto`.
	 *
	 * Тут був `pushState`, і він ламав режим ЦІЛКОМ. Причина в його контракті:
	 * поверхнева маршрутизація змінює `history` і `page.state`, але `page.url`
	 * НЕ ПРИСВОЮЄ ніколи — навпаки, зберігає стару адресу в записі історії, щоб
	 * `page.url` лишався узгоджений із завантаженим маршрутом і його даними.
	 *
	 * А ефект нижче читає рівно `page.url`. Тобто щойно кімната з'являлася, ефект
	 * бачив «в адресі кімнати немає» й одразу викидав із неї. Заміряно в браузері:
	 * `код 99`, `location.search` = `?room=99`, а `page.url` порожній — і виходило
	 * так, що зайти в кімнату було неможливо ні у вікторині, ні в «Знайди пару».
	 *
	 * `goto` — справжня навігація: вона і додає крок в історію (тобто «назад»
	 * веде на форму входу, як і задумано), і оновлює `page.url`. Тому джерело
	 * правди стало правдою, а не збігом.
	 *
	 * `await` обов'язковий: без нього все, що читає адресу далі, побачило б її в
	 * попередньому стані — той самий клас помилки, тільки на такт коротший.
	 */
	async function rememberInUrl(value: string) {
		if (!browser) return;
		await goto(withRoom(page.url, value), { noScroll: true, keepFocus: true });
	}

	/** Вийти з кімнати на форму входу. Кімнату не закриває. */
	function leaveRoom() {
		// Кімнати немає — локальний рахунок знову живе своїм життям.
		playerData.endOnline();
		for (const stop of stops) stop();
		stops = [];
		match = null;
		code = '';
		online = [];
	}

	// Адреса — джерело правди про кімнату: «назад» знімає `?room`, і дошка мусить
	// зникнути разом із ним. Те саме рішення, що на `pairs/online`.
	$effect(() => {
		if (match && roomFromUrl() !== code) leaveRoom();
	});

	$effect(() => {
		void player.load(settings.locale, takenNames);
	});

	async function enter(action: 'create' | 'join', quick = false) {
		if (busy) return;
		busy = true;
		try {
			const net = await import('$lib/net/rtdbRoom');
			const who = player.forEntry(takenNames);

			if (action === 'create') {
				code = await net.createRoom({
					gameId: 'quiz',
					rulesVersion: RULES_VERSION,
					seed: Math.floor(Math.random() * 2 ** 31),
					/*
					 * НАБІР ІГОР ЇДЕ В `config`, і саме тому спільна вікторина не
					 * потребує нової редакції правил: конверт уже дозволяє
					 * `Record<string, number>`, а прапорці 1/0 — числа.
					 */
					config: gamesToConfig(picked),
					name: who,
					country: player.country,
					avatar: player.forRoom(),
					autoStart: quick,
					isPrivate: quick ? false : isPrivate
				});
			} else {
				const wanted = joinCode.replace(/\D/g, '');
				const room = await net.peekRoom(wanted);
				if (!room) {
					toast.error('pairs.noRoom');
					return;
				}
				// Кімнати різних ігор не змішуються: у вікторині інші правила, і дошки
				// «Знайди пару» тут просто немає чим малювати.
				if (room.gameId !== 'quiz') {
					toast.error('quiz.otherGame');
					return;
				}
				if (room.rulesVersion !== RULES_VERSION) {
					toast.error('pairs.oldVersion');
					return;
				}
				code = wanted;
				await net.joinRoom(code, who, undefined, player.country, player.forRoom());
			}
			await rememberInUrl(code);

			const transport = await net.roomTransport(code);
			const connection = await import('$lib/net/firebase').then((m) => m.connect());
			me = connection.uid;

			const started = new QuizMatch(me, transport, dev ? DEV_TIME_FACTOR : 1);
			stops.push(started.listen());
			/*
			 * ЛОКАЛЬНИЙ РАХУНОК НА ПАУЗІ, поки триває спільна партія.
			 *
			 * Раунди грають ТІ САМІ контролери, що соло, і кожен додає свої 3–4 очки
			 * за правильну відповідь та пише «зіграно партію» — на КОЖЕН раунд, тобто
			 * дванадцять разів за вікторину. Замість цього в кінці партії
			 * зараховується один раз, за курсом двох шкал (`awardQuizMatch`).
			 */
			playerData.beginOnline();

			const live = await import('$lib/net/presence');
			stops.push(await live.trackPresence(code));
			stops.push(
				await live.watchPresence(code, (uids) => {
					online = uids;
					/*
					 * ПРИСУТНІСТЬ ЇДЕ В МАТЧ, і саме це розморожує партію: раунд
					 * закінчується, коли відповіли ПРИСУТНІ, а не всі, хто колись
					 * зайшов (`members` не прибираються ніколи).
					 */
					started.present = uids;
					// Мить зникнення запамʼятовується ТУТ, бо тільки тут видно перехід.
					awaySince = awayStamps(started.players, uids, awaySince, Date.now());
				})
			);

			if (action === 'create') {
				/*
				 * ХВАТА БІЛЬШЕ НЕМА, і це виправлення, а не спрощення.
				 *
				 * Доти тут стояв `holdRoom(code)`: домовленість `onDisconnect().remove()`
				 * на ВСЮ кімнату, щоб покинуте лобі не лишалося в базі. Але
				 * перезавантаження сторінки — це теж розрив зʼєднання, тож кімната
				 * зникала під господарем: «Такої кімнати немає», і повернутися в неї не
				 * виходило нічим. Скарга автора саме про це.
				 *
				 * Покинуте прибирається й без хвата, двома засобами, які вже є: рядок
				 * зникає з переліку через дві хвилини тишини (`config/roomLife` за
				 * `info.aliveAt`), а сам запис зносить збирач своїх кімнат через 12 годин
				 * (`net/ownRooms`). Ціна — запис живе довше, ніж потрібно; виграш —
				 * перезавантаження перестало бути втратою кімнати.
				 */

				if (!isPrivate || quick) {
					await lobby.publish({
						code,
						hostUid: me,
						hostName: who,
						hostCountry: player.country,
						hostAvatar: player.forRoom(),
						rulesVersion: RULES_VERSION,
						players: 1,
						/*
						 * НАБІР ІГОР ЇДЕ В ЗАПИС ПЕРЕЛІКУ — без нього фільтр списку
						 * неможливий: `rooms` перелічувати заборонено, тож про чужу
						 * кімнату видно рівно те, що в самому записі.
						 */
						games: gamesToConfig(picked)
					});
					stops.push(() => lobby.unpublish());
				}
			}

			match = started;
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			const denied = /permission[_ ]denied/i.test(reason);
			const missing = reason === 'rules-missing';
			toast.error(missing ? 'pairs.rulesMissing' : denied ? 'pairs.rulesStale' : 'pairs.netFailed');
			logService.error('network', 'quiz room entry failed', { action, reason });
		} finally {
			busy = false;
		}
	}

	/** Зайти у вільну кімнату вікторини, а якщо таких немає — створити нову. */
	async function quickGame() {
		/*
		 * ФІЛЬТР ДІЄ І ТУТ, і це не педантизм: «швидка гра» без нього кидала б у
		 * кімнату з іграми, які людина щойно зняла. Не знайшлося такої — створимо
		 * свою з вибраним набором, тобто вибір спрацює в обох гілках.
		 */
		const free = lobby.rooms.find(
			(room) =>
				room.gameId === 'quiz' && room.players < MIN_PLAYERS && roomFitsGames(room.games, picked)
		);
		if (free) {
			joinCode = free.code;
			await enter('join', true);
			return;
		}
		await enter('create', true);
	}

	/** Дія лідера над кімнатою: один каркас на всі, як на `pairs/online`. */
	async function hostAction(run: (transport: RoomTransport) => Promise<void>) {
		if (!match || !amHost) return;
		try {
			const net = await import('$lib/net/rtdbRoom');
			await run(await net.roomTransport(code));
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'host action denied', { reason: String(error) });
		}
	}

	const switchAutoStart = (on: boolean) => hostAction((transport) => transport.setAutoStart(on));

	/**
	 * ЗМІНИТИ НАБІР ІГОР У КІМНАТІ — і, якщо кімната в переліку, там ТЕЖ.
	 *
	 * Два записи, бо це два різні місця з різним призначенням: `info.config`
	 * визначає ПАРТІЮ, а запис у `lobby` — те, за чим кімнату вибирають зі списку.
	 * Не оновити другий означало б, що фільтр бреше саме тому, хто ним
	 * скористався: у списку кімната обіцяє одні ігри, а зіграє в інші.
	 *
	 * Порядок саме такий: спершу кімната, потім довідка. Навпаки був би момент, у
	 * який список обіцяє те, чого в кімнаті ще немає.
	 *
	 * Чи кімната взагалі в переліку, знає сам перелік: закрита («лише друзі») туда
	 * не писалася, і `lobby.setGames` тоді нічого не робить.
	 */
	async function changeGames(games: string[]) {
		if (!match) return;
		await match.setGames(games);
		await lobby.setGames(code, gamesToConfig(games));
	}
	/**
	 * Прибрати того, хто зник. Дія лідера, і правило бази дозволяє саме її:
	 * ВИДАЛЕННЯ чужого рядка складу, а не зміну.
	 */
	const kick = (uid: string) => hostAction((transport) => transport.removeMember(uid));
	const rematch = () =>
		hostAction((transport) => transport.restart(Math.floor(Math.random() * 2 ** 31)));

	async function start() {
		if (!match) return;
		const players = match.players.length;
		if (players < MIN_PLAYERS) {
			toast.info('pairs.needPlayers');
			return;
		}
		const net = await import('$lib/net/rtdbRoom');
		await (await net.roomTransport(code)).setStatus('playing');
		lobby.unpublish();
	}

	async function close() {
		if (!match || !amHost) return;
		try {
			lobby.unpublish();
			const net = await import('$lib/net/rtdbRoom');
			await net.closeRoom(code);
			await goto(langPath(lang, 'quiz'));
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'host action denied', { reason: String(error) });
		}
	}

	async function setRole(role: Role) {
		if (!match || match.status !== 'lobby') return;
		const net = await import('$lib/net/rtdbRoom');
		await net.joinRoom(code, player.forEntry(takenNames), role, player.country, player.forRoom());
	}

	/** Я відповів — частка правильного в журнал. Очки порахує кожен сам. */
	async function answer(correct: number) {
		if (!match) return;
		try {
			await match.answer(correct);
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'quiz answer not saved', { reason: String(error) });
		}
	}

	/**
	 * ГОДИННИК ПАРТІЇ ЙДЕ ЧАСТІШЕ ЗА СЕКУНДУ, і це не марнотратство.
	 *
	 * На ньому смуга таймера раунду. Оновлення раз на секунду давало б смугу, що
	 * стрибає сімома кроками, — а раунд і триває сім секунд, тобто стрибок був би
	 * майже всією смугою.
	 */
	const ROUND_CLOCK_MS = 100;

	/*
	 * НАСТУПНИЙ РАУНД ОГОЛОШУЄ ГОСПОДАР, і рівно один раз.
	 *
	 * Прапорець потрібен, бо `$effect` перезапускається на кожен такт годинника, а
	 * умова «час таблу вийшов» лишається правдою, доки раунд не змінився. Без
	 * нього господар писав би той самий раунд десять разів на секунду; журнал
	 * відкидав би повтори (перше оголошення виграє), але писати їх однаково не
	 * треба.
	 */
	let announcing = false;

	$effect(() => {
		if (!browser || !match || !amHost) return;
		if (match.status !== 'playing' || match.over) return;
		// Партія щойно почалася — перший раунд оголошується без чекання.
		if (match.round < 0) {
			if (announcing) return;
			announcing = true;
			void match.startRound(0).finally(() => (announcing = false));
			return;
		}
		if (!match.nextDue(clock) || announcing) return;
		announcing = true;
		void match.startRound(match.round + 1).finally(() => (announcing = false));
	});

	// Відлік до автоматичного старту — той самий механізм, що в «Знайди пару»:
	// позначку ставить лідер, а бачать обидва.
	$effect(() => {
		if (!browser || !amHost || !match || match.status !== 'lobby') return;
		const ready = match.autoStart && match.players.length >= MIN_PLAYERS;
		if (!ready || match.countdownAt !== null) return;
		void hostAction((transport) => transport.setCountdown(true));
	});

	$effect(() => {
		if (!browser || !amHost || !match || match.status !== 'lobby') return;
		const startedAt = match.countdownAt;
		if (startedAt === null) return;
		const left = Math.max(0, startedAt + COUNTDOWN_MS - Date.now());
		const timer = setTimeout(() => void start(), left);
		return () => clearTimeout(timer);
	});

	/**
	 * Усе про чекання одним викликом — правила живуть у `utils/awayWait`.
	 *
	 * Пауза й зникнення дають один відлік і одне вікно: на екрані це один стан
	 * («партія стоїть, і ось чому»), і два різні числа читалися б як випадковість.
	 */
	const wait = $derived(waitView(match, awaySince, clock, me));

	/*
	 * Пауза раунду — наслідок стану вище. Саме `$effect`, а не похідна: зсув
	 * дедлайну це ЗМІНА стану партії, і робити її в похідній означало б писати з
	 * читання.
	 */
	$effect(() => void match?.setHold(wait.hold, clock));

	/*
	 * Годинник іде, поки на нього чекають: відлік у лобі АБО раунд партії.
	 *
	 * Під час раунду частіше — на ньому смуга таймера. Поза цими двома станами
	 * таймера немає зовсім: інтервал, який тікає на порожньому екрані, — це
	 * розряджений акумулятор і нічого більше.
	 */
	const clockNeeded = $derived(
		(match?.countdownAt ?? null) !== null ||
			(match !== null && match.status === 'playing' && !match.over) ||
			(match !== null && match.away.length > 0)
	);

	$effect(() => {
		if (!browser || !clockNeeded) return;
		const counting = (match?.countdownAt ?? null) !== null;
		const every = counting && match?.status !== 'playing' ? CLOCK_MS : ROUND_CLOCK_MS;
		clock = Date.now();
		const timer = setInterval(() => (clock = Date.now()), every);
		return () => clearInterval(timer);
	});

	/*
	 * Перелік і свої партії живуть ЛИШЕ поки видно форму входу.
	 *
	 * Тримати підписку під час партії означало б слухати чужі кімнати замість
	 * своєї — і платити за це трафіком на кожну чужу зміну.
	 */
	$effect(() => {
		if (!browser || match) return;
		// Імʼя перекидається тут, бо підставляється воно ДО приїзду переліку.
		return lobby.watch((names) => player.settle(names));
	});

	$effect(() => {
		if (!browser || match) return;
		return lobby.load();
	});

	/**
	 * БАЛИ ЗА ПАРТІЮ нараховуються один раз, у мить, коли вона скінчилася.
	 *
	 * Ключ ідемпотентності — зерно партії: «зіграти ще» ставить нове зерно й стирає
	 * журнал, тобто наступна партія отримає своє нарахування, а поточна не отримає
	 * другого. Без цього ефект, що перезапускається на кожен приїзд ходу, доливав
	 * би бали доти, доки хтось дивиться на екран підсумку.
	 */
	let awardedSeed = -1;

	$effect(() => {
		if (!browser || !match || !match.over) return;
		if (match.seed === awardedSeed) return;
		awardedSeed = match.seed;
		playerData.awardQuizMatch(match.myScore);
	});

	/*
	 * Серцебиття кімнати, поки вона відкрита: від нього список «продовжити партію»
	 * відрізняє покинуту кімнату від тієї, з якої щойно вийшли. Сам такт — у
	 * `net/roomBeat.ts`, бо сторінок дві.
	 */
	$effect(() => {
		if (!browser || !match || !code) return;
		return startRoomBeat(code);
	});

	onMount(() => {
		/*
		 * «НАЗАД» РОБИТЬ ОДИН КРОК, і крок залежить від того, де я стою.
		 *
		 * Доти тут стояв один жорсткий напрямок на два різні екрани: із кімнати
		 * «назад» вело в розділ «Вікторина», перескочивши форму входу. Скарга автора
		 * саме про це: з `?room=##` мусить вести на `/quiz/online/`.
		 *
		 * У кімнаті крок — це ЗНЯТИ `?room`: адреса тут джерело правди, і ефект
		 * нижче сам розбирає кімнату, коли параметр зникає. Тобто «назад» не
		 * дублює вихід, а користується тим самим шляхом.
		 */
		const release = settings.claimHeader(
			'menu.quiz',
			() =>
				void goto(code === '' ? langPath(lang, 'quiz') : withoutRoom(page.url), {
					noScroll: true,
					keepFocus: true
				})
		);
		void player.loadCountry();

		const saved = roomFromUrl();
		if (saved) {
			joinCode = saved;
			void enter('join');
		}

		return () => {
			for (const stop of stops) stop();
			stops = [];
			release();
		};
	});
</script>

<div
	class="quiz-online"
	class:quiz-online--gate={match === null}
	class:quiz-online--playing={match !== null && match.status !== 'lobby'}
>
	{#if !match}
		<OnlineGate
			bind:name={player.value}
			bind:joinCode
			bind:isPrivate
			bind:country={player.country}
			{busy}
			onRandomName={() => player.reroll(takenNames)}
			onCreate={() => enter('create')}
			onJoin={() => enter('join')}
			onQuickGame={quickGame}
		>
			{#snippet roomList()}
				<!--
					НАБІР ІГОР ТУТ — ФІЛЬТР, а не панель налаштувань.

					Доти він стояв окремою панеллю над списком і робив одне: задавав
					`config` кімнаті, яку ти створиш. Автор попросив прибрати його
					звідси у фільтр, а правити набір — у самій кімнаті. Обидві
					половини цього тепер справджені: тут фільтр (`QuizRooms`), а в
					лобі кімнати той самий набір править господар.

					Вибір лишається ОДИН, і це навмисно: «у що я хочу грати» сіє чужі
					кімнати й задає свою. Два різні набори на ті самі шість кнопок
					означали б, що людина мусить тримати в голові, який із них зараз
					діє.
				-->
				<QuizRooms
					{text}
					rooms={lobby.rooms}
					resume={lobby.own}
					friends={lobby.friends}
					hasMore={lobby.hasMore}
					unavailable={lobby.unavailable}
					{busy}
					{picked}
					onPick={(games) => (picked = games)}
					onClose={(dead) =>
						void lobby.close(dead).then((done) => {
							if (!done) toast.error('pairs.actionFailed');
						})}
					onEnter={(chosen) => {
						joinCode = chosen;
						void enter('join');
					}}
				/>
			{/snippet}
		</OnlineGate>
	{:else if match.status === 'lobby'}
		<!--
			Лобі вікторини — спільне лобі ПЛЮС набір ігор кімнати, і зʼєднані вони в
			`QuizLobby`, а не тут: `OnlineLobby` спільне з «Знайди пару» й про ігри не
			знає, а ця сторінка стоїть на межі розміру. Той самий взірець, що
			`QuizRooms` для списку кімнат.
		-->
		<QuizLobby
			{text}
			{match}
			{code}
			{joinUrl}
			{online}
			{me}
			{amHost}
			{clock}
			onRole={setRole}
			onStart={start}
			onAutoStart={switchAutoStart}
			onGames={changeGames}
		/>
	{:else}
		<!--
			ПАРТІЯ Й ПІДСУМОК — в окремому компоненті.

			Сторінка тримає вхід у кімнату: код, присутність, перелік, дії лідера.
			`QuizRoom` не знає про мережу зовсім — він читає матч і час, і саме тому
			підсумок у ньому однаковий в усіх, а не збирається з двох різних гілок
			сторінки.
		-->
		<QuizRoom
			{text}
			{match}
			{me}
			{lang}
			{amHost}
			{clock}
			{wait}
			onPause={() => void match?.pause()}
			onResume={() => void match?.resume()}
			goOn={match.goOn}
			onGoOn={() => void match?.voteGoOn()}
			onanswer={answer}
			onRematch={rematch}
			onClose={close}
			onkick={kick}
		/>
	{/if}
</div>

<style>
	.quiz-online {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		/*
		 * ШИРИНА ОБМЕЖЕНА, а не «майже все вікно».
		 *
		 * Тут стояло `width: 95%; max-width: 96vw`, і на широкому екрані дошка
		 * «Роздай страви» розповзалася на всю ширину: три мішені по пів метра, а
		 * підпис і кнопка «Далі» посередині пустки. Автор надіслав знімок саме
		 * цього — «розтягнутий та поломаний інтерфейс».
		 *
		 * 900px — ширина, за якої в ЛОБІ все читається без прокрутки: перелік
		 * кімнат, поля й набір ігор. Партія має інші потреби — див. нижче.
		 */
		width: 100%;
		max-width: 900px;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

	/*
	 * ПІД ПАРТІЮ СТОВПЕЦЬ ШИРШАЄ, під лобі — ні.
	 *
	 * Кожна гра тепер обмежує себе сама (`--measure-*` у `QuizBoard`), тож
	 * стовпець більше не мусить її стримувати — але мусить ДАВАТИ їй місце.
	 * «Де живем?» від 1000px просить 1100px під один ряд із дев'яти зон, і в
	 * стовпці на 900 вона його не отримувала: зони тиснулися, а підпис «Ліс
	 * помірної зони» ламався в стовпчик по слову.
	 *
	 * Лобі при цьому лишається вузьким навмисно: перелік кімнат і поля на 1100px
	 * — це рядок, який око не проходить за раз.
	 */
	.quiz-online--playing {
		max-width: var(--measure-habitat-wide);
	}

	/*
	 * ПІД ФОРМОЮ ВХОДУ СТОВПЕЦЬ ШИРШАЄ — бо там уже не стовпець.
	 *
	 * `OnlineGate` на широкому екрані розкладається в три стовпці (лівий: код і
	 * «хто може зайти», середина: швидка гра й імʼя, правий: кімнати), а в 900px
	 * три стовпці не влазять: вони починаються з 64rem, тобто самі просять близько
	 * 1100. Скарга автора була саме про цю пустку — «в один стовпчик, а праворуч і
	 * ліворуч купа вільного місця».
	 *
	 * Міркування «лобі лишається вузьким навмисно» (нижче) стосувалося ОДНОГО
	 * стовпця: рядок списку кімнат на 1100px око не проходить за раз. У трьох
	 * стовпцях кожен вужчий за ті самі 900 — тобто рядки стали КОРОТШІ, а не довші.
	 */
	.quiz-online--gate {
		max-width: 1120px;
	}
</style>
