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
 * @param {string} path
 * @param {string | null} token
 */
async function read(path, token) {
	const auth = token ? `&auth=${token}` : '';
	return (await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}${auth}`)).status;
}

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
const member = { name: 'Тест', role: 'player', order: 1 };

/**
 * `at` — серверна позначка часу, і саме такою її вимагає правило. REST розуміє
 * `{".sv": "timestamp"}` так само, як SDK розуміє `serverTimestamp()`, тож цей
 * прогін заразом доводить, що ходу з підробленим часом не існує.
 */
const SERVER_TIME = { '.sv': 'timestamp' };
const move = (by, seq) => ({ seq, by, type: 'flip', at: SERVER_TIME, payload: { index: 3 } });

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
		name: 'учасник тримає СВОЮ присутність',
		allowed: true,
		run: () => write(`presence/${CODE}/${guest.uid}`, { at: 1 }, guest.token)
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
		name: 'чужа присутність',
		allowed: false,
		run: () => write(`presence/${CODE}/${host.uid}`, { at: 1 }, guest.token)
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
