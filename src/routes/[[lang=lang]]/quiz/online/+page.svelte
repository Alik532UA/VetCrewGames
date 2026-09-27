<script lang="ts">
	import { withoutRoom } from '$lib/utils/roomUrl';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser, dev } from '$app/environment';
	import { page, updated } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { RoomSession } from '$lib/controllers/roomSession.svelte';
	import { liveProbe } from '$lib/controllers/diagnose';
	import { reloadBanner } from '$lib/controllers/reloadAdvice.svelte';
	import { chooseRoomAvatar } from '$lib/controllers/roomAvatar';
	import { RoomInvite } from '$lib/controllers/roomInvite.svelte';
	import InviteWindow from '$lib/components/pairs/InviteWindow.svelte';
	import { QuizRoomState } from '$lib/controllers/quizRoom.svelte';
	import { roomPlace } from '$lib/controllers/roomPlace';
	import { DEV_TIME_FACTOR, gamesToConfig } from '$lib/config/quizOnline';
	import CreateWindow from '$lib/components/online/CreateWindow.svelte';
	import NetLost from '$lib/components/pairs/NetLost.svelte';
	import QuizLobby from '$lib/components/quiz/QuizLobby.svelte';
	import QuizRoom from '$lib/components/quiz/QuizRoom.svelte';
	import { crossGameLinks, onlineRoutes } from '$lib/utils/crossGame';
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
	const place = roomPlace(
		() => page.url,
		goto,
		browser,
		onlineRoutes(() => lang)
	);

	const player = new PlayerIdentity(Math.random);
	// Стрічка переліку — щоб господар оголосив свою кімнату в гілці СВОЄЇ гри; читає перелік хаб.
	const lobby = new LobbyFeed(quiz.game.gameId);
	// Факти для тоста з причиною збою; опитування версії — звідси: `$app/state` живе на сторінці.
	const session = new RoomSession(
		quiz.game,
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
		 * правди, і сесія сама розбере кімнату, а двері поведуть на хаб), без кімнати — на хаб.
		 */
		const release = settings.claimHeader(
			'menu.quiz',
			() =>
				void goto(session.code === '' ? langPath(lang, 'online') : withoutRoom(page.url), {
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
			game="quiz"
			busy={session.busy}
			onChoose={(isPrivate) => {
				session.isPrivate = isPrivate;
				void session.enter('create');
			}}
			onBack={() => void session.place.hub()}
		/>
	{:else if !match}
		<!-- Двері без кімнати: створюємо ту, яку попросили, або йдемо на хаб (`roomPolicies`). -->
		<p class="online-door" role="status">{@html formatFont(t('online.opening'))}</p>
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
			onRematch={session.canRematch ? session.rematch : undefined}
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
		 * 1120px — під ТРИ СТОВПЦІ лобі кімнати (запросити, хто тут і старт,
		 * налаштування гри): вони стають трьома стовпцями з 64rem, тобто самі просять
		 * близько 1100. Ту саму міру має й хаб «Грати онлайн» (`routes/…/online`), куди
		 * переїхала форма входу.
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

	/* Рядок стану дверей стоїть просто на фотографії тла — тому на власній панелі. */
	.online-door {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
		color: var(--color-text-on-panel);
	}
</style>
