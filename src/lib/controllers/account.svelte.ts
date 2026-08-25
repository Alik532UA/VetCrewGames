import {
	accountState,
	handleFree,
	linkEmail,
	readProfile,
	resetPassword,
	saveProfile,
	searchHandles,
	signInEmail,
	signInGoogle,
	signOut,
	type AccountState,
	type Profile
} from '$lib/net/account';
import { follow, friendUids, listFollowing, unfollow, type Friend } from '$lib/net/follows';
import { OPEN_PRIVACY, readPrivacy, savePrivacy, type Privacy } from '$lib/net/privacy';
import { changePassword, deleteAccount } from '$lib/net/erase';
import { leadersOf, topLeaders, withdrawLeader, type Leader } from '$lib/net/leaders';
import { connect } from '$lib/net/firebase';
import { hasAccount } from '$lib/services/accountFlag';
import { logService } from '$lib/services/logService.svelte';
import { mergeOnSignIn, refreshProfile, signedOut } from '$lib/services/playerSync';

/**
 * Стан акаунта на екрані: хто я, мій профіль, мої підписки, знахідки пошуку.
 *
 * ## Чому контролер, а не поля сторінки
 *
 * Тут шість станів, які міняються НЕЗАЛЕЖНО (вхід, профіль, пошук, підписки,
 * зайнятість псевдоніма, помилка останньої дії) і два з них асинхронні. Розсипані
 * по сторінці, вони дають шість `$state` і чотири `$effect`, з яких кожен може
 * переписати чуже — і сторінка вже двічі виходила за межу розміру саме так.
 *
 * ## Помилки НЕ ковтаються, але й не падають
 *
 * `error` — код останньої невдалої дії, і він тут навмисно РЯДКОМ, а не
 * `Error`: у журнал і на екран потрапляє причина, яку можна перекласти, а не
 * англійське повідомлення Firebase. Порожньо — усе гаразд.
 */
export class Account {
	/**
	 * Анонімний вхід чи справжній акаунт.
	 *
	 * ПОЧАТКОВЕ ЗНАЧЕННЯ — З ПІДКАЗКИ СХОВИЩА, а не «анонім, поки не спитаємо».
	 *
	 * Доти тут стояло `'anonymous'`, і сторінка на першому кадрі малювала ФОРМУ
	 * ВХОДУ навіть тому, хто ввійшов місяць тому: `load()` мусить підняти SDK
	 * Firebase (динамічний імпорт), дочекатися відновлення сесії й лише тоді
	 * сказати правду. На локальній машині це мигання, на мобільній мережі —
	 * секунда з формою входу перед власним кабінетом.
	 *
	 * `hasAccount()` відповідає на те саме питання БЕЗ мережі: цей браузер уже
	 * входив в акаунт (`services/accountFlag.ts`, той самий прапорець, за яким
	 * кореневий layout вирішує, чи вантажити синхронізацію). Тобто це не здогадка
	 * навмання, а те, що ми самі записали при вході й стерли при виході.
	 *
	 * Ціна названа: якщо сховище каже «входив», а сесії вже немає (почистили
	 * IndexedDB руками), перший кадр покаже порожній кабінет, і `load()` за
	 * мілісекунди замінить його формою. Це рідший і дешевший різновид помилки, ніж
	 * форма входу перед кабінетом у КОЖНОГО залогіненого при кожному відкритті.
	 */
	state = $state<AccountState>(hasAccount() ? 'linked' : 'anonymous');
	/** Мій `uid`. Порожньо — ще не підʼєдналися. */
	uid = $state('');
	/**
	 * Чи має акаунт пароль — тобто чи є що міняти.
	 *
	 * Вхід через Google пароля не створює: панель зміни пароля там показувала б
	 * поле, яке нічого не змінює. Той самий висновок, що в сусідньому `Slovko`
	 * (`isGoogleAccount`).
	 */
	hasPassword = $state(false);
	/** Мій профіль. `null` — ще не створений. */
	profile = $state<Profile | null>(null);
	/** Мої підписки з позначкою взаємності. */
	following = $state<Friend[]>([]);
	/** Знахідки пошуку людей. */
	found = $state<Profile[]>([]);
	/**
	 * Мої перемикачі приватності.
	 *
	 * Типово дозволено все, і це не оптимізм: вузла в базі немає, доки людина не
	 * торкалася перемикачів, а правила питають `!= false`. Показати їх вимкненими
	 * означало б збрехати про стан, якого ніхто не задавав.
	 */
	privacy = $state<Privacy>({ ...OPEN_PRIVACY });
	/** Таблиця лідерів: найкращі взагалі. */
	leaders = $state<Leader[]>([]);
	/** Таблиця лідерів серед друзів — тобто взаємних підписок. */
	friendLeaders = $state<Leader[]>([]);
	/** Триває мережева дія: кнопки не приймають повторних натискань. */
	busy = $state(false);
	/** Код останньої невдачі для перекладу. Порожньо — усе гаразд. */
	error = $state('');

