import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Database } from 'firebase/database';

/**
 * ПІДʼЄДНАННЯ ДО ЕМУЛЯТОРА — для перевірок, що йдуть над справжнім SDK.
 *
 * Лише для файлів `*.emulator.test.ts` (їх запускає `npm run check:rules`).
 * Застосунок цього модуля не імпортує: шлях до продакшн-проєкту — `firebase.ts`,
 * і змішувати їх не можна навіть через прапорець — саме так прапорець і лишився
 * б увімкненим у збірці.
 *
 * Перевірка підміняє `connect()` на `currentConnection()` звідси й діє від імені
 * вибраного учасника через `as()`. Кожен учасник — окремий `FirebaseApp` з
 * власним анонімним входом в емулятор, тож правила бачать РІЗНИХ людей.
 */
export interface Connection {
	uid: string;
	db: Database;
	auth: Auth;
	app: FirebaseApp;
}

const PROJECT = 'demo-vet-crew-games';
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9010';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9109';

let current: Connection | null = null;

/** Те, що віддає підмінений `connect()`: учасник, вибраний `as()`. */
export async function currentConnection(): Promise<Connection> {
	if (!current) throw new Error('емулятор: не вибрано, від чийого імені діяти');
	return current;
}

/** Новий учасник: свій застосунок, свій анонімний вхід в емулятор. */
export async function signedIn(name: string): Promise<Connection> {
	const { initializeApp } = await import('firebase/app');
	const { connectAuthEmulator, getAuth, signInAnonymously } = await import('firebase/auth');
	const { connectDatabaseEmulator, getDatabase } = await import('firebase/database');
	const app = initializeApp(
		{
			apiKey: 'demo-key',
			projectId: PROJECT,
			databaseURL: `http://${DB_HOST}?ns=${PROJECT}-default-rtdb`
		},
		name
	);
	const auth = getAuth(app);
	connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
	const db = getDatabase(app);
	const [host, port] = DB_HOST.split(':');
	connectDatabaseEmulator(db, host, Number(port));
	const { user } = await signInAnonymously(auth);
	return { uid: user.uid, db, auth, app };
}

/** Зробити щось від імені учасника. Транспорт кімнати бере підʼєднання раз, при створенні. */
export async function as<T>(who: Connection, run: () => Promise<T>): Promise<T> {
	current = who;
	try {
		return await run();
	} finally {
		current = null;
	}
}

/** Прочитати вузол від імені учасника — щоб побачити, що саме лишилося в базі. */
export async function peek(who: Connection, path: string): Promise<unknown> {
	const { get, ref } = await import('firebase/database');
	return (await get(ref(who.db, path))).val();
}

/** Закрити застосунки учасників: інакше підʼєднання тримають процес живим. */
export async function closeAll(people: readonly Connection[]): Promise<void> {
	const { deleteApp } = await import('firebase/app');
	for (const who of people) await deleteApp(who.app);
}
