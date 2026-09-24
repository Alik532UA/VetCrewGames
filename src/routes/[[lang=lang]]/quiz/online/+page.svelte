<script lang="ts">
	import { withRoom, withoutRoom } from '$lib/utils/roomUrl';
	import { awayStamps, waitView } from '$lib/utils/awayWait';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { playerData } from '$lib/services/playerData.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { RoomSession, type RoomGame, type RoomPlace } from '$lib/controllers/roomSession.svelte';
	import {
		DEV_TIME_FACTOR,
		ONLINE_GAMES,
		gamesToConfig,
		roomFitsGames
	} from '$lib/config/quizOnline';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import QuizRooms from '$lib/components/quiz/QuizRooms.svelte';
	import QuizLobby from '$lib/components/quiz/QuizLobby.svelte';
	import QuizRoom from '$lib/components/quiz/QuizRoom.svelte';
	import { announceFrom, crossGameLinks } from '$lib/utils/crossGame';
	import type { PageData } from './$types';

	/** Дані маршруту: словник цієї сторінки, завантажений у `+page.ts`. */
	let { data }: { data: PageData } = $props();

	/**
	 * СПІЛЬНА ВІКТОРИНА: усі відповідають одночасно, кожен на своєму екрані.
	 *
	 * Модель партії й ціна, яку вона коштує (рахунок неперевірний), розписані в
	 * `config/quizOnline.ts`. Обвʼязка кімнати — спільна з «Знайди пару»
	 * (`controllers/roomSession.svelte.ts`): доти вона стояла тут копією на ~120
	 * рядків і вже розійшлася з оригіналом. Тут — те, що належить САМЕ вікторині:
	 * набір ігор, швидкість, раунди, чекання відсутніх.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	/*
	 * Словник приходить пропом із `load` (`+page.ts`), а не з `onMount`: інакше
	 * сирі ключі лишаються в пререндері назавжди. `?? key` — запобіжник на
	 * невідому мову.
	 */
	const text = $derived((key: string) => data.quizText[key] ?? key);

	/**
	 * Версія ПРАВИЛ спільної вікторини. Різні версії в кімнату не пускають.
	 *
	 * ДВІЙКА З ПОЯВОЮ ШВИДКОСТІ КІМНАТИ: клієнт першої редакції полів швидкості не
	 * читає й порахує собі СВІЙ дедлайн за старими числами — а очки залежать від
	 * того, скільки тривав раунд.
	 *
	 * ТРІЙКА З ПОЯВОЮ «НЕ ОБМЕЖЕНОГО» РАУНДУ (`pace_round` = 3). Клієнт другої
	 * редакції читає його як «стандартна»: у нього раунд скінчився б за межею, і
	 * «поки кожен не відповість» не настало б ніколи.
	 *
	 * ЧЕТВІРКА: ПАУЗУ ПИШЕ КОЖЕН ГРАВЕЦЬ, а перепрогін бере НАЙБІЛЬШЕ (аудит
	 * 2026-09-24). Клієнт третьої редакції рахував би лише ходи ведучого й ДОДАВАВ
	 * їх — тобто в одній кімнаті вийшло б два різні дедлайни, і відповідь, яку один
	 * зараховує, другий відкидав би.
	 */
	const RULES_VERSION = 4;
	const CLOCK_MS = 1000;

	/**
	 * ГОДИННИК ПАРТІЇ ЙДЕ ЧАСТІШЕ ЗА СЕКУНДУ: на ньому смуга таймера раунду, а
	 * раунд і триває сім секунд — секундні стрибки були б майже всією смугою.
	 */
	const ROUND_CLOCK_MS = 100;

	/** Двоє — мінімум, щоб змагатися. Більше вікторина витримує без змін. */
	const MIN_PLAYERS = 2;

	/**
	 * Які ігри вибрано для НОВОЇ кімнати. Типово всі: людина, яка створює кімнату
	 * не думаючи про набір, мусить отримати повну вікторину, а не порожню.
	 */
	let picked = $state<string[]>(ONLINE_GAMES.map((game) => game.id));
	/** Коли гравця не стало онлайн. Ключ — `uid`; звідси відлік у вікні очікування. */
	let awaySince = $state<Record<string, number>>({});

	/**
	 * Вікторина для сесії. Новачок у вже розпочату партію заходить ГРАВЦЕМ:
	 * відповідати він може з поточного раунду, а роздачі, яку він міг би
	 * перероздати, тут немає.
	 */
	const QUIZ: RoomGame<QuizMatch> = {
		gameId: 'quiz',
		rulesVersion: RULES_VERSION,
		minPlayers: MIN_PLAYERS,
		quickSeats: MIN_PLAYERS,
		lateRole: 'player',
		autoStartReady: (players) => players >= MIN_PLAYERS,
		// НАБІР ІГОР ЇДЕ В `config` — конверт уже дозволяє `Record<string, number>`.
		newRoom: () => ({ seed: Math.floor(Math.random() * 2 ** 31), config: gamesToConfig(picked) }),
		createMatch: (me, transport) => new QuizMatch(me, transport, dev ? DEV_TIME_FACTOR : 1),
		// Набір і в записі переліку: `rooms` перелічувати заборонено, тож фільтр списку
		// бачить про чужу кімнату рівно те, що в самому записі.
		listingExtras: () => ({ games: gamesToConfig(picked) }),
		// «Швидка гра» без фільтра кидала б у кімнату з іграми, які людина щойно зняла.
		fitsQuick: (room) => roomFitsGames(room.games, picked),
		onPresence: (match, uids, now) => {
			// ПРИСУТНІСТЬ ЇДЕ В МАТЧ, і саме це розморожує партію: раунд закінчується,
			// коли відповіли ПРИСУТНІ, а не всі, хто колись зайшов.
			match.present = uids;
			awaySince = awayStamps(match.players, uids, awaySince, now);
		},
		award: (match, me) => playerData.awardQuizMatch(match.scores[me] ?? 0),
		clockEvery: (match) => {
			if (match.countdownAt !== null && match.status !== 'playing') return CLOCK_MS;
			if (match.status === 'playing' && !match.over) return ROUND_CLOCK_MS;
			return match.away.length > 0 ? ROUND_CLOCK_MS : null;
		}
	};

	/** Адреса — джерело правди про кімнату; той самий взірець, що на `pairs/online`. */
	const place: RoomPlace = {
		urlRoom: () => (browser ? (page.url.searchParams.get('room') ?? '') : ''),
		remember: async (code) => {
			if (browser) await goto(withRoom(page.url, code), { noScroll: true, keepFocus: true });
		},
		exit: () => goto(withoutRoom(page.url), { noScroll: true, keepFocus: true }),
		announce: (code) => announceFrom(page.url, code)
	};

	const player = new PlayerIdentity(Math.random);
	// Перелік читається з гілки СВОЄЇ гри: кімнати «Знайди пару» тут не з'являються.
	const lobby = new LobbyFeed(QUIZ.gameId);
	const session = new RoomSession(QUIZ, place, player, lobby);
	session.attach();

	const match = $derived(session.match);
	const takenNames = $derived(lobby.takenNames);
	const joinUrl = $derived(browser && session.code !== '' ? page.url.href : '');

	/**
	 * Хто ОГОЛОШУЄ РАУНДИ — ведучий із журналу, а не господар кімнати. Поки ніхто
	 * не підхоплював партію, це та сама людина; різниця зʼявляється, коли господар
	 * зник і роль перейшла ходом `lead` (`utils/quizReplay.ts`).
	 */
	const amLeader = $derived(session.me !== '' && match?.leader === session.me);

	/**
	 * ЗМІНИТИ НАБІР ІГОР У КІМНАТІ — і, якщо кімната в переліку, там ТЕЖ: інакше
	 * фільтр бреше саме тому, хто ним скористався. Спершу кімната, потім довідка.
	 */
	async function changeGames(games: string[]) {
		if (!match) return;
		await match.setGames(games);
		await lobby.setGames(session.code, gamesToConfig(games));
	}

	/** Я відповів — частка правильного в журнал. Очки порахує кожен сам. */
	async function answer(correct: number) {
		if (!match) return;
		try {
			await match.answer(correct);
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', 'quiz answer not saved', {
				code: session.code,
				reason: String(error)
			});
		}
	}

	/*
	 * НАСТУПНИЙ РАУНД ОГОЛОШУЄ ВЕДУЧИЙ, і рівно один раз: `$effect` перезапускається
	 * на кожен такт годинника, а «час таблу вийшов» лишається правдою, доки раунд не
	 * змінився. Журнал відкинув би повтори, але писати їх однаково не треба.
	 */
	let announcing = false;

	$effect(() => {
		if (!browser || !match || !amLeader) return;
		if (match.status !== 'playing' || match.over || announcing) return;
		// Партія щойно почалася — перший раунд оголошується без чекання.
		const next = match.round < 0 ? 0 : match.nextDue(session.clock) ? match.round + 1 : null;
		if (next === null) return;
		announcing = true;
		void match.startRound(next).finally(() => (announcing = false));
	});

	/**
	 * Усе про чекання одним викликом — правила живуть у `utils/awayWait`: пауза й
	 * зникнення дають один відлік і одне вікно.
	 */
	const wait = $derived(waitView(match, awaySince, session.clock, session.me));

	/*
	 * Пауза раунду — наслідок стану вище. Саме `$effect`, а не похідна: зсув
	 * дедлайну — це ЗМІНА стану партії.
	 */
	$effect(() => void match?.setHold(wait.hold, session.clock));

	onMount(() => {
		/*
		 * «НАЗАД» РОБИТЬ ОДИН КРОК: у кімнаті — зняти `?room` (адреса тут джерело
		 * правди, і сесія сама розбере кімнату), на формі входу — у розділ.
		 */
		const release = settings.claimHeader(
			'menu.quiz',
			() =>
				void goto(session.code === '' ? langPath(lang, 'quiz') : withoutRoom(page.url), {
					noScroll: true,
					keepFocus: true
				})
		);
		void player.loadCountry();
		session.resume();

		return () => {
			session.dispose();
			release();
		};
	});
