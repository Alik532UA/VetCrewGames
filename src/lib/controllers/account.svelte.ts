import {
	accountState,
	handleFree,
	linkEmail,
	readProfile,
	saveProfile,
	searchHandles,
	signInEmail,
	signOut,
	type AccountState,
	type Profile
} from '$lib/net/account';
import { follow, listFollowing, unfollow, type Friend } from '$lib/net/follows';
import { connect } from '$lib/net/firebase';
import { logService } from '$lib/services/logService.svelte';

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
	/** Анонімний вхід чи справжній акаунт. */
	state = $state<AccountState>('anonymous');
	/** Мій `uid`. Порожньо — ще не підʼєдналися. */
	uid = $state('');
	/** Мій профіль. `null` — ще не створений. */
	profile = $state<Profile | null>(null);
	/** Мої підписки з позначкою взаємності. */
	following = $state<Friend[]>([]);
	/** Знахідки пошуку людей. */
	found = $state<Profile[]>([]);
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
		if (done) this.state = await accountState();
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
		if (done) await this.load();
		return done;
	}

	async leave(): Promise<boolean> {
		const done = await this.#act('sign-out', () => signOut());
		if (done) {
			// Після виходу все читається заново: `uid` уже інший, тобто попередній
			// профіль і підписки на екрані стосувалися б чужого акаунта.
			this.profile = null;
			this.following = [];
			this.found = [];
			await this.load();
		}
		return done;
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
				previous
			)
		);
		if (done) this.profile = await readProfile(this.uid);
		return done;
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
