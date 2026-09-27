import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ВІДНОВЛЕННЯ СЕСІЇ: хто ми після перезавантаження сторінки.
 *
 * ## Що тут доводиться й чому це найдорожча перевірка в мережевому шарі
 *
 * `auth.currentUser` одразу після `getAuth()` — ЗАВЖДИ `null`: сесія лежить в
 * IndexedDB і читається асинхронно. Доти код питав його синхронно, тобто питав
 * не «уже ввійшли?», а «встигло прочитатися?» — і на першому такті відповідь
 * завжди «ні». Далі йшов `signInAnonymously`, і залогінена людина після
 * перезавантаження ставала НОВИМ анонімом: профіль, підписки й рахунок лишалися
 * на попередньому `uid`. На екрані це виглядало як «знову вікно логіну».
 *
 * Оком таке не ловиться в тесті сторінки: там усе залежить від того, чи встигла
 * база відповісти, тобто перевірка була б плаваючою. Тут порядок ЗАДАНИЙ:
 * підставний `authStateReady()` виставляє користувача рівно тоді, коли його
 * дочекалися, — і тест червоніє саме на пропущеному `await`.
 *
 * ## Чому мережа підміняється на межі модуля
 *
 * `firebase.ts` тягне SDK динамічними імпортами й нікуди не приймає іншої
 * реалізації — інтерфейсу транспорту тут, на відміну від кімнати
 * (`net/roomTypes.ts`), немає. Той самий прийом, що в `controllers/account`.
 */

const anonymous = { uid: 'uid-anon', isAnonymous: true };
const account = { uid: 'uid-real', isAnonymous: false };

/** Стан підставного Firebase Auth. Перезбирається перед кожним випадком. */
let currentUser: typeof account | null = null;
/** Кого віддасть відновлення сесії. `null` — відновлювати нема кого. */
let restored: typeof account | null = null;

const signInAnonymously = vi.fn(async () => {
	currentUser = anonymous as unknown as typeof account;
	return { user: anonymous };
});

const authStateReady = vi.fn(async () => {
	// Саме тут сесія й «дочитується» — як у справжньому SDK.
	currentUser = restored;
});

const auth = {
	get currentUser() {
		return currentUser;
	},
	authStateReady
};

const initializeApp = vi.fn(() => ({ name: 'test' }));
const connectAuthEmulator = vi.fn();
const connectDatabaseEmulator = vi.fn();
vi.mock('firebase/app', () => ({ initializeApp }));
vi.mock('firebase/auth', () => ({
	getAuth: vi.fn(() => auth),
	signInAnonymously,
	connectAuthEmulator
}));

/**
 * Прапорець dev-емулятора (`net/emulator.ts`). У vitest `import.meta.env.DEV` — теж `true`, тож
 * без підміни тут ішли б в емулятор усі випадки. Типово — бойова база, як у збірці; шлях
 * емулятора — окремими випадками нижче.
 */
let emulator = false;
vi.mock('./emulator', () => ({
	get EMULATOR() {
		return emulator;
	},
	EMULATOR_PROJECT: 'demo-vet-crew-games',
	EMULATOR_HOST: '127.0.0.1',
	EMULATOR_PORTS: { database: 9011, auth: 9110 },
	EMULATOR_COMMAND: 'npm run emulators'
}));
/** Що віддасть `.info/serverTimeOffset`: зсув серверного годинника від пристрою. */
type OffsetSnapshot = { val: () => unknown; exists: () => boolean };
let offsetListener: ((snapshot: OffsetSnapshot) => void) | null = null;
/** База повідомила зсув — так, як це робить рукостискання зʼєднання. */
const offsetIs = (value: number) => offsetListener?.({ val: () => value, exists: () => true });
vi.mock('firebase/database', () => ({
	connectDatabaseEmulator,
	getDatabase: vi.fn(() => ({})),
	ref: vi.fn((_db: unknown, path: string) => ({ path })),
	onValue: vi.fn((_node: unknown, listener: (snapshot: OffsetSnapshot) => void) => {
		offsetListener = listener;
		// До рукостискання вузла немає — як у SDK.
		listener({ val: () => null, exists: () => false });
		return () => {};
	})
}));

