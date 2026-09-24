<script lang="ts">
	import { withRoom, withoutRoom } from '$lib/utils/roomUrl';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { playerData } from '$lib/services/playerData.svelte';
	import { PAIRS_DRAW_POINTS, PAIRS_WIN_POINTS } from '$lib/config/scoring';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { PairsMatch, PEEK_MS } from '$lib/controllers/pairsMatch.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { HoverBeam } from '$lib/controllers/hoverBeam.svelte';
	import { RoomSession, type RoomGame, type RoomPlace } from '$lib/controllers/roomSession.svelte';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import RoomList from '$lib/components/pairs/RoomList.svelte';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import OnlineRoom from '$lib/components/pairs/OnlineRoom.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import { announceFrom, crossGameLinks } from '$lib/utils/crossGame';

	/**
	 * Спільна партія «Знайди пару»: створити кімнату або зайти за кодом.
	 *
	 * Усе між сторінкою й матчем — вхід, присутність, перелік, відлік, нагорода, дії
	 * господаря, «назад» через адресу — живе в `RoomSession`, спільній із вікториною
	 * (`controllers/roomSession.svelte.ts`). Тут лишається те, що належить САМЕ цій
	 * грі: розкладка дошки, підсвітка наведення, перегортання пари й кнопки «забрати
	 * хід» та «завершити партію». Правила партії — у `PairsMatch`, і про базу вони не
	 * знають нічого.
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	/**
	 * Версія ПРАВИЛ цієї гри. Різні версії в кімнату не пускають.
	 *
	 * 1 → 2: у ході з'явився серверний час (`at`), у кімнаті — позначка початку
	 * партії (`startedAt`), і на них стоїть межа очікування. Стара збірка пише ходи
	 * без часу — правило бази їх відкидає, тож змішувати версії не можна, і саме
	 * для цього поле й існує: відмова зайти замість тихо зламаної партії.
	 *
	 * 2 → 3: роздача й черга — із ЗАМОРОЖЕНОГО складу (`info.roster`), а не з
	 * поточних `members`. Стара збірка роздає за поточним складом і на першому ж
	 * виході гравця посеред партії розійшлася б із новою.
	 */
	const RULES_VERSION = 3;

	/** Годинник для ЦИФРИ відліку в лобі: вона міняється раз на секунду. */
	const CLOCK_MS = 1000;

	/**
	 * Годинник для СМУГИ часу ходу — те саме число, що у вікторині: на секунді смуга
	 * рухалася б стрибками, на ста мілісекундах читається як час, що спливає.
	 */
	const TURN_CLOCK_MS = 100;

	/**
	 * Двоє — це сама гра, а не налаштування: дошка ділиться між двома чергами, і
	 * третій може бути лише глядачем. Не з правил бази: там стеля 12 на всі ігри.
	 */
	const PAIRS_PLAYERS = 2;

	/**
	 * Підсвітка чужого наведення — окремий контролер: підписка, канал надсилання й
	 * затримка проти сплеску мають один обовʼязок.
	 */
	const beam = new HoverBeam();

	/**
	 * «Знайди пару» для сесії — рівно те, чим вона відрізняється від вікторини.
	 *
	 * Новачок у вже розпочату партію заходить ГЛЯДАЧЕМ: роздача залежить від складу,
	 * і гравець, що зайшов за запрошенням посеред партії, перероздав би дошку всім —
	 * зібрані пари зникали (аудит 2026-09-23). Автостарт — рівно на двох: третій у
	 * кімнаті глядач, і його поява нічого не запускає.
	 */
	const PAIRS: RoomGame<PairsMatch> = {
		gameId: 'pairs',
		rulesVersion: RULES_VERSION,
		minPlayers: PAIRS_PLAYERS,
		quickSeats: PAIRS_PLAYERS,
		lateRole: 'spectator',
		autoStartReady: (players) => players === PAIRS_PLAYERS,
		newRoom: () => {
			// Розкладка належить КІМНАТІ, а не екрану того, хто створив: сітка, різна
			// на двох пристроях, дала б різні дошки з того самого зерна.
			const layout = layoutForViewport();
			return {
				seed: Math.floor(Math.random() * 2 ** 31),
				config: { pairs: layout.pairs, cols: layout.cols }
			};
		},
		createMatch: (me, transport) => new PairsMatch(me, transport),
		listen: async (code) => [await beam.listen(code)],
		award: (match) => {
			if (match.iAmSpectator) return;
			if (match.iWon) playerData.awardOnline(PAIRS_WIN_POINTS);
			else if (match.drawn) playerData.awardOnline(PAIRS_DRAW_POINTS);
		},
		clockEvery: (match) =>
			match.turnEndsAt !== null ? TURN_CLOCK_MS : match.countdownAt !== null ? CLOCK_MS : null
	};

	/**
	 * Адреса — ДЖЕРЕЛО ПРАВДИ про кімнату, і крок в історії робить `goto`, а не
	 * `pushState`: поверхнева маршрутизація не присвоює `page.url`, і ефект «адреса
	 * — джерело правди» бачив би «кімнати немає» одразу після входу (дефект
	 * 2026-08-24, тепер під інваріантом у `src/structure.test.ts`).
	 */
	const place: RoomPlace = {
		urlRoom: () => (browser ? (page.url.searchParams.get('room') ?? '') : ''),
		remember: async (code) => {
			if (browser) await goto(withRoom(page.url, code), { noScroll: true, keepFocus: true });
		},
		exit: () => goto(withoutRoom(page.url), { noScroll: true, keepFocus: true }),
		announce: (code) => announceFrom(page.url, code)
	};

	const player = new PlayerIdentity(Math.random);
	// Перелік читається з гілки СВОЄЇ гри: кімнати вікторини тут не з'являються.
	const lobby = new LobbyFeed(PAIRS.gameId);
	const session = new RoomSession(PAIRS, place, player, lobby);
	session.attach();

	const match = $derived(session.match);
	const takenNames = $derived(lobby.takenNames);

	/**
	 * Повне посилання на цю кімнату — для QR-коду в лобі. Береться з АДРЕСИ: вона
	 * вже містить і мову, і префікс GitHub Pages, і `?room`.
	 */
	const joinUrl = $derived(browser && session.code !== '' ? page.url.href : '');

	/**
	 * Пауза після невдалої пари — і тільки на пристрої того, чия черга. `$effect`, а
	 * не таймер у кліку: перегорнути треба й тоді, коли дошка чекає після
	 * перезавантаження посеред чужого ходу.
	 */
	$effect(() => {
		if (!browser || !match?.game.awaitingPeek || !match.myTurn) return;
		const timer = setTimeout(() => void match?.resolve(), PEEK_MS);
		return () => clearTimeout(timer);
	});

	/*
	 * НАВЕДЕННЯ ТРАНСЛЮЄТЬСЯ ЛИШЕ В СВОЮ ЧЕРГУ — вибір автора: «він зараз тицьне ось
	 * у цю». Умова тут, а не в контролері підсвітки: «чия черга» — правило гри.
	 */
	$effect(() => {
		if (match?.myTurn === false) beam.clear();
	});

	/** Кнопки «забрати хід» і «завершити» існують лише коли межа вже вийшла. */
	const canTakeTurn = $derived(Boolean(match?.canYieldAt(session.clock)));

	/**
	 * Скільки лишилося ПОТОЧНОМУ ХОДОВІ, мс, — смугою, у обох гравців. `null` — ходу
	 * немає. Годинник серверний, як і позначки, від яких рахується межа.
	 */
	const turnLeftMs = $derived.by(() => {
		const ends = match?.turnEndsAt;
		return ends === null || ends === undefined ? null : Math.max(0, ends - session.clock);
	});

	/**
	 * Забрати чергу або завершити партію, з якої суперник не вернувся. Остаточне
	 * слово не за сторінкою: законність цих ходів перевіряють усі учасники за
	 * серверними позначками з журналу.
	 */
	async function stallAction(action: 'yield' | 'end') {
		if (!match) return;
		try {
			if (action === 'yield') await match.yieldTurn(session.now());
			else await match.endMatch(session.now());
		} catch (error) {
			toast.error('pairs.actionFailed');
			logService.error('network', `${action} failed`, { reason: String(error) });
		}
	}

	onMount(() => {
		/*
		 * «Назад» робить ОДИН крок: у кімнаті знімає `?room`, на формі входу веде в
		 * розділ.
		 */
		const release = settings.claimHeader(
			'memory.title',
			() =>
				void goto(session.code === '' ? langPath(lang, 'pairs') : withoutRoom(page.url), {
					noScroll: true,
					keepFocus: true
				})
		);
		// Прапор питається РІВНО ОДИН РАЗ: запит іде до сторонньої служби з IP.
		void player.loadCountry();
		// Код в адресі означає «я вже був у цій кімнаті» — повертаємося самі.
		session.resume();

		return () => {
			session.dispose();
			release();
		};
	});
