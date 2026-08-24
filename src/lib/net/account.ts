import { connect, forget } from './firebase';
import { logService } from '$lib/services/logService.svelte';

/**
 * АКАУНТ: привʼязка до анонімного входу, профіль, псевдонім.
 *
 * ## Головне рішення: акаунт ПРИВʼЯЗУЄТЬСЯ, а не заміняє
 *
 * Анонімний вхід лишається типовим, і це не компроміс: кімнату треба вміти
 * створити з першого дотику, а людина, яку на вході питають пароль, до кімнати не
 * доходить. Тому реєстрація — це `linkWithCredential` до НАЯВНОГО анонімного
 * користувача: `uid` не міняється, і разом із ним не гинуть ні кімнати в індексі
 * `myRooms`, ні підписки, ні профіль.
 *
 * Це та сама схема, що в сусідньому `Slovko`, і вона там уже показала, чого
 * коштує зворотний порядок: `signInWithPopup` створює НОВОГО користувача, і
 * прогрес анонімного лишається під старим `uid` назавжди.
 *
 * ## Пошта й пароль, а не Google — на першому кроці
 *
 * `signInWithPopup` вимагає `apis.google.com` у `script-src` і `frame-src`
 * політики CSP, а зараз він там заборонений — заміряно в консолі: браузер блокує
 * саме цей скрипт. Пошта з паролем іде звичайним запитом до `identitytoolkit`,
 * тобто вже дозволена (`connect-src: https://*.googleapis.com`), і працює без
 * жодної правки політики.
 *
 * Google лишається наступним кроком, і він вимагає не коду, а рішення: пустити в
 * CSP сторонній скрипт. Це записано в PROJECT-CONTEXT.md як борг із причиною, а
 * не забуто.
 *
 * ## Чого тут НЕМА
 *
 * Скидання пароля поштою. Воно вимагає налаштованого шаблону листа в консолі
 * Firebase і власного домену для посилання — тобто роботи поза кодом. Межа
 * названа, щоб «забув пароль» не читалося як недогляд.
 */

/** Профіль, який видно всім. Рівно те, що й так видно в кімнаті. */
export interface Profile {
	uid: string;
	name: string;
	/** Псевдонім для пошуку: малі латинські, цифри, підкреслення. */
	handle: string;
	country?: string;
	/**
	 * Аватар — короткий рядок `значок:колір` (`config/avatars.ts`).
	 *
	 * НЕОБОВʼЯЗКОВИЙ, як і країна: профіль, створений до появи аватарів, лишається
	 * чинним, а показ підставляє типовий. Порожнього поля тут не буває — правило
	 * бази вимагає взірця, і `''` йому не відповідає.
	 */
	avatar?: string;
}

/** Стан входу. `anonymous` — грати можна, підписуватися ні. */
export type AccountState = 'anonymous' | 'linked';

/** Чи має поточний користувач справжній акаунт, а не лише анонімний вхід. */
export async function accountState(): Promise<AccountState> {
	const { auth } = await connect();
	const user = auth.currentUser;
	// `isAnonymous` — властивість самого користувача, а не здогадка за наявністю
	// пошти: анонімний користувач із привʼязаною поштою її вже не має.
	return user && !user.isAnonymous ? 'linked' : 'anonymous';
}

/**
 * Привʼязати пошту й пароль до наявного входу.
 *
 * Кидає з кодом Firebase, і кидає НАВМИСНО: це єдине місце, де людина мусить
 * побачити причину. «Пошта вже зайнята» й «пароль надто простий» вимагають різних
 * дій, і сховати їх за одним «не вдалося» означало б лишити людину гадати.
 */
export async function linkEmail(email: string, password: string): Promise<void> {
	const { auth } = await connect();
	const user = auth.currentUser;
	if (!user) throw new Error('no-user');

	const { EmailAuthProvider, linkWithCredential } = await import('firebase/auth');
	const credential = EmailAuthProvider.credential(email, password);
	await linkWithCredential(user, credential);
}

