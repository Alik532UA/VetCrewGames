import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';
import { logService } from '$lib/services/logService.svelte';

/**
 * Під'єднання до Firebase — ліниве, анонімне й одне на застосунок.
 *
 * **Імпорти динамічні, і це не оптимізація.** Пакет `firebase` важить більше за
 * всю поточну збірку разом; статичний імпорт поклав би його в спільний чанк, і
 * кожен, хто зайшов почитати про заповідник, тягнув би SDK бази, у яку ніколи не
 * звернеться. Тут він приїжджає лише на екран спільної гри — і саме тому
 * `check:build` не червоніє.
 *
 * **Вхід анонімний.** Кімнату треба вміти створити з першого дотику: людина, яку
 * на вході питають пароль, до кімнати не доходить. Прив'язати акаунт (Google,
 * пошта) можна потім — Firebase дає `link`, і прогрес при цьому не гине.
 *
 * `apiKey` тут **не секрет**: для веб-застосунків він публічний за задумом і
 * приїжджає в кожну сторінку. Захист дають правила безпеки й список дозволених
 * доменів, а не приховування ключа.
 */

const CONFIG = {
	apiKey: 'AIzaSyBqSsnKynm_iWDr7qLZO7gwcp4VFZHXS40',
	authDomain: 'vet-crew-games.firebaseapp.com',
	databaseURL: 'https://vet-crew-games-default-rtdb.europe-west1.firebasedatabase.app',
	projectId: 'vet-crew-games',
	storageBucket: 'vet-crew-games.firebasestorage.app',
	messagingSenderId: '797702010405',
	appId: '1:797702010405:web:38e4e9918f115b795eb1cc'
};

export interface Connection {
	/**
	 * Хто я. Анонімний доти, доки до цього ж входу не привʼязали акаунт.
	 *
	 * Саме «до цього ж»: реєстрація — це `linkWithCredential`, тож `uid` при
	 * ній НЕ міняється, і все, що під ним лежить (кімнати, підписки, профіль),
	 * лишається на місці. Подробиці — у `net/account.ts`.
	 */
	uid: string;
	db: Database;
	/**
	 * Сам обʼєкт автентифікації — потрібен акаунтам, і лише їм.
	 *
	 * Гра його не торкається: кімнати живуть на `uid`, а не на користувачі.
	 * Але привʼязати акаунт, вийти чи спитати `isAnonymous` без нього
	 * неможливо, а другий `getAuth()` поруч дав би другий екземпляр на той
	 * самий застосунок.
	 */
	auth: Auth;
}

/**
 * Одне під'єднання на застосунок, і саме тому це проміс, а не функція.
 *
 * Два виклики поспіль (лобі й дошка) не мусять означати двох входів: перший
 * створює проміс, другий чекає на той самий. Синхронний прапорець «уже
 * підключаємось» тут не допоміг би — між перевіркою й записом лежить `await`.
 */
let pending: Promise<Connection> | null = null;

export function connect(): Promise<Connection> {
	pending ??= open();
	return pending;
}

async function open(): Promise<Connection> {
	const [{ initializeApp }, authModule, dbModule] = await Promise.all([
		import('firebase/app'),
		import('firebase/auth'),
		import('firebase/database')
	]);

	const app = initializeApp(CONFIG);
	const auth: Auth = authModule.getAuth(app);
	const db = dbModule.getDatabase(app);

	/*
	 * СПЕРШУ ЧЕКАЄМО, ПОКИ FIREBASE ВІДНОВИТЬ СЕСІЮ, і лише тоді дивимось, хто ми.
	 *
	 * Тут стояло просто `auth.currentUser ?? signInAnonymously(...)`, і це був
	 * найдорожчий дефект застосунку: `currentUser` одразу після `getAuth()` —
	 * ЗАВЖДИ `null`, бо сесія лежить в IndexedDB і читається асинхронно. Тобто
	 * умова не «уже ввійшли?», а «встигло прочитатися?» — і відповідь на неї на
	 * першому такті завжди «ні».
	 *
	 * Наслідок був не косметичний. Перезавантаження сторінки залогіненою людиною
	 * створювало НОВИЙ анонімний акаунт і робило його поточним, а справжній
	 * лишався в базі з усім, що під ним: профіль, підписки, рахунок, кімнати.
	 * На екрані це виглядало як «знову вікно логіну» — саме так автор і описав, —
	 * але втрачався не екран, а прив'язка до акаунта.
	 *
	 * `authStateReady()` віддає обіцянку, що спрацьовує рівно раз — після першого
	 * визначення стану (SDK 9.17+). До неї те саме доводилося робити руками через
	 * `onAuthStateChanged` з відпискою в першому виклику; тут це один рядок.
	 *
	 * Анонімний вхід лишається — але тепер він означає те, що й мав означати: «тут
	 * НЕМА кого відновлювати», а не «ще не встигли перевірити».
	 */
	await auth.authStateReady();

	const user = auth.currentUser ?? (await authModule.signInAnonymously(auth)).user;
	logService.info(
		'network',
		user.isAnonymous ? 'anonymous session ready' : 'account session ready'
	);

	return { uid: user.uid, db, auth };
}

/**
 * Скинути під'єднання. Потрібне тестам і виходу з акаунта — у грі не кличеться.
 */
export function forget(): void {
	pending = null;
}