</script>

<div class="quiz-online" class:quiz-online--playing={match !== null && match.status !== 'lobby'}>
	<NetLost lost={match !== null && !session.connected} />
	{#if !match}
		<OnlineGate
			bind:name={player.value}
			bind:joinCode={session.joinCode}
			bind:isPrivate={session.isPrivate}
			bind:country={player.country}
			busy={session.busy}
			onRandomName={() => player.reroll(takenNames)}
			onCreate={() => session.enter('create')}
			onJoin={() => session.enter('join')}
			onQuickGame={() => session.quickGame()}
		>
			{#snippet roomList()}
				<!--
					НАБІР ІГОР ТУТ — ФІЛЬТР, а не панель налаштувань: «у що я хочу грати»
					сіє чужі кімнати й задає свою. Правити набір — у лобі кімнати.
				-->
				<QuizRooms
					{text}
					rooms={lobby.rooms}
					resume={lobby.own}
					friends={lobby.friends}
					hasMore={lobby.hasMore}
					unavailable={lobby.unavailable}
					busy={session.busy}
					{picked}
					onPick={(games) => (picked = games)}
					onClose={(dead) =>
						void lobby.close(dead).then((done) => {
							if (!done) toast.error('pairs.actionFailed');
						})}
					onEnter={(chosen) => {
						session.joinCode = chosen;
						void session.enter('join');
					}}
				/>
			{/snippet}
		</OnlineGate>
	{:else if match.status === 'lobby'}
		<!--
			Лобі вікторини — спільне лобі ПЛЮС набір ігор і швидкість кімнати.
			ШВИДКІСТЬ У ПЕРЕЛІК КІМНАТ НЕ ПИШЕТЬСЯ: за нею не вибирають, тож набір іде
			через `changeGames` (два записи), а швидкість — прямо в матч.
		-->
		<QuizLobby
			{text}
			{match}
			code={session.code}
			{joinUrl}
			online={session.online}
			me={session.me}
			amHost={session.amHost}
			clock={session.clock}
			onRole={(role) => session.setRole(role)}
			onStart={() => session.start()}
			onAutoStart={session.switchAutoStart}
			onGames={changeGames}
			onPace={(pace) => void match?.setPace(pace)}
		/>
	{:else}
		<!--
			ПАРТІЯ Й ПІДСУМОК — в окремому компоненті, який не знає про мережу: він
			читає матч і час, тож підсумок однаковий в усіх.
		-->
		<QuizRoom
			{text}
			{match}
			me={session.me}
			{lang}
			cross={crossGameLinks(lang, 'quiz', session.code, match?.nextCode ?? null)}
			amHost={session.amHost}
			clock={session.clock}
			{wait}
			onPause={() => void match?.pause()}
			onResume={() => void match?.resume()}
			goOn={match.goOn}
			onGoOn={() => void match?.voteGoOn()}
			onanswer={answer}
			onRematch={session.rematch}
			onClose={() => session.close()}
			onkick={session.kick}
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
		 * 1120px — під ТРИ СТОВПЦІ, і стовпці тут на обох екранах до партії.
		 * `OnlineGate` на широкому місці розкладається в три (лівий: код і «хто
		 * може зайти», середина: швидка гра й імʼя, правий: кімнати), лобі кімнати
		 * — теж (запросити, хто тут і старт, налаштування гри). Обидва стають
		 * трьома стовпцями з 64rem, тобто самі просять близько 1100.
		 *
		 * Тут стояло 900px, а 1120 мала лише форма входу. Скарга автора була та
		 * сама двічі — «в один стовпчик, а праворуч і ліворуч купа вільного місця»:
		 * спершу про форму, потім про лобі, де на знімку (1863×996) набір ігор і
		 * швидкість лежали нижче межі екрана.
		 *
		 * Міркування «вузьке лобі читається без прокрутки» стосувалося ОДНОГО
		 * стовпця: рядок складу на 1100px око не проходить за раз. У трьох
		 * стовпцях кожен вужчий за ті самі 900 — тобто рядки стали КОРОТШІ, а не
		 * довші. Партія має інші потреби — див. нижче.
		 */
		width: 100%;
		max-width: 1120px;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

	/*
	 * ПІД ПАРТІЮ — ВЛАСНА МІРА ГРИ, а не міра стовпців.
	 *
	 * Кожна гра тепер обмежує себе сама (`--measure-*` у `QuizBoard`), тож
	 * стовпець більше не мусить її стримувати — але мусить ДАВАТИ їй місце.
	 * «Де живем?» від 1000px просить 1100px під один ряд із дев'яти зон, і в
	 * стовпці на 900 вона його не отримувала: зони тиснулися, а підпис «Ліс
	 * помірної зони» ламався в стовпчик по слову.
	 */
	.quiz-online--playing {
		max-width: var(--measure-habitat-wide);
	}
</style>