/**
 * Зайти в наявний акаунт поштою й паролем.
 *
 * УВАГА, і це названо прямо: вхід у ІНШИЙ акаунт міняє `uid`, тож усе, що лежало
 * під анонімним, лишається під ним. Кімнати в індексі, підписки, профіль — усе
 * це прив'язане до `uid`, а не до пристрою.
 *
 * Тому екран мусить питати підтвердження, а не пропонувати вхід поруч із
 * реєстрацією як рівний варіант.
 */
export async function signInEmail(email: string, password: string): Promise<void> {
	const { auth } = await connect();
	const { signInWithEmailAndPassword } = await import('firebase/auth');
	await signInWithEmailAndPassword(auth, email, password);
}

/**
 * Вхід через Google — привʼязкою до наявного входу, а не окремим входом.
 *
 * `linkWithPopup`, а не `signInWithPopup`, і це те саме міркування, що в
 * `linkEmail`: анонімний `uid` уже має профіль, кімнати в індексі й підписки.
 * Звичайний вхід дав би НОВИЙ `uid`, тобто тихо загубив би все це.
 *
 * Коли акаунт Google уже привʼязаний до іншого користувача, Firebase кидає
 * `auth/credential-already-in-use`. Тоді єдиний правильний шлях — зайти в той
 * акаунт, і ми це й робимо: `signInWithCredential` із тим самим підтвердженням.
 * Так поводиться й привʼязка пошти, тільки там про це вирішує людина, а тут
 * вибору немає — вікно Google уже закрилося.
 *
 * ЦІНА НАЗВАНА: у другому випадку `uid` міняється, і анонімний доробок лишається
 * під старим. Інакше було б гірше — «не вдалося» на кнопці, яка не має жодного
 * іншого способу спрацювати.
 */
export async function signInGoogle(): Promise<void> {
	const { auth } = await connect();
	const user = auth.currentUser;
	const {
		GoogleAuthProvider,
		linkWithPopup,
		signInWithCredential,
		signInWithPopup
	} = await import('firebase/auth');

	const provider = new GoogleAuthProvider();
	if (!user) {
		await signInWithPopup(auth, provider);
		return;
	}

	try {
		await linkWithPopup(user, provider);
	} catch (error) {
		const code = (error as { code?: string }).code ?? '';
		if (code !== 'auth/credential-already-in-use') throw error;

		/*
		 * Підтвердження з ПОМИЛКИ, а не друге вікно.
		 *
		 * Firebase кладе в помилку те саме підтвердження, яке щойно отримав, — і
		 * це єдиний спосіб продовжити: показати вікно Google удруге означало б
		 * попросити людину підтвердити те, що вона підтвердила секунду тому, і
		 * частина браузерів друге вікно вже заблокує як не викликане кліком.
		 */
		const credential = GoogleAuthProvider.credentialFromError(
			error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
		);
		if (!credential) throw error;
		await signInWithCredential(auth, credential);
	}
}

/**
 * Надіслати лист для відновлення пароля.
 *
 * Помилку `auth/user-not-found` викликач НЕ показує: різний текст для наявної
 * й відсутньої пошти дозволяє перебирати акаунти. Тому тут вона не гаситься —
 * рішення про повідомлення належить шару вище, і воно там однакове для обох.
 */
export async function resetPassword(email: string): Promise<void> {
	const { auth } = await connect();
	const { sendPasswordResetEmail } = await import('firebase/auth');
	await sendPasswordResetEmail(auth, email);
}

/**
 * Вийти з акаунта — і одразу зайти анонімно.
 *
 * Без другої половини сторінка лишилася б без користувача, а без користувача не
 * читається ні перелік кімнат, ні профіль: правила вимагають `auth != null`
 * майже всюди. Тобто «вийти» без анонімного входу виглядало б як зламаний сайт.
 */
export async function signOut(): Promise<void> {
	const { auth } = await connect();
	const { signInAnonymously, signOut: leave } = await import('firebase/auth');
	await leave(auth);
	await signInAnonymously(auth);

	/*
	 * СКИНУТИ КЕШ ПІД'ЄДНАННЯ — і це виправлення, а не прибирання.
	 *
	 * `connect()` кешує проміс разом із `uid`, і після повторного анонімного входу
	 * `uid` уже ІНШИЙ. Без цього рядка кожен наступний виклик віддавав би старий:
	 * профіль читався б за колишнім акаунтом, а запис ішов би в чужу гілку — і
	 * правило його відкидало б. `forget()` існував саме для цього випадку («потрібне
	 * тестам і виходу з акаунта»), і не кликав його ніхто.
	 *
	 * Повторний `initializeApp` цьому не шкодить: SDK віддає наявний застосунок,
	 * коли імʼя й конфіг ті самі.
	 */
	forget();
}

