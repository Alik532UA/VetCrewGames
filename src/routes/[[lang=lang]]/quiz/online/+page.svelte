<script lang="ts">
	import { withoutRoom } from '$lib/utils/roomUrl';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { page, updated } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { RoomSession } from '$lib/controllers/roomSession.svelte';
	import { chooseRoomAvatar } from '$lib/controllers/roomAvatar';
	import { RoomInvite } from '$lib/controllers/roomInvite.svelte';
	import InviteWindow from '$lib/components/pairs/InviteWindow.svelte';
	import { QuizRoomState } from '$lib/controllers/quizRoom.svelte';
	import { roomPlace } from '$lib/controllers/roomPlace';
	import { DEV_TIME_FACTOR, gamesToConfig } from '$lib/config/quizOnline';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import QuizRooms from '$lib/components/quiz/QuizRooms.svelte';
	import QuizLobby from '$lib/components/quiz/QuizLobby.svelte';
	import QuizRoom from '$lib/components/quiz/QuizRoom.svelte';
	import { crossGameLinks } from '$lib/utils/crossGame';
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

	/*
	 * Адаптер, стан чекання й реакції вікторини — у `controllers/quizRoom.svelte.ts`,
	 * адреса — у `roomPlace.ts`: там їх перевіряють тести, а маршрут тест не бере
	 * (аудит 2026-09-24).
	 */
	const quiz = new QuizRoomState(Math.random, dev ? DEV_TIME_FACTOR : 1);
	const place = roomPlace(() => page.url, goto, browser);

	const player = new PlayerIdentity(Math.random);
	// Перелік читається з гілки СВОЄЇ гри: кімнати «Знайди пару» тут не з'являються.
	const lobby = new LobbyFeed(quiz.game.gameId);
	const session = new RoomSession(quiz.game, place, player, lobby);
	/** Посилання чи QR-код новачка — спершу коротке вікно, а не мовчазний вхід. */
	const invite = new RoomInvite(session);
	session.attach();

	const match = $derived(session.match);
	const takenNames = $derived(lobby.takenNames);
	const joinUrl = $derived(browser && session.code !== '' ? page.url.href : '');

	/**
	 * ЗМІНИТИ НАБІР ІГОР У КІМНАТІ — і, якщо кімната в переліку, там ТЕЖ: інакше
	 * фільтр бреше саме тому, хто ним скористався. Спершу кімната, потім довідка.
	 */
	function changeGames(games: string[]) {
		void session.act('quiz games not changed', async () => {
			if (!match) return;
			await match.setGames(games);
			await lobby.setGames(session.code, gamesToConfig(games));
		});
	}

	/** Я відповів — частка правильного в журнал. Очки порахує кожен сам. */
	async function answer(correct: number) {
		await session.act('quiz answer not saved', () => match?.answer(correct));
	}

	quiz.attach(session);
	const wait = $derived(quiz.wait);

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
		void invite.check();

		return () => {
			session.dispose();
			release();
		};
	});
</script>

<div class="quiz-online" class:quiz-online--playing={match !== null && match.status !== 'lobby'}>
	<!-- Нова збірка на сервері видна й без відмови: опитування версії (`updated`) каже
	     про неї раніше, ніж перша ж спроба зайти впаде на відсутньому шматку. -->
	<NetLost
		lost={match !== null && !session.connected}
		reload={session.reload.reason ?? (updated.current ? 'build' : null)}
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
	{:else if !match}
		<OnlineGate
			bind:name={player.value}
			bind:joinCode={session.joinCode}
			bind:isPrivate={session.isPrivate}
			bind:country={player.country}
			avatar={player.avatar}
			onAvatar={(avatar) => player.chooseAvatar(avatar)}
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
					picked={quiz.picked}
					onPick={(games) => (quiz.picked = games)}
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
			myRole={session.myRole}
			countdownLeft={session.countdownLeft}
			ready={session.canStart}
			onRole={(role) => session.setRole(role)}
			onAvatar={(avatar) => void chooseRoomAvatar(session, avatar)}
			onStart={() => session.start()}
			onAutoStart={session.switchAutoStart}
			onGames={changeGames}
			onPace={(pace) => void session.act('quiz pace not changed', () => match?.setPace(pace))}
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
			onPause={() => void session.act('quiz pause not written', () => match?.pause())}
			onResume={() => void session.act('quiz resume not written', () => match?.resume())}
			goOn={match.goOn}
			onGoOn={() => void session.act('quiz vote not written', () => match?.voteGoOn())}
			onanswer={answer}
			onRematch={session.rematch}
			onClose={() => session.close()}
			onPlayNext={session.myRole === 'spectator' ? () => session.setRole('player') : undefined}
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
