import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountState, Profile } from '$lib/net/account';
import type { Friend } from '$lib/net/follows';
import type { Leader } from '$lib/net/leaders';

/**
 * Контролер акаунта — БЕЗ Firebase і без мережі.
 *
 * ## Чому `vi.mock`, а не реалізація в памʼяті
 *
 * Взірець ізоляції транспорту в проєкті вже є: `net/roomTypes.ts` — інтерфейс,
 * `net/localRoom.ts` — реалізація в памʼяті, і матч приймає транспорт
 * аргументом конструктора. Акаунт улаштований інакше: `Account` імпортує
 * `$lib/net/account`, `$lib/net/follows` і `$lib/net/firebase` статично й
 * НАЗВАМИ ФУНКЦІЙ — одинадцять вільних функцій, жодного інтерфейсу й жодного
 * місця, куди можна було б передати іншу реалізацію. Тобто підмінити транспорт
 * без правки самого контролера тут неможливо, і переписувати мережевий шар
 * заради тесту — окреме рішення, не це.
 *
 * Тому мережа підміняється на межі модуля. Це той самий прийом, що вже стоїть у
 * `mythGame.svelte.test.ts` для сховища.
 *
 * ## Що саме доводиться
 *
 * Головне тут — ПРИВАТНІСТЬ відновлення пароля. `resetPassword()` навмисно
 * ковтає `auth/user-not-found` і `auth/invalid-credential` і віддає `true`: різна
 * відповідь для наявної й відсутньої пошти дозволяла б перебирати акаунти. Це
 * логіка, яку легко «спростити» до `return done` — і дірка відкрилася б без
 * жодного червоного тесту, бо зовні кнопка працює однаково.
 *
 * Друге за важливістю — `google()` кличе `load()`, а не `accountState()`: вхід у
 * НАЯВНИЙ акаунт Google міняє `uid`, і без перечитування профіль із підписками
 * на екрані стосувалися б чужого.
 */

/** Помилка Firebase — це `code`, а не текст: саме його читає `#act`. */
const fbError = (code: string) => Object.assign(new Error(code), { code });

const profile = (over: Partial<Profile> = {}): Profile => ({
	uid: 'uid-anon',
	name: 'Лідер',
	handle: 'lider',
	...over
});

const friend = (uid: string, mutual = true): Friend => ({
	profile: profile({ uid, handle: uid }),
	mutual
});

/** Хто ми зараз для `connect()`. Вхід у інший акаунт це значення МІНЯЄ. */
let currentUid = 'uid-anon';

/** Чи каже сховище «цей браузер уже входив в акаунт». */
let flagged = false;

const connect = vi.fn(async () => ({ uid: currentUid }));

const net = {
	accountState: vi.fn<() => Promise<AccountState>>(async () => 'anonymous'),
	handleFree: vi.fn<(handle: string) => Promise<boolean>>(async () => true),
	linkEmail: vi.fn<(email: string, password: string) => Promise<void>>(async () => {}),
	readProfile: vi.fn<(uid: string) => Promise<Profile | null>>(async () => null),
	resetPassword: vi.fn<(email: string) => Promise<void>>(async () => {}),
	saveAvatar: vi.fn<(avatar: string) => Promise<void>>(async () => {}),
	saveProfile: vi.fn<(next: Omit<Profile, 'uid'>, previous?: string) => Promise<void>>(
		async () => {}
	),
	searchHandles: vi.fn<(prefix: string) => Promise<Profile[]>>(async () => []),
	signInEmail: vi.fn<(email: string, password: string) => Promise<void>>(async () => {}),
	signInGoogle: vi.fn<() => Promise<void>>(async () => {}),
	signOut: vi.fn<() => Promise<void>>(async () => {})
};

const follows = {
	follow: vi.fn<(target: string) => Promise<void>>(async () => {}),
	unfollow: vi.fn<(target: string) => Promise<void>>(async () => {}),
	listFollowing: vi.fn<() => Promise<Friend[]>>(async () => []),
	// Друзі — це ВЗАЄМНІ підписки, і саме цим переліком будується вкладка «друзі»
	// в таблиці лідерів: одностороння підписка друга не робить.
	friendUids: vi.fn<() => Promise<string[]>>(async () => [])
};

/**
 * ДАНІ ГРАВЦЯ й ЗАПОВІДНИК — теж на межі модуля, і теж не заради швидкості.
 *
 * `playerSync` тягне за собою `playerData` → `settings`, а конструктор
 * налаштувань читає системну тему через `matchMedia`, якого в jsdom немає. Тобто
 * без цього мока сюїта не збиралася б узагалі — і повідомлення вказувало б на
 * тему, а не на акаунт.
 *
 * Заповідник контролер вантажить динамічно вже в самому виході (`leave()`), тож
 * мок тут ще й доводить, що виклик справді робиться: недограна партія мусить
 * зникати разом з акаунтом.
 */
