/**
 * Перевірка правил Realtime Database над емулятором.
 *
 * Запускати: `npm run check:rules` — скрипт піднімає емулятори сам
 * (`firebase emulators:exec`).
 *
 * ЧОМУ ЦЕ ОКРЕМИЙ СКРИПТ, А НЕ ТЕСТ. Правила — єдина частина цього проєкту,
 * стан якої не видно ні в `src/`, ні у `build/`: вони виконуються на боці
 * Firebase. Файл під vitest, який вимагає живого емулятора, у звичайному
 * `npm test` або падає, або тихо пропускається — тобто стає перевіркою, якої
 * не запускає ніхто (AI-AGENT-PITFALLS-v8 § 1.3).
 *
 * ЧОМУ REST, А НЕ firebase-admin. `firebase-admin` ходить в обхід правил, тобто
 * перевіряв би не те. Звичайний `fetch` із токеном звичайного користувача
 * проходить крізь правила так само, як клієнтський SDK.
 *
 * ЗВОРОТНИЙ ЕКСПЕРИМЕНТ УСЕРЕДИНІ. Половина очікувань — «застосунок мусить це
 * вміти», половина — «сторонній не мусить цього могти». Правила «дозволити
 * все» валять другу половину, «заборонити все» — першу. Зелений результат
 * неможливий випадково (CLOUD-DATABASE-v8 § 3.1).
 */

import { readFile } from 'node:fs/promises';

const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST ?? '127.0.0.1:9010';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9109';
const PROJECT = process.env.GCLOUD_PROJECT ?? 'demo-vet-crew-games';
const NS = `${PROJECT}-default-rtdb`;

/**
 * Анонімний користувач в емуляторі Auth. Ключ будь-який: емулятор його не
 * перевіряє, і саме тому тут не потрібні бойові ключі проєкту.
 * @param {string} label
 */
/**
 * Учасник гейту — ПРИВʼЯЗАНИЙ акаунт (пошта й пароль в емуляторі): профіль,
 * псевдонім, пошук, підписки й таблицю лідерів база тепер приймає лише від такого
 * (аудит 2026-09-25). Для кімнат різниці немає — там правила про вхід не питають.
 */
let accounts = 0;
async function signIn(label) {
	accounts += 1;
	return signUp(label, {
		email: `gate-${accounts}-${Date.now()}@example.test`,
		password: 'emulator-only'
	});
}

/** Анонімний вхід — рівно такий, яким у грі входить кожен гравець. */
async function signInAnonymously(label) {
	return signUp(label, {});
}

async function signUp(label, credentials) {
	const res = await fetch(
		`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...credentials, returnSecureToken: true })
		}
	);
	if (!res.ok) throw new Error(`емулятор Auth не дав токен для ${label}: ${res.status}`);
	const body = await res.json();
	return { uid: body.localId, token: body.idToken };
}

/**
 * @param {string} path шлях у базі, без `.json`
 * @param {unknown} value значення; `null` означає видалення
 * @param {string | null} token токен користувача або `null` для неавторизованого
 */
async function write(path, value, token) {
	const auth = token ? `&auth=${token}` : '';
	const res = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}${auth}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(value)
	});
	return res.status;
}

/**
 * Запис КІЛЬКОМА ШЛЯХАМИ одним запитом — те саме, що `update()` у SDK.
 *
 * Потрібен там, де код пише саме так: реванш міняє зерно, статус, позначку
 * початку й стирає журнал ОДНИМ записом (`rtdbRoom.restart`). Правила
 * перевіряються для кожного шляху окремо, а запис лягає цілком або ніяк —
 * тобто випадок, зібраний з окремих PUT, перевіряв би не той запис.
 *
 * @param {string} path
 * @param {Record<string, unknown>} value ключі — відносні шляхи
 * @param {string | null} token
 */
async function patch(path, value, token) {
	const auth = token ? `&auth=${token}` : '';
	const res = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}${auth}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(value)
	});
	return res.status;
}

/**
 * Читання ЗАПИТОМ: `orderBy` і `limitToLast` у REST — те саме, що
 * `orderByChild()`/`limitToLast()` у SDK. Потрібне там, де правило вимагає
 * обмеженого читання, а не читання гілки.
 *
 * @param {string} path
 * @param {string} params сира частина рядка запиту, напр. `orderBy="at"&limitToLast=20`
 * @param {string | null} token
 */
async function readQuery(path, params, token) {
	const auth = token ? `&auth=${token}` : '';
	return (await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}&${params}${auth}`)).status;
}

/**
 * @param {string} path
 * @param {string | null} token
 */
/**
 * ЗАПИС В ОБХІД ПРАВИЛ — лише щоб ПІДГОТУВАТИ стан, якого правила вже не дають
 * створити: залишки попередньої кімнати під кодом (склад чи журнал без `info`).
 * Такі залишки лишилися від старих редакцій правил, і захист від них мусить бути
 * перевірений, хоч сьогоднішніми правилами їх не зробити. Сам випадок після цього
 * — звичайний запис із токеном. Емулятор пускає власника з `Bearer owner`.
 */
async function seed(path, value) {
	const res = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}`, {
		method: value === null ? 'DELETE' : 'PUT',
		headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
		body: value === null ? undefined : JSON.stringify(value)
	});
	if (res.status !== 200) throw new Error(`seed ${path}: ${res.status}`);
}

/** Значення вузла (а не лише статус) — щоб узяти серверну мітку, яку поставила база. */
async function valueAt(path, token) {
	const auth = token ? `&auth=${token}` : '';
	return (await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}${auth}`)).json();
}

