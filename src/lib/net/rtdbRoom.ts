import { connect } from './firebase';
import type { Member, Move, RoomInfo, RoomSnapshot, RoomStatus, RoomTransport } from './roomTypes';

/**
 * Кімната в Realtime Database — та сама, що `LocalRoom`, тільки справжня.
 *
 * Форма даних:
 *
 * ```
 * rooms/{code}/info      { gameId, rulesVersion, seed, status, hostUid, config }
 * rooms/{code}/members/{uid}  { name, role, order }
 * rooms/{code}/moves/{seq}    { seq, by, type, payload }
 * presence/{code}/{uid}       { at }      ← прибирається onDisconnect
 * ```
 *
 * **Склад НЕ прибирається при обриві звʼязку.** Присутність — окрема гілка, і
 * саме вона гасне сама. Роздача колоди залежить від складу гравців, тож
 * прибрати учасника означало б перероздати дошку посеред партії — тобто
 * покарати всіх за чужий тунель у метро.
 *
 * **Чому RTDB, а не Firestore.** Через `onDisconnect()`: вбудований механізм,
 * який сам гасить присутність, коли вкладку закрили. У грі на двох питання
 * «суперник вийшов чи просто думає» вирішує, чи партія зависне назавжди; у
 * Firestore такого немає, і офіційна порада — підключити поруч RTDB. Тобто
 * Firestore тут закінчився б ДВОМА базами.
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

/** Зайти в кімнату. Порядок входу рахується з наявного складу. */
export async function joinRoom(code: string, name: string, role: Member['role']): Promise<void> {
	const { uid, db } = await connect();
	const { get, ref, set } = await import('firebase/database');

	const snapshot = await get(ref(db, `rooms/${code}/members`));
	const existing = (snapshot.val() ?? {}) as Record<string, Member>;
	// Свій порядок не переписуємо: повернувшись після обриву, гравець мусить
	// лишитися на своєму місці в черзі, інакше дошку перероздасть.
	const order = existing[uid]?.order ?? Object.keys(existing).length + 1;

	await set(ref(db, `rooms/${code}/members/${uid}`), { name, role, order });
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
	const { off, onValue, ref, set } = await import('firebase/database');
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
				await set(ref(db, `rooms/${code}/moves/${String(move.seq).padStart(6, '0')}`), move);
				return true;
			} catch {
				// Номер уже зайнятий (правило «лише створити») — цей хід зникає.
				return false;
			}
		},

		async setStatus(status: RoomStatus) {
			await set(ref(db, `rooms/${code}/info/status`), status);
		}
	};
}

/**
 * Тримати присутність: поки вкладка жива — запис є, зникла — Firebase прибере
 * його сам. Це і є та причина, через яку тут RTDB, а не Firestore.
 */
export async function trackPresence(code: string): Promise<() => void> {
	const { uid, db } = await connect();
	const { onDisconnect, ref, remove, serverTimestamp, set } = await import('firebase/database');
	const mine = ref(db, `presence/${code}/${uid}`);

	await onDisconnect(mine).remove();
	await set(mine, { at: serverTimestamp() });

	return () => void remove(mine);
}

/** Хто зараз на звʼязку. Підписка, бо це найшвидша частина стану. */
export async function watchPresence(
	code: string,
	onChange: (online: string[]) => void
): Promise<() => void> {
	const { db } = await connect();
	const { off, onValue, ref } = await import('firebase/database');
	const branch = ref(db, `presence/${code}`);
	const handler = onValue(branch, (snapshot) => onChange(Object.keys(snapshot.val() ?? {})));
	return () => off(branch, 'value', handler);
}