</script>

<div class="online-page">
	<NetLost lost={match !== null && !session.connected} />
	{#if !match}
		<OnlineGate
			bind:name={player.value}
			bind:joinCode={session.joinCode}
			bind:isPrivate={session.isPrivate}
			busy={session.busy}
			bind:country={player.country}
			onRandomName={() => player.reroll(takenNames)}
			onCreate={() => session.enter('create')}
			onJoin={() => session.enter('join')}
			onQuickGame={() => session.quickGame()}
		>
			{#snippet roomList()}
				<!--
					Список малює СТОРІНКА, а форма лишає для нього місце сніпетом:
					`OnlineGate` навмисно не знає про мережу, а список без мережі не існує.
				-->
				<RoomList
					rooms={lobby.rooms}
					resume={lobby.own}
					friends={lobby.friends}
					hasMore={lobby.hasMore}
					unavailable={lobby.unavailable}
					busy={session.busy}
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
		<OnlineLobby
			code={session.code}
			{joinUrl}
			members={match.members}
			online={session.online}
			me={session.me}
			amHost={session.amHost}
			myRole={session.myRole}
			countdownLeft={session.countdownLeft}
			autoStart={match.autoStart}
			onRole={(role) => session.setRole(role)}
			onStart={() => session.start()}
			onAutoStart={session.switchAutoStart}
		/>
	{:else}
		<OnlineRoom
			{match}
			me={session.me}
			online={session.online}
			amHost={session.amHost}
			cross={crossGameLinks(lang, 'pairs', session.code, match?.nextCode ?? null)}
			onRematch={session.amHost && session.canStart ? session.rematch : undefined}
			onClose={session.amHost ? () => session.close() : undefined}
			onYield={canTakeTurn ? () => stallAction('yield') : undefined}
			onEnd={canTakeTurn ? () => stallAction('end') : undefined}
			{turnLeftMs}
			hovers={beam.seen}
			onpoint={(card) => void (match?.myTurn && beam.point(card))}
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