const play = {
	mergeOnSignIn: vi.fn<() => Promise<void>>(async () => {}),
	refreshProfile: vi.fn<() => Promise<void>>(async () => {}),
	signedOut: vi.fn<() => void>()
};
const reserve = { reset: vi.fn<() => void>() };

/**
 * ПРИВАТНІСТЬ І ТАБЛИЦЯ — теж мокаються, і теж на межі модуля.
 *
 * Головне, що тут доводиться: контролер не «фільтрує показ», а віддає рішення
 * базі й приводить у відповідність те, що вже лежить назовні — індекс пошуку
 * (це робить `savePrivacy`) і рядок таблиці лідерів.
 */
const privacyNet = {
	OPEN_PRIVACY: { search: true, follow: true, board: true },
	readPrivacy: vi.fn(async () => ({ search: true, follow: true, board: true })),
	savePrivacy: vi.fn<(next: unknown, handle: string | null) => Promise<void>>(async () => {})
};
const board = {
	BOARD_LIMIT: 50,
	BOARD_MIN_SCORE: 50,
	// Тип названий явно: `async () => []` виводиться як `never[]`, і рядок таблиці
	// в `mockResolvedValue` не проходив би перевірку типів.
	topLeaders: vi.fn<() => Promise<Leader[]>>(async () => []),
	leadersOf: vi.fn<(uids: string[]) => Promise<Leader[]>>(async () => []),
	withdrawLeader: vi.fn<() => Promise<void>>(async () => {}),
	publishLeader: vi.fn<() => Promise<void>>(async () => {})
};

/**
 * ПАРОЛЬ І ВИДАЛЕННЯ — теж мокаються: обидві дії ходять у Firebase Auth і в базу.
 *
 * Головне, що доводиться тут: після видалення сторінка лишається РОБОЧОЮ. Тобто
 * після нього робиться те саме, що після виходу (стерти місцеве, почати
 * заповідник заново), плюс новий анонімний вхід.
 */
const erase = {
	changePassword: vi.fn<(current: string, next: string) => Promise<void>>(async () => {}),
	deleteAccount: vi.fn<(password?: string) => Promise<void>>(async () => {})
};

vi.mock('$lib/net/erase', () => erase);
vi.mock('$lib/net/privacy', () => privacyNet);
vi.mock('$lib/net/leaders', () => board);
vi.mock('$lib/net/firebase', () => ({ connect }));
/*
 * Прапорець «цей браузер входив в акаунт» — підставний, бо саме з нього
 * контролер бере ПОЧАТКОВИЙ стан, ще до будь-якої мережі.
 */
vi.mock('$lib/services/accountFlag', () => ({ hasAccount: () => flagged }));
vi.mock('$lib/net/account', () => net);
vi.mock('$lib/net/follows', () => follows);
vi.mock('$lib/services/playerSync', () => play);
vi.mock('$lib/controllers/reserve.svelte', () => ({ reserve }));

const { Account } = await import('./account.svelte');

