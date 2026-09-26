/**
 * ЧИ ВИКЛАДЕНІ В FIREBASE ТІ САМІ ПРАВИЛА, ЩО ЛЕЖАТЬ У GIT.
 *
 * Використання: `npm run check:rules:live`
 *
 * ## Єдина перевірка в репозиторії, яка дивиться на ПРОДАКШН
 *
 * `npm run check:rules` піднімає емулятор і доводить, що ФАЙЛ правильний. Що
 * лежить у консолі Firebase, він не знає — правила виконуються там, а викладає їх
 * людина руками. Тобто «гейт зелений» і «база захищена» — два різні твердження, і
 * доти між ними нічого не стояло: стан консолі описувало рукописне речення в
 * `PROJECT-CONTEXT.md`, і воно вже було неправдою.
 *
 * ## Як це працює без жодних секретів
 *
 * `scripts/rules-stamp.mjs` вписує в правила умову на сегмент шляху:
 * `/__rulesVersion/<штамп>` читається лише тоді, коли викладені правила містять
 * саме цей штамп. Тобто відповідь бази й є версією — жодних даних за цим шляхом
 * немає й не потрібно, бо правила оцінюються ДО існування вузла.
 *
 * Вхід — анонімний, публічним ключем із бандла (`apiKey` для веб-застосунків
 * публічний за задумом). СЕРВІСНИЙ АКАУНТ ТУТ НЕ ПІДІЙШОВ БИ, і це не про
 * зручність: його токен обходить правила ЦІЛКОМ, тож зонд завжди відповідав би
 * «викладено». Перевірка мусить іти тим самим шляхом, що й відвідувач.
 *
 * ## Що робити з червоним результатом
 *
 * Викласти правила: `npm run rules:deploy` (або вручну через консоль). Червоне
 * тут означає рівно одне: у продакшні діють ІНШІ правила, ніж ті, що перевіряє
 * гейт на емуляторі.
 */
import { readFile } from 'node:fs/promises';

/** Джерело правди для штампа й конфігу — файли проєкту, а не копії тут. */
const RULES = 'database.rules.json';
const CONFIG_SOURCE = 'src/lib/net/firebase.ts';

const stamp = /\$v === '([0-9a-f]+)'/.exec(await readFile(RULES, 'utf8'))?.[1];
if (!stamp) {
	console.error(`ПОМИЛКА: у ${RULES} немає блока __rulesVersion. Виконати: npm run rules:stamp`);
	process.exit(1);
}

/*
 * Конфіг читається з ДЖЕРЕЛА застосунку, а не дублюється тут.
 *
 * Друга копія розійшлася б із першою рівно тоді, коли проєкт Firebase змінять, —
 * і зонд перевіряв би чужу базу, показуючи «правила відстали» без причини.
 */
const source = await readFile(CONFIG_SOURCE, 'utf8');
const apiKey = /apiKey: '([^']+)'/.exec(source)?.[1];
const databaseURL = /databaseURL: '([^']+)'/.exec(source)?.[1];
if (!apiKey || !databaseURL) {
	console.error(`ПОМИЛКА: не знайшов apiKey/databaseURL у ${CONFIG_SOURCE}`);
	process.exit(1);
}

/** Анонімний вхід публічним ключем — той самий шлях, що в застосунку. */
async function signInAnonymously() {
	const res = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ returnSecureToken: true })
		}
	);
	if (!res.ok) {
		throw new Error(`анонімний вхід не вдався: ${res.status} ${(await res.text()).slice(0, 200)}`);
	}
	return (await res.json()).idToken;
}

async function probe(path, token) {
	const res = await fetch(`${databaseURL}/${path}.json?auth=${token}`);
	return res.status;
}

/*
 * ПОВТОРИ — БО ЗОНД СТОЇТЬ МІЖ ПРАВИЛАМИ Й САЙТОМ (аудит 2026-09-25).
 *
 * Сайт виїжджає лише після зеленого зонда. Доти один збій анонімного входу чи
 * мережі на раннері валив зонд одразу — а правила на той момент уже викладено,
 * тож продакшн лишався з НОВИМИ правилами й СТАРИМ сайтом, рівно тією парою, від
 * якої порядок робіт і мав берегти.
 *
 * Зонд при цьому ЛИШАЄТЬСЯ ГЕЙТОМ сайту, і це свідомо, а не забута порада винести
 * його окремо: справжня відмова означає, що правила НЕ лягли, тобто в продакшні
 * старі правила зі старим сайтом — пара узгоджена. Розбіжну пару давала лише
 * ВИПАДКОВА відмова зонда, і саме її знімають повтори. Повторюється все, крім
 * «база пускає будь-який штамп»: це не збій, а відповідь.
 */
const PAUSES_MS = [0, 3000, 8000, 15000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let last = null;
for (const [attempt, pause] of PAUSES_MS.entries()) {
	await sleep(pause);
	try {
		const token = await signInAnonymously();
		const mine = await probe(`__rulesVersion/${stamp}`, token);
		/*
		 * КАНАРКА НА САМ ЗОНД, і без неї він майже нічого не вартий.
		 *
		 * Якби в базі раптом стояло «дозволити все», очікуваний штамп читався б — і зонд
		 * сказав би «викладено» на правилах, які не захищають нічого. Тому поруч
		 * перевіряється вигаданий штамп: він мусить дати ВІДМОВУ. Дві відповіді разом
		 * означають «діють саме ті правила», а не «база щось відповідає».
		 */
		const bogus = await probe('__rulesVersion/000000000000', token);
		last = { mine, bogus };
		if (bogus === 200 || mine === 200) break;
	} catch (error) {
		last = { error };
	}
	console.log(
		`  спроба ${attempt + 1} з ${PAUSES_MS.length}: ${last.error ?? `штамп → ${last.mine}`}`
	);
}

if (last?.error) {
	console.error('ЗОНД НЕ ДОСТУКАВСЯ ДО БАЗИ жодного разу:', String(last.error));
	console.error('Це не «правила відстали», а «не знаю»: перезапустити роботу.\n');
	process.exit(1);
}
const { mine, bogus } = last;

console.log('');
console.log(`  очікуваний штамп ${stamp}  → ${mine === 200 ? 'ДОЗВОЛЕНО' : `відмова(${mine})`}`);
console.log(`  вигаданий штамп             → ${bogus === 200 ? 'ДОЗВОЛЕНО' : `відмова(${bogus})`}`);
console.log('');

if (bogus === 200) {
	console.error('БАЗА ПУСКАЄ БУДЬ-ЯКИЙ ШТАМП.');
	console.error('Це означає надто широке правило в продакшні — можливо, «дозволити все».');
	console.error('Зонд у такому стані нічого не доводить: викласти правила з файлу.\n');
	process.exit(1);
}
if (mine !== 200) {
	console.error('ПРАВИЛА В FIREBASE ВІДСТАЛИ ВІД ФАЙЛУ.');
	console.error(`Штамп ${stamp} у продакшні не діє — отже там інша редакція правил.`);
	console.error('Викласти: npm run rules:deploy\n');
	process.exit(1);
}

console.log(`check-rules-live: у Firebase діють правила редакції ${stamp} — збігається з git.\n`);