/** Чи вільний псевдонім. `false` і коли зайнятий, і коли прочитати не дали. */
export async function handleFree(handle: string): Promise<boolean> {
	try {
		const { db } = await connect();
		const { get, ref } = await import('firebase/database');
		return !(await get(ref(db, `handles/${handle}`))).exists();
	} catch (error) {
		logService.warn('network', 'handle check failed', { reason: String(error) });
		return false;
	}
}

/**
 * Зберегти профіль і зайняти псевдонім.
 *
 * ## Порядок: спершу ПСЕВДОНІМ, потім профіль
 *
 * Псевдонім — те, що може не вийти: його міг зайняти хтось інший між перевіркою
 * й записом, і саме від цього стоїть правило «створити лише вільний». Профіль же
 * не відмовить нікому.
 *
 * У зворотному порядку існував би стан, у якому профіль уже називає псевдонім, а
 * псевдонім належить іншому — тобто дві правди про те саме. Тут же невдача
 * лишає все як було.
 *
 * ## Старий псевдонім звільняється ПІСЛЯ
 *
 * Якщо звільнити його першим, а новий зайняти не вдасться, людина лишиться без
 * псевдоніма зовсім — гірше, ніж із двома на мить.
 */
export async function saveProfile(
	profile: Omit<Profile, 'uid'>,
	previous?: string,
	searchable = true
): Promise<void> {
	const { uid, db } = await connect();
	const { ref, remove, serverTimestamp, set } = await import('firebase/database');

	if (previous !== profile.handle) {
		await set(ref(db, `handles/${profile.handle}`), uid);
	}

	await set(ref(db, `users/${uid}/profile`), {
		name: profile.name,
		handle: profile.handle,
		// Поле або є, або його немає зовсім: `undefined` у `set()` кидає, а
		// порожній рядок не пройшов би `.validate` (рівно дві літери).
		...(profile.country ? { country: profile.country } : {}),
		// Те саме й для аватара, і з тієї самої причини: його `.validate` вимагає
		// взірця `значок:колір`, якому порожній рядок не відповідає.
		...(profile.avatar ? { avatar: profile.avatar } : {}),
		at: serverTimestamp()
	});

	/*
	 * ПОШУКОВИЙ ІНДЕКС — після профілю, і окремим записом.
	 *
	 * Він не частина профілю: людина, яка вимкнула пошук, лишається з профілем і
	 * псевдонімом, просто її не знаходять. Тому невдача тут не валить збереження —
	 * профіль уже записаний, а індекс наздожене наступним збереженням.
	 *
	 * Правило бази при цьому не дасть створити запис тому, хто пошук вимкнув, —
	 * навіть якщо цей рядок колись покличуть із `searchable = true` помилково.
	 */
	if (searchable) await setSearchable(profile.handle, true);

	if (previous && previous !== profile.handle) {
		// Звільнення старого — прибирання, а не частина запису: невдача тут лишає
		// зайнятий псевдонім, який більше нікого не називає. Це сміття, а не дефект.
		try {
			await remove(ref(db, `handles/${previous}`));
			await remove(ref(db, `find/${previous}`));
		} catch (error) {
			logService.warn('network', 'old handle not released', { reason: String(error) });
		}
	}
}

/**
 * Показувати цей псевдонім у пошуку — чи прибрати з індексу.
 *
 * ОДИН власник гілки `find`: і збереження профілю, і перемикач приватності
 * ходять сюди. Два місця запису в один індекс розійшлися б тихо — саме так у
 * сусідньому `Slovko` профіль називав псевдонім, якого в індексі не було.
 *
 * НЕ КИДАЄ. Увімкнути пошук може не дати правило (перемикач ще `false` у базі), а
 * вимкнути — обрив мережі. Обидва випадки лишають індекс позаду стану, і
 * наздоганяє його наступне збереження, а не виняток на екрані.
 */