describe('Account', () => {
	beforeEach(() => {
		currentUid = 'uid-anon';
		connect.mockClear();
		net.accountState.mockReset().mockResolvedValue('anonymous');
		net.handleFree.mockReset().mockResolvedValue(true);
		net.linkEmail.mockReset().mockResolvedValue(undefined);
		net.readProfile.mockReset().mockResolvedValue(null);
		net.resetPassword.mockReset().mockResolvedValue(undefined);
		net.saveAvatar.mockReset().mockResolvedValue(undefined);
		net.saveProfile.mockReset().mockResolvedValue(undefined);
		net.searchHandles.mockReset().mockResolvedValue([]);
		net.signInEmail.mockReset().mockResolvedValue(undefined);
		net.signInGoogle.mockReset().mockResolvedValue(undefined);
		net.signOut.mockReset().mockResolvedValue(undefined);
		privacyNet.readPrivacy
			.mockReset()
			.mockResolvedValue({ search: true, follow: true, board: true });
		privacyNet.savePrivacy.mockReset().mockResolvedValue(undefined);
		board.topLeaders.mockReset().mockResolvedValue([]);
		board.leadersOf.mockReset().mockResolvedValue([]);
		board.withdrawLeader.mockReset().mockResolvedValue(undefined);
		follows.friendUids.mockReset().mockResolvedValue([]);
		erase.changePassword.mockReset().mockResolvedValue(undefined);
		erase.deleteAccount.mockReset().mockResolvedValue(undefined);
		play.refreshProfile.mockReset();
		play.mergeOnSignIn.mockReset();
		play.signedOut.mockReset();
		reserve.reset.mockReset();
		follows.follow.mockReset().mockResolvedValue(undefined);
		follows.unfollow.mockReset().mockResolvedValue(undefined);
		follows.listFollowing.mockReset().mockResolvedValue([]);
	});

	it('перевірка жива: новий контролер анонімний і без профілю', () => {
		const account = new Account();
		expect(account.state).toBe('anonymous');
		expect(account.uid).toBe('');
		expect(account.profile).toBeNull();
		expect(account.busy).toBe(false);
		expect(account.error).toBe('');
	});

	describe('load()', () => {
		it('одним викликом набирає uid, стан, профіль і підписки', async () => {
			net.accountState.mockResolvedValue('linked');
			net.readProfile.mockResolvedValue(profile({ uid: 'uid-anon' }));
			follows.listFollowing.mockResolvedValue([friend('uid-friend')]);

			const account = new Account();
			await account.load();

			expect(account.uid).toBe('uid-anon');
			expect(account.state).toBe('linked');
			expect(account.profile?.handle).toBe('lider');
			expect(account.following).toHaveLength(1);
			expect(net.readProfile).toHaveBeenCalledWith('uid-anon');
		});

		/**
		 * Невдача читання НЕ ламає екран: сторінка акаунта відкривається й без
		 * мережі, бо на ній є форма входу — саме те, чим людина цю невдачу
		 * виправляє.
		 */
		it('невдача мережі лишає порожній стан і не кидає', async () => {
			connect.mockRejectedValueOnce(new Error('offline'));

			const account = new Account();
			await expect(account.load()).resolves.toBeUndefined();

			expect(account.uid).toBe('');
			expect(account.profile).toBeNull();
		});
	});

	describe('спільна обгортка #act', () => {
		/**
		 * `busy` — не оздоба: без нього подвійний клік по «Зареєструватися» дає два
		 * запити на привʼязку, і другий приходить із `auth/email-already-in-use` на
		 * пошту, яку щойно привʼязав перший.
		 */
		it('поки дія триває, друга не починається', async () => {
			let release = () => {};
			net.linkEmail.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						release = () => resolve();
					})
			);

			const account = new Account();
			const first = account.register('a@b.co', 'password');
			expect(account.busy).toBe(true);

			await expect(account.register('a@b.co', 'password')).resolves.toBe(false);
			expect(net.linkEmail, 'друга спроба таки поїхала в мережу').toHaveBeenCalledTimes(1);

			release();
			await expect(first).resolves.toBe(true);
			expect(account.busy).toBe(false);
		});

		/** Код Firebase, а не англійське речення: на екран іде перекладене. */
		it('невдача лишає КОД помилки, а `busy` знімається', async () => {
			net.linkEmail.mockRejectedValueOnce(fbError('auth/email-already-in-use'));

			const account = new Account();
			await expect(account.register('a@b.co', 'password')).resolves.toBe(false);

			expect(account.error).toBe('auth/email-already-in-use');
			expect(account.busy).toBe(false);
		});

		/**
		 * Помилка без коду лишає порожній рядок, і це правильна межа: у невдачі,
		 * якої ми не передбачили, вигадувати причину не можна — екран покаже
		 * загальне повідомлення.
		 */
		it('помилка без коду лишає `error` порожнім', async () => {
			net.linkEmail.mockRejectedValueOnce(new Error('щось не те'));

			const account = new Account();
			await expect(account.register('a@b.co', 'password')).resolves.toBe(false);

			expect(account.error).toBe('');
		});

		it('нова дія скидає помилку попередньої', async () => {
			net.linkEmail.mockRejectedValueOnce(fbError('auth/weak-password'));

			const account = new Account();
			await account.register('a@b.co', '123');
			expect(account.error).toBe('auth/weak-password');

			await account.register('a@b.co', 'password');
			expect(account.error).toBe('');
		});
	});

	describe('register()', () => {
		/**
		 * Привʼязка НЕ міняє `uid`, тож профіль і підписки перечитувати нічого —
		 * питається лише стан входу.
		 */
		it('успіх перепитує стан входу, але не перечитує профіль', async () => {
			net.accountState.mockResolvedValue('linked');

			const account = new Account();
			await expect(account.register('a@b.co', 'password')).resolves.toBe(true);

			expect(account.state).toBe('linked');
			expect(net.readProfile).not.toHaveBeenCalled();
		});

		it('невдача лишає стан анонімним', async () => {
			net.linkEmail.mockRejectedValueOnce(fbError('auth/email-already-in-use'));

			const account = new Account();
			await account.register('a@b.co', 'password');

			expect(account.state).toBe('anonymous');
			expect(net.accountState).not.toHaveBeenCalled();
		});
	});

	/**
	 * АНОНІМНИЙ ДОРОБОК ЗЛИВАЄТЬСЯ З АКАУНТОМ — усіма трьома входами.
	 *
	 * Це те, чого не було: рахунок жив у браузері, і «увійти» означало «і далі
	 * тримати його в браузері». Три шляхи входу — реєстрація, пошта, Google — і
	 * пропущений виклик у будь-якому з них виглядав би не як помилка, а як
	 * зникнення набраного (сусідній `Slovko` цим уже хворів).
	 *
	 * Невдалий вхід не зливає нічого: зливати з чим — акаунта немає.
	 */
	describe('злиття даних гравця', () => {
		it.each([
			['register', (a: InstanceType<typeof Account>) => a.register('a@b.co', 'password')],
			['signIn', (a: InstanceType<typeof Account>) => a.signIn('a@b.co', 'password')],
			['google', (a: InstanceType<typeof Account>) => a.google()]
		])('%s зливає анонімне з акаунтом', async (_name, run) => {
			const account = new Account();

			await expect(run(account)).resolves.toBe(true);

			expect(play.mergeOnSignIn).toHaveBeenCalledTimes(1);
		});

		it('невдалий вхід не зливає нічого', async () => {
			net.signInEmail.mockRejectedValueOnce(fbError('auth/invalid-credential'));

			const account = new Account();
			await account.signIn('a@b.co', 'wrong');

			expect(play.mergeOnSignIn).not.toHaveBeenCalled();
		});
	});

	describe('signIn()', () => {
		/** Вхід у ІНШИЙ акаунт міняє `uid`, тож читається все заново. */
		it('успіх перечитує все під новим uid', async () => {
			net.signInEmail.mockImplementationOnce(async () => {
				currentUid = 'uid-real';
			});
			net.readProfile.mockResolvedValue(profile({ uid: 'uid-real', handle: 'real' }));

			const account = new Account();
			await expect(account.signIn('a@b.co', 'password')).resolves.toBe(true);

			expect(account.uid).toBe('uid-real');
			expect(net.readProfile).toHaveBeenCalledWith('uid-real');
		});

		it('невдача не читає нічого', async () => {
			net.signInEmail.mockRejectedValueOnce(fbError('auth/wrong-password'));

			const account = new Account();
			await expect(account.signIn('a@b.co', 'nope')).resolves.toBe(false);

			expect(account.error).toBe('auth/wrong-password');
			expect(net.readProfile).not.toHaveBeenCalled();
		});
	});

	describe('google()', () => {
		/**
		 * ГОЛОВНЕ про цю кнопку: після неї читається все, а не лише стан входу.
		 *
		 * Привʼязка лишає `uid`, але вхід у вже наявний акаунт Google його МІНЯЄ, і
		 * котрий із двох шляхів спрацював, клієнт не знає. Заміна `load()` на
		 * `accountState()` дала б екран, де підписки й профіль належать колишньому
		 * `uid` — і виглядало б це як «дані з минулого сеансу», а не як дефект.
		 */
		it('успіх перечитує профіль під тим uid, який лишився після входу', async () => {
			net.signInGoogle.mockImplementationOnce(async () => {
				currentUid = 'uid-google';
			});
			net.readProfile.mockResolvedValue(profile({ uid: 'uid-google', handle: 'gmail' }));
			follows.listFollowing.mockResolvedValue([friend('uid-other')]);

			const account = new Account();
			await expect(account.google()).resolves.toBe(true);

			expect(account.uid).toBe('uid-google');
			expect(net.readProfile).toHaveBeenCalledWith('uid-google');
			expect(account.following).toHaveLength(1);
		});

		it('закрите вікно Google лишає код помилки й нічого не читає', async () => {
			net.signInGoogle.mockRejectedValueOnce(fbError('auth/popup-closed-by-user'));

			const account = new Account();
			await expect(account.google()).resolves.toBe(false);

			expect(account.error).toBe('auth/popup-closed-by-user');
			expect(net.readProfile).not.toHaveBeenCalled();
		});
	});

	/**
	 * ПРИВАТНІСТЬ ВІДНОВЛЕННЯ ПАРОЛЯ — найважливіший набір у цьому файлі.
	 *
	 * «Лист надіслано» мусить бути єдиною відповіддю і для наявної пошти, і для
	 * відсутньої. Інакше форма «забув пароль» перетворюється на перевірку
	 * «чи є в цій грі акаунт на цю адресу», і перебрати нею список адрес може
	 * будь-хто, без жодного пароля.
	 *
	 * Ковтаються РІВНО два коди. Решта — мережа, забагато спроб, крива адреса —
	 * людині потрібна: вона про акаунт нічого не каже, зате каже, що робити далі.
	 */
	describe('resetPassword(): різниця між «є акаунт» і «немає» не витікає', () => {
		it('вдалий лист — `true` і без помилки', async () => {
			const account = new Account();
			await expect(account.resetPassword('a@b.co')).resolves.toBe(true);
			expect(account.error).toBe('');
		});

		it('`auth/user-not-found` ковтається: та сама відповідь, що на наявну пошту', async () => {
			net.resetPassword.mockRejectedValueOnce(fbError('auth/user-not-found'));

			const account = new Account();
			await expect(
				account.resetPassword('nobody@b.co'),
				'відсутня пошта відрізняється від наявної — акаунти можна перебирати'
			).resolves.toBe(true);
			expect(account.error, 'код витік на екран').toBe('');
		});

		it('`auth/invalid-credential` ковтається так само', async () => {
			net.resetPassword.mockRejectedValueOnce(fbError('auth/invalid-credential'));

			const account = new Account();
			await expect(account.resetPassword('nobody@b.co')).resolves.toBe(true);
			expect(account.error).toBe('');
		});

		/** Межа ковтання: усе, що не про існування акаунта, лишається видимим. */
		it('`auth/too-many-requests` НЕ ковтається — це вже про нас, а не про акаунт', async () => {
			net.resetPassword.mockRejectedValueOnce(fbError('auth/too-many-requests'));

			const account = new Account();
			await expect(account.resetPassword('a@b.co')).resolves.toBe(false);
			expect(account.error).toBe('auth/too-many-requests');
		});

		it('помилка без коду теж не ковтається', async () => {
			net.resetPassword.mockRejectedValueOnce(new Error('offline'));

			const account = new Account();
			await expect(account.resetPassword('a@b.co')).resolves.toBe(false);
			expect(account.error).toBe('');
		});
	});

	describe('leave()', () => {
		/** Після виходу `uid` уже інший, тож попереднє на екрані — чуже. */
		it('успіх стирає профіль, підписки й знахідки, потім читає заново', async () => {
			net.readProfile.mockResolvedValue(profile());
			follows.listFollowing.mockResolvedValue([friend('uid-friend')]);
			net.searchHandles.mockResolvedValue([profile({ uid: 'uid-found' })]);

			const account = new Account();
			await account.load();
			await account.search('lid');
			expect(account.found).toHaveLength(1);

			net.readProfile.mockResolvedValue(null);
			follows.listFollowing.mockResolvedValue([]);
			net.signOut.mockImplementationOnce(async () => {
				currentUid = 'uid-anon-2';
			});

			await expect(account.leave()).resolves.toBe(true);

			expect(account.profile).toBeNull();
			expect(account.following).toEqual([]);
			expect(account.found).toEqual([]);
			expect(account.uid).toBe('uid-anon-2');
		});

		/**
		 * ВИХІД СТИРАЄ МІСЦЕВЕ — і це не косметика, а межа між акаунтами.
		 *
		 * Рахунок і рекорди зливаються з акаунтом при вході. Якби вихід лишав їх у
		 * браузері, вони влилися б у НАСТУПНИЙ акаунт, у який тут увійдуть, — тобто
		 * рахунок можна було б переписати з чужого. У сусідньому `MindStep` це
		 * рівно так і працює досі: метод очищення там написаний і не покликаний.
		 */
		it('успіх стирає рахунок, рекорди й недограну партію', async () => {
			const account = new Account();
			await account.load();

			await expect(account.leave()).resolves.toBe(true);

			expect(play.signedOut).toHaveBeenCalledTimes(1);
			expect(
				reserve.reset,
				'фонд заповідника лишився б наступному власнику браузера'
			).toHaveBeenCalledTimes(1);
		});

		it('невдалий вихід не стирає нічого', async () => {
			const account = new Account();
			await account.load();

			net.signOut.mockRejectedValueOnce(fbError('auth/network-request-failed'));
			await expect(account.leave()).resolves.toBe(false);

			expect(play.signedOut).not.toHaveBeenCalled();
			expect(reserve.reset).not.toHaveBeenCalled();
		});

		it('невдалий вихід лишає все як було', async () => {
			net.readProfile.mockResolvedValue(profile());
			const account = new Account();
			await account.load();

			net.signOut.mockRejectedValueOnce(fbError('auth/network-request-failed'));
			await expect(account.leave()).resolves.toBe(false);

			expect(account.profile?.handle).toBe('lider');
			expect(account.error).toBe('auth/network-request-failed');
		});
	});

	describe('checkHandle()', () => {
		/** Свій псевдонім вільний: інакше не можна було б зберегти профіль двічі. */
		it('власний псевдонім вважається вільним без запиту', async () => {
			net.readProfile.mockResolvedValue(profile({ handle: 'lider' }));
			const account = new Account();
			await account.load();

			await expect(account.checkHandle('lider')).resolves.toBe(true);
			expect(net.handleFree).not.toHaveBeenCalled();
		});

		it('чужий псевдонім питається в мережі', async () => {
			net.readProfile.mockResolvedValue(profile({ handle: 'lider' }));
			net.handleFree.mockResolvedValue(false);
			const account = new Account();
			await account.load();

			await expect(account.checkHandle('someone')).resolves.toBe(false);
			expect(net.handleFree).toHaveBeenCalledWith('someone');
		});

		/** Профілю ще немає — порівнювати ні з чим, тож питається завжди. */
		it('без профілю будь-який псевдонім питається в мережі', async () => {
			const account = new Account();
			await expect(account.checkHandle('lider')).resolves.toBe(true);
			expect(net.handleFree).toHaveBeenCalledWith('lider');
		});
	});

	describe('save()', () => {
		/**
		 * Порожні країна й аватар їдуть як `undefined`, а не як `''`: правило бази
		 * вимагає взірця (дві літери / `значок:колір`), і порожній рядок йому не
		 * відповідає — запис відкинула б база, а не форма.
		 */
		it('порожні країна й аватар перетворюються у відсутні поля', async () => {
			const account = new Account();
			await expect(account.save('Лідер', 'lider', '', '')).resolves.toBe(true);

			// Третій аргумент — `searchable`: чи вписувати псевдонім у пошуковий
			// індекс. Типово так, бо приватність типово дозволяє пошук.
			expect(net.saveProfile).toHaveBeenCalledWith(
				{ name: 'Лідер', handle: 'lider', country: undefined, avatar: undefined },
				undefined,
				true
			);
		});

		/** Старий псевдонім треба назвати, щоб його звільнили ПІСЛЯ запису нового. */
		it('передає попередній псевдонім і перечитує профіль', async () => {
			net.readProfile.mockResolvedValue(profile({ handle: 'lider' }));
			const account = new Account();
			await account.load();

			net.readProfile.mockResolvedValue(profile({ handle: 'chief', country: 'ua' }));
			await expect(account.save('Шеф', 'chief', 'ua', 'cat:blue')).resolves.toBe(true);

			expect(net.saveProfile).toHaveBeenCalledWith(
				{ name: 'Шеф', handle: 'chief', country: 'ua', avatar: 'cat:blue' },
				'lider',
				true
			);
			expect(account.profile?.handle).toBe('chief');
		});

		it('зайнятий псевдонім лишає старий профіль на екрані', async () => {
			net.readProfile.mockResolvedValue(profile({ handle: 'lider' }));
			const account = new Account();
			await account.load();

			net.saveProfile.mockRejectedValueOnce(fbError('PERMISSION_DENIED'));
			await expect(account.save('Шеф', 'taken', '', '')).resolves.toBe(false);

			expect(account.profile?.handle).toBe('lider');
			expect(account.error).toBe('PERMISSION_DENIED');
		});
	});

	describe('пошук і підписки', () => {
		it('search() кладе знахідки в `found`', async () => {
			net.searchHandles.mockResolvedValue([profile({ uid: 'a' }), profile({ uid: 'b' })]);

			const account = new Account();
			await account.search('li');

			expect(account.found).toHaveLength(2);
			expect(net.searchHandles).toHaveBeenCalledWith('li');
		});

		it('add() після успіху перечитує підписки', async () => {
			follows.listFollowing.mockResolvedValue([friend('uid-target')]);

			const account = new Account();
			await expect(account.add('uid-target')).resolves.toBe(true);

			expect(follows.follow).toHaveBeenCalledWith('uid-target');
			expect(account.follows('uid-target')).toBe(true);
		});

		it('add() на себе не міняє списку', async () => {
			follows.follow.mockRejectedValueOnce(new Error('self-follow'));

			const account = new Account();
			await expect(account.add('uid-anon')).resolves.toBe(false);

			expect(follows.listFollowing).not.toHaveBeenCalled();
			expect(account.following).toEqual([]);
		});

		it('remove() після успіху перечитує підписки', async () => {
			follows.listFollowing.mockResolvedValue([friend('uid-a')]);
			const account = new Account();
			await account.add('uid-a');

			follows.listFollowing.mockResolvedValue([]);
			await expect(account.remove('uid-a')).resolves.toBe(true);

			expect(follows.unfollow).toHaveBeenCalledWith('uid-a');
			expect(account.follows('uid-a')).toBe(false);
		});

		it('невдале відписування лишає список як був', async () => {
			follows.listFollowing.mockResolvedValue([friend('uid-a')]);
			const account = new Account();
			await account.add('uid-a');

			follows.unfollow.mockRejectedValueOnce(fbError('PERMISSION_DENIED'));
			await expect(account.remove('uid-a')).resolves.toBe(false);

			expect(account.follows('uid-a'), 'зник із екрана, хоч база не прийняла').toBe(true);
		});

		/** `follows()` відповідає з уже прочитаного списку, без жодного запиту. */
		it('follows() не ходить у мережу', async () => {
			follows.listFollowing.mockResolvedValue([friend('uid-a')]);
			const account = new Account();
			await account.load();

			connect.mockClear();
			expect(account.follows('uid-a')).toBe(true);
			expect(account.follows('uid-b')).toBe(false);
			expect(connect).not.toHaveBeenCalled();
		});
	});

	/**
	 * ПРИВАТНІСТЬ: перемикач міняє не показ, а те, що лежить у базі.
	 *
	 * Тому й перевіряється саме порядок наслідків: запис вибору, потім приведення
	 * у відповідність рядка таблиці. Без другої половини вимкнений показ лишав би
	 * рядок у таблиці до наступного збереження рахунку — тобто перемикач,
	 * що клацнув і нічого не зробив.
	 */
	describe('setPrivacy()', () => {
		it('зберігає вибір і передає псевдонім для індексу пошуку', async () => {
			net.readProfile.mockResolvedValue(profile());
			const account = new Account();
			await account.load();

			await expect(account.setPrivacy({ search: false, follow: true, board: true })).resolves.toBe(
				true
			);

			expect(privacyNet.savePrivacy).toHaveBeenCalledWith(
				{ search: false, follow: true, board: true },
				'lider'
			);
			expect(account.privacy.search).toBe(false);
		});

		it('вимкнений показ ПРИБИРАЄ рядок таблиці', async () => {
			const account = new Account();
			await account.load();

			await account.setPrivacy({ search: true, follow: true, board: false });

			expect(board.withdrawLeader).toHaveBeenCalledTimes(1);
			expect(play.refreshProfile).not.toHaveBeenCalled();
		});

		it('увімкнений показ оновлює рядок таблиці', async () => {
			const account = new Account();
			await account.load();

			await account.setPrivacy({ search: true, follow: true, board: true });

			expect(play.refreshProfile).toHaveBeenCalledTimes(1);
			expect(board.withdrawLeader).not.toHaveBeenCalled();
		});

		it('невдалий запис не міняє ні стану, ні таблиці', async () => {
			privacyNet.savePrivacy.mockRejectedValueOnce(fbError('PERMISSION_DENIED'));
			const account = new Account();
			await account.load();

			await expect(
				account.setPrivacy({ search: false, follow: false, board: false })
			).resolves.toBe(false);

			expect(account.privacy.search, 'екран показував би вибір, якого база не прийняла').toBe(true);
			expect(board.withdrawLeader).not.toHaveBeenCalled();
			expect(account.error).toBe('PERMISSION_DENIED');
		});
	});

	describe('loadBoard()', () => {
		it('читає обидві таблиці — усіх і друзів', async () => {
			follows.friendUids.mockResolvedValue(['uid-friend']);
			board.topLeaders.mockResolvedValue([
				{ uid: 'uid-anon', name: 'Лідер', handle: 'lider', score: 300 }
			]);
			board.leadersOf.mockResolvedValue([
				{ uid: 'uid-friend', name: 'Друг', handle: 'druh', score: 120 }
			]);

			const account = new Account();
			await account.loadBoard();

			expect(account.leaders).toHaveLength(1);
			expect(account.friendLeaders).toHaveLength(1);
			// Друзі — ВЗАЄМНІ підписки, тож список береться саме з `friendUids()`.
			expect(board.leadersOf).toHaveBeenCalledWith(['uid-friend']);
		});
	});

	describe('changePassword()', () => {
		it('успіх', async () => {
			const account = new Account();
			await expect(account.changePassword('old-one', 'new-one')).resolves.toBe(true);
			expect(erase.changePassword).toHaveBeenCalledWith('old-one', 'new-one');
		});

		it('невірний поточний пароль лишає код на екрані', async () => {
			erase.changePassword.mockRejectedValueOnce(fbError('auth/invalid-credential'));
			const account = new Account();

			await expect(account.changePassword('wrong', 'new-one')).resolves.toBe(false);

			expect(account.error).toBe('auth/invalid-credential');
		});
	});

	describe('delete()', () => {
		it('після видалення сторінка лишається робочою', async () => {
			net.readProfile.mockResolvedValue(profile());
			const account = new Account();
			await account.load();

			net.signOut.mockImplementationOnce(async () => {
				currentUid = 'uid-anon-3';
			});
			net.readProfile.mockResolvedValue(null);

			await expect(account.delete('secret')).resolves.toBe(true);

			expect(erase.deleteAccount).toHaveBeenCalledWith('secret');
			// Те саме, що після виходу: місцеве стерте, заповідник заново.
			expect(play.signedOut).toHaveBeenCalledTimes(1);
			expect(reserve.reset).toHaveBeenCalledTimes(1);
			// І новий анонімний вхід — інакше сторінка лишилася б із мертвим uid.
			expect(net.signOut).toHaveBeenCalledTimes(1);
			expect(account.uid).toBe('uid-anon-3');
			expect(account.profile).toBeNull();
		});

		it('порожній пароль їде як «пароля немає», а не як порожній рядок', async () => {
			// Для акаунта на Google пароля немає взагалі: підтвердженням стає вікно,
			// і порожній рядок замість `undefined` виглядав би як спроба ним увійти.
			const account = new Account();
			await account.delete('');

			expect(erase.deleteAccount).toHaveBeenCalledWith(undefined);
		});

		it('невдале видалення не стирає нічого', async () => {
			erase.deleteAccount.mockRejectedValueOnce(fbError('auth/wrong-password'));
			const account = new Account();
			await account.load();

			await expect(account.delete('nope')).resolves.toBe(false);

			expect(play.signedOut).not.toHaveBeenCalled();
			expect(reserve.reset).not.toHaveBeenCalled();
			expect(net.signOut).not.toHaveBeenCalled();
			expect(account.error).toBe('auth/wrong-password');
		});
	});
});

