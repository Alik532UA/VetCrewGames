import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';
import { forgetOwnRoom, pruneOwnRooms, rememberOwnRoom } from './ownRooms';
import type { Member, Move, RoomInfo, RoomSnapshot, RoomStatus, RoomTransport } from './roomTypes';

/**
 * Кімната в Realtime Database — та сама, що `LocalRoom`, тільки справжня.
 *
 * Форма даних:
 *
 * ```
 * rooms/{code}/info      { gameId, rulesVersion, seed, status, hostUid, config, createdAt, startedAt }
 * rooms/{code}/members/{uid}  { name, role, order }
 * rooms/{code}/moves/{seq}    { seq, by, type, at, payload }
 * ```
 * Індекс власних кімнат і прибирання за собою — окремо, у `net/ownRooms.ts`.
 *
 * **Склад НЕ прибирається при обриві звʼязку.** Присутність — окрема гілка й
 * окремий модуль (`net/presence.ts`), і саме вона гасне сама. Роздача залежить
 * від складу, тож прибрати учасника означало б перероздати дошку посеред партії.
 *
 * **`at` і `startedAt` ставить СЕРВЕР.** На цих двох позначках стоїть межа
 * очікування чужого ходу (`controllers/turnLimit.ts`), і правило бази не дає
 * записати час поза вікном навколо серверного. Інакше гравець оголошував би чужий
 * хід простроченим коли завгодно й забирав чергу.
 */

/**
 * КОД — ЦИФРАМИ, і це рішення автора з видимою ціною.
 *
 * Було `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` × 5 — тридцять три мільйони варіантів,
 * без 0/O і 1/I, бо їх диктують із помилками. Цифри знімають плутанину літер
 * повністю (диктувати «чотири два» неможливо неправильно) і дають цифрову
 * клавіатуру на телефоні замість повної.
 */
const DIGITS = '0123456789';

/**
 * Публічна кімната — ДВА розряди, і це не стеля, а початок.
 *
 * Дві цифри — сто варіантів. Мало, і навмисно: код публічної кімнати не є
 * секретом (вона й так у переліку), тож єдина його задача — легко диктуватися.
 * Коли сотні не хватає, розряд додається сам (див. `createRoom`).
 */
const PUBLIC_CODE_LENGTH = 2;

/** Доки ростити розряд публічного коду. Чотири цифри — десять тисяч кімнат. */
const PUBLIC_CODE_MAX = 4;

/**
 * Приватна кімната — пʼять цифр, і ослаблення тут НАЗВАНЕ.
 *
 * Код приватної кімнати і є її пароль: у переліку її немає, зайти можна лише
 * знаючи код. Пʼять цифр — сто тисяч варіантів проти тридцяти трьох мільйонів у
 * попередніх пʼяти символах алфавіту, тобто в 335 разів слабше, і перебрати
 * стотисячний простір скриптом реально.
 *
 * Автор обрав це свідомо, з міркуванням «кімната живе хвилини, а не дні»: щоб
 * перебір щось дав, він мусить влучити у ВІКНО життя конкретної кімнати. Плюс
 * порожня кімната зникає разом із вкладкою господаря (`onDisconnect`), а
 * розпочату партія не пускає третього гравцем — лише глядачем.
 *
 * Якщо колись знадобиться міцніше — рости має саме це число, і нічого більше:
 * решта коду довжини не знає.
 */
const PRIVATE_CODE_LENGTH = 5;

export const makeCode = (random: () => number, length: number): string =>
	Array.from({ length }, () => DIGITS[Math.floor(random() * DIGITS.length)]).join('');

/**
 * Скільком спробам дати кожен розряд, перш ніж додати наступний.
 *
 * Дванадцять, а не пʼять: на двох розрядах простір малий, і промах тут
 * нормальний, а не сигнал. При шістдесяти зайнятих зі ста ймовірність дванадцяти
 * промахів підряд — близько 0,2%, тобто розряд додається лише коли простір
 * справді майже вичерпано, а не через невдачу.
 */
const CODE_TRIES = 12;

export interface NewRoom {
	gameId: string;
	rulesVersion: number;
	seed: number;
	config: Record<string, number>;
	/** Імʼя господаря: він одразу й перший учасник. */
	name: string;
	/** Прапор господаря. Порожній рядок — без прапора. */
	country?: string;
	/**
	 * Чи починати партію самій, коли зібралися гравці.
	 *
	 * Задається ПРИ СТВОРЕННІ, бо різні дороги в кімнату хочуть різного:
	 * «швидка гра» зводить незнайомців і мусить починатися сама, а кімнату,
	 * створену руками, автор відкриває для когось конкретного й починає тоді,
	 * коли вирішить сам.
	 */
	autoStart?: boolean;
	/**
	 * Кімната поза переліком — і від цього залежить ДОВЖИНА коду.
	 *
	 * Не косметика: у публічної кімнати код не секрет (вона й так у списку), тож
	 * він короткий і легко диктується. У приватної код І Є пароль, тож він довший
	 * — див. `PRIVATE_CODE_LENGTH`, де названо й ослаблення цифрового простору.
	 *
	 * Сам факт публікації в `lobby` робить СТОРІНКА окремим викликом: сюда
	 * приходить лише намір, бо від нього залежить код.
	 */
	isPrivate?: boolean;
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

