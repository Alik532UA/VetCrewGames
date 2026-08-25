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

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({ name: 'test' })) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => auth), signInAnonymously }));
vi.mock('firebase/database', () => ({ getDatabase: vi.fn(() => ({ ref: vi.fn() })) }));

const { connect, forget } = await import('./firebase');

describe('під’єднання до Firebase', () => {
	beforeEach(() => {
		forget();
		currentUser = null;
		restored = null;
		signInAnonymously.mockClear();
		authStateReady.mockClear();
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

	/** Два виклики — одне під’єднання: інакше в кімнаті було б два `uid`. */
	it('другий виклик чекає на той самий вхід', async () => {
		const [first, second] = await Promise.all([connect(), connect()]);

		expect(first.uid).toBe(second.uid);
		expect(signInAnonymously).toHaveBeenCalledTimes(1);
	});
});