/**
 * ПЕРШИЙ КАДР: що на екрані, поки мережа ще не відповіла.
 *
 * Доти контролер починав із `'anonymous'`, і сторінка малювала форму входу
 * КОЖНОМУ — зокрема тому, хто ввійшов місяць тому: правду знає лише `load()`,
 * а він мусить підняти SDK Firebase і дочекатися відновлення сесії. Автор
 * побачив це як «знову буде вікно логіну».
 *
 * Зворотний експеримент (§ 1.1): повернути `$state('anonymous')` — червоніє
 * перший випадок.
 */
describe('стан до відповіді мережі', () => {
	it('браузер, що входив в акаунт, бачить кабінет, а не форму', async () => {
		flagged = true;
		const { Account } = await import('./account.svelte');

		expect(new Account().state).toBe('linked');
	});

	it('браузер без акаунта бачить форму входу', async () => {
		flagged = false;
		const { Account } = await import('./account.svelte');

		expect(new Account().state).toBe('anonymous');
	});
});

/**
 * АВАТАР ЗБЕРІГАЄТЬСЯ САМ — і саме тому окремою дією, а не через `save()`.
 *
 * Плитку аватара тепер зберігає натиск (прохання автора: «без кнопки зберегти,
 * бо зберігання автоматичне при виборі»). Через `saveProfile` це означало б
 * переписувати заразом імʼя, псевдонім і країну — тобто відправляти в базу вміст
 * полів, яких людина не торкалася, і платити перевіркою вільності псевдоніма за
 * зміну картинки.
 *
 * Друга межа важливіша: БЕЗ ПРОФІЛЮ в базу не пишемо. `.validate` батьківського
 * вузла (`hasChildren(['name','handle'])`) при записі в дитину не
 * переоцінюється, тож такий запис створив би профіль з одного аватара — без
 * імені й псевдоніма, і прочитався б він як профіль, якого людина не заповнювала.
 */