	// Спершу прибираємо СВОЄ покинуте: вивільнений код одразу вертається в обіг.
	await pruneOwnRooms();

	/*
	 * РОЗРЯД РОСТЕ САМ, коли простір вичерпано.
	 *
	 * Приватна кімната росту не потребує: сто тисяч варіантів не заповнить ніхто,
	 * тож у неї межі збігаються й зовнішній цикл робить один прохід.
	 *
	 * Публічна починає з двох цифр — сотні. Це усвідомлено мало: код тут не
	 * секрет, а зручність, і сотні кімнат одночасно в грі такого розміру не буває.
	 * Коли таки трапиться, розряд додається, і НІЩО про це не мовчить: у журнал
	 * ідеться запис (NO-SILENT-CAPS), бо це рідка подія, за якою видно, що гра
	 * виросла.
	 */
	const from = options.isPrivate ? PRIVATE_CODE_LENGTH : PUBLIC_CODE_LENGTH;
	const to = options.isPrivate ? PRIVATE_CODE_LENGTH : PUBLIC_CODE_MAX;

	for (let length = from; length <= to; length++) {
		if (length > from) {
			logService.info('network', `room codes grew to ${length} digits`);
		}
		for (let attempt = 0; attempt < CODE_TRIES; attempt++) {
			const code = makeCode(random, length);

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
				// `?? false` явно: відсутнє поле правило прийме, але тоді режим кімнати
				// читався б із відсутності, а не з рішення.
				autoStart: options.autoStart ?? false,
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
				order: 1,
				// Поле або є, або його немає зовсім: `undefined` у `set()` кидає, а
				// порожній рядок не пройшов би `.validate` (рівно дві літери).
				...(options.country ? { country: options.country } : {})
			});

			// Запис в індекс — ПІСЛЯ кімнати, і він не кидає: див. `ownRooms.ts`.
			await rememberOwnRoom(code);

			return code;
		}
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
export async function joinRoom(
	code: string,
	name: string,
	role?: Member['role'],
	country?: string
): Promise<void> {
	const { uid, db } = await connect();
	const { get, ref, set } = await import('firebase/database');

	const snapshot = await get(ref(db, `rooms/${code}/members`));
	const existing = (snapshot.val() ?? {}) as Record<string, Member>;
	// Свій порядок не переписуємо з тієї самої причини: черга рахується зі складу.
	const order = existing[uid]?.order ?? Object.keys(existing).length + 1;

	await set(ref(db, `rooms/${code}/members/${uid}`), {
		name,
		role: role ?? existing[uid]?.role ?? 'player',
		order,
		/*
		 * Своя країна ПЕРЕЗАПИСУЄТЬСЯ, а не лишається як була.
		 *
		 * Інакше, ніж `order` і `role`: ті визначають роздачу й черга, тож їх
		 * повторний вхід не торкається. Прапор — підпис, і людина могла
		 * змінити його у формі саме перед тим, як вернутися в кімнату.
		 */
		...(country ? { country } : {})
	});

	/*
	 * ПІСЛЯ входу, а не до нього.
	 *
	 * Запис в індекс означає «я в цій кімнаті», і поки вхід не вдався, це
	 * неправда: рядок «продовжити партію» вів би туди, куди мене не пустили.
	 * Порядок тут зворотний до `onDisconnect` у `lobby.ts` — і причина інша:
	 * там домовленість про ПРИБИРАННЯ, і вона мусить існувати раніше за запис.
	 *
	 * Сам виклик не кидає (див. `rememberOwnRoom`), тож невдача індексу не
	 * скасовує входу в кімнату.
	 */
	await rememberOwnRoom(code);
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
	await forgetOwnRoom(code);
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
				/*
				 * `countdownAt: null` тим самим записом — щоб не лишалося поля, яке вже
				 * ні про що. Стале число читалося б як «відлік іде» щоразу, коли хтось
				 * повернеться в кімнату після партії.
				 */
				await update(ref(db, `rooms/${code}/info`), {
					status,
					startedAt: serverTimestamp(),
					countdownAt: null
				});
				return;
			}
			await set(ref(db, `rooms/${code}/info/status`), status);
		},

		async setAutoStart(on: boolean) {
			/*
			 * ОДНИМ записом, і `countdownAt: null` тут обовʼязковий.
			 *
			 * Двома записами існувала б мить, коли режим уже «підтвердження», а
			 * позначка відліку ще лежить, — і таймер господаря встиг би почати
			 * партію, яку щойно скасували.
			 */
			await update(ref(db, `rooms/${code}/info`), { autoStart: on, countdownAt: null });
		},

		async setCountdown(active: boolean) {
			// `null` — це видалення поля; правило `.validate` на видалення не діє, тож
			// скасування дозволене тим самим правом, що й увімкнення.
			await set(ref(db, `rooms/${code}/info/countdownAt`), active ? serverTimestamp() : null);
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
