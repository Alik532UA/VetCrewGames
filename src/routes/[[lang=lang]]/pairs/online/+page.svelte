<script lang="ts">
	import { withoutRoom } from '$lib/utils/roomUrl';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { HoverBeam } from '$lib/controllers/hoverBeam.svelte';
	import { RoomSession } from '$lib/controllers/roomSession.svelte';
	import { attachPairsPolicies, pairsGame } from '$lib/controllers/pairsRoom.svelte';
	import { roomPlace } from '$lib/controllers/roomPlace';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import RoomList from '$lib/components/pairs/RoomList.svelte';
	import OnlineLobby from '$lib/components/pairs/OnlineLobby.svelte';
	import OnlineRoom from '$lib/components/pairs/OnlineRoom.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import { crossGameLinks } from '$lib/utils/crossGame';

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
	 * Підсвітка чужого наведення — окремий контролер: підписка, канал надсилання й
	 * затримка проти сплеску мають один обовʼязок.
	 */
	const beam = new HoverBeam();

	/*
	 * Адаптер гри й адреса — у контролерах (`pairsRoom.svelte.ts`, `roomPlace.ts`):
	 * там їх перевіряють тести, а маршрут тест не бере (аудит 2026-09-24).
	 */
	const PAIRS = pairsGame(beam, Math.random);
	const place = roomPlace(() => page.url, goto, browser);

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
			toast.error('pairs.actionFailed');
			logService.error('network', `${action} failed`, {
				code: session.code,
				reason: String(error)
			});
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
	<NetLost lost={match !== null && !session.connected} stale={session.rulesStale} />
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
			ready={session.canStart}
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
</style>
