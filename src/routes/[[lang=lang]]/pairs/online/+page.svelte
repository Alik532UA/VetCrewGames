<script lang="ts">
	import { withoutRoom } from '$lib/utils/roomUrl';
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page, updated } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { HoverBeam } from '$lib/controllers/hoverBeam.svelte';
	import { RoomSession } from '$lib/controllers/roomSession.svelte';
	import { liveProbe } from '$lib/controllers/diagnose';
	import { reloadBanner } from '$lib/controllers/reloadAdvice.svelte';
	import { chooseRoomAvatar } from '$lib/controllers/roomAvatar';
	import { RoomInvite } from '$lib/controllers/roomInvite.svelte';
	import InviteWindow from '$lib/components/pairs/InviteWindow.svelte';
	import { attachPairsPolicies, pairsGame } from '$lib/controllers/pairsRoom.svelte';
	import { roomPlace } from '$lib/controllers/roomPlace';
	import CreateWindow from '$lib/components/online/CreateWindow.svelte';
	import RoomDoor from '$lib/components/online/RoomDoor.svelte';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import OnlineRoom from '$lib/components/pairs/OnlineRoom.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import { crossGameLinks, onlineRoutes } from '$lib/utils/crossGame';

	/**
	 * Спільна партія «Знайди пару» — КІМНАТА. Форма входу переїхала на хаб «Грати онлайн»
	 * (рішення автора 2026-09-26): без кімнати в адресі сторінка — лише двері (`?create`
	 * з хабу, `?from` переїзду групи, решта — на хаб; `roomPolicies`).
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
	 * Підсвітка чужого наведення — окремий контролер: підписка, канал надсилання й
	 * затримка проти сплеску мають один обовʼязок.
	 */
	const beam = new HoverBeam();

	/*
	 * Адаптер гри й адреса — у контролерах (`pairsRoom.svelte.ts`, `roomPlace.ts`):
	 * там їх перевіряють тести, а маршрут тест не бере (аудит 2026-09-24).
	 */
	const PAIRS = pairsGame(beam, Math.random);
	const place = roomPlace(
		() => page.url,
		goto,
		browser,
		onlineRoutes(() => lang)
	);

	const player = new PlayerIdentity(Math.random);
	// Стрічка переліку — щоб господар оголосив свою кімнату в гілці СВОЄЇ гри; читає перелік хаб.
	const lobby = new LobbyFeed(PAIRS.gameId);
	// Факти для тоста з причиною збою; опитування версії — звідси: `$app/state` живе на сторінці.
	const session = new RoomSession(
		PAIRS,
		place,
		player,
		lobby,
		liveProbe(() => updated.check())
	);
	/** Посилання чи QR-код новачка — спершу коротке вікно, а не мовчазний вхід. */
	const invite = new RoomInvite(session);
	session.attach();

	const match = $derived(session.match);
	const takenNames = $derived(lobby.takenNames);

	/**
	 * Повне посилання на цю кімнату — для QR-коду в лобі. Береться з АДРЕСИ: вона
	 * вже містить і мову, і префікс GitHub Pages, і `?room`.
	 */
	const joinUrl = $derived(browser && session.code !== '' ? page.url.href : '');

	attachPairsPolicies(session, beam);

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
			// Тією самою дорогою, що й решта дій кімнати: тост із причиною й журнал із кодом.
			session.failed(`${action} failed`, error);
		}
	}

	onMount(() => {
		/*
		 * «Назад» робить ОДИН крок: у кімнаті знімає `?room` (далі двері ведуть на хаб), без
		 * кімнати — на хаб.
		 */
		const release = settings.claimHeader(
			'memory.title',
			() =>
				void goto(session.code === '' ? langPath(lang, 'online') : withoutRoom(page.url), {
					noScroll: true,
					keepFocus: true
				})
		);
		// Прапор питається РІВНО ОДИН РАЗ: запит іде до сторонньої служби з IP.
		void player.loadCountry();
		// Код в адресі означає «я вже був у цій кімнаті» — повертаємося самі.
		void invite.check();

		return () => {
			session.dispose();
			release();
		};
	});
</script>

<!--
	ЛОБІ РОСТЕ ДО ЕКРАНА ОДНИМ МАСШТАБОМ, лише вгору, як лобі вікторини (`quiz/online`, там
	і причина). У лобі стовпець вужчий (`online-page--lobby`): лобі без налаштувань — два
	стовпці на 46rem, і саме від цієї ширини масштабу є куди рости. На всю ширину вікна рости
	не було б куди, бо стовпець уже займав би весь рядок.
-->
<div
	class="online-page"
	class:online-page--lobby={match?.status === 'lobby'}
	use:fitToViewport={match?.status === 'lobby' && 'grow'}
>
	<!-- Нова збірка на сервері видна й без відмови: опитування версії (`updated`) каже
	     про неї раніше, ніж перша ж спроба зайти впаде на відсутньому шматку. Але не
	     посеред партії (`reloadBanner`): там оновлення забрало б саму партію. -->
	<NetLost
		lost={match !== null && !session.connected}
		reload={reloadBanner(session.reload.reason, updated.current, match?.status)}
		stranded={match !== null && session.stranded}
		onLeave={() => void session.place.exit()}
		onNewRoom={() => void session.freshRoom()}
	/>
	{#if !match && invite.open}
		<!-- Вас запросили: посилання чи QR-код, і вас ще немає в складі (`RoomInvite`). -->
		<InviteWindow
			code={invite.code ?? ''}
			bind:name={player.value}
			bind:country={player.country}
			avatar={player.avatar}
			taken={invite.taken}
			busy={session.busy}
			onAvatar={(avatar) => player.chooseAvatar(avatar)}
			onRandomName={() => player.reroll(takenNames)}
			onJoin={() => invite.accept()}
			onBack={() => invite.decline()}
		/>
	{:else if !match && session.place.choosing()}
		<!-- Група переїжджає в цю гру (`?from`): лише «хто зможе зайти» — окремим вікном. -->
		<CreateWindow
			game="pairs"
			busy={session.busy}
			onChoose={(isPrivate) => {
				session.isPrivate = isPrivate;
				void session.enter('create');
			}}
			onBack={() => void session.place.hub()}
		/>
	{:else if !match}
		<!-- Двері без кімнати: створюємо ту, яку попросили, або йдемо на хаб (`roomPolicies`). -->
		<RoomDoor />
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
			ready={session.canStart}
			autoStart={match.autoStart}
			onRole={(role) => session.setRole(role)}
			onAvatar={(avatar) => void chooseRoomAvatar(session, avatar)}
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
			onRematch={session.canRematch ? session.rematch : undefined}
			onClose={session.amHost ? () => session.close() : undefined}
			onPlayNext={session.myRole === 'spectator' ? () => session.setRole('player') : undefined}
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

	/* Два стовпці лобі (46rem) і поля обгортки (`lobby-shell`, по 1rem). */
	.online-page--lobby {
		max-width: 48rem;
	}
</style>
