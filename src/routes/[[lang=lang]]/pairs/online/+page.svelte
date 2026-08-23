<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { storage } from '$lib/services/storage';
	import { page } from '$app/state';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { PairsMatch } from '$lib/controllers/pairsMatch.svelte';
	import { td } from '$lib/i18n';
	import { randomCrewName } from '$lib/config/crewNames';
	import type { Role } from '$lib/net/roomTypes';
	import OnlineGate from '$lib/components/pairs/OnlineGate.svelte';
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

	let match = $state<PairsMatch | null>(null);
	let code = $state('');
	let joinCode = $state('');
	let name = $state('');
	/**
	 * Чи ховати створювану кімнату зі списку.
	 *
	 * Типово `false` — відкрита. Кімната поза списком потребує, щоб код комусь
	 * передали; кімната в списку не потребує нічого, тож саме вона й типова.
	 * Приватність — вибір для того, хто грає з конкретною людиною.
	 */
	let isPrivate = $state(false);
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
	 * Імʼя за замовчуванням: людину не мусять просити його вигадати.
	 *
	 * Було `` `${t('memory.you')} ${Math.floor(Math.random() * 900 + 100)}` `` —
	 * «Ти 417». У лобі стоять двоє, і обидва «Ти» з різними числами: підпис не
	 * називав нікого. Тепер це готова фраза зі списку команди — чому саме такий
	 * список і чому фрази цілі, написано в `config/crewNames.ts`.
	 */
	const guessName = () => randomCrewName(td, Math.random);

	/**
	 * Імʼя пам'ятається між заходами.
	 *
	 * Не зручність: сторінка заходить у кімнату заново після перезавантаження, і без
	 * збереженого імені гравець перетворювався б на «Ти 417» — сам для себе й для
	 * суперника, посеред партії.
	 */
	const NAME_KEY = 'pairs.name';

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

	async function enter(action: 'create' | 'join') {
		if (busy) return;
		busy = true;
		try {
			const net = await import('$lib/net/rtdbRoom');
			const who = name.trim() || guessName();
			storage.set(NAME_KEY, who);
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
					name: who
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
			}

			match = started;
		} catch (error) {
			/*
			 * Причини дві, і плутати їх не можна: «правила не пускають» не лікується
			 * повтором, а «не склалося» — лікується. Перша версія казала «спробуйте ще
			 * раз» на першу з них, тобто радила безглузде.
			 */
			const why = error instanceof Error && error.message === 'rules-missing';
			toast.error(why ? 'pairs.rulesMissing' : 'pairs.netFailed');
			logService.error('network', 'room entry failed', error);
		} finally {
			busy = false;
		}
	}

	async function setRole(role: Role) {
		if (!match || match.status !== 'lobby') return;
		const net = await import('$lib/net/rtdbRoom');
		await net.joinRoom(code, name.trim() || guessName(), role);
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
			logService.error('network', 'yield failed', error);
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
			const net = await import('$lib/net/rtdbRoom');
			await net.closeRoom(code);
			await goto(langPath(lang, 'pairs'));
		} catch (error) {
			hostActionFailed(error);
		}
	}

	/** Нова партія в тій самій кімнаті. Роздає господар: зерно одне на всіх. */
	async function rematch() {
		if (!match || !amHost) return;
		try {
			const net = await import('$lib/net/rtdbRoom');
			const transport = await net.roomTransport(code);
			await transport.restart(Math.floor(Math.random() * 2 ** 31));
		} catch (error) {
			hostActionFailed(error);
		}
	}

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
		logService.error('network', 'host action denied', error);
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
		if (!browser || match?.yieldReadyAt === null || match?.yieldReadyAt === undefined) return;
		clock = Date.now();
		const timer = setInterval(() => (clock = Date.now()), CLOCK_MS);
		return () => clearInterval(timer);
	});

	/** Кнопка «забрати чергу» існує лише коли межа вже вийшла. */
	const canTakeTurn = $derived(Boolean(match?.canYieldAt(clock)));

	onMount(() => {
		const release = settings.claimHeader('memory.title', () => goto(langPath(lang, 'pairs')));

		/*
		 * Поле імені НЕ буває порожнім: або збережене, або кинуте з списку команди.
		 *
		 * Порожнє поле — це прохання вигадати, а вигадувати нікого не просили: імʼя
		 * тут лише для того, щоб суперник розумів, хто ходить. Кому підставлене не
		 * до душі, той натисне кубик або впише своє.
		 */
		name = storage.get(NAME_KEY) ?? randomCrewName(td, Math.random);
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
			bind:name
			bind:joinCode
			bind:isPrivate
			{busy}
			onCreate={() => enter('create')}
			onJoin={() => enter('join')}
		/>
	{:else if match.status === 'lobby'}
		<OnlineLobby
			{code}
			members={match.members}
			{online}
			{me}
			{amHost}
			{myRole}
			onRole={setRole}
			onStart={start}
		/>
	{:else}
		<OnlineRoom
			{match}
			{me}
			{online}
			onRematch={amHost ? rematch : undefined}
			onClose={amHost ? close : undefined}
			onYield={canTakeTurn ? takeTurn : undefined}
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
