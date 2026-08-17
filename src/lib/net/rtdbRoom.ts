import { connect } from './firebase';
import type { Member, Move, RoomInfo, RoomSnapshot, RoomStatus, RoomTransport } from './roomTypes';

/**
 * Кімната в Realtime Database — та сама, що `LocalRoom`, тільки справжня.
 *
 * Форма даних:
 *
 * ```
 * rooms/{code}/info      { gameId, rulesVersion, seed, status, hostUid, config, startedAt }
 * rooms/{code}/members/{uid}  { name, role, order }
 * rooms/{code}/moves/{seq}    { seq, by, type, at, payload }
 * ```
 *
 * **Склад НЕ прибирається при обриві звʼязку.** Присутність — окрема гілка й
 * окремий модуль (`net/presence.ts`), і саме вона гасне сама. Роздача колоди
 * залежить від складу гравців, тож прибрати учасника означало б перероздати
 * дошку посеред партії — тобто покарати всіх за чужий тунель у метро.
 *
 * **`at` і `startedAt` ставить СЕРВЕР.** На цих двох позначках стоїть межа
 * очікування чужого ходу (`controllers/turnLimit.ts`), і правило бази не дає
 * записати час поза вікном навколо серверного. Інакше гравець оголошував би чужий
 * хід простроченим коли завгодно й забирав чергу.
 */

/** Літери коду: без 0/O і 1/I — їх диктують по телефону з помилками. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

export const makeCode = (random: () => number): string =>
	Array.from({ length: CODE_LENGTH }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join(
		''
	);

/** Скільком спробам дати код, перш ніж зізнатися, що не вийшло. */
const CODE_TRIES = 5;

export interface NewRoom {
	gameId: string;
	rulesVersion: number;
	seed: number;
	config: Record<string, number>;
	/** Імʼя господаря: він одразу й перший учасник. */
	name: string;
	random?: () => number;
}

/**
 * Створити кімнату. Повертає код, який кажуть уголос.
 *
 * **Спершу ЧИТАННЯ, і це не про race, а про правду в повідомленні.** Перша
 * версія одразу пробувала записати, а відмову трактувала як «код зайнятий» — і
 * поки правила бази не викладені, кожна спроба давала «спробуйте ще раз» на
 * проблему, яку жодне «ще раз» не виправить. Виміряно на живому екрані: пʼять
 * спроб і безглузда порада.
 *
 * Тепер відмова в ЧИТАННІ означає «правила не пускають» і так і називається, а
 * створення-лише-раз лишається там, де воно справді потрібне: як захист від
 * рідкісного збігу двох кодів.
 */
export async function createRoom(options: NewRoom): Promise<string> {
	const { uid, db } = await connect();
	const { get, ref, set, serverTimestamp } = await import('firebase/database');
	const random = options.random ?? Math.random;

	for (let attempt = 0; attempt < CODE_TRIES; attempt++) {
		const code = makeCode(random);

		let taken: boolean;
		try {
			taken = (await get(ref(db, `rooms/${code}/info`))).exists();
		} catch (error) {
			// Читати не дають — далі пробувати нема сенсу: те саме буде з будь-яким
			// кодом. Найчастіша причина — правила ще не викладені в консоль.
			throw new Error('rules-missing', { cause: error });
		}
		if (taken) continue;

		const info: RoomInfo & { createdAt: object } = {
			gameId: options.gameId,
			rulesVersion: options.rulesVersion,
			seed: options.seed,
			status: 'lobby',
			hostUid: uid,
			config: options.config,
			createdAt: serverTimestamp()
		};

		try {
			await set(ref(db, `rooms/${code}/info`), info);
		} catch {
			// Хтось зайняв цей код між читанням і записом. Саме від цього й стоїть
			// правило «лише створити» — беремо наступний.
			continue;
		}

		await set(ref(db, `rooms/${code}/members/${uid}`), {
			name: options.name,
			role: 'player',
			order: 1
		});
		return code;
	}

	throw new Error('room-code-taken');
}

/**
 * Зайти в кімнату — або повернутися в неї.
 *
 * `role` без значення означає «лишити як було»: після перезавантаження сторінка
 * заходить знову, і глядач, якого мовчки перевели в гравці, змінив би СКЛАД —
 * тобто перероздав би дошку всім. Роль міняється лише тоді, коли її справді
 * натиснули.
 */
export async function joinRoom(code: string, name: string, role?: Member['role']): Promise<void> {
	const { uid, db } = await connect();
	const { get, ref, set } = await import('firebase/database');

	const snapshot = await get(ref(db, `rooms/${code}/members`));
	const existing = (snapshot.val() ?? {}) as Record<string, Member>;
	// Свій порядок не переписуємо з тієї самої причини: черга рахується зі складу.
	const order = existing[uid]?.order ?? Object.keys(existing).length + 1;

	await set(ref(db, `rooms/${code}/members/${uid}`), {
		name,
		role: role ?? existing[uid]?.role ?? 'player',
		order
	});
}

