import { afterEach, describe, expect, it, vi } from 'vitest';
import { PAIRS_RULES_VERSION, QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { LocalSeekBoard } from '$lib/net/localSeek';
import { toast } from './toast.svelte';
import { OnlineHubState, type HubNet, type HubRoutes } from './onlineHub.svelte';
import type { ProblemProbe } from './diagnose';
import type { LobbyRoom } from '$lib/net/lobby';
import type { RoomInfo } from '$lib/net/roomTypes';

/**
 * ХАБ «ГРАТИ ОНЛАЙН» — без мережі й без сторінки (рішення автора 2026-09-26).
 *
 * Головне тут — «гру каже кімната»: код підключення веде на сторінку тієї гри, чия це
 * кімната, і глухого кута «ця кімната для іншої гри» більше немає. Друге — підпис гравця
 * йде у сховище ДО переходу: сторінка кімнати читає його звідти.
 *
 * Зворотні експерименти: вести за кодом завжди в одну гру — червоніє «гру каже кімната»;
 * не зберігати підпис перед переходом — «підпис гравця — до переходу»; дозволити
 * підключатися посеред пошуку — «поки пошук іде».
 */

// Сховище налаштувань читає тему системи, а в jsdom `matchMedia` немає: хабу потрібна лише мова.
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk' } }));

const room = (over: Partial<LobbyRoom> = {}): LobbyRoom => ({
	code: '42',
	hostUid: 'host',
	hostName: 'Господар',
	gameId: 'pairs',
	rulesVersion: PAIRS_RULES_VERSION,
	players: 1,
	at: 100,
	...over
});

const info = (gameId: string): RoomInfo => ({
	gameId,
	rulesVersion: 1,
	seed: 1,
	status: 'lobby',
	hostUid: 'host',
	config: {}
});

function feed(rooms: LobbyRoom[] = [], friends: string[] = []) {
	return {
		rooms,
		own: [],
		friends,
		hasMore: false,
		unavailable: false,
		watch: vi.fn(() => () => {}),
		load: vi.fn(() => () => {}),
		close: vi.fn(async () => true)
	};
}

function setup({ quiz = feed(), pairs = feed(), peek = null as RoomInfo | null } = {}) {
	const signed: string[] = [];
	const player = {
		value: 'Мудра Сова',
		country: 'UA',
		load: vi.fn(async () => {}),
		forEntry: vi.fn(() => {
			signed.push('signed');
			return 'Мудра Сова';
		}),
		forRoom: vi.fn(() => 'cat:red'),
		settle: vi.fn()
	};
	const routes: HubRoutes = {
		room: vi.fn(() => void signed.push('room')),
		create: vi.fn(() => void signed.push('create'))
	};
	const net: HubNet = {
		createRoom: vi.fn(async () => '77'),
		closeRoom: vi.fn(async () => {}),
		peekRoom: vi.fn(async () => peek),
		me: vi.fn(async () => 'me'),
		watchOthers: vi.fn(async () => () => {})
	};
	const board = new LocalSeekBoard();
	// Факти для причини збою — випадок автора: локальна збірка, у базі інша редакція правил.
	const probe: ProblemProbe = {
		online: vi.fn(() => true),
		rules: vi.fn(async () => 'stale' as const),
		newBuild: vi.fn(async () => false),
		deployed: () => false,
		emulator: () => false
	};
	const hub = new OnlineHubState(
		player as never,
		{ quiz: quiz as never, pairs: pairs as never },
		routes,
		() => 0,
		probe,
		net,
		board.as('me')
	);
	return { hub, player, routes, net, signed, probe };
}

afterEach(() => {
	// Тости — спільний синглтон: причина з одного випадку не мусить доїхати в наступний.
	toast.dismissProblems();
	vi.restoreAllMocks();
});

/** Причини, про які зараз кажуть тости. */
const shown = () => toast.messages.filter((message) => message.problem).map((m) => m.problem);

describe('хаб «Грати онлайн»', () => {
	it('гру каже кімната: код веде на сторінку її гри', async () => {
		const { hub, routes } = setup({ peek: info('quiz') });
		hub.joinCode = ' 4-2 ';
		await hub.join();
		expect(routes.room).toHaveBeenCalledWith('quiz', '42');
	});

	it('кімнати немає чи гра невідома — кажемо про це тостом, нікуди не йдемо', async () => {
		const error = vi.spyOn(toast, 'error');
		const missing = setup({ peek: null });
		missing.hub.joinCode = '42';
		await missing.hub.join();
		expect(error).toHaveBeenCalledWith('pairs.noRoom');

		const unknown = setup({ peek: info('chess') });
		unknown.hub.joinCode = '42';
		await unknown.hub.join();
		expect(error).toHaveBeenCalledWith('quiz.otherGame');
		expect(missing.routes.room).not.toHaveBeenCalled();
		expect(unknown.routes.room).not.toHaveBeenCalled();
	});

	/**
	 * ЗБІЙ ПІДКЛЮЧЕННЯ НАЗИВАЄ ПРИЧИНУ (прохання автора 2026-09-27) — тим самим тостом,
	 * що й пошук. Доти тут був тост «Не вдалося зайти в кімнату. Спробуйте ще раз» і на
	 * відмову правил, де повтор не допоможе ніколи.
	 *
	 * Зворотний експеримент: повернути тост `pairs.netFailed` замість `toast.problem` — червоніє.
	 */
	it('підключення не вдалося — тост із причиною, а не «спробуйте ще раз»', async () => {
		const { hub, net, routes } = setup();
		const error = vi.spyOn(toast, 'error');
		vi.mocked(net.peekRoom).mockRejectedValue(new Error('PERMISSION_DENIED: Permission denied'));
		hub.joinCode = '42';
		await hub.join();
		expect(shown()).toEqual(['rules']);
		expect(hub.busy).toBe(false);
		expect(error).not.toHaveBeenCalled();
		expect(routes.room).not.toHaveBeenCalled();
	});

	it('без мережі — «немає звʼязку» одразу: читання кімнати висіло б, а не падало', async () => {
		const { hub, net, probe } = setup({ peek: info('quiz') });
		vi.mocked(probe.online).mockReturnValue(false);
		hub.joinCode = '42';
		await hub.join();
		expect(shown()).toEqual(['offline']);
		expect(net.peekRoom).not.toHaveBeenCalled();
		vi.mocked(probe.online).mockReturnValue(true);
		await hub.join();
		expect(shown(), 'наступна спроба прибирає стару причину').toEqual([]);
	});

	/**
	 * Підпис — перший крок пошуку: його збій іде тією самою дорогою, що й решта. Доти
	 * `startSearch` підписував ДО пошуку, і відсутній шматок словника імен ставав
	 * необробленою відмовою промісу, а кнопка не казала нічого.
	 */
	it('підпис не вдався — це збій пошуку з причиною, а не необроблена відмова', async () => {
		const { hub, player } = setup();
		player.load.mockRejectedValueOnce(
			new TypeError('Failed to fetch dynamically imported module: /_app/names.js')
		);
		await hub.startSearch();
		expect(hub.search.phase).toBe('idle');
		expect(shown()).toEqual(['reload']);
	});

	it('підпис гравця — у сховище ДО переходу, і в кімнату, і в створення', async () => {
		const { hub, signed } = setup();
		await hub.enter('42', 'pairs');
		hub.openCreate('quiz');
		await hub.create(true);
		expect(signed).toEqual(['signed', 'room', 'signed', 'create']);
	});

	it('«Створити» → гра → вікно; вибір у вікні веде на сторінку гри з наміром', async () => {
		const { hub, routes } = setup();
		hub.openCreate('pairs');
		expect(hub.creating).toBe('pairs');
		await hub.create(false);
		expect(routes.create).toHaveBeenCalledWith('pairs', false);
	});

	it('перелік — обидві гри разом, найновіші вгорі; друзі без повторів', () => {
		const { hub } = setup({
			quiz: feed([room({ code: '1', gameId: 'quiz', since: 300 })], ['f']),
			pairs: feed([room({ code: '2', since: 500 }), room({ code: '3', since: 100 })], ['f', 'g'])
		});
		expect(hub.rooms.map((one) => one.code)).toEqual(['2', '1', '3']);
		expect(hub.friends).toEqual(['f', 'g']);
	});

	it('кімната під збіг пошуку — приватна, з автостартом, тієї гри й версії', async () => {
		const { hub, net } = setup();
		expect(await hub.search.deps.createRoom('quiz')).toBe('77');
		expect(net.createRoom).toHaveBeenCalledWith(
			expect.objectContaining({
				gameId: 'quiz',
				rulesVersion: QUIZ_RULES_VERSION,
				name: 'Мудра Сова',
				country: 'UA',
				avatar: 'cat:red',
				autoStart: true,
				isPrivate: true
			})
		);
	});

	it('поки пошук іде, ні підключитися, ні створити, ні зайти з переліку', async () => {
		vi.useFakeTimers();
		try {
			const { hub, routes } = setup({ peek: info('quiz') });
			const info_ = vi.spyOn(toast, 'info');
			void hub.startSearch();
			await vi.advanceTimersByTimeAsync(0);
			expect(hub.search.phase).toBe('waiting');
			hub.joinCode = '42';
			await hub.join();
			await hub.enter('42', 'quiz');
			hub.openCreate('quiz');
			expect(routes.room).not.toHaveBeenCalled();
			expect(hub.creating).toBeNull();
			expect(info_, 'натиск чує пояснення, а не тишу').toHaveBeenCalledWith('online.searchBusy');
			hub.dispose();
			expect(hub.search.phase).toBe('idle');
		} finally {
			vi.useRealTimers();
		}
	});
});
