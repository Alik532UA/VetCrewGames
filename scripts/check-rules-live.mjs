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

const token = await signInAnonymously();

async function probe(path) {
	const res = await fetch(`${databaseURL}/${path}.json?auth=${token}`);
	return res.status;
}

const mine = await probe(`__rulesVersion/${stamp}`);

/*
 * КАНАРКА НА САМ ЗОНД, і без неї він майже нічого не вартий.
 *
 * Якби в базі раптом стояло «дозволити все», очікуваний штамп читався б — і зонд
 * сказав би «викладено» на правилах, які не захищають нічого. Тому поруч
 * перевіряється вигаданий штамп: він мусить дати ВІДМОВУ. Дві відповіді разом
 * означають «діють саме ті правила», а не «база щось відповідає».
 */
const bogus = await probe('__rulesVersion/000000000000');

console.log('');
console.log(`  очікуваний штамп ${stamp}  → ${mine === 200 ? 'ДОЗВОЛЕНО' : `відмова(${mine})`}`);
console.log(`  вигаданий штамп             → ${bogus === 200 ? 'ДОЗВОЛЕНО' : `відмова(${bogus})`}`);
console.log('');

if (mine !== 200) {
	console.error('ПРАВИЛА В FIREBASE ВІДСТАЛИ ВІД ФАЙЛУ.');
	console.error(`Штамп ${stamp} у продакшні не діє — отже там інша редакція правил.`);
	console.error('Викласти: npm run rules:deploy\n');
	process.exit(1);
}
if (bogus === 200) {
	console.error('БАЗА ПУСКАЄ БУДЬ-ЯКИЙ ШТАМП.');
	console.error('Це означає надто широке правило в продакшні — можливо, «дозволити все».');
	console.error('Зонд у такому стані нічого не доводить: викласти правила з файлу.\n');
	process.exit(1);
}

console.log(`check-rules-live: у Firebase діють правила редакції ${stamp} — збігається з git.\n`);