async function read(path, token) {
	const auth = token ? `&auth=${token}` : '';
	return (await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}${auth}`)).status;
}

/**
 * Штамп версії правил — читається З ФАЙЛУ, а не вписується сюди числом.
 *
 * Власна копія штампа в тесті означала б два джерела: після `npm run
 * rules:stamp` вони розійшлися б, і гейт червонів би на правильних правилах.
 */
const RULES_STAMP = /\$v === '([0-9a-f]+)'/.exec(
	await readFile('database.rules.json', 'utf8')
)?.[1];
if (!RULES_STAMP) throw new Error('у database.rules.json немає блока __rulesVersion');

const host = await signIn('господар');
const guest = await signIn('гість');
/** Увійшов, знає код, але в кімнату НЕ заходив. */
const stranger = await signIn('сторонній');
const anon = await signInAnonymously('анонім');

/** Кімната з правильною формою `info`. Одна на весь прогін. */
const CODE = '90417';
/**
 * Окрема ПУБЛІЧНА кімната в лобі — для переліку. Перелік тепер приймає лише таку
 * (аудит 2026-09-25), а головна кімната гейту на той момент уже в партії, і
 * господаря в її складі ще немає.
 */
const LIST = '90430';
/** Кімната в лобі для перехоплення ведення (гілка лобі правила `info/hostUid`). */
const LEAD = '90431';
/**
 * Кімната ВІКТОРИНИ (аудит 2026-09-26): доти в гейті не було жодної, тож виняток
 * вікторини в правилі ходів («посеред партії пише й пізній гравець») і гілка
 * складу в правилі перехоплення посеред партії не перевірялися нічим.
 */
const QUIZ = '90432';
/**
 * Кімната для МЕЖ ЗЕРНА Й РОЗКЛАДКИ (аудит 2026-09-26, шостий). Кожна відмова — на
 * створенні, тобто з рівно однієї причини: решта `info` правильна.
 */
const BOUNDS = '90433';
const info = (hostUid) => ({
	gameId: 'pairs',
	rulesVersion: 2,
	seed: 12345,
	status: 'lobby',
	hostUid,
	config: { pairs: 8, cols: 4 },
	// Без неї кімнату тепер не створити (аудит 2026-09-25); `SERVER_TIME` — нижче,
	// але шаблон кличеться вже після нього.
	createdAt: SERVER_TIME
});
const member = { name: 'Тест', role: 'player', order: 2 };

/**
 * `at` — серверна позначка часу, і саме такою її вимагає правило. REST розуміє
 * `{".sv": "timestamp"}` так само, як SDK розуміє `serverTimestamp()`, тож цей
 * прогін заразом доводить, що ходу з підробленим часом не існує.
 */
const SERVER_TIME = { '.sv': 'timestamp' };
const move = (by, seq) => ({ seq, by, type: 'flip', at: SERVER_TIME, payload: { index: 3 } });

/**
 * Запис у переліку публічних кімнат. Несекретні поля — і ТІЛЬКИ вони.
 *
 * `hostUid` тут не для показу, а для правила: саме за ним дається право прибрати
 * запис, і саме тому воно не залежить від того, чи кімната ще існує.
 */
const lobbyEntry = (hostUid) => ({
	hostUid,
	hostName: 'Головний Лікар',
	gameId: 'pairs',
	rulesVersion: 2,
	players: 1,
	at: SERVER_TIME
});

/**
 * Кожен рядок — що саме перевіряємо і чого чекаємо.
 * Порядок має значення: пізніші випадки спираються на стан, створений раніше.
 */
const CASES = [
	// --- застосунок мусить це вміти ---
	{
		name: 'господар створює кімнату, назвавши господарем СЕБЕ',
		allowed: true,
		run: () => write(`rooms/${CODE}/info`, info(host.uid), host.token)
	},
	{
		name: 'учасник читає кімнату за кодом',
		allowed: true,
		run: () => read(`rooms/${CODE}`, guest.token)
	},
	{
		name: 'гість записує СВІЙ рядок складу',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, member, guest.token)
	},
	{
		/*
		 * СТАРТ — СТАТУС І СКЛАД ОДНИМ ЗАПИСОМ, як у `rtdbRoom.setStatus`. Доти тут
		 * писався лише статус, і кімната гейту йшла в партію без складу — стан, якого
		 * клієнт не створює і в якому посеред «Знайди пару» хід тепер не лягає зовсім
		 * (аудит 2026-09-25). Господаря в складі кімнати ще немає — див. «господар у
		 * складі кімнати» нижче, — тож у складі старту лише гість.
		 */
		name: 'господар переводить кімнату в playing разом зі складом',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{ 'info/status': 'playing', 'info/roster': { [guest.uid]: { name: 'Тест', seat: 0 } } },
				host.token
			)
	},
	{
		// Вказівник на хід `lead` пише лише той, хто в НОВОМУ стані господар (аудит
		// 2026-09-26 — окремого випадку в цієї гілки не було).
		name: 'гість сам ставить вказівник на хід lead',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/leadSeq`, '000001', guest.token)
	},
	{
		name: 'господар ставить серверну позначку початку партії',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/startedAt`, SERVER_TIME, host.token)
	},
	{
		// Від `startedAt` рахується межа першого ходу: клієнтське число оголошувало б
		// першу чергу простроченою коли завгодно (аудит 2026-09-25 — випадку не було).
		name: 'позначка початку партії з клієнтським часом',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/startedAt`, 1000, host.token)
	},
	{
		name: 'господар перемикає режим початку партії',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/autoStart`, true, host.token)
	},
	{
		// Публічність живе в кімнаті: її читає й той, хто стане господарем після
		// перехоплення, і господар, що повернувся після перезавантаження.
		name: 'господар позначає кімнату публічною',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/listed`, true, host.token)
	},
	{
		name: 'господар вмикає відлік до автоматичного старту',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/countdownAt`, SERVER_TIME, host.token)
	},
	{
		// Скасування — видалення поля. `.validate` на видалення не діє, тож перевіряти
		// треба саме право: воно те саме, що на зміну `info`.
		name: 'господар скасовує відлік',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/countdownAt`, null, host.token)
	},
	{
		name: 'гість дописує СВІЙ хід у журнал',
		allowed: true,
		run: () => write(`rooms/${CODE}/moves/000001`, move(guest.uid, 1), guest.token)
	},
	/*
	 * ПАРТІЯ З ЖУРНАЛОМ НЕ МІНЯЄ РОЗДАЧІ Й ГРИ (аудит 2026-09-26): доти господар (чи
	 * той, хто підхопив ведення) міг переписати зерно, налаштування, гру чи версію
	 * правил посеред партії, і зіграні ходи лягали на іншу дошку. Реванш міняє зерно
	 * разом зі стертим журналом — див. «РЕВАНШ» нижче. Кожен випадок — рівно одна
	 * причина: писати `info` господареві можна, решта запису правильна.
	 */
	{
		name: 'посеред партії господар міняє зерно роздачі',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/seed`, 54321, host.token)
	},
	{
		name: 'посеред партії господар міняє налаштування',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/config`, { pairs: 6, cols: 4 }, host.token)
	},
	{
		name: 'господар міняє гру кімнати',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/gameId`, 'quiz', host.token)
	},
	{
		name: 'господар міняє версію правил кімнати',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/rulesVersion`, 99, host.token)
	},
	/*
	 * МЕЖА НОМЕРА ХОДУ — 9 999, а не мільйон (аудит 2026-09-26, `MOVE_SEQ_MAX`). Ключ і
	 * поле — окремими випадками: у кожному рівно одне з двох поза межею.
	 */
	{
		name: 'хід під ключем понад межу номерів',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/010000`, move(guest.uid, 5), guest.token)
	},
	{
		name: 'хід із полем номера понад межу',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000009`, move(guest.uid, 10_000), guest.token)
	},
	{
		// Поля ходу — лише ті, що пишуть ігри (аудит 2026-09-24): доти `$field` не
		// обмежував їх кількості, і хід міг важити мегабайти, які перечитує кожен.
		name: 'хід із полем, якого ігри не пишуть',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{ seq: 2, by: guest.uid, type: 'say', at: SERVER_TIME, payload: { word: 'кіт' } },
				guest.token
			)
	},
	{
		name: 'частка правильності понад одиницю',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{
					seq: 2,
					by: guest.uid,
					type: 'answer',
					at: SERVER_TIME,
					payload: { round: 0, correct: 2 }
				},
				guest.token
			)
	},
	/*
	 * МЕЖІ ПОЛІВ ХОДУ, крім `correct` (аудит 2026-09-25): доти випадком стояла лише
	 * частка правильності, а решта меж не перевірялася нічим. Кожен хід нижче вірний
	 * в усьому, крім одного поля.
	 */
	{
		name: 'хід, у якого payload — рядок, а не обʼєкт',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{ seq: 2, by: guest.uid, type: 'flip', at: SERVER_TIME, payload: 'x'.repeat(64) },
				guest.token
			)
	},
	{
		name: 'номер картки поза колодою',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{ seq: 2, by: guest.uid, type: 'flip', at: SERVER_TIME, payload: { index: 1000 } },
				guest.token
			)
	},
	{
		name: 'від’ємний номер раунду',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{
					seq: 2,
					by: guest.uid,
					type: 'answer',
					at: SERVER_TIME,
					payload: { round: -1, correct: 1 }
				},
				guest.token
			)
	},
	{
		name: 'пауза довша за добу',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{
					seq: 2,
					by: guest.uid,
					type: 'held',
					at: SERVER_TIME,
					payload: { round: 0, ms: 86400001 }
				},
				guest.token
			)
	},
	{
		name: 'uid у ході довший за 32 знаки',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{
					seq: 2,
					by: guest.uid,
					type: 'held',
					at: SERVER_TIME,
					payload: { round: 0, ms: 1, uid: 'x'.repeat(33) }
				},
				guest.token
			)
	},
	{
		/*
		 * ГОСПОДАР ПРИБИРАЄ ЗНИКЛОГО — і це єдине, що він може зробити з чужим
		 * рядком складу. Потрібно це тому, що `members` не гаснуть самі: той, хто
		 * закрив вкладку, лишається у складі назавжди.
		 */
		name: 'господар ПРИБИРАЄ чужий рядок складу',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, null, host.token)
	},
	{
		// А ПЕРЕПИСАТИ його не може: інакше господар міняв би чуже імʼя, прапор і
		// роль, тобто говорив би за іншого.
		name: 'господар ПЕРЕПИСУЄ чужий рядок складу',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, name: 'Не він' }, host.token)
	},
	{
		// Гість не господар: прибрати сусіда він не може.
		name: 'гість ПРИБИРАЄ чужий рядок складу',
		allowed: false,
		run: () => write(`rooms/${CODE}/members/${host.uid}`, null, guest.token)
	},
	{
		// Вертаємо гостя у склад: наступні випадки спираються на його присутність.
		name: 'гість вертається у склад після виключення',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, member, guest.token)
	},
	{
		/*
		 * СЕРЦЕБИТТЯ ПИШЕ УЧАСНИК, а не лише господар: гість лишається в кімнаті й
		 * тоді, коли господар пішов, і саме він тримає її живою.
		 */
		name: 'гість оновлює позначку життя кімнати',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/aliveAt`, SERVER_TIME, guest.token)
	},
	{
		// Клієнтське число означало б «моя кімната ніколи не застаріє».
		name: 'позначка життя з клієнтським часом',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/aliveAt`, 1000, host.token)
	},
	{
		// Не учасник не має права тримати кімнату живою — інакше будь-хто, знаючи
		// код, продовжував би чужу кімнату вічно.
		name: 'позначка життя від НЕАВТОРИЗОВАНОГО',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/aliveAt`, SERVER_TIME, null)
	},
	{
		// Вхід є, членства немає: відмова — саме через членство (аудит 2026-09-25).
		name: 'позначка життя від того, хто не в кімнаті',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/aliveAt`, SERVER_TIME, stranger.token)
	},
	{
		// `at` серверний, як і в `net/presence.ts`. Клієнтське число тут доти
		// проходило, бо форма присутності не перевірялася зовсім.
		name: 'учасник тримає СВОЮ присутність',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		// Повторний вхід пише той самий рядок складу з тим САМИМ порядком —
		// саме це й мусить лишитися дозволеним попри незмінність `order`.
		name: 'повторний вхід із тим самим порядком',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, member, guest.token)
	},
	{
		name: 'рядок складу з роллю, якої немає',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, role: 'admin' }, guest.token)
	},
	{
		name: 'господар веде індекс СВОїх кімнат',
		allowed: true,
		run: () => write(`myRooms/${host.uid}/${CODE}`, { at: SERVER_TIME }, host.token)
	},
	{
		name: 'господар читає свій індекс кімнат',
		allowed: true,
		run: () => read(`myRooms/${host.uid}`, host.token)
	},
	{
		// Ключ індексу — код кімнати тієї самої форми, що в `rooms` (аудит 2026-09-26):
		// збирач своїх кімнат читає кожен ключ окремим запитом.
		name: 'свій індекс під ключем, що не є кодом кімнати',
		allowed: false,
		run: () => write(`myRooms/${host.uid}/ZZZZZ`, { at: SERVER_TIME }, host.token)
	},
	{
		/*
		 * ГІСТЬ ПИШЕ У СВІЙ ІНДЕКС — і на цьому дозволі тримається «вернутися в
		 * партію».
		 *
		 * Доти в індекс писав лише господар (при створенні кімнати), тож цей шлях
		 * не перевірявся взагалі. Тепер його пише й той, хто ЗАЙШОВ: без цього
		 * запису розпочата партія не має дороги назад — код кімнати живе лише в
		 * адресі й губиться разом із вкладкою.
		 *
		 * Правило звужене тим самим `$uid === auth.uid`, тобто нових прав не
		 * додано: кожен веде СВІЙ список і не бачить чужого (випадки нижче).
		 */
		name: 'гість веде індекс СВОїх кімнат',
		allowed: true,
		run: () => write(`myRooms/${guest.uid}/${CODE}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'свій індекс кімнат із клієнтським часом',
		allowed: false,
		run: () => write(`myRooms/${guest.uid}/${CODE}`, { at: 1000 }, guest.token)
	},
	{
		name: 'гість читає свій індекс кімнат',
		allowed: true,
		run: () => read(`myRooms/${guest.uid}`, guest.token)
	},

	/*
	 * ── АКАУНТИ, ПРОФІЛІ Й ПІДПИСКИ ──────────────────────────────────────────
	 *
	 * Порядок тут має значення: псевдонім займається першим, бо решта випадків
	 * спирається на вже зайнятий.
	 */
	{
		// Одним записом із профілем — рівно як `saveProfile`: псевдонім, якого профіль
		// не називає, правило вважає покинутим і дозволяє забрати.
		name: 'господар займає ВІЛЬНИЙ псевдонім на себе',
		allowed: true,
		run: () =>
			patch(
				'',
				{
					'handles/leader': host.uid,
					[`users/${host.uid}/profile`]: { name: 'Господар', handle: 'leader', at: SERVER_TIME }
				},
				host.token
			)
	},
	{
		name: 'ключ псевдоніма не за форматом',
		allowed: false,
		run: () => write('handles/Bad-Key', guest.uid, guest.token)
	},
	{
		// Правило вимагає `newData.val() === auth.uid`: інакше можна було б зайняти
		// псевдонім і вказати в ньому чужого, тобто підмінити людину в пошуку.
		name: 'псевдонім на ЧУЖИЙ uid',
		allowed: false,
		run: () => write('handles/stolen', host.uid, guest.token)
	},
	{
		// Зайнятий не перезаписує НІХТО, включно з власником: зміна псевдоніма —
		// це звільнити старий і зайняти новий, а не перезапис.
		name: 'перезапис зайнятого псевдоніма',
		allowed: false,
		run: () => write('handles/leader', guest.uid, guest.token)
	},
	{
		name: 'читання одного псевдоніма',
		allowed: true,
		run: () => read('handles/leader', guest.token)
	},
	{
		/*
		 * ПЕРЕЛІК ПСЕВДОНІМІВ ЦІЛКОМ — заборонено, і це головний випадок цієї
		 * групи: без межі один запит віддав би всі псевдоніми разом із `uid`,
		 * тобто повний список користувачів гри.
		 */
		name: 'перелічити всі псевдоніми',
		allowed: false,
		run: () => read('handles', guest.token)
	},
	{
		/*
		 * РЕЄСТР УНІКАЛЬНОСТІ НЕ ПЕРЕЛІЧУЄТЬСЯ БІЛЬШЕ НІЯК — навіть обмеженим
		 * запитом. Доти пошук ішов саме тут, і разом із перемикачем «не показувати
		 * мене в пошуку» це стало суперечністю: реєстр зобов'язаний містити ВСІХ,
		 * тож людину, яка вимкнула пошук, усе одно можна було перебрати. Тепер
		 * пошук — окрема гілка `find`, у якій лежать лише згодні.
		 */
		name: 'перелічити реєстр псевдонімів обмеженим запитом',
		allowed: false,
		run: () => readQuery('handles', 'orderBy=%22%24key%22&limitToFirst=20', guest.token)
	},

	/*
	 * ПОШУКОВИЙ ІНДЕКС І ПРИВАТНІСТЬ. Три перемикачі, і кожен перевіряється тут
	 * саме тому, що тримає його правило, а не екран: клієнтський фільтр приховує
	 * лише від того, хто дивиться екраном.
	 *
	 * У пошук — лише СВІЙ псевдонім і лише той, що називає профіль (аудит
	 * 2026-09-24): доти можна було зайняти пошук під чужим псевдонімом або
	 * засипати його вигаданими записами з одного акаунта. Тому спершу — псевдонім
	 * і профіль, і на них же спирається таблиця лідерів нижче.
	 */
	{
		name: 'гість займає псевдонім разом із профілем',
		allowed: true,
		run: () =>
			patch(
				'',
				{
					'handles/guest_one': guest.uid,
					[`users/${guest.uid}/profile`]: { name: 'Гість', handle: 'guest_one', at: SERVER_TIME }
				},
				guest.token
			)
	},
	{
		// Реєстр прибирає лише той, чий псевдонім (аудит 2026-09-25 — випадку не було).
		name: 'чужий псевдонім знести',
		allowed: false,
		run: () => write('handles/guest_one', null, host.token)
	},
	{
		name: 'гість вписує себе в пошуковий індекс',
		allowed: true,
		run: () => write('find/guest_one', guest.uid, guest.token)
	},
	{
		name: 'вписати в пошук ЧУЖИЙ псевдонім',
		allowed: false,
		run: () => write('find/leader', guest.uid, guest.token)
	},
	{
		name: 'гість займає запасний псевдонім',
		allowed: true,
		run: () => write('handles/guest_spare', guest.uid, guest.token)
	},
	{
		// Свій, але не той, що в профілі: інакше один акаунт тримав би в пошуку
		// скільки завгодно записів.
		name: 'вписати в пошук свій псевдонім, якого профіль не називає',
		allowed: false,
		run: () => write('find/guest_spare', guest.uid, guest.token)
	},
	{
		name: 'ключ пошуку не за форматом',
		allowed: false,
		run: () => write('find/ab', guest.uid, guest.token)
	},
	{
		name: 'пошук людей обмеженим запитом',
		allowed: true,
		run: () => readQuery('find', 'orderBy=%22%24key%22&limitToFirst=20', guest.token)
	},
	{
		name: 'пошук без межі',
		allowed: false,
		run: () => readQuery('find', 'orderBy=%22%24key%22', guest.token)
	},
	{
		name: 'запис у пошуковий індекс на ЧУЖИЙ uid',
		allowed: false,
		run: () => write('find/stolen', host.uid, guest.token)
	},
	{
		name: 'гість пише свої перемикачі приватності',
		allowed: true,
		run: () =>
			write(`users/${guest.uid}/privacy`, { search: false, follow: true, board: true }, guest.token)
	},
	{
		name: 'чужі перемикачі приватності читає інший гравець',
		allowed: false,
		run: () => read(`users/${guest.uid}/privacy`, host.token)
	},
	{
		// Перемикачі вирішують, хто може підписатися й знайти людину: чужою рукою
		// їх не ввімкнути (аудит 2026-09-25 — випадку не було).
		name: 'чужі перемикачі приватності пише інший гравець',
		allowed: false,
		run: () =>
			write(`users/${guest.uid}/privacy`, { search: true, follow: true, board: true }, host.token)
	},
	{
		name: 'у приватності поле, якого схема не знає',
		allowed: false,
		run: () => write(`users/${guest.uid}/privacy/secret`, true, guest.token)
	},
	{
		// Прибрати себе з індексу можна ЗАВЖДИ: заборона вимкнути пошук через
		// вимкнений пошук була б замком без ключа.
		name: 'вийти з пошуку при вимкненому пошуку',
		allowed: true,
		run: () => write('find/guest_one', null, guest.token)
	},
	{
		/*
		 * ГОЛОВНИЙ ВИПАДОК приватності: перемикач вимкнено — і база НЕ ДАЄ
		 * повернутися в пошук. Саме цим він відрізняється від фільтра на екрані:
		 * ні стара збірка з кешу, ні чужий клієнт, ні консоль браузера не
		 * повернуть запис, поки перемикач `false`. Псевдонім той самий, що в
		 * профілі, — тобто відмова тут рівно через перемикач, а не через ключ.
		 */
		name: 'вписатися в пошук із вимкненим пошуком',
		allowed: false,
		run: () => write('find/guest_one', guest.uid, guest.token)
	},
	{
		name: 'гість вертає пошук і знову вписується',
		allowed: true,
		run: () =>
			write(
				`users/${guest.uid}/privacy`,
				{ search: true, follow: false, board: false },
				guest.token
			)
	},
	{
		name: 'підписатися на того, хто закрив підписки',
		allowed: false,
		run: () => write(`users/${guest.uid}/followers/${host.uid}`, { at: SERVER_TIME }, host.token)
	},
	{
		// Зняти підписку можна й при закритих підписках: інакше людина, яка щойно
		// їх закрила, замкнула б наявних підписників назавжди.
		name: 'зняти підписку при закритих підписках',
		allowed: true,
		run: () => write(`users/${guest.uid}/followers/${host.uid}`, null, host.token)
	},

	/*
	 * ТАБЛИЦЯ ЛІДЕРІВ. Поріг і згода — умови ЗАПИСУ, а не фільтр показу: у гілці
	 * немає нічого, чого не мусить бути видно.
	 */

	{
		// Рядок таблиці не більший за власний рахунок гри.
		name: 'гість має рахунок гри',
		allowed: true,
		run: () => write(`users/${guest.uid}/play`, { score: 500, at: SERVER_TIME }, guest.token)
	},
	{
		name: 'дані гравця — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`users/${guest.uid}/play`, 'x'.repeat(64), guest.token)
	},
	{
		name: 'ігри в даних гравця — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/games`, 'x'.repeat(64), guest.token)
	},
	{
		name: 'одна гра в даних гравця — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/games/memory`, 'x'.repeat(64), guest.token)
	},
	{
		name: 'рахунок гри з клієнтським часом',
		allowed: false,
		run: () => write(`users/${guest.uid}/play`, { score: 500, at: 1000 }, guest.token)
	},
	{
		name: 'рядок таблиці при вимкненому показі',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 120, at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'гість дозволяє показ у таблиці',
		allowed: true,
		run: () =>
			write(`users/${guest.uid}/privacy`, { search: true, follow: true, board: true }, guest.token)
	},
	{
		name: 'гість пише свій рядок таблиці',
		allowed: true,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 120, country: 'ua', at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'приватність — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`users/${guest.uid}/privacy`, 'x'.repeat(64), guest.token)
	},
	{
		name: 'рядок таблиці з клієнтським часом',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 120, at: 1000 },
				guest.token
			)
	},
	{
		name: 'рядок таблиці з ЧУЖИМ псевдонімом',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'leader', score: 120, at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'рядок таблиці з ЧУЖИМ іменем',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Лідер', handle: 'guest_one', score: 120, at: SERVER_TIME },
				guest.token
			)
	},
	{
		// Щоб відмова нижче була саме через поріг, а не через відсутній рахунок гри.
		name: 'господар має рахунок гри',
		allowed: true,
		run: () => write(`users/${host.uid}/play`, { score: 500, at: SERVER_TIME }, host.token)
	},
	{
		name: 'рядок таблиці з рахунком понад свій рахунок гри',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 5000, at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'рядок таблиці з рахунком нижче порога',
		allowed: false,
		run: () =>
			write(
				`leaders/${host.uid}`,
				{ name: 'Господар', handle: 'leader', score: 49, at: SERVER_TIME },
				host.token
			)
	},
	{
		name: 'ЧУЖИЙ рядок таблиці',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Не я', handle: 'faker', score: 999, at: SERVER_TIME },
				host.token
			)
	},
	{
		// Рівно той рядок, що гість пише собі сам, — чужою рукою: відмова лише через
		// `$uid === auth.uid`. Випадок вище відмовляв ще й через імʼя, псевдонім і
		// рахунок (аудит 2026-09-25).
		name: 'ЧУЖИЙ рядок таблиці з правдивими даними власника',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 120, country: 'ua', at: SERVER_TIME },
				host.token
			)
	},
	{
		name: 'ЧУЖИЙ рядок таблиці прибирають',
		allowed: false,
		run: () => write(`leaders/${guest.uid}`, null, host.token)
	},
	{
		name: 'у рядку таблиці поле, якого схема не знає',
		allowed: false,
		run: () =>
			write(
				`leaders/${guest.uid}`,
				{ name: 'Гість', handle: 'guest_one', score: 120, rank: 1, at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'читання таблиці обмеженим запитом за рахунком',
		allowed: true,
		run: () => readQuery('leaders', 'orderBy=%22score%22&limitToLast=50', host.token)
	},
	{
		name: 'читання таблиці без межі',
		allowed: false,
		run: () => readQuery('leaders', 'orderBy=%22score%22', host.token)
	},
	{
		name: 'читання таблиці цілком',
		allowed: false,
		run: () => read('leaders', host.token)
	},
	{
		name: 'читання ОДНОГО рядка таблиці (вкладка «друзі»)',
		allowed: true,
		run: () => read(`leaders/${guest.uid}`, host.token)
	},
	{
		// Прибрати себе можна завжди — навіть коли рахунок уже нижчий за поріг.
		name: 'прибрати свій рядок таблиці',
		allowed: true,
		run: () => write(`leaders/${guest.uid}`, null, guest.token)
	},
	{
		name: 'господар пише свій профіль',
		allowed: true,
		run: () =>
			write(
				`users/${host.uid}/profile`,
				{ name: 'Лідер', handle: 'leader', country: 'ua', at: SERVER_TIME },
				host.token
			)
	},
	{
		name: 'профіль із клієнтським часом',
		allowed: false,
		run: () =>
			write(
				`users/${host.uid}/profile`,
				{ name: 'Лідер', handle: 'leader', country: 'ua', at: 1000 },
				host.token
			)
	},
	{
		name: 'профіль читає інший гравець',
		allowed: true,
		run: () => read(`users/${host.uid}/profile`, guest.token)
	},
	{
		name: 'чужий профіль перезаписати',
		allowed: false,
		run: () =>
			write(
				`users/${host.uid}/profile`,
				{ name: 'Не я', handle: 'faker', at: SERVER_TIME },
				guest.token
			)
	},
	{
		// Псевдонім вузький навмисно: за ним шукають людей. Великі літери й інші
		// алфавіти дають пари, що виглядають однаково й не збігаються.
		name: 'псевдонім із великими літерами',
		allowed: false,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{ name: 'Гість', handle: 'Guest', at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'псевдонім коротший за три символи',
		allowed: false,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{ name: 'Гість', handle: 'ab', at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'гість реєструє псевдонім для профілю',
		allowed: true,
		run: () => write('handles/guest', guest.uid, guest.token)
	},
	{
		name: 'профіль із ЧУЖИМ псевдонімом',
		allowed: false,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{ name: 'Лідер', handle: 'leader', at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'аватар у профілі',
		allowed: true,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{ name: 'Гість', handle: 'guest', avatar: 'turtle:violet', at: SERVER_TIME },
				guest.token
			)
	},
	/*
	 * ПОКИНУТИЙ ПСЕВДОНІМ МОЖНА ЗАБРАТИ, ЖИВИЙ — НІ. Профіль гостя тепер називає
	 * `guest`, тож `guest_one` він більше не тримає. Доти займати можна було
	 * скільки завгодно ключів з одного акаунта й тримати їх назавжди (аудит
	 * 2026-09-24).
	 */
	{
		name: 'забрати ЖИВИЙ чужий псевдонім',
		allowed: false,
		run: () => write('handles/guest', host.uid, host.token)
	},
	{
		name: 'забрати ПОКИНУТИЙ чужий псевдонім',
		allowed: true,
		run: () => write('handles/guest_one', host.uid, host.token)
	},
	{
		name: 'аватар у профілі довший за 24 символи',
		allowed: false,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{
					name: 'Гість',
					handle: 'guest',
					avatar: `${'a'.repeat(16)}:${'b'.repeat(16)}`,
					at: SERVER_TIME
				},
				guest.token
			)
	},
	{
		// Аватар у ЧУЖОМУ профілі. Те саме, що з рядком складу: нове поле не
		// створює нового шляху до чужого вузла.
		name: 'аватар у чужому профілі',
		allowed: false,
		run: () =>
			write(
				`users/${host.uid}/profile`,
				{ name: 'Не я', handle: 'faker', avatar: 'bug:pink', at: SERVER_TIME },
				guest.token
			)
	},
	/*
	 * ЛИСТКИ ПРОФІЛЮ ПООДИНЦІ — саме так їх пише застосунок (`saveName`,
	 * `saveAvatar` у `net/account.ts`). Доти гейт писав профіль лише цілком, тож
	 * листкові шляхи жили без жодного випадку (аудит 2026-09-24).
	 */
	{
		name: 'гість міняє лише своє імʼя',
		allowed: true,
		run: () => write(`users/${guest.uid}/profile/name`, 'Гість', guest.token)
	},
	{
		name: 'гість міняє лише свій аватар',
		allowed: true,
		run: () => write(`users/${guest.uid}/profile/avatar`, 'turtle:violet', guest.token)
	},
	{
		name: 'чуже імʼя поодинці',
		allowed: false,
		run: () => write(`users/${host.uid}/profile/name`, 'Не я', guest.token)
	},
	{
		name: 'чужий аватар поодинці',
		allowed: false,
		run: () => write(`users/${host.uid}/profile/avatar`, 'bug:pink', guest.token)
	},
	{
		name: 'псевдонім у чужому профілі читає інший гравець',
		allowed: true,
		run: () => read(`users/${host.uid}/profile/handle`, guest.token)
	},
	{
		name: 'у профілі поле, якого схема не знає',
		allowed: false,
		run: () =>
			write(
				`users/${guest.uid}/profile`,
				{ name: 'Гість', handle: 'guest', role: 'admin', at: SERVER_TIME },
				guest.token
			)
	},
	{
		// Дзеркало пише САМ підписник: ключ — його `uid`, і правило це вимагає.
		name: 'гість додає себе в підписники господаря',
		allowed: true,
		run: () => write(`users/${host.uid}/followers/${guest.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'гість пише свою підписку',
		allowed: true,
		run: () => write(`users/${guest.uid}/following/${host.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'підписка з клієнтським часом',
		allowed: false,
		run: () => write(`users/${guest.uid}/following/${host.uid}`, { at: 1000 }, guest.token)
	},
	{
		name: 'підписник із клієнтським часом',
		allowed: false,
		run: () => write(`users/${host.uid}/followers/${guest.uid}`, { at: 1000 }, guest.token)
	},
	{
		/*
		 * ЧУЖУ ПІДПИСКУ НЕ СТВОРИТИ, і це не дрібниця: без цього правила будь-хто
		 * дописував би собі підписників, а взаємність — це і є друзі. Тобто
		 * «дружба» ставала б односторонньою заявою.
		 */
		name: 'записати чужу підписку за нього',
		allowed: false,
		run: () => write(`users/${host.uid}/following/${guest.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'записати себе чужим підписником від третьої особи',
		allowed: false,
		run: () => write(`users/${guest.uid}/followers/${host.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		// Соціальний граф — лише власникові (аудит 2026-09-24): доти його бачив
		// кожен із входом, хоч клієнт і не читає чужих.
		name: 'підписки читає інший гравець',
		allowed: false,
		run: () => read(`users/${guest.uid}/following`, host.token)
	},
	{
		name: 'підписників читає інший гравець',
		allowed: false,
		run: () => read(`users/${host.uid}/followers`, guest.token)
	},
	{
		name: 'свої підписки й підписників читає власник',
		allowed: true,
		run: async () => {
			const following = await read(`users/${guest.uid}/following`, guest.token);
			return following === 200 ? read(`users/${guest.uid}/followers`, guest.token) : following;
		}
	},
	{
		// «Прибери мене зі своїх підписок»: без цього дозволу відписати наполегливого
		// підписника було б нічим. Та сама пара прав, що в сусідньому `Slovko`.
		name: 'той, на кого підписані, знімає чужу підписку на себе',
		allowed: true,
		run: () => write(`users/${guest.uid}/following/${host.uid}`, null, host.token)
	},
	/*
	 * ДАНІ ГРИ: рахунок і рекорди. Половина випадків тут — про те, що вони
	 * ПРИВАТНІ, і це не формальність: рахунок — єдине, що людина набирала сама, і
	 * публічною його робить лише власне рішення (гілка `leaders`, коли буде).
	 */
	{
		name: 'власник пише свій рахунок і рекорд гри',
		allowed: true,
		run: () =>
			write(
				`users/${guest.uid}/play`,
				{ score: 42, games: { population: { best: 12, plays: 3 } }, at: SERVER_TIME },
				guest.token
			)
	},
	{
		name: 'власник читає свої дані гри',
		allowed: true,
		run: () => read(`users/${guest.uid}/play`, guest.token)
	},
	{
		// Ключ — ЛИШЕ ВІДОМА ГРА (шостий аудит): доти тут стояв взірець, і один акаунт
		// клав мільйони ключів. Нова гра тепер — рядок у правилах.
		name: 'рекорд гри, якої немає в правилах',
		allowed: false,
		run: () =>
			write(`users/${guest.uid}/play/games/new-game-2027`, { best: 1, plays: 1 }, guest.token)
	},
	{
		name: 'чужий рахунок читає інший гравець',
		allowed: false,
		run: () => read(`users/${guest.uid}/play`, host.token)
	},
	{
		name: 'чужий рахунок переписує інший гравець',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/score`, 999999, host.token)
	},
	{
		name: 'рахунок рядком, а не числом',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/score`, 'багато', guest.token)
	},
	{
		name: 'від’ємний рахунок',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/score`, -1, guest.token)
	},
	{
		name: 'у даних гри поле, якого схема не знає',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/cheat`, true, guest.token)
	},
	{
		name: 'у рекорді гри поле, якого схема не знає',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/games/population/rank`, 1, guest.token)
	},
	{
		// Ключ гри — малі латинські, цифри й дефіс. Інший ключ означав би вузол, якого
		// код не назве ніколи, тобто сміття, що не прибирається. Ключ — ДОПУСТИМИЙ для
		// самої бази (великі літери): доти тут стояло `Гра.1`, а крапку REST відкидає
		// сам, відповіддю 400, ще до правил — і взірець не перевірявся зовсім (аудит
		// 2026-09-25).
		name: 'ключ гри не з переліку',
		allowed: false,
		run: () => write(`users/${guest.uid}/play/games/Gra1`, { best: 1, plays: 1 }, guest.token)
	},
	{
		// Дані гравця синхронізує лише акаунт; анонім — власник без імені й без меж.
		name: 'анонім пише свої дані гри',
		allowed: false,
		run: () => write(`users/${anon.uid}/play`, { score: 1, at: SERVER_TIME }, anon.token)
	},
	{
		name: 'перелічити всіх користувачів',
		allowed: false,
		run: () => read('users', guest.token)
	},
	{
		name: 'довільна гілка під користувачем',
		allowed: false,
		run: () => write(`users/${guest.uid}/secrets`, { key: 'value' }, guest.token)
	},
	{
		/*
		 * Хід `end` («завершити партію») пише НЕ господар, і це навмисно: лишається
		 * на дошці частіше саме гість — пішов той, хто роздавав. Правило тут його
		 * від `flip` не відрізняє, і не мусить: законність рахують правила гри з
		 * журналу, однаково в усіх. База стежить лише за тим, щоб хід був підписаний
		 * своїм uid і мав серверний час.
		 */
		name: 'гість дописує хід «завершити партію»',
		allowed: true,
		run: () =>
			write(
				`rooms/${CODE}/moves/000013`,
				{ seq: 13, by: guest.uid, type: 'end', at: SERVER_TIME },
				guest.token
			)
	},
	{
		// Саме на цьому дозволі й тримається перевірка «чи викладені правила»:
		// відповідь «дозволено» на очікуваний штамп і є версією. Даних за шляхом
		// немає — правила оцінюються ДО існування вузла.
		name: 'зонд версії пускає ОЧІКУВАНИЙ штамп',
		allowed: true,
		run: () => read(`__rulesVersion/${RULES_STAMP}`, guest.token)
	},
	{
		// Перелік читається лише ОБМЕЖЕНИМ запитом — та сама межа, що в `MindStep`
		// стоїть як `request.query.limit <= 50`.
		name: 'перелік кімнат читається обмеженим запитом',
		allowed: true,
		run: () => readQuery('lobby/pairs', 'orderBy=%22at%22&limitToLast=21', guest.token)
	},
	{
		// Публічна кімната в лобі, де господар — учасник під тим самим імʼям, що в
		// записі переліку: рівно те, що робить `createRoom` із публічністю.
		name: 'господар створює публічну кімнату для переліку',
		allowed: true,
		run: async () => {
			const created = await write(
				`rooms/${LIST}/info`,
				{ ...info(host.uid), listed: true },
				host.token
			);
			return created === 200
				? write(
						`rooms/${LIST}/members/${host.uid}`,
						{ ...member, name: lobbyEntry(host.uid).hostName, order: 1 },
						host.token
					)
				: created;
		}
	},
	{
		/*
		 * ВИПАДОК, ЯКИЙ ЗЛОВИВ БИ СПРАВЖНІЙ ДЕФЕКТ, і його тут не було.
		 *
		 * `publishRoom` спершу реєструє `onDisconnect().remove()`, а вже потім пише
		 * запис. Firebase перевіряє права на `onDisconnect` САМЕ ПРИ РЕЄСТРАЦІЇ,
		 * тобто оцінює видалення вузла, якого ще НЕМА. REST такого API не має, але
		 * перевірка прав там ідентична — видалення відсутнього запису.
		 *
		 * Доти правило шукало власника лише в самому записі, тож у продакшні
		 * створення публічної кімнати падало з `PERMISSION_DENIED` (заміряно в
		 * консолі браузера на кімнаті 9HMVK), а гейт лишався зеленим: він перевіряв
		 * `set`, але не реєстрацію.
		 *
		 * СТОЇТЬ ПЕРЕД публікацією — у тому самому порядку, що й у застосунку.
		 */
		name: 'господар знімає ЩЕ НЕІСНУЮЧИЙ запис (як onDisconnect при реєстрації)',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}`, null, host.token)
	},
	{
		name: 'господар публікує СВОЮ кімнату в переліку',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}`, lobbyEntry(host.uid), host.token)
	},
	/*
	 * МІТКА СТВОРЕННЯ В ПЕРЕЛІКУ — рівно `createdAt` кімнати (аудит 2026-09-26): за
	 * нею «швидка гра» бере найстаршу, тож вигадана означала б «забирати всіх собі».
	 */
	{
		name: 'запис переліку з міткою створення кімнати',
		allowed: true,
		run: async () => {
			const since = await valueAt(`rooms/${LIST}/info/createdAt`, host.token);
			return write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), since }, host.token);
		}
	},
	{
		name: 'мітка створення в переліку — не та, що в кімнаті',
		allowed: false,
		run: async () => {
			const since = await valueAt(`rooms/${LIST}/info/createdAt`, host.token);
			return write(
				`lobby/pairs/${LIST}`,
				{ ...lobbyEntry(host.uid), since: since - 1 },
				host.token
			);
		}
	},
	/*
	 * ПЕРЕЛІК — ЛИШЕ ДЛЯ КІМНАТИ В ЛОБІ, ПУБЛІЧНОЇ, І ПІД ІМʼЯМ ІЗ СКЛАДУ (аудит
	 * 2026-09-25). Кожен випадок нижче міняє рівно одну умову, а решту лишає
	 * правильною, і повертає кімнату назад.
	 */
	{
		name: 'запис у переліку з ЧУЖИМ іменем господаря',
		allowed: false,
		run: () =>
			write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), hostName: 'Хтось Інший' }, host.token)
	},
	{
		name: 'запис у переліку для кімнати, що вже грає',
		allowed: false,
		run: async () => {
			await write(`rooms/${LIST}/info/status`, 'playing', host.token);
			const status = await write(`lobby/pairs/${LIST}`, lobbyEntry(host.uid), host.token);
			await write(`rooms/${LIST}/info/status`, 'lobby', host.token);
			return status;
		}
	},
	{
		name: 'запис у переліку для кімнати «лише друзі»',
		allowed: false,
		run: async () => {
			await write(`rooms/${LIST}/info/listed`, false, host.token);
			const status = await write(`lobby/pairs/${LIST}`, lobbyEntry(host.uid), host.token);
			await write(`rooms/${LIST}/info/listed`, true, host.token);
			return status;
		}
	},

	{
		/*
		 * ГІЛКА ГРИ АВТОРИТЕТНА, і це весь сенс розділення переліків.
		 *
		 * Без цієї умови кімнату «Знайди пару» можна було б оголосити в гілці
		 * вікторини — і вона стояла б там у списку, хоч зайти в неї дошкою
		 * вікторини нічим. Тобто розділення трималося б лише на тому, що клієнт
		 * пише правильний шлях.
		 */
		name: 'поле гри в записі переліку не збігається з гілкою',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), gameId: 'quiz' }, host.token)
	},
	{
		/*
		 * І ГРА ЗАПИСУ — ГРА КІМНАТИ (аудит 2026-09-26). Поле, що збігається з гілкою,
		 * нічого не каже про саму кімнату: кімнату «Знайди пару» оголошували в
		 * переліку вікторини з полем `quiz`, і «швидка гра» вела туди.
		 */
		name: 'кімнату «Знайди пару» не оголосити в переліку вікторини',
		allowed: false,
		run: () => write(`lobby/quiz/${LIST}`, { ...lobbyEntry(host.uid), gameId: 'quiz' }, host.token)
	},
	{
		// Кількість гравців веде господар: він єдиний, хто бачить склад і має
		// право писати сюди.
		name: 'господар оновлює кількість гравців у переліку',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}/players`, 2, host.token)
	},
	{
		name: 'кількість гравців у переліку понад стелю складу',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}/players`, 13, host.token)
	},
	{
		name: 'прапор господаря в переліку — не код країни',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}/hostCountry`, 'UKR', host.token)
	},
	{
		// Аватар господаря в переліку. Дозвіл доводить, що поле НАЗВАНЕ: без
		// рядка в правилах `$other: false` відкинув би публікацію кімнати цілком.
		name: 'аватар господаря в переліку кімнат',
		allowed: true,
		run: () =>
			write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), hostAvatar: 'star:teal' }, host.token)
	},
	{
		name: 'аватар господаря без двокрапки',
		allowed: false,
		run: () =>
			write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), hostAvatar: 'startea' }, host.token)
	},
	{
		// Аватарку господар міняє в лобі (рішення автора 2026-09-26), і запис переліку
		// наздоганяє ОДНИМ полем — тим самим шляхом, що лічильник гравців
		// (`net/lobby.updateHostAvatar`).
		name: 'господар міняє свою аватарку в записі переліку',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}/hostAvatar`, 'cat:red', host.token)
	},
	{
		// Типова плитка в перелік не пишеться — вибір її прибирає поле, а не пише порожнє.
		name: 'господар прибирає свою аватарку з запису переліку',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}/hostAvatar`, null, host.token)
	},
	{
		name: 'гість міняє аватарку господаря в чужому записі переліку',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}/hostAvatar`, 'cat:red', guest.token)
	},
	{
		/*
		 * НАБІР ІГОР У ЗАПИСІ ПЕРЕЛІКУ — те, на чому стоїть фільтр списку.
		 *
		 * Дозвіл тут доводить, що поле НАЗВАНЕ в правилах: без рядка `games`
		 * спрацював би `$other: false` і відкинув публікацію кімнати ЦІЛКОМ. Тобто
		 * забуте правило виглядало б не як «фільтр не працює», а як «кімнату не
		 * вдалося створити».
		 */
		name: 'набір ігор у записі переліку',
		allowed: true,
		run: () =>
			write(
				`lobby/pairs/${LIST}`,
				{ ...lobbyEntry(host.uid), games: { game_myths: 1, game_feeding: 0 } },
				host.token
			)
	},
	{
		// Набір ігор окремо — так його наздоганяє господар, змінивши набір у кімнаті
		// (`updateGames` у `net/lobby.ts`).
		name: 'господар оновлює набір ігор у переліку',
		allowed: true,
		run: () => write(`lobby/pairs/${LIST}/games`, { game_myths: 1 }, host.token)
	},
	{
		name: 'набір ігор у записі переліку — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}/games`, 'x'.repeat(64), host.token)
	},
	{
		name: 'гість міняє набір ігор у чужому записі переліку',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}/games`, { game_feeding: 1 }, guest.token)
	},
	{
		name: 'прапорець гри рядком',
		allowed: false,
		run: () =>
			write(
				`lobby/pairs/${LIST}`,
				{ ...lobbyEntry(host.uid), games: { game_myths: 'yes' } },
				host.token
			)
	},
	{
		// Ключ — лише з переліку ігор (аудит 2026-09-24): доти будь-які імена, тобто
		// запис переліку, який завантажує кожен відвідувач, міг важити мегабайти.
		name: 'ключ гри, якої немає',
		allowed: false,
		run: () =>
			write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), games: { game_hack: 1 } }, host.token)
	},

	// --- сторонній не мусить цього могти ---
	/*
	 * КІМНАТА-ТІНЬ І КОД НЕ ЗА ФОРМОЮ (аудит 2026-09-24). Доти склад і присутність
	 * лягали під будь-який код, навіть де кімнати немає, — і підкинутий «гравець»
	 * уже сидів у кожній новій кімнаті з цим кодом, потрапляв у заморожений склад і
	 * запускав автостарт.
	 */
	{
		name: 'рядок складу під кодом, де кімнати немає',
		allowed: false,
		run: () => write(`rooms/90418/members/${guest.uid}`, member, guest.token)
	},
	{
		name: 'присутність у кімнаті, де тебе немає в складі',
		allowed: false,
		run: () => write(`presence/${CODE}/${stranger.uid}`, { at: SERVER_TIME }, stranger.token)
	},
	{
		// Склад без `info`: господар зніс лише `info`, а рядок складу лишився.
		name: 'господар створює кімнату для випадку «склад без кімнати»',
		allowed: true,
		run: async () => {
			const created = await write('rooms/90419/info', info(host.uid), host.token);
			return created === 200
				? write(`rooms/90419/members/${host.uid}`, { ...member, order: 1 }, host.token)
				: created;
		}
	},
	{
		/*
		 * `info` ОКРЕМО ВІД КІМНАТИ НЕ СТИРАЄТЬСЯ (аудит 2026-09-25). Доти тут було
		 * «дозволено» — і саме так робилися «зомбі»-коди: склад чи журнал без `info`,
		 * яких не датує й не зносить ніхто, а нова кімната успадковує. Знести кімнату
		 * господар і далі може цілком — див. «господар зносить кімнату».
		 */
		name: 'господар зносить лише info, лишаючи склад',
		allowed: false,
		run: () => write('rooms/90419/info', null, host.token)
	},
	{
		// Інакше новий господар успадкував би чужий склад. Сам залишок — від старої
		// редакції правил, тож готується записом власника.
		name: 'нова кімната поверх чужого складу',
		allowed: false,
		run: async () => {
			await seed('rooms/90419/info', null);
			return write('rooms/90419/info', info(stranger.uid), stranger.token);
		}
	},
	{
		/*
		 * НОВА КІМНАТА ПОВЕРХ ЛИШЕНОГО ЖУРНАЛУ (аудит 2026-09-25): доти створення
		 * дивилося лише на склад, і чужий хід `lead` робив ведучим вікторини того,
		 * кого в кімнаті немає, — партія стояла на раунді -1 назавжди.
		 */
		name: 'нова кімната поверх лишеного журналу',
		allowed: false,
		run: async () => {
			await seed('rooms/90420/moves/000001', {
				seq: 1,
				by: host.uid,
				type: 'lead',
				at: 1,
				payload: { from: host.uid }
			});
			const status = await write('rooms/90420/info', info(stranger.uid), stranger.token);
			await seed('rooms/90420', null);
			return status;
		}
	},
	{
		// Без позначки створення кімнату не датує й не зносить ніхто (аудит 2026-09-25).
		name: 'нова кімната з клієнтським createdAt',
		allowed: false,
		run: () => write('rooms/90423/info', { ...info(stranger.uid), createdAt: 1000 }, stranger.token)
	},
	{
		name: 'нова кімната без createdAt',
		allowed: false,
		run: () =>
			write('rooms/90422/info', { ...info(stranger.uid), createdAt: undefined }, stranger.token)
	},
	{
		name: 'господар прибирає свій рядок із покинутого коду',
		allowed: true,
		run: () => write(`rooms/90419/members/${host.uid}`, null, host.token)
	},
	{
		name: 'кімната з кодом не за форматом',
		allowed: false,
		run: () => write('rooms/ABCDE/info', info(stranger.uid), stranger.token)
	},
	{
		name: 'ключ налаштувань, якого ігри не знають',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/config/evil`, 1, host.token)
	},
	{
		name: 'неавторизований читає кімнату',
		allowed: false,
		run: () => read(`rooms/${CODE}`, null)
	},
	{
		name: 'неавторизований пише в кімнату',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/seed`, 999, null)
	},
	{
		name: 'ПЕРЕЗАПИС уже зайнятого номера ходу',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000001`, move(guest.uid, 1), guest.token)
	},
	{
		// Господареві на журнал дано ЛИШЕ стерти його цілком (`moves/.write` з
		// `!newData.exists()`): переписати чужий хід своїм підписом він не може
		// (аудит 2026-09-25 — випадку не було).
		name: 'господар переписує ЧУЖИЙ хід своїм підписом',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000001`, move(host.uid, 1), host.token)
	},
	{
		name: 'хід, підписаний ЧУЖИМ uid',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000009`, move(host.uid, 9), guest.token)
	},
	{
		// На цьому тримається межа очікування: з підробленим часом гравець
		// оголошував би чужий хід простроченим коли завгодно й забирав чергу.
		name: 'хід із ПІДРОБЛЕНИМ часом (клієнт написав старе число)',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000010`,
				{ seq: 10, by: guest.uid, type: 'flip', at: 1000, payload: { index: 1 } },
				guest.token
			)
	},
	{
		name: 'хід зовсім без часу',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000011`,
				{ seq: 11, by: guest.uid, type: 'flip', payload: { index: 1 } },
				guest.token
			)
	},
	{
		name: 'запис у ЧУЖИЙ рядок складу',
		allowed: false,
		run: () => write(`rooms/${CODE}/members/${host.uid}`, member, guest.token)
	},
	{
		name: 'не-господар міняє info',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/seed`, 777, guest.token)
	},
	{
		// Режим кімнати — рішення господаря: інакше гість умикав би автостарт і
		// партія починалася б без жодного натиску з того боку, де є кнопка.
		name: 'гість перемикає режим початку партії',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/autoStart`, true, guest.token)
	},
	{
		name: 'режим початку партії НЕ булевий',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/autoStart`, 'yes', host.token)
	},
	{
		// Інакше гість виставляв би чужу приватну кімнату в перелік — і її
		// господар оголошував би її сам, не знаючи чому.
		name: 'гість позначає кімнату публічною',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/listed`, true, guest.token)
	},
	{
		name: 'публічність кімнати НЕ булева',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/listed`, 'yes', host.token)
	},
	{
		// Інакше гість запускав би партію, до якої господар не готовий, — і робив би
		// це з боку, де кнопки «Почати» немає.
		name: 'гість вмикає відлік',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/countdownAt`, SERVER_TIME, guest.token)
	},
	{
		// Підроблений час означав би «відлік уже скінчився» будь-коли.
		name: 'відлік із ПІДРОБЛЕНИМ часом',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/countdownAt`, 1000, host.token)
	},
	{
		name: 'створити кімнату, назвавши господарем ІНШОГО',
		allowed: false,
		run: () => write('rooms/BBBBB/info', info(host.uid), guest.token)
	},
	{
		// Код правильної форми й вільний: відмова — рівно через «господарем назвав не
		// себе». Випадок вище відмовляв ще й через форму коду (аудит 2026-09-25).
		name: 'створити кімнату з правильним кодом, назвавши господарем ІНШОГО',
		allowed: false,
		run: () => write('rooms/98765/info', info(host.uid), guest.token)
	},
	{
		name: 'status поза переліком',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/status`, 'winner', host.token)
	},
	{
		// Межу підняли з 24 до 48, і випадок мусив піти за нею: на 25 символах він
		// тепер стверджував би заборону, якої вже немає, — тобто зеленів би на
		// протилежному правилі.
		/*
		 * ПРАПОР — рівно дві літери, і саме тому обидва випадки тут.
		 *
		 * Дозвіл сам собою нічого не стверджує: поле пройшло б і без правила, бо
		 * `$other: false` відкидає лише НЕНАЗВАНІ поля. Значення має пара: код із
		 * двох символів приймається, з трьох — ні. Без другого випадку правило
		 * `length === 2` можна було б зняти, і гейт лишився б зеленим.
		 */
		name: 'прапор із двох літер',
		allowed: true,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, country: 'ua' }, guest.token)
	},
	{
		name: 'прапор із трьох літер',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, country: 'ukr' }, guest.token)
	},
	{
		/*
		 * АВАТАР — три випадки, і жоден не зайвий.
		 *
		 * Дозвіл сам собою нічого не стверджує (`$other: false` відкидає лише
		 * НЕНАЗВАНІ поля), зате він доводить головне: поле НАЗВАНЕ. Без рядка
		 * `avatar` у правилах цей запис упав би ЦІЛКОМ — не «аватар не
		 * зберігся», а «не вдалося зайти в кімнату».
		 *
		 * Значення мають два негативні: без «задовгого» межу `length <= 24`
		 * можна було б зняти, а без «без двокрапки» — взірець форми.
		 */
		name: 'аватар у складі кімнати',
		allowed: true,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, avatar: 'cat:blue' }, guest.token)
	},
	{
		name: 'аватар довший за 24 символи',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/members/${guest.uid}`,
				{ ...member, avatar: `${'a'.repeat(16)}:${'b'.repeat(16)}` },
				guest.token
			)
	},
	{
		name: 'аватар без двокрапки',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, avatar: 'catblue' }, guest.token)
	},
	{
		// Нове поле не відкриває нового шляху: рядок складу лишається чужим, і
		// аватар у ньому не робить його своїм.
		name: 'аватар у ЧУЖОМУ рядку складу',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${host.uid}`, { ...member, avatar: 'dog:red' }, guest.token)
	},
	{
		// МАЛИЙ ЕКРАН — поле названо (інакше `$other: false` відкинув би вхід цілком), і
		// воно лише булеве: будь-що інше — чужа рука або зламаний клієнт.
		name: 'позначка малого екрана в своєму рядку складу',
		allowed: true,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, compact: true }, guest.token)
	},
	{
		name: 'позначка малого екрана — не булеве',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, compact: 'yes' }, guest.token)
	},
	{
		name: 'імʼя довше за 48 символів',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, name: 'я'.repeat(49) }, guest.token)
	},
	{
		name: 'рядок складу без обовʼязкових полів',
		allowed: false,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, { name: 'Без ролі' }, guest.token)
	},
	{
		// Без межі один запит вивантажує гілку ЦІЛКОМ. Доти стеля жила лише в
		// клієнті, тобто була ввічливим проханням.
		name: 'перелік кімнат читають БЕЗ обмеження',
		allowed: false,
		run: () => read('lobby/pairs', guest.token)
	},
	{
		name: 'перелік кімнат читають із ЗАВЕЛИКОЮ межею',
		allowed: false,
		run: () => readQuery('lobby/pairs', 'orderBy=%22at%22&limitToLast=500', guest.token)
	},
	{
		// Межа названа разом із порядком за `at`: з іншим порядком індекс не діє. Запит
		// ЗАКОННИЙ для самої бази (порядок за ключем): доти тут стояв `limitToLast` без
		// `orderBy`, а його REST відкидає сам, відповіддю 400, — і умова правила на
		// порядок не перевірялася зовсім (аудит 2026-09-25).
		name: 'перелік кімнат читають з межею, але в іншому порядку',
		allowed: false,
		run: () => readQuery('lobby/pairs', 'orderBy=%22%24key%22&limitToLast=10', guest.token)
	},
	{
		// Головне обмеження цієї гілки: публічною кімнату робить ЇЇ господар, а не
		// хтось інший. Без цього будь-хто відкривав би чужий код усьому світові.
		name: 'ЧУЖУ кімнату оголошують публічною',
		allowed: false,
		// Гість — у складі кімнати під тим самим імʼям, що й запис: відмова рівно через
		// те, що кімната не його (доти ще й через імʼя, якого в складі не було).
		run: async () => {
			const seated = await write(
				`rooms/${LIST}/members/${guest.uid}`,
				{ ...member, name: lobbyEntry(guest.uid).hostName, order: 4 },
				guest.token
			);
			if (seated !== 200) return seated;
			const status = await write(`lobby/pairs/${LIST}`, lobbyEntry(guest.uid), guest.token);
			await write(`rooms/${LIST}/members/${guest.uid}`, null, guest.token);
			return status;
		}
	},
	{
		// Господар кімнати, але запис — на чужий `uid`: без цієї умови прибирати запис
		// міг би той, кого господар у ньому назвав.
		name: 'господар оголошує свою кімнату на чужий uid',
		allowed: false,
		run: () =>
			write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), hostUid: guest.uid }, host.token)
	},
	{
		// Запис, що не відповідає жодній кімнаті, — це привид у списку.
		name: 'публікація кімнати, якої НЕМАЄ',
		allowed: false,
		run: () => write('lobby/pairs/90418', lobbyEntry(guest.uid), guest.token)
	},
	{
		name: 'чужий запис у переліку прибирають',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}`, null, guest.token)
	},
	{
		// Перелікові зерно не потрібне, і правило відкидає поле, якого не знає. Захистом
		// роздачі це не є: кімнату за кодом із переліку читає кожен (аудит 2026-09-26).
		name: 'у перелік кладуть зерно роздачі',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), seed: 12345 }, host.token)
	},
	{
		name: 'запис у переліку з клієнтським часом',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}`, { ...lobbyEntry(host.uid), at: 1000 }, host.token)
	},
	{
		name: 'запис у переліку без обовʼязкових полів',
		allowed: false,
		run: () => write(`lobby/pairs/${LIST}`, { hostUid: host.uid }, host.token)
	},
	{
		// Кімната переліку більше не потрібна: знести цілком, разом із записом.
		name: 'господар зносить кімнату переліку й знімає запис',
		allowed: true,
		run: async () => {
			const unlisted = await write(`lobby/pairs/${LIST}`, null, host.token);
			return unlisted === 200 ? write(`rooms/${LIST}`, null, host.token) : unlisted;
		}
	},
	{
		// Якби пускало будь-який штамп, зонд завжди казав би «викладено» — тобто
		// перевірка була б гіршою за відсутню: вона брехала б у бік «усе гаразд».
		name: 'зонд версії НЕ пускає чужий штамп',
		allowed: false,
		run: () => read('__rulesVersion/deadbeefdead', guest.token)
	},
	{
		// Перелічити гілку не можна: інакше штамп можна було б ВИЧИТАТИ з бази, і
		// зонд перетворився б із перевірки на підказку.
		name: 'перелічити гілку зонда версії',
		allowed: false,
		run: () => read('__rulesVersion', guest.token)
	},
	{
		name: 'зонд версії для неавторизованого',
		allowed: false,
		run: () => read(`__rulesVersion/${RULES_STAMP}`, null)
	},
	{
		name: 'чужа присутність',
		allowed: false,
		run: () => write(`presence/${CODE}/${host.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		// Присутність без обовʼязкового поля. Доти форма цього вузла не
		// перевірялася зовсім: свій вузол можна було набити чим завгодно.
		name: 'присутність без обовʼязкових полів',
		allowed: false,
		// Відоме поле без обовʼязкового `at`: причина рівно одна (доти `online` ще й
		// відкидав `$other`).
		run: () => write(`presence/${CODE}/${guest.uid}`, { hover: 3 }, guest.token)
	},
	{
		name: 'присутність із ПІДРОБЛЕНИМ часом',
		allowed: false,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: 1 }, guest.token)
	},
	{
		/*
		 * ПІДСВІТКА ЧУЖОГО НАВЕДЕННЯ — нове поле присутності.
		 *
		 * Прохання автора: «наведення на картку — бачать усі в грі». Лежить воно тут,
		 * а не в журналі ходів, і саме тому потрібна правка правил: доти `$other`
		 * забороняв у цьому вузлі будь-яке поле, крім `at`, — тобто підсвітку відкидала
		 * б база, і виглядало б це як «нічого не відбувається».
		 */
		name: 'своя підсвітка наведення',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}/hover`, 7, guest.token)
	},
	{
		/*
		 * СВІЖИЙ `at` ОКРЕМИМ ПОЛЕМ (аудит 2026-09-25): присутність оновлює його за
		 * розкладом серцебиття, не чіпаючи підсвітки. Без цього випадку нова форма
		 * запису жила б лише в клієнті — а відмова бази тут означала б, що
		 * прибиральник знову стирає живу присутність того, хто довго сидить.
		 */
		name: 'присутність оновлює свій `at` окремим полем',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}/at`, SERVER_TIME, guest.token)
	},
	{
		name: 'чужий `at` у присутності',
		allowed: false,
		run: () => write(`presence/${CODE}/${guest.uid}/at`, SERVER_TIME, host.token)
	},
	{
		/*
		 * ПЕРЕЇЗД У ДРУГУ ГРУ: господар кладе в кімнату код НОВОЇ.
		 *
		 * Прохання автора: «господар створює кімнату іншої гри, а решті в старій
		 * кімнаті зʼявляється кнопка „перейти“ з її кодом». Поле нове, і без правила
		 * `$other: false` відкидав би запис цілком — тобто кнопка не зʼявлялася б
		 * ніколи, і виглядало б це як «нічого не сталося».
		 */
		name: 'господар оголошує переїзд',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'ab', host.token)
	},
	{
		// Право те саме, що на решту `info`: гість переїзду не оголошує, інакше він
		// відводив би групу в кімнату, якої господар не створював.
		name: 'гість оголошує переїзд',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'ab', guest.token)
	},
	{
		// Коди тут дві-пʼять літер. Без верхньої межі поле стало б місцем для тексту.
		name: 'переїзд із задовгим кодом',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'abcdefghij', host.token)
	},
	{
		// Індекс картки — число в межах колоди. Без верхньої межі сюда пішло б
		// будь-яке, зокрема таке, що на екрані не означає нічого.
		name: 'підсвітка з індексом поза колодою',
		allowed: false,
		run: () => write(`presence/${CODE}/${guest.uid}/hover`, 1000, guest.token)
	},
	{
		name: 'підсвітка НЕ числом',
		allowed: false,
		run: () => write(`presence/${CODE}/${guest.uid}/hover`, 'усюди', guest.token)
	},
	{
		// Підсвітка чужа так само, як і сама присутність: інакше один гравець
		// малював би підказки на дошці замість другого.
		name: 'чужа підсвітка',
		allowed: false,
		run: () => write(`presence/${CODE}/${host.uid}/hover`, 3, guest.token)
	},
	{
		/*
		 * ЗМІНА СВОГО ПОРЯДКУ ПІСЛЯ ВХОДУ — і це найтихіший із закритих дефектів.
		 *
		 * Із неї учасник, уже впущений у кімнату, забирав першу чергу в господаря:
		 * `order` перевірявся лише на `isNumber`, а черга ходів рахується саме з
		 * нього. Не дірка в даних, а зміна правил гри посеред партії.
		 */
		name: 'ЗМІНА свого порядку входу після входу',
		allowed: false,
		run: () => write(`rooms/${CODE}/members/${guest.uid}`, { ...member, order: 1 }, guest.token)
	},
	{
		name: 'порядок входу поза діапазоном (нуль)',
		allowed: false,
		run: () => write(`rooms/${CODE}/members/${host.uid}`, { ...member, order: 0 }, host.token)
	},
	{
		// Невідоме поле — те, що ловить `$other: false`. Без нього `.validate`
		// перевіряє лише НАЗВАНІ поля, і розсинхрон імені між кодом і правилом
		// лишається тихим (CLOUD-DATABASE-v8 § 4.6).
		name: 'невідоме поле в рядку складу',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, isAdmin: true }, guest.token)
	},
	{
		name: 'невідоме поле в ході',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/moves/000012`, { ...move(guest.uid, 12), score: 999 }, guest.token)
	},
	{
		name: 'невідоме поле в info',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/isRanked`, true, host.token)
	},
	{
		name: 'невідома гілка всередині кімнати',
		allowed: false,
		run: () => write(`rooms/${CODE}/chat/msg1`, { text: 'привіт' }, host.token)
	},

	{
		name: 'ЧУЖИЙ індекс кімнат — читання',
		allowed: false,
		run: () => read(`myRooms/${host.uid}`, guest.token)
	},
	{
		// Ключ правильної форми: доти тут стояв `ZZZZZ`, і запис відкидав ще й формат ключа.
		name: 'ЧУЖИЙ індекс кімнат — запис',
		allowed: false,
		run: () => write(`myRooms/${host.uid}/${CODE}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'перелічити ВСІ індекси кімнат',
		allowed: false,
		run: () => read('myRooms', host.token)
	},
	{
		name: 'перелічити ВСІ кімнати одним читанням',
		allowed: false,
		run: () => read('rooms', guest.token)
	},
	{
		name: 'довільна нова гілка в чужій базі',
		allowed: false,
		run: () => write('hackers/pwn', { any: 1 }, guest.token)
	},
	{
		name: 'читання кореня бази',
		allowed: false,
		run: () => read('', guest.token)
	},
	/*
	 * РЕВАНШ — рівно тим записом, яким його робить `rtdbRoom.restart`: нове зерно,
	 * `playing`, НОВИЙ `startedAt` серверним часом, без відліку й без журналу.
	 * `startedAt` тут з 2026-09-23: без нього перший хід реваншу був простроченим
	 * уже на старті, бо межа очікування рахувалася від першої партії.
	 */
	{
		// Лише стерти журнал, без решти реваншу: відмова — рівно право господаря на
		// `moves`. Випадок нижче відмовляв ще й через `info/*` (аудит 2026-09-25).
		name: 'гість стирає журнал',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves`, null, guest.token)
	},
	{
		name: 'гість сам починає реванш',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/seed': 777,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					moves: null
				},
				guest.token
			)
	},
	{
		name: 'господар починає реванш одним записом',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/seed': 777,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					moves: null
				},
				host.token
			)
	},
	/*
	 * ХІД — ЛИШЕ ВІД УЧАСНИКА, КЛЮЧ — РІВНО ШІСТЬ ЦИФР, І ПЕРЕДАЧА ВЕДЕННЯ.
	 *
	 * Аудит 2026-09-23: хід міг дописати будь-хто з входом, хто знає код; ключ і
	 * `seq` не мали межі (`seq: 1e20` блокував вікторину); а коли господар закривав
	 * вкладку, вікторина стояла назавжди. Тепер ведення можна ПІДХОПИТИ — але лише
	 * коли господаря немає в присутності й лише разом із ходом `lead`.
	 *
	 * Журнал після реваншу порожній, тож номери тут починаються з одиниці.
	 */
	{
		// Той самий рядок складу, що пише `createRoom`: без нього господар — не учасник,
		// і ні хід, ні повернення ведення йому законно не світять.
		name: 'господар у складі кімнати',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${host.uid}`, { ...member, order: 1 }, host.token)
	},
	/*
	 * СКЛАД ПАРТІЇ — заморожений на старті (`RoomInfo.roster`, аудит 2026-09-23):
	 * лише гравці кімнати, лише з їхніми іменами й лише при порожньому журналі.
	 * Журнал тут порожній — реванш вище його стер.
	 */
	{
		name: 'склад із ЧУЖИМ іменем',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/info/roster`, { [guest.uid]: { name: 'Лідер', seat: 0 } }, host.token)
	},
	{
		name: 'у складі — не учасник кімнати',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/info/roster`, { [stranger.uid]: { name: 'Тест', seat: 0 } }, host.token)
	},
	{
		// Сторонній заходить глядачем — і рівно на один випадок нижче.
		name: 'сторонній заходить глядачем',
		allowed: true,
		run: () =>
			write(
				`rooms/${CODE}/members/${stranger.uid}`,
				{ ...member, role: 'spectator', order: 3 },
				stranger.token
			)
	},
	{
		name: 'у складі — глядач',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/info/roster`, { [stranger.uid]: { name: 'Тест', seat: 0 } }, host.token)
	},
	{
		// Випадки нижче чекають на стороннього, який НЕ учасник.
		name: 'глядач іде з кімнати сам',
		allowed: true,
		run: () => write(`rooms/${CODE}/members/${stranger.uid}`, null, stranger.token)
	},
	{
		name: 'склад із зайвим полем',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/info/roster`,
				{ [guest.uid]: { name: 'Тест', seat: 0, score: 1 } },
				host.token
			)
	},
	/*
	 * ЖУРНАЛ ЛОБІ Й СТАРТ (аудит 2026-09-26, A2). Поза партією журнал приймає лише
	 * `lead`, а старт стирає журнал лобі тим самим записом — правило `status` пускає в
	 * партію лише з порожнім журналом. Старт, що лишає журнал, і дубль старту —
	 * у кімнаті перехоплення нижче (`LEAD`): там у журналі лобі лежить законний `lead`.
	 */
	{
		name: 'господар повертає кімнату в лобі',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/status`, 'lobby', host.token)
	},
	{
		name: 'у лобі звичайний хід не лягає',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000900`, move(guest.uid, 900), guest.token)
	},
	{
		name: 'склад без переходу в playing',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/info/roster`, { [guest.uid]: { name: 'Тест', seat: 0 } }, host.token)
	},
	{
		// Рівно тим записом, яким його робить `rtdbRoom.setStatus('playing', склад)`:
		// на рівні кімнати, зі стертим журналом лобі й вказівником на нього (A2).
		name: 'господар починає партію, заморожує склад і стирає журнал лобі одним записом',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/leadSeq': null,
					'info/roster': {
						[host.uid]: { name: 'Тест', seat: 0 },
						[guest.uid]: { name: 'Тест', seat: 1 }
					},
					moves: null
				},
				host.token
			)
	},
	{
		// Номер 900 — щоб не зайняти тих, на яких випадки нижче перевіряють інше; на
		// ньому ж стоїть «ведення з вказівником на наявний хід».
		name: 'гравець складу дописує хід посеред партії',
		allowed: true,
		run: () => write(`rooms/${CODE}/moves/000900`, move(guest.uid, 900), guest.token)
	},
	{
		name: 'гість на звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'господар на звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${host.uid}`, { at: SERVER_TIME }, host.token)
	},
	{
		name: 'сторонній (не учасник) дописує хід',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000001`, move(stranger.uid, 1), stranger.token)
	},
	{
		name: 'хід під ключем не з шести цифр',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/12`, move(guest.uid, 12), guest.token)
	},
	{
		name: 'хід із номером понад шість цифр',
		allowed: false,
		run: () => write(`rooms/${CODE}/moves/000002`, move(guest.uid, 1e20), guest.token)
	},
	{
		name: 'хід lead без передачі ведення',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000003`,
				{ seq: 3, by: guest.uid, type: 'lead', at: SERVER_TIME, payload: { from: host.uid } },
				guest.token
			)
	},
	{
		name: 'гість забирає ведення, поки господар на звʼязку',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': guest.uid,
					'info/leadSeq': '000004',
					'moves/000004': {
						seq: 4,
						by: guest.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				guest.token
			)
	},
	{
		name: 'господар іде зі звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${host.uid}`, null, host.token)
	},
	/*
	 * ВЕДЕННЯ — ЛИШЕ З ХОДОМ `lead` І ЛИШЕ ГРАВЦЕМ СКЛАДУ (аудит 2026-09-24).
	 * Господаря зараз немає на звʼязку, тож відмова нижче — рівно через свою умову.
	 */
	{
		name: 'ведення без ходу lead',
		allowed: false,
		run: () => patch(`rooms/${CODE}`, { 'info/hostUid': guest.uid }, guest.token)
	},
	{
		// Вказівник на хід, що вже лежить, — не передача, а підробка її сліду.
		name: 'ведення з вказівником на наявний хід',
		allowed: false,
		run: () =>
			patch(`rooms/${CODE}`, { 'info/hostUid': guest.uid, 'info/leadSeq': '000900' }, guest.token)
	},
	{
		// Новий хід, але не `lead`: без перевірки типу ведення забирав би будь-який хід.
		name: 'ведення з новим ходом, що не lead',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': guest.uid,
					'info/leadSeq': '000010',
					'moves/000010': {
						seq: 10,
						by: guest.uid,
						type: 'flip',
						at: SERVER_TIME,
						payload: { index: 1 }
					}
				},
				guest.token
			)
	},
	{
		name: 'сторонній заходить гравцем посеред партії',
		allowed: true,
		run: async () => {
			const joined = await write(
				`rooms/${CODE}/members/${stranger.uid}`,
				{ ...member, order: 5 },
				stranger.token
			);
			return joined === 200
				? write(`presence/${CODE}/${stranger.uid}`, { at: SERVER_TIME }, stranger.token)
				: joined;
		}
	},
	{
		// `net/leave.ts` читає свій рядок складу, щоб знати, чи потрібен хід `leave`:
		// черги є лише в тих, хто в складі.
		name: 'учасник читає свій рядок складу',
		allowed: true,
		run: () => read(`rooms/${CODE}/info/roster/${guest.uid}`, guest.token)
	},
	{
		/*
		 * ПОСЕРЕД ПАРТІЇ «ЗНАЙДИ ПАРУ» ХІД — ЛИШЕ ЗІ СКЛАДУ (аудит 2026-09-25). Роль
		 * `player` він написав собі сам, членство є, номер вільний, поля правильні —
		 * відмова рівно через склад.
		 */
		name: 'посеред партії «Знайди пару» хід пише той, кого немає в складі',
		allowed: false,
		run: () =>
			write(
				`rooms/${CODE}/moves/000090`,
				{ seq: 90, by: stranger.uid, type: 'flip', at: SERVER_TIME, payload: { index: 0 } },
				stranger.token
			)
	},
	{
		// Роль `player` він написав собі сам — але в заморожений склад не потрапив.
		name: 'посеред партії ведення бере той, кого немає в складі',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': stranger.uid,
					'info/leadSeq': '000009',
					'moves/000009': {
						seq: 9,
						by: stranger.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				stranger.token
			)
	},
	{
		// Випадки нижче чекають на стороннього, який НЕ учасник.
		name: 'сторонній іде з кімнати',
		allowed: true,
		run: async () => {
			const gone = await write(`presence/${CODE}/${stranger.uid}`, null, stranger.token);
			return gone === 200
				? write(`rooms/${CODE}/members/${stranger.uid}`, null, stranger.token)
				: gone;
		}
	},
	{
		name: 'гість підхоплює ведення, коли господаря немає',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': guest.uid,
					'info/leadSeq': '000005',
					'moves/000005': {
						seq: 5,
						by: guest.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				guest.token
			)
	},
	/*
	 * ПЕРЕЇЗД ПІСЛЯ ПЕРЕХОПЛЕННЯ (аудит 2026-09-25): господар, що пішов створювати
	 * кімнату іншої гри, ведення вже втратив — а сказати групі «перейти» мусить
	 * саме він. Право — лише в того, чий uid стоїть у `from` ходу під `leadSeq`.
	 */
	{
		name: 'колишній господар оголошує переїзд, коли ведення вже перехопили',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'cd', host.token)
	},
	{
		name: 'сторонній, у кого ведення не забирали, переїзду не оголошує',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'cd', stranger.token)
	},
	{
		name: 'колишній господар оголошує переїзд із задовгим кодом',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/nextCode`, 'abcdefghij', host.token)
	},
	{
		// СКЛАДЕНИЙ випадок: колишній господар і поза складом, і без звʼязку, а новий —
		// на звʼязку. Кожна з трьох причин окремо — у кімнатах LEAD і QUIZ нижче.
		name: 'колишній господар поза складом і без звʼязку ведення назад не забирає',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': host.uid,
					'info/leadSeq': '000006',
					'moves/000006': {
						seq: 6,
						by: host.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: guest.uid }
					}
				},
				host.token
			)
	},
	{
		name: 'гість іде зі звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}`, null, guest.token)
	},
	{
		name: 'господар повертається на звʼязок',
		allowed: true,
		run: () => write(`presence/${CODE}/${host.uid}`, { at: SERVER_TIME }, host.token)
	},
	{
		name: 'lead із неправдивим from',
		allowed: false,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': host.uid,
					'info/leadSeq': '000007',
					'moves/000007': {
						seq: 7,
						by: host.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: stranger.uid }
					}
				},
				host.token
			)
	},
	{
		// Хід `lead` під 000005 лежить давно: указати на нього — не передача, а підробка
		// її сліду. Відмова тут саме через те, що хід не новий.
		name: 'ведення з вказівником на ЧУЖИЙ старий хід lead',
		allowed: false,
		run: () =>
			patch(`rooms/${CODE}`, { 'info/hostUid': host.uid, 'info/leadSeq': '000005' }, host.token)
	},
	{
		// Повертає господаря на місце: випадки нижче зносять кімнату від його імені.
		name: 'господар підхоплює ведення назад, коли гостя немає',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/hostUid': host.uid,
					'info/leadSeq': '000008',
					'moves/000008': {
						seq: 8,
						by: host.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: guest.uid }
					}
				},
				host.token
			)
	},
	/*
	 * СВІЙ СТАРИЙ lead (шостий аудит): гравець складу на звʼязку, господаря немає, хід
	 * під вказівником — справжній `lead` самого гравця, лише не новий. Без умови «хід
	 * новий» гравець повертав би собі ведення старим слідом, а перепрогін вікторини
	 * лишав би ведучим іншого — партія стояла б.
	 */
	{
		// Господар (ведення щойно повернуто йому) передає його вказівником на СТАРИЙ хід
		// гостя: тип і автор правильні, відмова — лише через те, що хід не новий (R7 у
		// `.validate` діє й на господаря, чий `.write` — право батька).
		name: 'господар передає ведення вказівником на старий lead гостя',
		allowed: false,
		run: () =>
			patch(`rooms/${CODE}`, { 'info/hostUid': guest.uid, 'info/leadSeq': '000005' }, host.token)
	},
	{
		name: 'господар знову йде зі звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${host.uid}`, null, host.token)
	},
	{
		name: 'гість повертається на звʼязок',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: SERVER_TIME }, guest.token)
	},
	{
		name: 'гравець складу повертає собі ведення вказівником на свій старий lead',
		allowed: false,
		run: () =>
			patch(`rooms/${CODE}`, { 'info/hostUid': guest.uid, 'info/leadSeq': '000005' }, guest.token)
	},
	{
		name: 'господар знову на звʼязку',
		allowed: true,
		run: () => write(`presence/${CODE}/${host.uid}`, { at: SERVER_TIME }, host.token)
	},
	/*
	 * Журнал тут уже НЕ порожній (ходи `lead` вище), тобто партія йде: склад не
	 * міняється й не прибирається — а реванш, що стирає журнал, ставить новий.
	 */
	{
		name: 'склад посеред партії не міняється',
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/info/roster`, { [host.uid]: { name: 'Тест', seat: 0 } }, host.token)
	},
	{
		name: 'склад посеред партії не прибирається',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/roster`, null, host.token)
	},
	{
		name: 'реванш ставить новий склад тим самим записом, що й порожній журнал',
		allowed: true,
		run: () =>
			patch(
				`rooms/${CODE}`,
				{
					'info/seed': 778,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/roster': { [guest.uid]: { name: 'Тест', seat: 0 } },
					moves: null
				},
				host.token
			)
	},
	{
		name: 'не-господар зносить кімнату',
		allowed: false,
		run: () => write(`rooms/${CODE}`, null, guest.token)
	},

	// --- знесення кімнати останнє: воно прибирає стан для решти ---
	{
		name: 'господар зносить кімнату',
		allowed: true,
		run: () => write(`rooms/${CODE}`, null, host.token)
	},

	/*
	 * МЕЖІ ЗЕРНА Й РОЗКЛАДКИ (аудит 2026-09-26, шостий). Програма вікторини — перепрогін
	 * усіх партій кімнати до ⌊зерно / 2³¹⌋, тож зерно 1e300 вішало вкладку кожного, хто
	 * заходив; `pairs` понад колоду давав партію без кінця, `cols: 0` — дошку без колонок.
	 */
	{
		name: 'кімната із зерном на стелі',
		allowed: false,
		run: () => write(`rooms/${BOUNDS}/info`, { ...info(host.uid), seed: 2199023255552 }, host.token)
	},
	{
		name: 'кімната з відʼємним зерном',
		allowed: false,
		run: () => write(`rooms/${BOUNDS}/info`, { ...info(host.uid), seed: -1 }, host.token)
	},
	{
		name: 'кімната з пар понад колоду',
		allowed: false,
		run: () =>
			write(
				`rooms/${BOUNDS}/info`,
				{ ...info(host.uid), config: { pairs: 15, cols: 4 } },
				host.token
			)
	},
	{
		name: 'кімната без жодної колонки',
		allowed: false,
		run: () =>
			write(
				`rooms/${BOUNDS}/info`,
				{ ...info(host.uid), config: { pairs: 8, cols: 0 } },
				host.token
			)
	},
	{
		name: 'прапорець гри — не нуль і не одиниця',
		allowed: false,
		run: () =>
			write(
				`rooms/${BOUNDS}/info`,
				{ ...info(host.uid), config: { pairs: 8, cols: 4, game_myths: 2 } },
				host.token
			)
	},
	{
		name: 'рівень швидкості поза шкалою',
		allowed: false,
		run: () =>
			write(
				`rooms/${BOUNDS}/info`,
				{ ...info(host.uid), config: { pairs: 8, cols: 4, pace_round: 10 } },
				host.token
			)
	},
	{
		// Самі межі — законні: зерно перед стелею, найбільші розкладка й рівні.
		name: 'кімната на самих межах зерна й розкладки',
		allowed: true,
		run: () =>
			write(
				`rooms/${BOUNDS}/info`,
				{
					...info(host.uid),
					seed: 2199023255551,
					config: { pairs: 14, cols: 14, game_myths: 1, pace_round: 9 }
				},
				host.token
			)
	},
	{
		name: 'господар зносить кімнату меж',
		allowed: true,
		run: () => write(`rooms/${BOUNDS}`, null, host.token)
	},
	/*
	 * ПЕРЕХОПЛЕННЯ ВЕДЕННЯ В ЛОБІ (аудит 2026-09-25): кожен сценарій перехоплення
	 * доти йшов уже посеред партії, і гілка лобі — «гравець кімнати», а не склад, —
	 * не перевірялася нічим. Окрема кімната: господар створює й іде, гість і
	 * глядач лишаються на звʼязку.
	 */
	{
		name: 'кімната в лобі для перехоплення: господар, гравець і глядач',
		allowed: true,
		run: async () => {
			const steps = [
				() => write(`rooms/${LEAD}/info`, info(host.uid), host.token),
				() => write(`rooms/${LEAD}/members/${host.uid}`, { ...member, order: 1 }, host.token),
				() => write(`rooms/${LEAD}/members/${guest.uid}`, member, guest.token),
				() =>
					write(
						`rooms/${LEAD}/members/${stranger.uid}`,
						{ ...member, role: 'spectator', order: 3 },
						stranger.token
					),
				() => write(`presence/${LEAD}/${guest.uid}`, { at: SERVER_TIME }, guest.token),
				() => write(`presence/${LEAD}/${stranger.uid}`, { at: SERVER_TIME }, stranger.token)
			];
			for (const step of steps) {
				const status = await step();
				if (status !== 200) return status;
			}
			return 200;
		}
	},
	{
		// Господаря немає, глядач на звʼязку, хід `lead` правильний — відмова рівно
		// через роль: у лобі вести може лише гравець кімнати.
		name: 'у лобі ведення бере глядач, коли господаря немає',
		allowed: false,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/hostUid': stranger.uid,
					'info/leadSeq': '000001',
					'moves/000001': {
						seq: 1,
						by: stranger.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				stranger.token
			)
	},
	{
		name: 'у лобі ведення бере гравець кімнати, коли господаря немає',
		allowed: true,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/hostUid': guest.uid,
					'info/leadSeq': '000002',
					'moves/000002': {
						seq: 2,
						by: guest.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				guest.token
			)
	},
	/*
	 * ПРИЧИНИ ВІДМОВИ ПЕРЕХОПЛЕННЯ — ПООДИНЦІ (аудит 2026-09-26). Доти кожен
	 * негативний випадок перехоплення падав одразу з двох-трьох причин, і прибрати
	 * будь-яку одну умову з правила гейт не помітив би.
	 */
	{
		name: 'колишній господар вертається на звʼязок у лобі',
		allowed: true,
		run: () => write(`presence/${LEAD}/${host.uid}`, { at: SERVER_TIME }, host.token)
	},
	{
		name: 'у лобі ведення не взяти, поки господар на звʼязку',
		allowed: false,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/hostUid': host.uid,
					'info/leadSeq': '000003',
					'moves/000003': {
						seq: 3,
						by: host.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: guest.uid }
					}
				},
				host.token
			)
	},
	{
		name: 'обидва йдуть зі звʼязку',
		allowed: true,
		run: async () => {
			const first = await write(`presence/${LEAD}/${host.uid}`, null, host.token);
			return first === 200 ? write(`presence/${LEAD}/${guest.uid}`, null, guest.token) : first;
		}
	},
	{
		name: 'у лобі ведення не взяти без власного звʼязку',
		allowed: false,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/hostUid': host.uid,
					'info/leadSeq': '000003',
					'moves/000003': {
						seq: 3,
						by: host.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: guest.uid }
					}
				},
				host.token
			)
	},
	/*
	 * ЖУРНАЛ, СТАРТ І РЕВАНШ (аудит 2026-09-26, A2) — у тій самій кімнаті: у журналі її
	 * лобі лежить законний хід `lead` (000002), і господар тепер — гість. Кожна відмова
	 * нижче — рівно з однієї причини.
	 */
	{
		// Без складу: інакше відмова мала б дві причини (склад теж вимагає порожнього журналу).
		name: 'старт, що лишає журнал лобі, не лягає',
		allowed: false,
		run: () =>
			patch(`rooms/${LEAD}/info`, { status: 'playing', startedAt: SERVER_TIME }, guest.token)
	},
	{
		name: 'старт стирає журнал лобі й вказівник на нього одним записом',
		allowed: true,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/nextCode': null,
					'info/leadSeq': null,
					'info/roster': { [guest.uid]: { name: member.name, seat: 0 } },
					moves: null
				},
				guest.token
			)
	},
	{
		name: 'гравець складу ходить посеред партії',
		allowed: true,
		run: () => write(`rooms/${LEAD}/moves/000001`, move(guest.uid, 1), guest.token)
	},
	{
		// Другий натиск «почати»: тим самим зерном журнал посеред партії не стерти.
		name: 'дубль старту партію не стирає',
		allowed: false,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/nextCode': null,
					'info/leadSeq': null,
					'info/roster': { [guest.uid]: { name: member.name, seat: 0 } },
					moves: null
				},
				guest.token
			)
	},
	{
		name: 'реванш посеред партії — з новим зерном — стирає журнал',
		allowed: true,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/seed': 2,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/nextCode': null,
					'info/leadSeq': null,
					'info/roster': { [guest.uid]: { name: member.name, seat: 0 } },
					moves: null
				},
				guest.token
			)
	},
	{
		name: 'гравець складу ходить у реванші',
		allowed: true,
		run: () => write(`rooms/${LEAD}/moves/000001`, move(guest.uid, 1), guest.token)
	},
	{
		name: 'склад посеред партії з журналом',
		allowed: false,
		run: () =>
			write(
				`rooms/${LEAD}/info/roster`,
				{ [guest.uid]: { name: member.name, seat: 0 } },
				guest.token
			)
	},
	{
		name: 'початок партії переписано посеред партії',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/startedAt`, SERVER_TIME, guest.token)
	},
	{
		name: 'мітку створення переписано',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/createdAt`, SERVER_TIME, guest.token)
	},
	{
		// `.validate` на видалення не діє — тримає `info`, а не сама мітка.
		name: 'мітку створення стерто',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/createdAt`, null, guest.token)
	},
	{
		name: 'налаштування стерто посеред партії',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/config`, null, guest.token)
	},
	{
		// Господар пише `info` правом батька, тож умову несе `.validate` `hostUid`.
		name: 'господар передає ведення без ходу lead',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/hostUid`, host.uid, guest.token)
	},
	{
		name: 'гравець складу ходить із полем from',
		allowed: true,
		run: () =>
			write(
				`rooms/${LEAD}/moves/000002`,
				{ seq: 2, by: guest.uid, type: 'flip', at: SERVER_TIME, payload: { from: host.uid } },
				guest.token
			)
	},
	{
		name: 'господар указує вказівником на хід, що не lead',
		allowed: true,
		run: () => write(`rooms/${LEAD}/info/leadSeq`, '000002', guest.token)
	},
	{
		// Названий у `from` — не господар; без перевірки типу він оголосив би переїзд.
		name: 'переїзд під вказівником на хід, що не lead',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/nextCode`, '77', host.token)
	},
	{
		name: 'господар завершує партію',
		allowed: true,
		run: () => write(`rooms/${LEAD}/info/status`, 'over', guest.token)
	},
	{
		// Після партії журнал стирає лише господар: R9 тут не діє (партія не йде), тож
		// відмова — рівно через те, що пише не господар (шостий аудит).
		name: 'не господар стирає журнал дограної партії',
		allowed: false,
		run: () => write(`rooms/${LEAD}/moves`, null, host.token)
	},
	{
		name: 'після партії звичайний хід не лягає',
		allowed: false,
		run: () => write(`rooms/${LEAD}/moves/000003`, move(guest.uid, 3), guest.token)
	},
	{
		name: 'після партії нове зерно без стертого журналу',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/seed`, 99, guest.token)
	},
	{
		name: 'після партії налаштування без стертого журналу',
		allowed: false,
		run: () => write(`rooms/${LEAD}/info/config`, { pairs: 6, cols: 4 }, guest.token)
	},
	{
		// Рівно тим записом, яким його робить `rtdbRoom.restart`.
		name: 'реванш після партії стирає журнал і вказівник',
		allowed: true,
		run: () =>
			patch(
				`rooms/${LEAD}`,
				{
					'info/seed': 3,
					'info/status': 'playing',
					'info/startedAt': SERVER_TIME,
					'info/countdownAt': null,
					'info/nextCode': null,
					'info/leadSeq': null,
					'info/roster': { [guest.uid]: { name: member.name, seat: 0 } },
					moves: null
				},
				guest.token
			)
	},
	{
		name: 'новий господар зносить кімнату перехоплення',
		allowed: true,
		run: () => write(`rooms/${LEAD}`, null, guest.token)
	},

	/*
	 * ВІКТОРИНА (аудит 2026-09-26): пізній гравець посеред партії дописує ходи, але
	 * ведення не бере — ні в грі, ні після неї; гравець складу — бере. І межі
	 * налаштувань — поки кімната в лобі, щоб відмова мала рівно одну причину.
	 */
	{
		name: 'кімната вікторини в лобі: господар і гість',
		allowed: true,
		run: async () => {
			const steps = [
				() =>
					write(
						`rooms/${QUIZ}/info`,
						{ ...info(host.uid), gameId: 'quiz', config: { game_myths: 1 } },
						host.token
					),
				() =>
					write(
						`rooms/${QUIZ}/members/${host.uid}`,
						{ ...member, name: 'Господар', order: 1 },
						host.token
					),
				() => write(`rooms/${QUIZ}/members/${guest.uid}`, member, guest.token)
			];
			for (const step of steps) {
				const status = await step();
				if (status !== 200) return status;
			}
			return 200;
		}
	},
	{
		name: 'нечислове значення в налаштуваннях',
		allowed: false,
		run: () => write(`rooms/${QUIZ}/info/config/game_feeding`, 'так', host.token)
	},
	{
		name: 'невідомий ключ у налаштуваннях',
		allowed: false,
		run: () => write(`rooms/${QUIZ}/info/config/mode`, 5, host.token)
	},
	{
		name: 'налаштування кімнати — рядок, а не обʼєкт',
		allowed: false,
		run: () => write(`rooms/${QUIZ}/info/config`, 'x'.repeat(64), host.token)
	},
	{
		name: 'склад старту — рядок, а не обʼєкт',
		allowed: false,
		run: () =>
			patch(
				`rooms/${QUIZ}`,
				{ 'info/status': 'playing', 'info/roster': 'x'.repeat(64) },
				host.token
			)
	},
	{
		name: 'склад старту з місцем поза столом',
		allowed: false,
		run: () =>
			patch(
				`rooms/${QUIZ}`,
				{
					'info/status': 'playing',
					'info/roster': {
						[host.uid]: { name: 'Господар', seat: 12 },
						[guest.uid]: { name: 'Тест', seat: 1 }
					}
				},
				host.token
			)
	},
	{
		name: 'вікторина стартує зі складом господаря й гостя',
		allowed: true,
		run: () =>
			patch(
				`rooms/${QUIZ}`,
				{
					'info/status': 'playing',
					'info/roster': {
						[host.uid]: { name: 'Господар', seat: 0 },
						[guest.uid]: { name: 'Тест', seat: 1 }
					}
				},
				host.token
			)
	},
	{
		name: 'пізній гравець заходить у вікторину, що йде, і він на звʼязку',
		allowed: true,
		run: async () => {
			const seated = await write(
				`rooms/${QUIZ}/members/${stranger.uid}`,
				{ ...member, name: 'Пізній', order: 3 },
				stranger.token
			);
			return seated === 200
				? write(`presence/${QUIZ}/${stranger.uid}`, { at: SERVER_TIME }, stranger.token)
				: seated;
		}
	},
	{
		// Виняток вікторини в правилі ходів: склад у неї відкритий в один бік
		// (`utils/roster.ts`), і пізній гравець відповідає з поточного раунду.
		name: 'пізній гравець дописує відповідь посеред вікторини',
		allowed: true,
		run: () =>
			write(
				`rooms/${QUIZ}/moves/000001`,
				{
					seq: 1,
					by: stranger.uid,
					type: 'answer',
					at: SERVER_TIME,
					payload: { round: 0, correct: 1 }
				},
				stranger.token
			)
	},
	{
		// Господаря на звʼязку немає, пізній гравець на звʼязку й хід правильний —
		// відмова рівно через склад: посеред партії веде лише той, хто в ньому.
		name: 'пізній гравець вікторини ведення не бере',
		allowed: false,
		run: () =>
			patch(
				`rooms/${QUIZ}`,
				{
					'info/hostUid': stranger.uid,
					'info/leadSeq': '000002',
					'moves/000002': {
						seq: 2,
						by: stranger.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				stranger.token
			)
	},
	{
		name: 'гравець складу вікторини підхоплює ведення',
		allowed: true,
		run: async () => {
			const here = await write(`presence/${QUIZ}/${guest.uid}`, { at: SERVER_TIME }, guest.token);
			if (here !== 200) return here;
			return patch(
				`rooms/${QUIZ}`,
				{
					'info/hostUid': guest.uid,
					'info/leadSeq': '000002',
					'moves/000002': {
						seq: 2,
						by: guest.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: host.uid }
					}
				},
				guest.token
			);
		}
	},
	{
		name: 'новий ведучий завершує вікторину',
		allowed: true,
		run: () => write(`rooms/${QUIZ}/info/status`, 'over', guest.token)
	},
	{
		// Скінчена партія — та сама гілка складу, що й та, що йде: реванш буде з ним.
		name: 'після вікторини ведення не бере той, кого немає в складі',
		allowed: false,
		run: async () => {
			const gone = await write(`presence/${QUIZ}/${guest.uid}`, null, guest.token);
			if (gone !== 200) return gone;
			return patch(
				`rooms/${QUIZ}`,
				{
					'info/hostUid': stranger.uid,
					'info/leadSeq': '000003',
					'moves/000003': {
						seq: 3,
						by: stranger.uid,
						type: 'lead',
						at: SERVER_TIME,
						payload: { from: guest.uid }
					}
				},
				stranger.token
			);
		}
	},
	{
		name: 'ведучий зносить кімнату вікторини',
		allowed: true,
		run: () => write(`rooms/${QUIZ}`, null, guest.token)
	},

	/*
	 * ПОШУК — ЛИШЕ ПІД ВЛАСНИМ ПСЕВДОНІМОМ, навіть коли профіль його називає.
	 * Буває й так: людина звільнила ключ, а профіль ще не переписала, і ключ
	 * тим часом зайняв інший. Тоді пошук під ним належить уже не їй.
	 */
	{
		name: 'гість звільняє свій псевдонім, лишаючи його в профілі',
		allowed: true,
		run: () => write('handles/guest', null, guest.token)
	},
	{
		name: 'господар займає звільнений псевдонім',
		allowed: true,
		run: () => write('handles/guest', host.uid, host.token)
	},
	{
		name: 'вписати в пошук псевдонім із профілю, що належить уже іншому',
		allowed: false,
		run: () => write('find/guest', guest.uid, guest.token)
	},
	/*
	 * ЗАСТАРІЛИЙ ЗАПИС ПОШУКУ НЕ ТРИМАЄ ПСЕВДОНІМА (аудит 2026-09-25). Стан
	 * «запис лишився, а профіль уже називає інше» готується записом власника:
	 * сьогоднішніми правилами він виникає за кілька кроків, і кожен із них уже
	 * перевірено вище.
	 */
	{
		name: 'застарілий запис пошуку прибирає будь-хто',
		allowed: true,
		run: async () => {
			await seed('find/squat', stranger.uid);
			return write('find/squat', null, host.token);
		}
	},
	{
		name: 'живий запис пошуку чужою рукою не прибрати',
		allowed: false,
		run: async () => {
			await seed('handles/alive', stranger.uid);
			await seed(`users/${stranger.uid}/profile`, { name: 'Сторонній', handle: 'alive', at: 1 });
			await seed('find/alive', stranger.uid);
			return write('find/alive', null, host.token);
		}
	},
	{
		name: 'новий власник переписує застарілий запис пошуку на себе',
		allowed: true,
		run: async () => {
			await seed('find/renewed', stranger.uid);
			const claimed = await write('handles/renewed', host.uid, host.token);
			if (claimed !== 200) return claimed;
			const named = await write(
				`users/${host.uid}/profile`,
				{ name: 'Господар', handle: 'renewed', at: SERVER_TIME },
				host.token
			);
			return named === 200 ? write('find/renewed', host.uid, host.token) : named;
		}
	},

	/*
	 * ОСОБА — ЛИШЕ В ПРИВʼЯЗАНОГО АКАУНТА (аудит 2026-09-25). Кожен випадок нижче
	 * вірний у всьому, крім одного — входу анонімом: реєстр, профіль і рахунок для
	 * нього підготовлено записом власника, щоб відмова була рівно через вхід.
	 */
	{
		name: 'анонім пише профіль',
		allowed: false,
		run: async () => {
			await seed('handles/anonh', anon.uid);
			await seed(`users/${anon.uid}/profile`, { name: 'Анонім', handle: 'anonh', at: 1 });
			await seed(`users/${anon.uid}/play`, { score: 500, at: 1 });
			return write(
				`users/${anon.uid}/profile`,
				{ name: 'Анонім', handle: 'anonh', at: SERVER_TIME },
				anon.token
			);
		}
	},
	{
		name: 'анонім займає вільний псевдонім',
		allowed: false,
		run: () => write('handles/anonfree', anon.uid, anon.token)
	},
	{
		name: 'анонім вписується в пошук',
		allowed: false,
		run: () => write('find/anonh', anon.uid, anon.token)
	},
	{
		name: 'анонім пише рядок таблиці лідерів',
		allowed: false,
		run: () =>
			write(
				`leaders/${anon.uid}`,
				{ name: 'Анонім', handle: 'anonh', score: 120, at: SERVER_TIME },
				anon.token
			)
	},
	{
		name: 'анонім підписується',
		allowed: false,
		run: () => write(`users/${anon.uid}/following/${guest.uid}`, { at: SERVER_TIME }, anon.token)
	},
	{
		name: 'анонім вмикає перемикачі приватності',
		allowed: false,
		run: () => write(`users/${anon.uid}/privacy`, { search: true }, anon.token)
	},
	/*
	 * ПО ОДНОМУ ПОЛЮ — ТЕ САМЕ (аудит 2026-09-26). Вимога «не анонім» стоїть у
	 * `.validate` БАТЬКІВСЬКОГО вузла, а запис лягає в дитину: випадки вище писали
	 * вузли цілком і цієї дороги не перевіряли. Батьківський вузол підготовлено
	 * записом власника, тож злите значення має всі обовʼязкові поля — і відмова
	 * лишається рівно через вхід.
	 */
	{
		name: 'анонім міняє в профілі лише імʼя',
		allowed: false,
		run: () => write(`users/${anon.uid}/profile/name`, 'Інше Імʼя', anon.token)
	},
	{
		name: 'анонім вмикає один перемикач приватності',
		allowed: false,
		run: () => write(`users/${anon.uid}/privacy/search`, true, anon.token)
	},
	{
		name: 'анонім пише лише час своєї підписки',
		allowed: false,
		run: () => write(`users/${anon.uid}/following/${guest.uid}/at`, SERVER_TIME, anon.token)
	},
	{
		name: 'анонім пише лише час у чужих підписниках',
		allowed: false,
		run: () => write(`users/${guest.uid}/followers/${anon.uid}/at`, SERVER_TIME, anon.token)
	},
	{
		name: 'анонім міняє в таблиці лише рахунок',
		allowed: false,
		run: async () => {
			await seed(`leaders/${anon.uid}`, {
				name: 'Анонім',
				handle: 'anonh',
				score: 60,
				at: 1
			});
			return write(`leaders/${anon.uid}/score`, 100, anon.token);
		}
	},
	{
		// Прибрати своє — завжди: умова стоїть на створенні й зміні, а не на видаленні.
		name: 'анонім прибирає свій профіль',
		allowed: true,
		run: () => write(`users/${anon.uid}/profile`, null, anon.token)
	},

	/*
	 * ВИДАЛЕННЯ АКАУНТА — останнім, бо воно прибирає дані гостя для всіх випадків
	 * вище. Доти `users/{uid}` і `myRooms/{uid}` знести не міг ніхто, включно з
	 * власником: права були лише на дітях (аудит 2026-09-24).
	 */
	{
		name: 'сторонній зносить ЧУЖІ дані користувача',
		allowed: false,
		run: () => write(`users/${guest.uid}`, null, stranger.token)
	},
	{
		name: 'сторонній зносить ЧУЖИЙ індекс кімнат',
		allowed: false,
		run: () => write(`myRooms/${guest.uid}`, null, stranger.token)
	},
	{
		name: 'власник ПЕРЕПИСУЄ свої дані цілком, а не через дітей',
		allowed: false,
		run: () => write(`users/${guest.uid}`, { anything: 1 }, guest.token)
	},
	{
		name: 'власник зносить свій індекс кімнат цілком',
		allowed: true,
		run: () => write(`myRooms/${guest.uid}`, null, guest.token)
	},
	{
		name: 'власник зносить свої дані цілком',
		allowed: true,
		run: () => write(`users/${guest.uid}`, null, guest.token)
	}
];

const problems = [];
let positives = 0;

/*
 * ВІДМОВА — ЦЕ 401, А НЕ «БУДЬ-ЩО, КРІМ 200» (аудит 2026-09-25).
 *
 * Доти негативний випадок зеленів на будь-якій відповіді, крім 200, — зокрема на
 * 400, яким REST відкидає незаконний ключ чи запит ще ДО правил. Два випадки так і
 * жили: вони перевіряли синтаксис REST, а не правило, заради якого написані. Тепер
 * відмова правил — рівно 401; будь-що інше — поломка самого випадку.
 */
const DENIED = 401;

for (const { name, allowed, run } of CASES) {
	if (allowed) positives++;
	const status = await run();
	const isAllowed = status === 200;
	const fits = allowed ? isAllowed : status === DENIED;
	const verdict = isAllowed ? 'ДОЗВОЛЕНО' : `ЗАБОРОНЕНО(${status})`;
	console.log(`  ${fits ? '✓' : '✗'} ${verdict.padEnd(18)} ${name}`);
	if (!fits) {
		const expected = allowed ? 'дозволено' : `відмову правил (${DENIED})`;
		problems.push(`${name}: очікувалося ${expected}, отримано ${verdict}`);
	}
}

/*
 * Перевірка живості самої перевірки: якщо позитивних або негативних випадків
 * не лишилося, прогін нічого не доводить (AI-AGENT-PITFALLS-v8 § 1).
 */
const negatives = CASES.length - positives;
if (positives === 0 || negatives === 0) {
	console.error('\nПеревірка вироджена: потрібні і позитивні, і негативні випадки.');
	process.exit(1);
}

if (problems.length) {
	console.error(`\nПравила доступу не відповідають очікуванням (${problems.length}):`);
	for (const problem of problems) console.error(`  - ${problem}`);
	process.exit(1);
}

console.log(
	`\nПравила доступу: ${CASES.length} перевірок (${positives} дозволено, ${negatives} заборонено), розбіжностей немає.`
);
