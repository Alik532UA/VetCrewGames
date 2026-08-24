<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { t, formatFont } from '$lib/i18n';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { QuizMatch } from '$lib/controllers/quizMatch.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { DEV_TIME_FACTOR, ONLINE_GAMES, gamesToConfig } from '$lib/config/quizOnline';
	import type { Role, RoomTransport } from '$lib/net/roomTypes';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import RoomList from '$lib/components/pairs/RoomList.svelte';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import QuizGamePicker from '$lib/components/quiz/QuizGamePicker.svelte';
	import QuizRound from '$lib/components/quiz/QuizRound.svelte';
	import QuizScores from '$lib/components/quiz/QuizScores.svelte';
	import GameOverCard from '$lib/components/GameOverCard.svelte';

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
	 * Версія ПРАВИЛ спільної вікторини. Різні версії в кімнату не пускають.
	 *
	 * Своя, не спільна з «Знайди пару»: правила там інші, і кімнати не змішуються
	 * (`gameId` різний). Одиниця — перша редакція.
	 */
	const RULES_VERSION = 1;
	const CLOCK_MS = 1000;
	const COUNTDOWN_MS = 5000;
	/** Двоє — мінімум, щоб змагатися. Більше вікторина витримує без змін. */
	const MIN_PLAYERS = 2;

	let match = $state<QuizMatch | null>(null);
	let code = $state('');
	let joinCode = $state('');
	let isPrivate = $state(false);
	/** Перелік кімнат і свої партії — спільний контролер, див. `lobbyFeed`. */
	const lobby = new LobbyFeed();
	let unlist: (() => void) | null = null;
	let releaseHold: (() => void) | null = null;
	let me = $state('');
	let online = $state<string[]>([]);
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
	const myRole = $derived<Role>(
		match?.members.find((member) => member.uid === me)?.role ?? 'player'
	);
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
		const url = new URL(page.url);
		url.searchParams.set('room', value);
		await goto(url, { noScroll: true, keepFocus: true });
	}

	/** Вийти з кімнати на форму входу. Кімнату не закриває. */
	function leaveRoom() {
		for (const stop of stops) stop();
		stops = [];
		releaseHold = null;
		unlist = null;
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
				await net.joinRoom(code, who, undefined, player.country);
			}
			await rememberInUrl(code);

			const transport = await net.roomTransport(code);
			const connection = await import('$lib/net/firebase').then((m) => m.connect());
			me = connection.uid;

			const started = new QuizMatch(me, transport, dev ? DEV_TIME_FACTOR : 1);
			stops.push(started.listen());

			const live = await import('$lib/net/presence');
			stops.push(await live.trackPresence(code));
			stops.push(await live.watchPresence(code, (uids) => (online = uids)));

			if (action === 'create') {
				releaseHold = await live.holdRoom(code);
				stops.push(() => releaseHold?.());

				if (!isPrivate || quick) {
					const list = await import('$lib/net/lobby');
					unlist = await list.publishRoom({
						code,
						hostUid: me,
						hostName: who,
						hostCountry: player.country,
						gameId: 'quiz',
						rulesVersion: RULES_VERSION,
						players: 1
					});
					stops.push(() => unlist?.());
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
		const free = lobby.rooms.find(
			(room) => room.gameId === 'quiz' && room.players < MIN_PLAYERS
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
	const rematch = () => hostAction((transport) => transport.restart(Math.floor(Math.random() * 2 ** 31)));

	async function start() {
		if (!match) return;
		const players = match.players.length;
		if (players < MIN_PLAYERS) {
			toast.info('pairs.needPlayers');
			return;
		}
		const net = await import('$lib/net/rtdbRoom');
		await (await net.roomTransport(code)).setStatus('playing');
		releaseHold?.();
		releaseHold = null;
		unlist?.();
		unlist = null;
	}

	async function close() {
		if (!match || !amHost) return;
		try {
			unlist?.();
			unlist = null;
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
		await net.joinRoom(code, player.forEntry(takenNames), role, player.country);
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

	const countdownLeft = $derived(
		match?.countdownAt === null || match?.countdownAt === undefined
			? null
			: Math.max(0, Math.ceil((match.countdownAt + COUNTDOWN_MS - clock) / 1000))
	);

	/*
	 * Годинник іде, поки на нього чекають: відлік у лобі АБО раунд партії.
	 *
	 * Під час раунду частіше — на ньому смуга таймера. Поза цими двома станами
	 * таймера немає зовсім: інтервал, який тікає на порожньому екрані, — це
	 * розряджений акумулятор і нічого більше.
	 */
	const clockNeeded = $derived(
		countdownLeft !== null || (match !== null && match.status === 'playing' && !match.over)
	);

	$effect(() => {
		if (!browser || !clockNeeded) return;
		const every = countdownLeft !== null && match?.status !== 'playing' ? CLOCK_MS : ROUND_CLOCK_MS;
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

	onMount(() => {
		const release = settings.claimHeader('menu.quiz', () => goto(langPath(lang, 'quiz')));
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

<div class="quiz-online">
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
					НАБІР ІГОР ВИБИРАЄТЬСЯ ДО СТВОРЕННЯ, а не тільки в лобі.

					Він міняє те, у що зіграють, тож прочитати його треба там, де
					натискають «створити кімнату». У лобі його теж видно — але вже як
					налаштування наявної кімнати.
				-->
				<div class="quiz-online__games text-panel">
					<QuizGamePicker bind:selected={picked} editable={true} />
				</div>
				<RoomList
					rooms={lobby.rooms}
					resume={lobby.own}
					friends={lobby.friends}
					hasMore={lobby.hasMore}
					unavailable={lobby.unavailable}
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
			{joinUrl}
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
		<!--
			У лобі набір показується ОБОМ, але править його лідер.

			Гість мусить знати, у що зіграє, до початку — інакше перше питання стає
			несподіванкою. Право правити звужене правилом бази, а не тільки екраном:
			`info.config` пише лише господар.
		-->
		<div class="quiz-online__games text-panel">
			<QuizGamePicker
				selected={match.games}
				editable={false}
			/>
		</div>
	{:else if match.over}
		<QuizScores
			players={match.players}
			answered={match.answered}
			scores={match.scores}
			withScores
			{me}
		/>
		<!--
			Екран підсумку — ЛИШЕ в лідера, бо «Зіграти ще» роздає він.
		
			`onPlayAgain` у `GameOverCard` обовʼязковий, і це правильно: картка з
			кнопкою, яка нічого не робить, гірша за картку без кнопки. Гість бачить
			табло й рядок «чекаємо на лідера» — тобто теж повний підсумок, просто без
			чужої кнопки.
		-->
		{#if amHost}
			<GameOverCard
				score={match.myScore}
				total={match.myScore}
				{lang}
				onPlayAgain={rematch}
				testId="quiz-online-game-over"
			/>
			<button type="button" class="chip" onclick={close} data-testid="quiz-close-btn">
				{@html formatFont(t('pairs.closeRoom'))}
			</button>
		{:else}
			<p class="quiz-online__wait text-panel">{@html formatFont(t('pairs.waitingHost'))}</p>
		{/if}
	{:else}
		<!--
			ФАЗА ВИРІШУЄ, ЩО НА ЕКРАНІ, і рахунок під час раунду не показується.
			
			Це вимога автора й вона слушна: цифри поруч із питанням тягнуть увагу
			саме тоді, коли вона потрібна на питанні. Під час раунду видно лише
			склад гравців із позначкою «вже відповів», а рахунок з'являється на
			таблі між раундами.
		-->
		{@const phase = match.phase(clock)}
		<QuizScores
			players={match.players}
			answered={match.answered}
			scores={match.scores}
			withScores={phase !== 'round'}
			{me}
		/>

		<QuizRound
			{phase}
			step={match.step}
			leftMs={match.leftMs(clock)}
			limitMs={match.limitMs}
			answered={match.iAnswered}
			onanswer={answer}
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
		 * 900px — ширина, за якої три мішені лишаються квадратними, а картки
		 * тварин читаються без прокрутки.
		 */
		width: 100%;
		max-width: 900px;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

	.quiz-online__games {
		width: 100%;
	}

	.quiz-online__wait {
		margin: 0;
		text-align: center;
		font-size: var(--font-size-sm);
	}

	.chip {
		min-height: 44px;
		padding: 0 var(--space-md);
		border-radius: var(--radius-sm);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
</style>
