<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { storage } from '$lib/services/storage';
	import { page } from '$app/state';
	import { t, formatFont } from '$lib/i18n';
	import { langPath, languageFromParam } from '$lib/i18n/routing';
	import { settings } from '$lib/services/settings.svelte';
	import { toast } from '$lib/controllers/toast.svelte';
	import { logService } from '$lib/services/logService.svelte';
	import { layoutForViewport } from '$lib/config/memory-game';
	import { PairsMatch } from '$lib/controllers/pairsMatch.svelte';
	import type { Role } from '$lib/net/roomTypes';
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

	/** Версія ПРАВИЛ цієї гри. Різні версії в кімнату не пускають. */
	const RULES_VERSION = 1;

	let match = $state<PairsMatch | null>(null);
	let code = $state('');
	let joinCode = $state('');
	let name = $state('');
	let me = $state('');
	let online = $state<string[]>([]);
	let busy = $state(false);
	let stops: Array<() => void> = [];

	const myRole = $derived<Role>(
		match?.members.find((member) => member.uid === me)?.role ?? 'player'
	);
	/*
	 * Господар — той, кого назвала КІМНАТА. Не «перший у списку»: база віддає склад
	 * за алфавітом ключів, і кнопка «Почати» зникала в господаря, щойно заходив
	 * хтось із меншим `uid`.
	 */
	const amHost = $derived(Boolean(me) && match?.hostUid === me);

	/** Імʼя за замовчуванням: людину не мусять просити його вигадати. */
	const guessName = () => `${t('memory.you')} ${Math.floor(Math.random() * 900 + 100)}`;

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
			stops.push(await net.trackPresence(code));
			stops.push(await net.watchPresence(code, (uids) => (online = uids)));
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

	onMount(() => {
		const release = settings.claimHeader('memory.title', () => goto(langPath(lang, 'pairs')));

		name = storage.get(NAME_KEY) ?? '';
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
		<div class="gate">
			<label class="gate__field">
				<span>{@html formatFont(t('pairs.yourName'))}</span>
				<input
					type="text"
					bind:value={name}
					maxlength="24"
					placeholder={t('memory.you')}
					data-testid="pairs-name-input"
				/>
			</label>

			<button
				type="button"
				class="btn-primary"
				onclick={() => enter('create')}
				aria-disabled={busy}
				data-testid="pairs-create-btn"
			>
				{@html formatFont(t('pairs.createRoom'))}
			</button>

			<label class="gate__field">
				<span>{@html formatFont(t('pairs.roomCode'))}</span>
				<input
					type="text"
					bind:value={joinCode}
					maxlength="5"
					class="gate__code"
					data-testid="pairs-code-input"
				/>
			</label>

			<button
				type="button"
				class="btn-primary"
				onclick={() => enter('join')}
				aria-disabled={busy || joinCode.trim().length < 5}
				data-testid="pairs-join-btn"
			>
				{@html formatFont(t('pairs.joinRoom'))}
			</button>
		</div>
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

	.gate {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		width: 100%;
		max-width: 22rem;
		padding: var(--space-lg);
		border-radius: var(--radius-md);
		background: var(--color-bg-panel);
	}

	.gate__field {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		font-size: var(--font-size-sm);
	}

	.gate__field input {
		min-height: 44px;
		padding: 0 var(--space-sm);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-card);
		color: inherit;
		font: inherit;
	}

	/* Код диктують уголос і вводять великими: так його й показуємо. */
	.gate__code {
		text-transform: uppercase;
		letter-spacing: 0.25em;
	}
</style>
