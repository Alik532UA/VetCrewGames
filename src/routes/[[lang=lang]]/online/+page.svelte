<script lang="ts">
	import { fitToViewport } from '$lib/utils/fitToViewport';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page, updated } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { PlayerIdentity } from '$lib/controllers/playerIdentity.svelte';
	import { LobbyFeed } from '$lib/controllers/lobbyFeed.svelte';
	import { OnlineHubState } from '$lib/controllers/onlineHub.svelte';
	import { liveProbe } from '$lib/controllers/diagnose';
	import { isOnlineGame, onlineRoute, type OnlineGame } from '$lib/utils/crossGame';
	import OnlineHub from '$lib/components/online/OnlineHub.svelte';
	import SearchWindow from '$lib/components/online/SearchWindow.svelte';
	import CreateWindow from '$lib/components/online/CreateWindow.svelte';
	import JoinWindow from '$lib/components/online/JoinWindow.svelte';
	import RoomList from '$lib/components/pairs/RoomList.svelte';

	/**
	 * «ГРАТИ ОНЛАЙН» — хаб обох спільних ігор (рішення автора 2026-09-26).
	 *
	 * Уся логіка — у `controllers/onlineHub.svelte.ts` (його бере тест), вигляд — у
	 * `components/online/OnlineHub.svelte`. Тут лише проводка: мова адреси, переходи на
	 * сторінки ігор і дві стрічки переліку — по одній на гру, бо перелік кожної гри живе у
	 * своїй гілці (`net/lobby.ts`).
	 */
	const lang = $derived(languageFromParam(page.params.lang));

	/** Сторінка гри з параметрами — шлях складає `langPath`, а не склеювання з `base`. */
	const gamePage = (gameId: OnlineGame, query: string) =>
		`${langPath(lang, onlineRoute(gameId))}?${query}`;

	const player = new PlayerIdentity(Math.random);
	const hub = new OnlineHubState(
		player,
		{ pairs: new LobbyFeed('pairs'), quiz: new LobbyFeed('quiz') },
		{
			room: (gameId, code) =>
				void goto(gamePage(gameId, `room=${encodeURIComponent(code)}&move=1`)),
			create: (gameId, isPrivate) =>
				void goto(gamePage(gameId, `create=${isPrivate ? 'friends' : 'everyone'}`))
		},
		Math.random,
		// Чи є на сервері інша збірка — для причини збою: `$app/state` живе на сторінці.
		liveProbe(() => updated.check())
	);
	hub.attach();

	const takenNames = $derived(hub.takenNames);
	const opened = $derived(hub.opened);

	onMount(() => {
		const release = settings.claimHeader('menu.playOnline');
		// Прапор питається РІВНО ОДИН РАЗ: запит іде до сторонньої служби з IP.
		void player.loadCountry();
		return () => {
			hub.dispose();
			release();
		};
	});
</script>

<!--
	ХАБ РОСТЕ ДО ЕКРАНА ОДНИМ МАСШТАБОМ, як лобі кімнат (прохання автора 2026-09-27:
	«масштабування не пропорційне»). Під шапкою, що росте з екраном, хаб на 16px займав
	верхню половину екрана дрібним текстом. Лише вгору (`'grow'`): на телефоні хаб —
	сторінка з прокруткою, а не екран гри, і стиснутий він лише дрібнішав би.

	ВІКНА ДОРІГ — ДО 90% ЕКРАНА В ОБИДВА БОКИ (правило автора 2026-09-27: «елементи разом на
	90% екрану»). Доти вікна не масштабувалися зовсім («ростуть власною одиницею»), і на
	нижчому телефоні вікно пошуку з плитками займало 105% екрана — «Назад» ховався під
	край. Тепер вікно стискається, щойно не вміщається, і росте, коли займає менше.

	Кожне вікно відкрила людина, тож фокус переїжджає в нього (`focusTitle`, `focusField`),
	а коли вікно закривається — на кнопку, що його відкрила (`returnFocus`).
-->
<div class="online-hub" use:fitToViewport={opened ? true : 'grow'}>
	{#if opened?.kind === 'search'}
		<div class="online-hub__window">
			<SearchWindow
				games={hub.search.games}
				phase={hub.search.phase}
				onToggle={(game) => hub.toggleGame(game)}
				onStart={() => void hub.startSearch()}
				onCancel={() => hub.search.cancel()}
				onBack={() => hub.back()}
				focusTitle
			/>
		</div>
	{:else if opened?.kind === 'create'}
		<div class="online-hub__window">
			<CreateWindow
				game={opened.game}
				onGame={(game) => hub.chooseGame(game)}
				busy={hub.busy}
				onChoose={(isPrivate) => void hub.create(isPrivate)}
				onBack={() => hub.back()}
				focusTitle
			/>
		</div>
	{:else if opened?.kind === 'join'}
		<div class="online-hub__window">
			<JoinWindow
				bind:joinCode={hub.joinCode}
				busy={hub.busy}
				onJoin={() => void hub.join()}
				onBack={() => hub.back()}
				focusField
			/>
		</div>
	{:else}
		<OnlineHub
			bind:name={player.value}
			bind:country={player.country}
			avatar={player.avatar}
			onAvatar={(avatar) => player.chooseAvatar(avatar)}
			onRandomName={() => player.reroll(takenNames)}
			onOpen={(kind) => hub.open(kind)}
			returnFocus={hub.returnFocus}
		>
			{#snippet roomList()}
				<RoomList
					rooms={hub.rooms}
					resume={hub.own}
					friends={hub.friends}
					hasMore={hub.hasMore}
					unavailable={hub.unavailable}
					busy={hub.busy || hub.search.phase !== 'idle'}
					onClose={(code, gameId) => void hub.close(code, gameId)}
					onEnter={(code, gameId) => {
						if (isOnlineGame(gameId)) void hub.enter(code, gameId);
					}}
				/>
			{/snippet}
		</OnlineHub>
	{/if}
</div>

<style>
	/* Та сама міра, що в сторінок ігор до партії: два стовпці хабу вміщаються й у 1100px. */
	.online-hub {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
		width: 100%;
		max-width: 1120px;
		padding: 3svh 0 var(--space-lg);
		gap: var(--space-md);
		margin: 0 auto;
		box-sizing: border-box;
	}

	/*
	 * ХАБ І ВІКНА — ПОСЕРЕДИНІ ЕКРАНА, а не під шапкою (прохання автора 2026-09-27: «більшість
	 * меню зверху — всі меню по центру»). `margin-block: auto`, а не `justify-content: center`:
	 * коли вміст вищий за екран, авто-поля стають нулем і верх лишається досяжним прокруткою,
	 * а центрування флексом відрізало б його. Той самий прийом — у меню «Грати»
	 * (`.menu-page.fill > .menu-tiles`). Масштабу це не заважає: `fitToViewport` міряє вміст
	 * від верху першої дитини до низу останньої, а поля не міняють її висоти.
	 */
	.online-hub > :global(*) {
		margin-block: auto;
	}

	/* Бічне поле вікна — тут: хаб його має у власній обгортці, а вікно — ні. */
	.online-hub__window {
		display: flex;
		justify-content: center;
		width: 100%;
		padding-inline: var(--space-md);
		box-sizing: border-box;
	}
</style>