const rememberSession = vi.fn();
vi.mock('$lib/services/accountFlag', () => ({ rememberSession }));
vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { connect, forget, serverNow, serverTime, OFFSET_WAIT_MS } = await import('./firebase');

describe('під’єднання до Firebase', () => {
	beforeEach(() => {
		forget();
		offsetListener = null;
		currentUser = null;
		restored = null;
		signInAnonymously.mockClear();
		authStateReady.mockClear();
		rememberSession.mockClear();
		initializeApp.mockClear();
		connectAuthEmulator.mockClear();
		connectDatabaseEmulator.mockClear();
		emulator = false;
		vi.unstubAllGlobals();
	});

	/**
	 * DEV НА ЕМУЛЯТОРІ (рішення автора 2026-09-27): демо-проєкт і підʼєднання до емулятора —
	 * ДО першого звернення до входу й до бази (вимога SDK), а незапущений емулятор — зрозумілою
	 * помилкою ще до SDK, а не вічним очікуванням.
	 *
	 * Зворотні експерименти: підʼєднатися до емулятора входу ПІСЛЯ входу — червоніє перший;
	 * прибрати перевірку `emulatorUp` — другий.
	 */
	it('dev на емуляторі: демо-проєкт, і підʼєднання — до входу й до бази', async () => {
		emulator = true;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null))
		);
		await connect();
		expect(initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: 'demo-vet-crew-games',
				databaseURL: 'http://127.0.0.1:9011?ns=demo-vet-crew-games-default-rtdb'
			})
		);
		expect(connectAuthEmulator).toHaveBeenCalledWith(auth, 'http://127.0.0.1:9110', {
			disableWarnings: true
		});
		expect(connectDatabaseEmulator).toHaveBeenCalledWith(expect.anything(), '127.0.0.1', 9011);
		const order = (mock: ReturnType<typeof vi.fn>) => mock.mock.invocationCallOrder[0];
		expect(order(connectAuthEmulator)).toBeLessThan(order(signInAnonymously));
	});

	it('емулятор не запущено — зрозуміла помилка ще до SDK, а не вічне очікування', async () => {
		emulator = true;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
		);
		await expect(connect()).rejects.toThrow(/emulator is not running/);
		expect(initializeApp, 'SDK не піднімається зовсім').not.toHaveBeenCalled();
	});

	it('бойова база — без емулятора й без перевірки порту', async () => {
		const probe = vi.fn();
		vi.stubGlobal('fetch', probe);
		await connect();
		expect(connectAuthEmulator).not.toHaveBeenCalled();
		expect(connectDatabaseEmulator).not.toHaveBeenCalled();
		expect(probe).not.toHaveBeenCalled();
		expect(initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'vet-crew-games' })
		);
	});

	it('перевірка жива: без сесії входимо анонімно', async () => {
		const { uid } = await connect();

		expect(uid).toBe('uid-anon');
		expect(signInAnonymously).toHaveBeenCalledTimes(1);
	});

	/**
	 * ГОЛОВНИЙ ВИПАДОК: збережений акаунт мусить дочекатися й перемогти.
	 *
	 * Зворотний експеримент (§ 1.1): прибрати `await auth.authStateReady()` у
	 * `firebase.ts` — цей випадок червоніє, бо `currentUser` на тому такті ще
	 * `null` і застосунок заводить нового аноніма.
	 */
	it('чекає на відновлення сесії, а не входить анонімно поверх неї', async () => {
		restored = account;

		const { uid } = await connect();

		expect(uid, 'акаунт, а не новий анонім').toBe('uid-real');
		expect(
			signInAnonymously,
			'поверх наявної сесії анонімний вхід не робиться'
		).not.toHaveBeenCalled();
	});

	it('відновлення питається до анонімного входу, а не після', async () => {
		const order: string[] = [];
		authStateReady.mockImplementationOnce(async () => {
			order.push('ready');
			currentUser = restored;
		});
		signInAnonymously.mockImplementationOnce(async () => {
			order.push('anon');
			currentUser = anonymous as unknown as typeof account;
			return { user: anonymous };
		});

		await connect();

		expect(order).toEqual(['ready', 'anon']);
	});

	/**
	 * Під'єднання ставить позначку сесії: лише після неї кореневий layout питає про
	 * свої кімнати (`controllers/awaitedRoom`). Без позначки браузер, що грав онлайн,
	 * більше ніколи не побачив би смуги «вас чекають у грі».
	 */
	it('після входу браузер позначено як такий, що мав сесію', async () => {
		await connect();
		expect(rememberSession).toHaveBeenCalledTimes(1);
	});

	it('відновлений акаунт теж позначає сесію', async () => {
		restored = account;
		await connect();
		expect(rememberSession).toHaveBeenCalledTimes(1);
	});

	/**
	 * ЧИЙ ЦЕ ЗВІТ (аудит 2026-09-25): після входу логер знає `uid`, і шапка звіту
	 * зі значка сервісу його несе; після скидання під’єднання — вже ні.
	 */
	it('після входу логер знає uid, після скидання — ні', async () => {
		const { logService } = await import('$lib/services/logService.svelte');
		await connect();
		expect(logService.sessionUid).toBe('uid-anon');
		forget();
		expect(logService.sessionUid).toBeNull();
	});

	/**
	 * СЕРВЕРНИЙ ЧАС ПОЗА КІМНАТОЮ (аудит 2026-09-25): годинник пристрою, що біжить
	 * уперед, доти ховав смугу «вас чекають» і показував живі кімнати покинутими.
	 *
	 * Зворотний експеримент: повернути в `serverNow` голий `Date.now()` — червоніє.
	 */
	it('поза кімнатою «зараз» — серверне: зі зсувом, який повідомила база', async () => {
		await connect();
		offsetIs(-120_000);

		const skew = serverNow() - Date.now();

		expect(skew).toBeGreaterThanOrEqual(-120_050);
		expect(skew).toBeLessThanOrEqual(-119_950);
	});

	/**
	 * ЗСУВ ЩЕ НЕ ПРИЇХАВ (аудит 2026-09-26): одразу після входу `serverNow()` — це
	 * годинник пристрою, і смуга «вас чекають» на вході в застосунок звірялася саме
	 * з ним. `serverTime()` чекає справжнього зсуву — а без звʼязку не чекає вічно.
	 *
	 * Зворотні експерименти: не чекати зсуву — червоніє перший; порожній вузол
	 * вважати нульовим зсувом — теж перший; прибрати межу чекання — другий.
	 */
	it('серверний час, якому можна вірити, — після справжнього зсуву', async () => {
		const reading = serverTime();
		await vi.waitFor(() => expect(offsetListener).not.toBeNull());
		await Promise.resolve();
		offsetIs(-120_000);

		const skew = (await reading) - Date.now();

		expect(skew, 'прочитано до зсуву').toBeLessThanOrEqual(-119_950);
	});

	it('без звʼязку зсуву немає — і час пристрою приходить після межі, а не ніколи', async () => {
		vi.useFakeTimers();
		try {
			let read: number | null = null;
			void serverTime().then((value) => (read = value));
			await vi.advanceTimersByTimeAsync(OFFSET_WAIT_MS - 1);
			expect(read, 'повірив годиннику пристрою, не дочекавшись').toBeNull();
			await vi.advanceTimersByTimeAsync(1);
			expect(read, 'чекає вічно').not.toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	/** Два виклики — одне під’єднання: інакше в кімнаті було б два `uid`. */
	it('другий виклик чекає на той самий вхід', async () => {
		const [first, second] = await Promise.all([connect(), connect()]);

		expect(first.uid).toBe(second.uid);
		expect(signInAnonymously).toHaveBeenCalledTimes(1);
	});

	/**
	 * НЕВДАЛИЙ ВХІД НЕ ЗАПАМʼЯТОВУЄТЬСЯ (аудит 2026-09-25): доти один збій
	 * `signInAnonymously` на хиткій мережі робив кожну дію з кімнатою миттєвою
	 * помилкою до перезавантаження сторінки.
	 *
	 * Зворотний експеримент: прибрати `pending = null` у `catch` — червоніє.
	 */
	it('вхід, що впав, наступний виклик пробує знову', async () => {
		signInAnonymously.mockRejectedValueOnce(new Error('auth/network-request-failed'));

		await expect(connect()).rejects.toThrow('network-request-failed');
		const { uid } = await connect();

		expect(uid).toBe('uid-anon');
		expect(signInAnonymously).toHaveBeenCalledTimes(2);
	});
});