describe('окреме збереження аватара', () => {
	const mine = (over: Partial<Profile> = {}) => profile({ uid: 'uid-anon', ...over });

	/*
	 * Свій `beforeEach`, бо цей блок — сусід головного, а не його дитина. Перша
	 * редакція про це забула, і «без профілю в базу не пише нічого» червонів на
	 * виклику з ПОПЕРЕДНЬОГО випадку: перевірка була права, а не зайва.
	 */
	beforeEach(() => {
		net.saveAvatar.mockReset().mockResolvedValue(undefined);
		net.saveProfile.mockReset().mockResolvedValue(undefined);
		net.readProfile.mockReset().mockResolvedValue(null);
	});

	it('пише лише аватар, а не весь профіль', async () => {
		net.readProfile.mockResolvedValue(mine());
		const account = new Account();
		await account.load();

		expect(await account.saveAvatar('cat:blue')).toBe(true);
		expect(net.saveAvatar).toHaveBeenCalledWith('cat:blue');
		expect(net.saveProfile, 'імʼя й нік лишаються недоторкані').not.toHaveBeenCalled();
	});

	it('без профілю в базу не пише нічого', async () => {
		net.readProfile.mockResolvedValue(null);
		const account = new Account();
		await account.load();

		expect(await account.saveAvatar('cat:blue')).toBe(false);
		expect(net.saveAvatar, 'інакше вийшов би профіль з одного аватара').not.toHaveBeenCalled();
	});

	it('невдача мережі не міняє профіль на екрані', async () => {
		net.readProfile.mockResolvedValue(mine({ avatar: 'dog:red' }));
		const account = new Account();
		await account.load();
		net.saveAvatar.mockRejectedValueOnce(fbError('PERMISSION_DENIED'));

		expect(await account.saveAvatar('cat:blue')).toBe(false);
		expect(account.profile?.avatar).toBe('dog:red');
	});
});