export async function setSearchable(handle: string, on: boolean): Promise<void> {
	try {
		const { uid, db } = await connect();
		const { ref, remove, set } = await import('firebase/database');
		if (on) await set(ref(db, `find/${handle}`), uid);
		else await remove(ref(db, `find/${handle}`));
	} catch (error) {
		logService.warn('network', 'search index not updated', { reason: String(error) });
	}
}

/**
 * СВІЙ профіль. `null` — його ще не створили або читання не вдалося.
 *
 * Окремо від `readProfile(uid)`, бо `uid` знає лише під'єднання: тягнути його
 * через півдороги застосунку означало б передавати аргумент, який завжди той
 * самий, і давати змогу передати чужий.
 */
export async function readMyProfile(): Promise<Profile | null> {
	try {
		const { uid } = await connect();
		return await readProfile(uid);
	} catch (error) {
		logService.warn('network', 'own profile not read', { reason: String(error) });
		return null;
	}
}

/** Профіль за `uid`. `null` — його ще не створили. */
export async function readProfile(uid: string): Promise<Profile | null> {
	const { db } = await connect();
	const { get, ref } = await import('firebase/database');
	const snapshot = await get(ref(db, `users/${uid}/profile`));
	if (!snapshot.exists()) return null;
	return { uid, ...(snapshot.val() as Omit<Profile, 'uid'>) };
}

/** Скільком знахідкам показуватися в пошуку. Правило бази вимагає межі. */
export const SEARCH_LIMIT = 20;

/**
 * Пошук людей за початком псевдоніма.
 *
 * ГІЛКА `find`, а не `handles`, і це не перейменування: реєстр унікальності
 * містить усіх, а індекс пошуку — лише тих, хто на це згоден (перемикач
 * `privacy/search`). Доти перелічити можна було саме реєстр, тобто вимкнений
 * пошук нічого не приховував.
 *
 * ОБМЕЖЕНИМ запитом, і межа тут — умова доступу, а не оптимізація: без неї один
 * запит вивантажив би весь індекс разом із `uid`, тобто перелік користувачів
 * гри. Правило вимагає `orderByKey` і `limitToFirst <= 20`.
 *
 * `\uf8ff` — останній код ПРИВАТНОЇ області Unicode (BMP), і саме тому він тут
 * доречний: у псевдонімах дозволені лише `[a-z0-9_]`, тож жоден справжній ключ до
 * нього не дійде. `startAt(q)` плюс `endAt(q + \uf8ff)` дає рівно «усі ключі, що
 * починаються з q» — документований ідіом Firebase, а не хитрість.
 *
 * НЕ КИДАЄ: пошук, що впав, лишає порожній список, а не зламаний екран.
 */
export async function searchHandles(prefix: string): Promise<Profile[]> {
	const clean = prefix.trim().toLowerCase();
	if (clean.length < 2) return [];

	try {
		const { db } = await connect();
		const { endAt, get, limitToFirst, orderByKey, query, ref, startAt } = await import(
			'firebase/database'
		);
		const found = await get(
			query(
				ref(db, 'find'),
				orderByKey(),
				startAt(clean),
				endAt(`${clean}\uf8ff`),
				limitToFirst(SEARCH_LIMIT)
			)
		);
		if (!found.exists()) return [];

		const uids = Object.values(found.val() as Record<string, string>);
		/*
		 * Профілі читаються ПАРАЛЕЛЬНО, і невдалі просто зникають зі списку.
		 *
		 * Псевдонім міг лишитися після профілю (звільнення не вдалося — див.
		 * `saveProfile`), і тоді запис у `handles` вказує в порожнє. Це сміття, а
		 * не дефект: у пошуку його просто не видно.
		 */
		const profiles = await Promise.all(uids.map((uid) => readProfile(uid).catch(() => null)));
		return profiles.filter((profile): profile is Profile => profile !== null);
	} catch (error) {
		logService.warn('network', 'handle search failed', { reason: String(error) });
		return [];
	}
}