	/**
	 * Прочитати все, що потрібно екрану. Кличеться з `onMount`.
	 *
	 * Один виклик, а не три: усі три відповіді потрібні одночасно, і три окремі
	 * `$effect` давали б три різні миті, у які екран уже показує щось, а решта ще
	 * їде.
	 */
	async load(): Promise<void> {
		try {
			const { uid } = await connect();
			this.uid = uid;
			this.state = await accountState();
			this.profile = await readProfile(uid);
			this.following = await listFollowing();
			this.privacy = await readPrivacy();

			const { auth } = await connect();
			this.hasPassword =
				auth.currentUser?.providerData.some((provider) => provider.providerId === 'password') ??
				false;
		} catch (error) {
			logService.warn('network', 'account not loaded', { reason: String(error) });
		}
	}

	/**
	 * Обгортка для дій, що можуть не вийти.
	 *
	 * Один каркас на всі: перевірка «не зайнято», скидання попередньої помилки,
	 * `busy` і `finally`. Той самий висновок, що з `hostAction` у кімнаті — забути
	 * `catch` у четвертій копії легко, і тоді кнопка мовчить.
	 */
	async #act(what: string, run: () => Promise<void>): Promise<boolean> {
		if (this.busy) return false;
		this.busy = true;
		this.error = '';
		try {
			await run();
			return true;
		} catch (error) {
			/*
			 * Код Firebase, а не текст: `auth/email-already-in-use` можна перекласти
			 * й показати людині, а англійське речення з SDK — ні.
			 *
			 * Порожній код лишає загальне повідомлення, і це правильна межа: у
			 * невдачі, якої ми не передбачили, вигадувати причину не можна.
			 */
			const code = (error as { code?: string }).code ?? '';
			this.error = code;
			logService.warn('network', `account action failed: ${what}`, {
				reason: String(error)
			});
			return false;
		} finally {
			this.busy = false;
		}
	}

	/** Створити акаунт на наявному анонімному вході: `uid` не міняється. */
	async register(email: string, password: string): Promise<boolean> {
		const done = await this.#act('register', () => linkEmail(email, password));
		if (done) {
			this.state = await accountState();
			await mergeOnSignIn();
		}
		return done;
	}

	/**
	 * Зайти в наявний акаунт. МІНЯЄ `uid`, тож і профіль, і підписки перечитуються.
	 *
	 * Саме тому екран мусить попередити про це до натиску: усе, що лежало під
	 * анонімним `uid`, лишається під ним.
	 */
	async signIn(email: string, password: string): Promise<boolean> {
		const done = await this.#act('sign-in', () => signInEmail(email, password));
		if (done) {
			await this.load();
			await mergeOnSignIn();
		}
		return done;
	}

	/**
	 * Вхід через Google.
	 *
	 * `load()` після успіху, а не `accountState()`: привʼязка лишає `uid`, але
	 * вхід у вже наявний акаунт Google його МІНЯЄ — і тоді профіль із підписками
	 * на екрані стосувалися б чужого. Перечитати дешевше, ніж угадати, який із
	 * двох шляхів спрацював.
	 */
	async google(): Promise<boolean> {
		const done = await this.#act('google', () => signInGoogle());
		if (done) {
			await this.load();
			await mergeOnSignIn();
		}
		return done;
	}

	/**
	 * Лист для відновлення пароля.
	 *
	 * Повертає `true` і тоді, коли пошти не існує: різний результат для наявної
	 * й відсутньої дозволяв би перебирати акаунти. Тому `auth/user-not-found`
	 * ковтається ТУТ і тільки він — решта помилок (немережева пошта, забагато
	 * спроб) людині потрібна.
	 */
	async resetPassword(email: string): Promise<boolean> {
		const done = await this.#act('reset', () => resetPassword(email));
		if (done) return true;
		if (this.error === 'auth/user-not-found' || this.error === 'auth/invalid-credential') {
			this.error = '';
			return true;
		}
		return false;
	}

	/**
	 * Вийти з акаунта — і НЕ лишити в браузері нічого, що набрала людина.
	 *
	 * ## Чому місцеве стирається, а не лишається «про запас»
	 *
	 * Рахунок і рекорди зливаються з акаунтом при вході (`playerData.signedIn`).
	 * Якби вихід лишав їх у сховищі, вони влилися б у НАСТУПНИЙ акаунт, у який
	 * тут увійдуть, — тобто рахунок можна було б переписати з чужого, просто
	 * вийшовши й увійшовши іншим. У сусідньому `MindStep` це рівно так і працює
	 * досі: метод очищення там написаний, і його не кличе жоден рядок.
	 *
	 * ## Чому й заповідник
	 *
	 * Автор попросив стирати все, що стосується гравця, включно з недограною
	 * партією. Фонд заповідника — саме вона: пів години гри, які інакше побачив би
	 * наступний власник цього браузера. Стирає його СВІЙ контролер: до сховища
	 * фонду ходить лише він (інваріант у `src/structure.test.ts`), і `reset()`
	 * робить обидві половини одним рухом — новий фонд у памʼяті й у сховищі.
	 */
	async leave(): Promise<boolean> {
		const done = await this.#act('sign-out', () => signOut());
		if (done) {
			signedOut();
			/*
			 * Заповідник — ДИНАМІЧНИМ імпортом, і це не стиль.
			 *
			 * Статичний тягнув би в чанк сторінки акаунта всю симуляцію: каталог
			 * видів, рушій доби, збереження. Заміряно: 217 КБ gzip проти 305 на
			 * тому самому маршруті (`npm run check:build` — гейт). Тут же він
			 * приїжджає лише в мить виходу з акаунта, тобто рівно тоді, коли
			 * потрібен.
			 */
			const { reserve } = await import('$lib/controllers/reserve.svelte');
			reserve.reset();

			// Після виходу все читається заново: `uid` уже інший, тобто попередній
			// профіль і підписки на екрані стосувалися б чужого акаунта.
			this.profile = null;
			this.following = [];
			this.found = [];
			await this.load();
		}
		return done;
	}

	/**
	 * Змінити пароль. Обидві половини — повторна автентифікація й новий пароль —
	 * лежать у `net/erase.ts`, тут лишається проводка й помилка на екран.
	 */
	async changePassword(current: string, next: string): Promise<boolean> {
		return this.#act('password', () => changePassword(current, next));
	}

	/**
	 * Видалити акаунт — незворотно, з прибиранням усього свого.
	 *
	 * ПІСЛЯ УСПІХУ сторінка мусить лишитися робочою, тож усе, що робить вихід,
	 * робиться й тут: місцеві дані стираються, заповідник починається заново, а
	 * далі — новий анонімний вхід. Різниця з виходом одна: акаунта більше немає, і
	 * повернутися в нього неможливо.
	 */
	async delete(password: string): Promise<boolean> {
		const done = await this.#act('delete', () => deleteAccount(password || undefined));
		if (!done) return false;

		signedOut();
		const { reserve } = await import('$lib/controllers/reserve.svelte');
		reserve.reset();

		/*
		 * Новий анонімний вхід — тим самим шляхом, що у виході: `signOut()` знає, що
		 * після нього треба скинути кеш під'єднання, бо `uid` став іншим. Без цього
		 * сторінка лишилася б із `uid` видаленого акаунта, і кожне читання впиралося
		 * б у правило.
		 */
		await signOut();
		this.profile = null;
		this.following = [];
		this.found = [];
		this.leaders = [];
		this.friendLeaders = [];
		await this.load();
		return true;
	}

	/** Чи вільний псевдонім. Свій власний вважається вільним. */
	async checkHandle(handle: string): Promise<boolean> {
		if (handle === this.profile?.handle) return true;
		return handleFree(handle);
	}

	/**
	 * Зберегти профіль.
	 *
	 * Аватар їде тим самим записом, що імʼя й країна: це один опис того, «як мене
	 * видно», і розділяти його на два записи означало б стан, у якому половина
	 * профілю нова, а половина стара.
	 */
	async save(name: string, handle: string, country: string, avatar: string): Promise<boolean> {
		const previous = this.profile?.handle;
		const done = await this.#act('profile', () =>
			saveProfile(
				{ name, handle, country: country || undefined, avatar: avatar || undefined },
				previous,
				this.privacy.search
			)
		);
		if (done) {
			this.profile = await readProfile(this.uid);
			// Рядок у таблиці лідерів несе імʼя, аватар і країну — без цього виклику
			// він показував би те, що було до збереження.
			await refreshProfile();
		}
		return done;
	}

	/**
	 * Перемикачі приватності.
	 *
	 * Кожен із трьох тримає ПРАВИЛО БАЗИ (`net/privacy.ts`), тож тут не фільтр, а
	 * рівно дві дії: записати вибір і привести у відповідність те, що вже лежить
	 * назовні — індекс пошуку (це робить `savePrivacy`) і рядок таблиці лідерів.
	 *
	 * Порядок на вимкненні важливий: спершу запис, потім прибирання рядка. У
	 * зворотному порядку рядок міг би повернутися наступним же збереженням
	 * рахунку, бо перемикач у базі ще дозволяв би показ.
	 */
	async setPrivacy(next: Privacy): Promise<boolean> {
		const done = await this.#act('privacy', () => savePrivacy(next, this.profile?.handle ?? null));
		if (!done) return false;

		this.privacy = next;
		if (next.board) await refreshProfile();
		else await withdrawLeader();
		return true;
	}

	/**
	 * Прочитати обидві таблиці — глобальну й серед друзів.
	 *
	 * Друзі — це ВЗАЄМНІ підписки, і саме тому список береться з `friendUids()`, а
	 * не з `following`: одностороння підписка не робить людину другом, і показувати
	 * її рахунок серед друзів було б неправдою.
	 */
	async loadBoard(): Promise<void> {
		this.leaders = await topLeaders();
		this.friendLeaders = await leadersOf(await friendUids());
	}

	async search(prefix: string): Promise<void> {
		this.found = await searchHandles(prefix);
	}

	async add(target: string): Promise<boolean> {
		const done = await this.#act('follow', () => follow(target));
		if (done) this.following = await listFollowing();
		return done;
	}

	async remove(target: string): Promise<boolean> {
		const done = await this.#act('unfollow', () => unfollow(target));
		if (done) this.following = await listFollowing();
		return done;
	}

	/** Чи вже підписаний я на цього — з уже прочитаного списку, без запиту. */
	follows(target: string): boolean {
		return this.following.some((friend) => friend.profile.uid === target);
	}
}
