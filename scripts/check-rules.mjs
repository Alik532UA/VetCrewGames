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
async function signIn(label) {
	const res = await fetch(
		`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ returnSecureToken: true })
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

/** Кімната з правильною формою `info`. Одна на весь прогін. */
const CODE = 'AAAAA';
const info = (hostUid) => ({
	gameId: 'pairs',
	rulesVersion: 2,
	seed: 12345,
	status: 'lobby',
	hostUid,
	config: { pairs: 8, cols: 4 }
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
		name: 'господар переводить кімнату в playing',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/status`, 'playing', host.token)
	},
	{
		name: 'господар ставить серверну позначку початку партії',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/startedAt`, SERVER_TIME, host.token)
	},
	{
		name: 'господар перемикає режим початку партії',
		allowed: true,
		run: () => write(`rooms/${CODE}/info/autoStart`, true, host.token)
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
	{
		name: 'хід із рядковим payload (нові типи ходів)',
		allowed: true,
		run: () =>
			write(
				`rooms/${CODE}/moves/000002`,
				{ seq: 2, by: guest.uid, type: 'say', at: SERVER_TIME, payload: { word: 'кіт' } },
				guest.token
			)
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
		run: () => readQuery('lobby', 'orderBy=%22at%22&limitToLast=21', guest.token)
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
		run: () => write(`lobby/${CODE}`, null, host.token)
	},
	{
		name: 'господар публікує СВОЮ кімнату в переліку',
		allowed: true,
		run: () => write(`lobby/${CODE}`, lobbyEntry(host.uid), host.token)
	},

	{
		// Кількість гравців веде господар: він єдиний, хто бачить склад і має
		// право писати сюди.
		name: 'господар оновлює кількість гравців у переліку',
		allowed: true,
		run: () => write(`lobby/${CODE}/players`, 2, host.token)
	},

	// --- сторонній не мусить цього могти ---
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
		name: 'status поза переліком',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/status`, 'winner', host.token)
	},
	{
		name: "імʼя довше за 24 символи",
		allowed: false,
		run: () =>
			write(`rooms/${CODE}/members/${guest.uid}`, { ...member, name: 'я'.repeat(25) }, guest.token)
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
		run: () => read('lobby', guest.token)
	},
	{
		name: 'перелік кімнат читають із ЗАВЕЛИКОЮ межею',
		allowed: false,
		run: () => readQuery('lobby', 'orderBy=%22at%22&limitToLast=500', guest.token)
	},
	{
		// Межа названа разом із порядком: без `orderBy` індекс не діє, і база
		// однаково віддала б гілку цілком.
		name: 'перелік кімнат читають з межею, але без orderBy',
		allowed: false,
		run: () => readQuery('lobby', 'limitToLast=10', guest.token)
	},
	{
		// Головне обмеження цієї гілки: публічною кімнату робить ЇЇ господар, а не
		// хтось інший. Без цього будь-хто відкривав би чужий код усьому світові.
		name: 'ЧУЖУ кімнату оголошують публічною',
		allowed: false,
		run: () => write(`lobby/${CODE}`, lobbyEntry(guest.uid), guest.token)
	},
	{
		// Запис, що не відповідає жодній кімнаті, — це привид у списку.
		name: 'публікація кімнати, якої НЕМАЄ',
		allowed: false,
		run: () => write('lobby/ZZZZZ', lobbyEntry(guest.uid), guest.token)
	},
	{
		name: 'чужий запис у переліку прибирають',
		allowed: false,
		run: () => write(`lobby/${CODE}`, null, guest.token)
	},
	{
		// `seed` і `config` визначають роздачу: побачити їх, не заходячи в кімнату,
		// означало б бачити дошку суперника до першого ходу.
		name: 'у перелік кладуть зерно роздачі',
		allowed: false,
		run: () => write(`lobby/${CODE}`, { ...lobbyEntry(host.uid), seed: 12345 }, host.token)
	},
	{
		name: 'запис у переліку з клієнтським часом',
		allowed: false,
		run: () => write(`lobby/${CODE}`, { ...lobbyEntry(host.uid), at: 1000 }, host.token)
	},
	{
		name: 'запис у переліку без обовʼязкових полів',
		allowed: false,
		run: () => write(`lobby/${CODE}`, { hostUid: host.uid }, host.token)
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
		run: () => write(`presence/${CODE}/${guest.uid}`, { online: true }, guest.token)
	},
	{
		name: 'присутність із ПІДРОБЛЕНИМ часом',
		allowed: false,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: 1 }, guest.token)
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
			write(
				`rooms/${CODE}/moves/000012`,
				{ ...move(guest.uid, 12), score: 999 },
				guest.token
			)
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
		name: 'нечислове значення в config',
		allowed: false,
		run: () => write(`rooms/${CODE}/info/config/mode`, 'hard', host.token)
	},
	{
		name: 'ЧУЖИЙ індекс кімнат — читання',
		allowed: false,
		run: () => read(`myRooms/${host.uid}`, guest.token)
	},
	{
		name: 'ЧУЖИЙ індекс кімнат — запис',
		allowed: false,
		run: () => write(`myRooms/${host.uid}/ZZZZZ`, { at: SERVER_TIME }, guest.token)
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
	}
];

const problems = [];
let positives = 0;

for (const { name, allowed, run } of CASES) {
	if (allowed) positives++;
	const status = await run();
	const isAllowed = status === 200;
	const verdict = isAllowed ? 'ДОЗВОЛЕНО' : `ЗАБОРОНЕНО(${status})`;
	console.log(`  ${isAllowed === allowed ? '✓' : '✗'} ${verdict.padEnd(18)} ${name}`);
	if (isAllowed !== allowed) {
		problems.push(
			`${name}: очікувалося ${allowed ? 'дозволено' : 'заборонено'}, отримано ${verdict}`
		);
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