/**
 * Знести кімнату. Дозволено лише господареві — правилом, а не домовленістю.
 *
 * Кличеться, коли господар іде зі скінченої партії: інакше кімнати
 * накопичувалися б назавжди. Покинута кімната важить близько кілобайта, тож це
 * не про місце — про те, щоб код можна було видати комусь іще.
 */
export async function closeRoom(code: string): Promise<void> {
	const { db } = await connect();
	const { ref, remove } = await import('firebase/database');
	await remove(ref(db, `rooms/${code}`));
}

/** Чи є така кімната і чи та сама в неї гра. */
export async function peekRoom(code: string): Promise<RoomInfo | null> {
	const { db } = await connect();
	const { get, ref } = await import('firebase/database');
	const snapshot = await get(ref(db, `rooms/${code}/info`));
	return snapshot.exists() ? (snapshot.val() as RoomInfo) : null;
}

/** Транспорт кімнати — рівно те, що описує `RoomTransport`. */
export async function roomTransport(code: string): Promise<RoomTransport> {
	const { db } = await connect();
	const { off, onValue, ref, serverTimestamp, set, update } = await import('firebase/database');
	const room = ref(db, `rooms/${code}`);

	return {
		watch(onSnapshot) {
			const handler = onValue(room, (snapshot) => {
				const value = snapshot.val() as {
					info?: RoomInfo;
					members?: Record<string, Omit<Member, 'uid'>>;
					moves?: Record<string, Move>;
				} | null;
				if (!value?.info) return;

				onSnapshot({
					info: value.info,
					members: Object.entries(value.members ?? {}).map(([uid, member]) => ({
						uid,
						...member
					})),
					// Порядок ЗАДАЄМО самі: покладатися на порядок ключів обʼєкта означало
					// б грати партію в різній послідовності на різних пристроях.
					moves: Object.values(value.moves ?? {}).sort((a, b) => a.seq - b.seq)
				} satisfies RoomSnapshot);
			});
			return () => off(room, 'value', handler);
		},

		async append(move: Move) {
			try {
				// Ключ із нулями попереду: RTDB упорядковує рядки лексикографічно, і при
				// однаковій довжині це те саме, що за числом. Без вирівнювання «10» став
				// би між «1» і «2».
				//
				// `at` ставить СЕРВЕР, і правило бази вимагає, щоб позначка лягла у вікно
				// навколо серверного часу. Тому межу очікування ходу неможливо обійти
				// підробленим числом: без цього гравець оголошував би чужий хід
				// простроченим коли завгодно.
				await set(ref(db, `rooms/${code}/moves/${String(move.seq).padStart(6, '0')}`), {
					...move,
					at: serverTimestamp()
				});
				return true;
			} catch (error) {
				/*
				 * `false` лише на ВІДМОВУ ПРАВИЛ — тобто «номер уже зайнятий». Решту
				 * кидаємо далі, і це виправлення справжнього дефекту: перша версія
				 * ковтала будь-яку помилку, і хід із порожнім полем (`set()` на
				 * `undefined` кидає) зникав безслідно. Дошка чекала на перегортання,
				 * якого не буде, і жодного слова ні в консолі, ні в логах.
				 */
				const denied = error instanceof Error && /permission_denied/i.test(error.message ?? '');
				if (!denied) throw error;
				return false;
			}
		},

		async setStatus(status: RoomStatus) {
			/*
			 * Початок партії — це ДВА поля й ОДИН запис.
			 *
			 * `startedAt` — те, від чого рахується очікування першого ходу. Двома
			 * записами існувала б мить, у яку партія вже `playing`, а межі очікування
			 * ще немає, — і суперник, який зник саме тоді, тримав би першу чергу
			 * назавжди.
			 */
			if (status === 'playing') {
				await update(ref(db, `rooms/${code}/info`), { status, startedAt: serverTimestamp() });
				return;
			}
			await set(ref(db, `rooms/${code}/info/status`), status);
		},

		async restart(seed: number) {
			/*
			 * `update` кількома шляхами — саме щоб проміжку не було.
			 *
			 * Стерти журнал і поставити нове зерно двома записами означало б мить, у
			 * яку колода вже нова, а ходи ще старі: усі програли б чужу партію на
			 * новій дошці. Правило дозволяє господареві і зміну `info`, і знесення
			 * всього журналу — окремі ходи в ньому лишаються незмінними назавжди.
			 */
			await update(ref(db, `rooms/${code}`), { 'info/seed': seed, moves: null });
		}
	};
}
