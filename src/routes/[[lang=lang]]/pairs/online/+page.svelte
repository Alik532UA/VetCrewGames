<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { PairsMatch } from '$lib/controllers/pairsMatch.svelte';
	import { PlayerName } from '$lib/controllers/playerName.svelte';
	import type { Role, RoomTransport } from '$lib/net/roomTypes';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import RoomList from '$lib/components/pairs/RoomList.svelte';
	import type { LobbyRoom } from '$lib/net/lobby';
	import type { OwnRoom } from '$lib/net/ownRooms';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import OnlineRoom from '$lib/components/pairs/OnlineRoom.svelte';

	/**
	 * Спільна партія «Знайди пару»: створити кімнату або зайти за кодом.
	 *
	 * Мережа тут — це три виклики (`createRoom`, `joinRoom`, `roomTransport`), а
	 * правила партії живуть у `PairsMatch` і не знають про базу нічого. Тому та
	 * сама гра перевіряється тестами на підставному транспорті, а тут лишається
	 * рівно те, що без мережі не робиться.
	 *
	 * **Пауза перед перегортанням — ХІД, а не таймер.** Її оголошує той, чия
	 * черга: два таймери на двох пристроях спрацювали б у різні миті, і дошки
	 * розійшлися б на той час, поки один уже перегорнув, а другий ще ні.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	/** Скільки видно невдалу пару, перш ніж її оголосять закритою. */
	const PEEK_MS = 1200;

	/**
	 * Версія ПРАВИЛ цієї гри. Різні версії в кімнату не пускають.
	 *
	 * 1 → 2: у ході з'явився серверний час (`at`), у кімнаті — позначка початку
	 * партії (`startedAt`), і на них стоїть межа очікування. Стара збірка пише ходи
	 * без часу — правило бази їх відкидає, тож змішувати версії не можна, і саме
	 * для цього поле й існує: відмова зайти замість тихо зламаної партії.
	 */
	const RULES_VERSION = 2;

	/**
	 * Як часто оновлювати годинник для межі очікування.
	 *
	 * Секунда тут не про плавність, а про те, що інтервал існує ЛИШЕ поки хтось
	 * чекає на чужий хід (див. `$effect` нижче): у решту часу таймера немає взагалі.
	 */
	const CLOCK_MS = 1000;

	/**
	 * Скільком гравцям місце в партії «Знайди пару».
	 *
	 * Двоє — це сама гра, а не налаштування: дошка ділиться між двома чергами, і
	 * третій може бути лише глядачем. Число тут потрібне швидкій грі: вона мусить
	 * відрізнити кімнату, де ще чекають, від тієї, де вже грають удвох.
	 *
	 * Не з правил бази: там стеля 12 на всі ігри проєкту, і це інша величина.
	 */
	const PAIRS_PLAYERS = 2;

	/**
	 * Скільки триває відлік до автоматичного старту.
	 *
	 * Пʼять секунд — не «щоб гарно»: це та межа, за яку встигаєш прочитати, що
	 * відбувається, і натиснути «Не починати», але не встигаєш занудьгувати. Менше
	 * — і кнопка скасування існує лише формально; більше — і двоє, які вже готові,
	 * сидять і чекають на таймер.
	 */
	const COUNTDOWN_MS = 5000;

	let match = $state<PairsMatch | null>(null);
	let code = $state('');
	let joinCode = $state('');
	/**
	 * Підпис гравця — окремий контролер.
	 *
	 * Тут зійшлися збережений вибір людини, підставлене нами імʼя,
	 * довантажуваний словник імен і перелік уже зайнятих. Розсипані по
	 * сторінці, вони давали три місця, кожне з яких могло переписати поле.
	 */
	const player = new PlayerName(Math.random);
	/**
	 * Чи ховати створювану кімнату зі списку.
	 *
	 * Типово `false` — відкрита. Кімната поза списком потребує, щоб код комусь
	 * передали; кімната в списку не потребує нічого, тож саме вона й типова.
	 * Приватність — вибір для того, хто грає з конкретною людиною.
	 */
	let isPrivate = $state(false);
	/** Перелік відкритих кімнат. Порожній і поки не підписалися, і коли їх немає. */
	let rooms = $state<LobbyRoom[]>([]);
	/** Чи лишилося щось за межею запиту: обрізку треба показати, а не сховати. */
	let roomsHasMore = $state(false);
	/**
	 * Перелік не читається — майже завжди «правила ще не викладені».
	 *
	 * Окремо від «кімнат немає»: порожній список і недоступний список — різні
	 * повідомлення, і друге не мусить читатися як перше.
	 */
	let roomsUnavailable = $state(false);
	/**
	 * Партії, які вже йдуть і до яких я належу.
	 *
	 * Окремо від `rooms` навмисно: у переліку лежить те, куди можна ЗАЙТИ, а це —
	 * те, куди можна ВЕРНУТИСЯ. Джерела теж різні: перелік читається з `lobby`,
	 * спільної гілки, а ці — з мого приватного індексу `myRooms/{uid}`. Змішати
	 * їх в одному масиві означало б або показати чужі розпочаті партії, або
	 * приховати свою.
	 */
	let ownRooms = $state<OwnRoom[]>([]);
	/** Зняти свою кімнату з переліку. `null`, якщо вона закрита або вже знята. */
	let unlist: (() => void) | null = null;
	let me = $state('');
	let online = $state<string[]>([]);
	let busy = $state(false);
	let stops: Array<() => void> = [];
	/** Годинник сторінки. Контролер часу не питає — йому його передають. */
	let clock = $state(Date.now());
	/** Скасувати домовленість «зникла вкладка господаря — зникла кімната». */
	let releaseHold: (() => void) | null = null;

	const myRole = $derived<Role>(
		match?.members.find((member) => member.uid === me)?.role ?? 'player'
	);
	/*
	 * Господар — той, кого назвала КІМНАТА. Не «перший у списку»: база віддає склад
	 * за алфавітом ключів, і кнопка «Почати» зникала в господаря, щойно заходив
	 * хтось із меншим `uid`.
	 */
	const amHost = $derived(Boolean(me) && match?.hostUid === me);

	/**
	 * Словник імен ДОВАНТАЖУЄТЬСЯ, тож ефект стежить за мовою.
	 *
	 * Причина винесення словника з основного — у `i18n/crew/index.ts`: 86 імен
	 * на кожну з чотирьох мов важили 3 КБ gzip у першому payload КОЖНОГО
	 * відвідувача, а читає їх рівно ця сторінка.
	 */
	$effect(() => {
		void player.load(settings.locale, takenNames);
	});

	/**
	 * Імена, уже видані тим, хто зараз онлайн.
	 *
	 * Джерело — перелік кімнат: це ЄДИНЕ, що клієнт знає про інших до входу в
	 * кімнату. Тобто це підписи господарів відкритих кімнат, а не всіх людей у
	 * грі, — і межа названа навмисно, бо решти клієнт не бачить і не має права
	 * бачити: `presence` живе під кодом кімнати, а перелічити `rooms` правила
	 * забороняють.
	 *
	 * Цього досить для задачі, яку ставив автор: збіг помітний саме там, де імена
	 * стоять поруч у списку.
	 */
	const takenNames = $derived(rooms.map((room) => room.hostName));




	/**
	 * Код кімнати живе в АДРЕСІ, а не лише в памʼяті.
	 *
	 * Дві причини, і друга важливіша. Перезавантаження сторінки більше не викидає з
	 * партії — а воно трапляється саме тоді, коли найдорожче: гра оновилася, зникла
	 * мережа, натиснули «назад». І посилання стає запрошенням: замість диктувати
	 * пʼять літер, його надсилають.
	 *
	 * Читається під `browser`: `page.url.searchParams` під час prerender КИДАЄ, і
	 * збірка впала б, а не сторінка.
	 */
	const roomFromUrl = () => (browser ? (page.url.searchParams.get('room') ?? '') : '');

	function rememberInUrl(value: string) {
		if (!browser) return;
		const url = new URL(page.url);
		url.searchParams.set('room', value);
		// `replaceState`, а не `goto`: це та сама сторінка, і крок в історії тут
		// означав би, що «назад» веде в порожню кімнату.
		replaceState(url, {});
	}

	/**
	 * Зайти в кімнату або створити її.
	 *
	 * `quick` доходить сюди лише по одній дорозі — від кнопки «швидка гра», — і
	 * вирішує рівно одне: чи вмикати автостарт у новій кімнаті. Окремої функції
	 * створення заради цього немає: усе інше в шляху те саме, а копія розійшлася б
	 * на першій же правці.
	 */
	async function enter(action: 'create' | 'join', quick = false) {
		if (busy) return;
		busy = true;
		try {
			const net = await import('$lib/net/rtdbRoom');
			const who = player.forEntry(takenNames);
			const layout = layoutForViewport();

			if (action === 'create') {
				code = await net.createRoom({
					gameId: 'pairs',
					rulesVersion: RULES_VERSION,
					seed: Math.floor(Math.random() * 2 ** 31),
					/*
					 * Розкладка належить КІМНАТІ, а не екрану того, хто створив: сітка,
					 * різна на двох пристроях, дала б різні дошки з того самого зерна.
					 * Тому вона лягає в кімнату числами один раз — і далі однакова в усіх.
					 */
					config: { pairs: layout.pairs, cols: layout.cols },
					name: who,
					/*
					 * АВТОСТАРТ ЛИШЕ ДЛЯ ШВИДКОЇ ГРИ, і це рішення автора.
					 *
					 * Кімнату, створену руками, відкривають для когось конкретного:
					 * надсилають код і чекають саме на нього. Партія, що почалася сама,
					 * щойно зайшов ХТОСЬ, тут була б несподіванкою. Швидка гра —
					 * навпаки: вона зводить двох незнайомців, і зайвий натиск лише
					 * заважає.
					 *
					 * Господар може перемкнути режим у лобі — обидві кнопки там видно.
					 */
					autoStart: quick
				});
			} else {
				const room = await net.peekRoom(joinCode.trim().toUpperCase());
				if (!room) {
					toast.error('pairs.noRoom');
					return;
				}
				/*
				 * Версія правил звіряється ДО входу. Сайт роздається з кешу, тож двоє
				 * легко опиняються на різних збірках — а з детермінізмом це означає різні
				 * світи з того самого зерна. Відмова зайти краща за тихе розходження.
				 */
				if (room.rulesVersion !== RULES_VERSION) {
					toast.error('pairs.oldVersion');
					return;
				}
				code = joinCode.trim().toUpperCase();
				// Роль НЕ передаємо: повернувшись у кімнату, глядач мусить лишитися
				// глядачем, інакше склад зміниться й дошку перероздасть усім.
				await net.joinRoom(code, who);
			}
			rememberInUrl(code);

			const transport = await net.roomTransport(code);
			const connection = await import('$lib/net/firebase').then((m) => m.connect());
			me = connection.uid;

			const started = new PairsMatch(me, transport);
			stops.push(started.listen());

			// Присутність — окремий модуль: інша природа записів (їх прибирає сервер),
			// і в кімнаті вони не живуть навмисно.
			const live = await import('$lib/net/presence');
			stops.push(await live.trackPresence(code));
			stops.push(await live.watchPresence(code, (uids) => (online = uids)));

			/*
			 * Кімната, у яку ніхто не зайшов, зникає разом із вкладкою господаря.
			 *
			 * Це закриває найчастіший випадок покинутого сміття: створив кімнату, нікого
			 * не дочекався, закрив вкладку. Прибирає сервер (`onDisconnect`), і нових
			 * прав для цього не потрібно — господар і так може знести свою кімнату. Тому
			 * тут немає «зачистки старих кімнат при вході», яка вимагала б права
			 * видаляти ЧУЖЕ (CLOUD-DATABASE-v8 § 9.3).
			 */
			if (action === 'create') {
				releaseHold = await live.holdRoom(code);
				stops.push(() => releaseHold?.());

				/*
				 * ВІДКРИТА кімната потрапляє в перелік; закрита — ні, і в цьому вся
				 * різниця між ними.
				 *
				 * Запис віддає код усім, хто читає перелік, тому рішення лишається за
				 * господарем і зроблене воно прапорцем у формі. Подробиці ціни — у
				 * `net/lobby.ts`.
				 *
				 * Невдача публікації НЕ скасовує створення: кімната працює й без
				 * запису, просто її не видно в списку — тобто найгірший наслідок
				 * дорівнює стану «закрита кімната».
				 */
				if (!isPrivate) {
					try {
						const list = await import('$lib/net/lobby');
						unlist = await list.publishRoom({
							code,
							// `me` уже відомий: його виставив `connect()` вище, до створення
							// матчу. Правило бази однаково звірить його з господарем кімнати.
							hostUid: me,
							hostName: who,
							gameId: 'pairs',
							rulesVersion: RULES_VERSION,
							players: 1
						});
						stops.push(() => unlist?.());
					} catch (error) {
						logService.warn('network', 'room not published', { code, error: String(error) });
					}
				}
			}

			match = started;
		} catch (error) {
			/*
			 * ТРИ РІЗНІ ПРИЧИНИ, і кожна вимагає іншої дії.
			 *
			 * «Правила не пускають» не лікується повтором, «не склалося» —
			 * лікується. Перша версія казала «спробуйте ще раз» на обидві, тобто
			 * радила безглузде на половині випадків.
			 *
			 * Третю додано після справжнього випадку: `PERMISSION_DENIED` означає, що
			 * база відкинула запис, і найчастіша причина цього — правила в Firebase
			 * СТАРІШІ за цю збірку. Так буває рівно тоді, коли клієнт уже пише нове
			 * поле, а `$other: false` у старому правилі відкидає весь запис. Порада
			 * «спробуйте ще раз» тут теж безглузда: помагає лише викладання правил.
			 */
			const reason = error instanceof Error ? error.message : String(error);
			const denied = /permission[_ ]denied/i.test(reason);
			const missing = reason === 'rules-missing';
			toast.error(missing ? 'pairs.rulesMissing' : denied ? 'pairs.rulesStale' : 'pairs.netFailed');
			logService.error('network', 'room entry failed', { action, reason });
		} finally {
			busy = false;
		}
	}

	/**
	 * ШВИДКА ГРА: зайти у вільну кімнату, а якщо таких немає — створити відкриту.
	 *
	 * Вибір найстаршої з вільних, а не найновішої. Список показує найновіші вгорі
	 * (так видно, що щойно з'явилося), але заходити треба до того, хто чекає
	 * ДОВШЕ — інакше кімната, створена першою, стоятиме порожньою, поки біля
	 * свіжих збирається черга.
	 *
	 * ЗБІГ ДВОХ НАТИСКІВ не потребує захисту, і це варто сказати прямо, бо
	 * виглядає інакше:
	 *
	 *   обидва вибрали ту саму кімнату → обидва зайшли, і це рівно те, що
	 *     потрібно: двоє гравців у кімнаті на двох;
	 *   обидва не знайшли нічого й створили → дві кімнати по одному, і кожен
	 *     побачить кімнату іншого в списку наступним же кадром.
	 *
	 * Тобто гірший випадок — це «створилося на одну кімнату більше», і він
	 * лікується сам. Блокування ж (транзакція чи оренда коду) коштувало б окремої
	 * гілки в базі й правила до неї — заради стану, який не є помилкою.
	 *
	 * Версія правил перевіряється ТУТ, а не після спроби: зайти в кімнату з
	 * іншою версією однаково не вийде (`enter` покаже «гра оновилася»), і
	 * пропонувати таку кімнату швидкій грі — це запрошувати до відмови.
	 */
	async function quickGame() {
		if (busy) return;

		const free = rooms
			.filter(
				(room) =>
					room.gameId === 'pairs' &&
					room.rulesVersion === RULES_VERSION &&
					room.players < PAIRS_PLAYERS
			)
			.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

		if (free.length > 0) {
			joinCode = free[0].code;
			await enter('join');
			return;
		}

		// Своя кімната для швидкої гри — завжди ВІДКРИТА: сенс дії в тому, щоб у неї
		// хтось зайшов, а закрита цього не дозволяє за побудовою.
		isPrivate = false;
		// `true` — автостарт: сенс швидкої гри в тому, щоб партія почалася сама,
		// щойно зібралися двоє. У кімнаті, створеній руками, це виключено.
		await enter('create', true);
	}

	async function setRole(role: Role) {
		if (!match || match.status !== 'lobby') return;
		const net = await import('$lib/net/rtdbRoom');
		await net.joinRoom(code, player.forEntry(takenNames), role);
	}

	async function start() {
		if (!match) return;
		const players = match.members.filter((member) => member.role === 'player');
		if (players.length < 2) {
			toast.info('pairs.needPlayers');
			return;
		}
		const net = await import('$lib/net/rtdbRoom');
		await (await net.roomTransport(code)).setStatus('playing');
		/*
		 * Партія почалася — домовленість «зникла вкладка, зникла кімната»
		 * скасовується. Обрив звʼязку посеред гри не має нищити партію, у яку ще
		 * хочуть повернутися.
		 */
		releaseHold?.();
		releaseHold = null;

		/*
		 * І з переліку теж: у списку мусять бути лише кімнати, куди ще можна зайти.
		 * Партія, що вже йде, — це рядок, який обіцяє гру й дає роль глядача.
		 */
		unlist?.();
		unlist = null;
	}

	/**
	 * Забрати чергу в того, хто зник.
	 *
	 * Час беремо з годинника сторінки, а контролер уже перевіряє, чи вийшла межа.
	 * Остаточне слово однаково не за сторінкою: законність цього ходу перевіряють
	 * усі учасники за серверними позначками з журналу.
	 */
	async function takeTurn() {
		if (!match) return;
		try {
			await match.yieldTurn(Date.now());
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'yield failed', { reason: String(error) });
		}
	}

	/**
	 * Завершити партію, з якої суперник не вернувся.
	 *
	 * Доступна за тієї самої умови, що й «забрати хід», і НЕ лише господареві:
	 * лишається на дошці частіше саме гість — пішов той, хто роздавав. Тому це хід
	 * у журналі, а не переведення кімнати в `over`, яке правило дозволяє лише
	 * господареві (див. `endMatch` у контролері).
	 */
	async function endMatch() {
		if (!match) return;
		try {
			await match.endMatch(Date.now());
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'end match failed', { reason: String(error) });
		}
	}

	/**
	 * Закрити кімнату — ЯВНОЮ кнопкою, а не при виході зі сторінки.
	 *
	 * Відрізнити «пішов назовсім» від «перезавантажив» на клієнті неможливо, а
	 * видалити кімнату, у якій ще хотіли зіграти ще раз, гірше за кілобайт сміття в
	 * базі. Тому рішення лишається за господарем — і воно видиме.
	 */
	async function close() {
		if (!match || !amHost) return;
		try {
			// Спершу з переліку, і лише потім сама кімната: у зворотному порядку є
			// вікно, у якому в списку стоїть рядок кімнати, якої вже немає.
			unlist?.();
			unlist = null;
			const net = await import('$lib/net/rtdbRoom');
			await net.closeRoom(code);
			await goto(langPath(lang, 'pairs'));
		} catch (error) {
			hostActionFailed(error);
		}
	}

	/**
	 * Дія господаря над кімнатою — ОДИН каркас на всі.
	 *
	 * `rematch` і `switchAutoStart` повторювали той самий набір: перевірити, що я
	 * господар, підвантажити транспорт, зловити помилку й сказати про неї. Повтор
	 * дорогий не рядками, а тим, що `catch` легко забути в наступній копії — і
	 * кнопка змовчить, як уже змовчала одного разу «Зіграти ще».
	 */
	async function hostAction(run: (transport: RoomTransport) => Promise<void>) {
		if (!match || !amHost) return;
		try {
			const net = await import('$lib/net/rtdbRoom');
			await run(await net.roomTransport(code));
		} catch (error) {
			hostActionFailed(error);
		}
	}

	/** Нова партія в тій самій кімнаті. Роздає господар: зерно одне на всіх. */
	const rematch = () => hostAction((t) => t.restart(Math.floor(Math.random() * 2 ** 31)));

	/**
	 * Дія господаря не вдалася — і людина мусить про це почути.
	 *
	 * Виміряно на живій базі: «Зіграти ще» впиралося в `PERMISSION_DENIED` (правила
	 * в консолі були старіші за код), і кнопка МОВЧАЛА — помилка лишалася
	 * необробленою обіцянкою в консолі. Натиснути й не дізнатися нічого гірше, ніж
	 * почути «сервер не дозволив»: у другому випадку зрозуміло хоч куди дивитися.
	 */
	function hostActionFailed(error: unknown) {
		toast.error('pairs.actionFailed');
		logService.error('network', 'host action denied', { reason: String(error) });
	}

	/**
	 * Пауза після невдалої пари — і тільки на пристрої того, чия черга.
	 *
	 * `$effect`, а не таймер у кліку: перегорнути треба й тоді, коли пару відкрив
	 * не ти, а дошка все одно чекає — наприклад, після перезавантаження сторінки
	 * посеред чужого ходу.
	 */
	$effect(() => {
		if (!browser || !match?.game.awaitingPeek || !match.myTurn) return;
		const timer = setTimeout(() => void match?.resolve(), PEEK_MS);
		return () => clearTimeout(timer);
	});

	/**
	 * Годинник — лише поки на нього чекають.
	 *
	 * `yieldReadyAt` віддає `null`, коли межа очікування незастосовна (моя черга,
	 * глядач, партія скінчилася), — і тоді інтервалу немає взагалі. Секундний
	 * таймер, що цокає всю партію, тут був би витратою батареї на нічого.
	 */
	$effect(() => {
		// Друга причина цокати — відлік у лобі: без неї число на екрані стояло б
		// нерухомо, поки таймер господаря тихо доходив до нуля.
		const counting = match?.countdownAt !== null && match?.countdownAt !== undefined;
		const waiting = match?.yieldReadyAt !== null && match?.yieldReadyAt !== undefined;
		if (!browser || (!waiting && !counting)) return;
		clock = Date.now();
		const timer = setInterval(() => (clock = Date.now()), CLOCK_MS);
		return () => clearInterval(timer);
	});

	/**
	 * ПІДПИСКА НА ПЕРЕЛІК — лише поки видно форму входу.
	 *
	 * `$effect`, а не `onMount`: підписка мусить зникнути, щойно з'явився матч.
	 * Тримати її під час партії означало б слухати чужі кімнати замість своєї, і
	 * платити за це трафіком на кожну чужу зміну.
	 *
	 * ЦІНА, ЯКУ ВАРТО НАЗВАТИ: читання переліку вимагає авторизації, тож ця
	 * підписка входить анонімно ВІДРАЗУ при відкритті сторінки — доти вхід
	 * відкладався до створення чи приєднання. Анонімний обліковий запис при цьому
	 * НЕ множиться: `connect()` перевикористовує наявного користувача, і новий
	 * з'являється лише в того, хто вперше відкрив саму цю сторінку.
	 */
	$effect(() => {
		if (!browser || match) return;

		let stop: (() => void) | null = null;
		let dead = false;

		void (async () => {
			try {
				const list = await import('$lib/net/lobby');
				const off = await list.watchLobby({
					onRooms: (next, more) => {
						rooms = next;
						roomsHasMore = more;
						roomsUnavailable = false;
						/*
						 * Тут, а не в `$effect`: імʼя підставляється в `onMount`, тобто ДО
						 * приїзду переліку, і ефект, що читає й пише те саме `name`,
						 * довелося б стерегти від самозапуску. Умови «чиє це імʼя» живуть у
						 * `playerName.ts`, і `null` означає «не чіпати».
						 */
						player.settle(next.map((room) => room.hostName));
					},
					// Порожній список і недоступний список — РІЗНІ повідомлення. Доти
					// друге виглядало як перше, тобто «правила не викладені» читалося
					// як «ніхто не створив кімнату».
					onUnavailable: () => {
						rooms = [];
						roomsHasMore = false;
						roomsUnavailable = true;
					}
				});
				// Ефект міг зникнути, поки йшов імпорт і вхід: тоді підписку треба
				// знімати одразу, інакше вона живе довше за сторінку.
				if (dead) off();
				else stop = off;
			} catch (error) {
				roomsUnavailable = true;
				logService.warn('network', 'lobby subscription failed', { error: String(error) });
			}
		})();

		return () => {
			dead = true;
			stop?.();
		};
	});

	/**
	 * СВОЇ РОЗПОЧАТІ ПАРТІЇ — один запит, а не підписка.
	 *
	 * Задача, яку це закриває: вийшов зі сторінки посеред гри — і дороги назад не
	 * було взагалі. Код кімнати жив лише в адресі, а адреса губилася разом із
	 * вкладкою; індекс `myRooms` при цьому існував, але знав лише кімнати, де я
	 * господар, і читав його один збирач.
	 *
	 * ПІДПИСКИ ТУТ НЕ ТРЕБА, і це рішення, а не спрощення. Свої партії не
	 * зʼявляються самі: вони зʼявляються тоді, коли я сам зайшов у кімнату, — а
	 * після цього сторінка вже показує партію, не форму. Підписка платила б
	 * трафіком за зміни, яких у цей момент не буває.
	 *
	 * Читається щоразу, коли видно форму входу, — тобто й при поверненні з партії:
	 * закриту кімнату треба прибрати з рядка, а не лишити обіцянку.
	 */
	$effect(() => {
		if (!browser || match) return;

		let dead = false;
		void (async () => {
			const own = await import('$lib/net/ownRooms');
			// `listOwnRooms` не кидає: це довідка, і її відсутність лишає сторінку
			// такою, якою вона була до появи цього рядка.
			const found = await own.listOwnRooms();
			if (!dead) ownRooms = found;
		})();

		return () => {
			dead = true;
		};
	});

	/**
	 * ГОСПОДАР ВЕДЕ КІЛЬКІСТЬ ГРАВЦІВ У СВОЄМУ ЗАПИСІ.
	 *
	 * Він єдиний, хто може: правило дозволяє писати в `lobby/{code}` лише
	 * господареві, а склад він і так бачить підпискою. Гість не має ні права, ні
	 * потреби.
	 *
	 * Без цього список показував би «Гравців: 1» у кімнаті, де вже двоє, — і
	 * швидка гра водила б людей у повні кімнати, роблячи їх глядачами.
	 */
	$effect(() => {
		if (!browser || !unlist || !amHost || !match) return;
		const players = match.members.filter((member) => member.role === 'player').length;
		void import('$lib/net/lobby').then((list) => list.updatePlayers(code, players));
	});

	/**
	 * ВІДЛІК ДО АВТОМАТИЧНОГО СТАРТУ — вмикає ГОСПОДАР, бачать обоє.
	 *
	 * Навіщо взагалі. Швидка гра приводить двох незнайомців у кімнату, і хтось із
	 * них мусить натиснути «Почати». Той, хто зайшов другим, кнопки не має зовсім
	 * (вона господарева), а господар може дивитися в інше вікно — і партія не
	 * починається, хоч обоє на місці.
	 *
	 * Умова саме РІВНО двоє, а не «двоє й більше»: третій у кімнаті — глядач, і
	 * його поява не мусить нічого запускати. Менше двох — відлік гасне сам, і саме
	 * це дає гостю спосіб його скасувати: перейти в глядачі. Явна кнопка є в
	 * господаря.
	 *
	 * Записує лише господар — гостю правило бази й не дозволить.
	 */
	$effect(() => {
		if (!browser || !amHost || !match || match.status !== 'lobby') return;

		const players = match.members.filter((member) => member.role === 'player').length;
		/*
		 * РЕЖИМ КІМНАТИ — ПЕРША УМОВА, і саме її бракувало.
		 *
		 * Доти відлік залежав лише від складу, тобто «двоє гравців» означало
		 * «відлік мусить іти». Через це кнопка «не починати» не працювала: вона
		 * гасила позначку, склад лишався тим самим, і цей ефект умикав відлік
		 * заново наступним же тактом — заміряно автором, таймер скидався й
		 * запускався сам.
		 *
		 * Тепер «не починати» перемикає РЕЖИМ, і скасування тримається: `ready`
		 * стає хибним не через склад, а через рішення господаря.
		 */
		const ready = match.autoStart && players === PAIRS_PLAYERS;
		const running = match.countdownAt !== null;

		if (ready === running) return;
		void import('$lib/net/rtdbRoom')
			.then((net) => net.roomTransport(code))
			.then((transport) => transport.setCountdown(ready))
			.catch((error) => logService.warn('network', 'countdown not set', { error: String(error) }));
	});

	/**
	 * Коли відлік вийшов — партія починається.
	 *
	 * Таймер ГОСПОДАРЯ, і тільки його: перевести кімнату в `playing` має право
	 * лише він. У гостя те саме поле малює число, і розбіжність годинників зсуває
	 * лише показане, а не мить старту.
	 *
	 * `setTimeout` на ЗАЛИШОК, а не на пʼять секунд: господар міг перезавантажити
	 * сторінку посеред відліку, і тоді чекати треба менше, ніж спочатку.
	 */
	$effect(() => {
		if (!browser || !amHost || !match || match.status !== 'lobby') return;
		const startedAt = match.countdownAt;
		if (startedAt === null) return;

		const left = Math.max(0, startedAt + COUNTDOWN_MS - Date.now());
		const timer = setTimeout(() => void start(), left);
		return () => clearTimeout(timer);
	});

	/**
	 * Скільки секунд лишилося. `null` — відліку немає.
	 *
	 * Читає `clock`, який уже цокає раз на секунду, — тому окремого таймера тут
	 * немає. Але `clock` іде лише поки на нього чекають (`$effect` нижче), тож
	 * заводимо його й на відлік: інакше число стояло б на місці.
	 */
	const countdownLeft = $derived(
		match?.countdownAt === null || match?.countdownAt === undefined
			? null
			: Math.max(0, Math.ceil((match.countdownAt + COUNTDOWN_MS - clock) / 1000))
	);

	/**
	 * Перемкнути режим початку партії.
	 *
	 * Це ж і є «не починати»: воно не гасить таймер, а ВИКЛЮЧАЄ АВТОСТАРТ — і
	 * саме тому скасування тримається. Гасіння самої позначки бере на себе
	 * транспорт одним записом (див. `setAutoStart` у `net/rtdbRoom.ts`), щоб не
	 * було миті, коли режим уже «підтвердження», а таймер ще доходить до нуля.
	 */
	const switchAutoStart = (on: boolean) => hostAction((t) => t.setAutoStart(on));

	/** Кнопка «забрати чергу» існує лише коли межа вже вийшла. */
	const canTakeTurn = $derived(Boolean(match?.canYieldAt(clock)));

	/**
	 * Скільки лишилося до межі очікування. `null` — межа незастосовна.
	 *
	 * Число рахується ТУТ, бо межу знає контролер: екран отримує готовий залишок і
	 * не тримає власної копії `TURN_LIMIT_MS`. Читає `clock`, який уже цокає, поки
	 * `yieldReadyAt` не `null`, — тобто рівно ті секунди, коли на нього дивляться.
	 */
	const yieldInMs = $derived.by(() => {
		const ready = match?.yieldReadyAt;
		return ready === null || ready === undefined ? null : Math.max(0, ready - clock);
	});

	onMount(() => {
		const release = settings.claimHeader('memory.title', () => goto(langPath(lang, 'pairs')));

		/*
		 * Поле імені НЕ буває порожнім: або збережене, або кинуте з списку команди.
		 *
		 * Порожнє поле — це прохання вигадати, а вигадувати нікого не просили: імʼя
		 * тут лише для того, щоб суперник розумів, хто ходить. Кому підставлене не
		 * до душі, той натисне кубик або впише своє.
		 */
		const saved = roomFromUrl();
		if (saved) {
			// Повертаємося самі: код в адресі означає «я вже був у цій кімнаті».
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

<div class="online-page">
	{#if !match}
		<OnlineGate
			bind:name={player.value}
			bind:joinCode
			bind:isPrivate
			{busy}
			onRandomName={() => player.reroll(takenNames)}
			onCreate={() => enter('create')}
			onJoin={() => enter('join')}
			onQuickGame={quickGame}
		>
			{#snippet roomList()}
				<!--
					Список малює СТОРІНКА, а форма лишає для нього місце сніпетом.

					Причина не в компонуванні: `OnlineGate` навмисно не знає про мережу
					(див. його докблок), а список без мережі не існує. Сніпет тримає межу
					на місці — форма й далі перевіряється без бази.
				-->
				<RoomList
					{rooms}
					resume={ownRooms}
					hasMore={roomsHasMore}
					unavailable={roomsUnavailable}
					{busy}
					onEnter={(chosen) => {
						joinCode = chosen;
						void enter('join');
					}}
				/>
			{/snippet}
		</OnlineGate>
	{:else if match.status === 'lobby'}
		<OnlineLobby
			{code}
			members={match.members}
			{online}
			{me}
			{amHost}
			{myRole}
			{countdownLeft}
			autoStart={match.autoStart}
			onRole={setRole}
			onStart={start}
			onAutoStart={switchAutoStart}
		/>
	{:else}
		<OnlineRoom
			{match}
			{me}
			{online}
			onRematch={amHost ? rematch : undefined}
			onClose={amHost ? close : undefined}
			onYield={canTakeTurn ? takeTurn : undefined}
			onEnd={canTakeTurn ? endMatch : undefined}
			{yieldInMs}
		/>
	{/if}
</div>

<style>
	.online-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 95%;
		max-width: 96vw;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

</style>
