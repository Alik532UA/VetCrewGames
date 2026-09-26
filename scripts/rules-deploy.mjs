/**
 * ВИКЛАСТИ ПРАВИЛА — з перевіркою, чим саме ми входимо.
 *
 * Використання: `npm run rules:deploy`
 *
 * ## Навіщо обгортка, а не просто `firebase deploy`
 *
 * Без облікових даних `firebase-tools` каже «Failed to authenticate, have you run
 * firebase login?» — і це рівно той різновид повідомлення, який відправляє не
 * туди. У CI входять сервісним акаунтом через `GOOGLE_APPLICATION_CREDENTIALS`, і
 * `firebase login` там не при чому; локально навпаки. Порада, яка згадує лише один
 * із двох способів, змушує вгадувати, який саме випадок у тебе.
 *
 * Тому тут спершу перевіряється, ЧИМ ми можемо ввійти, і на порожньому місці
 * друкуються обидва шляхи з конкретними командами.
 *
 * ## Чому це не просто рядок у package.json
 *
 * Перевірка наявності файлу й друк багаторядкової підказки в npm-скрипті
 * означали б синтаксис оболонки — а на Windows npm-скрипти йдуть через `cmd.exe`,
 * де POSIX-конструкції не працюють. Той самий висновок, що й у
 * `scripts/firebase-cli.mjs`.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/*
 * ІДЕНТИФІКАТОР ПРОЄКТУ — З ТОГО САМОГО ФАЙЛУ, ЩО Й У ЗАСТОСУНКУ.
 *
 * Доти тут стояв власний літерал `'vet-crew-games'`, тобто один факт жив у
 * двох місцях. Розходження було б тихим у найгірший спосіб: правила поїхали б
 * в одну базу, застосунок писав би в іншу, і ОБИДВІ дії відзвітували б
 * успіхом. Сусідній `check-rules-live.mjs` уже читає конфіг звідси — тепер і
 * цей (SECURITY-v9 § 4.2.1, `SEC-CONFIG-IN-SOURCE`).
 */
const CONFIG_SOURCE = 'src/lib/net/firebase.ts';
const PROJECT = /projectId: '([^']+)'/.exec(readFileSync(CONFIG_SOURCE, 'utf8'))?.[1];
if (!PROJECT) {
	console.error(`ПОМИЛКА: не знайшов projectId у ${CONFIG_SOURCE} — невідомо, куди викладати.`);
	process.exit(2);
}

/**
 * Чим можна ввійти — у порядку, у якому це робить сам `firebase-tools`.
 *
 * `configstore` перевіряється у двох місцях: на Windows файл лежить у `APPDATA`,
 * на решті — у `~/.config`. Одного шляху досить лише поки працюєш на одній ОС.
 *
 * ВМІСТ, А НЕ НАЯВНІСТЬ ФАЙЛУ. Перша редакція вважала входом сам факт існування
 * `configstore/firebase-tools.json` — і одразу дала хибний плюс: файл там був, а
 * в ньому лежав лише ключ `motd`. Його створюють прогони `emulators:exec`, яким
 * жодного входу не потрібно. Тобто перевірка казала «входимо через firebase
 * login», після чого `firebase deploy` падав із тим самим «have you run firebase
 * login?» — рівно та підказка, від якої цей скрипт мав захистити.
 */
function credentials() {
	const adc = process.env.GOOGLE_APPLICATION_CREDENTIALS;
	if (adc && existsSync(adc)) return `сервісний акаунт (${adc})`;

	if (process.env.FIREBASE_TOKEN) return 'токен FIREBASE_TOKEN';

	const stores = [
		process.env.APPDATA && join(process.env.APPDATA, 'configstore', 'firebase-tools.json'),
		join(homedir(), '.config', 'configstore', 'firebase-tools.json')
	].filter(Boolean);
	for (const store of stores) {
		if (!existsSync(store)) continue;
		try {
			const saved = JSON.parse(readFileSync(store, 'utf8'));
			// `tokens.refresh_token` — те, що `firebase login` справді кладе; `user`
			// лишається поруч. Без токена цей файл про вхід не говорить нічого.
			if (saved?.tokens?.refresh_token) return `вхід firebase login (${store})`;
		} catch {
			// Пошкоджений configstore — не привід падати тут: нехай про це скаже сам
			// CLI, а ми лише не вважаємо його входом.
		}
	}
	return null;
}

/*
 * ВИКЛАДАТИ ЛИШЕ ТЕ, ЩО В GIT, І ЛИШЕ ЗІ СВІЖИМ ШТАМПОМ (шостий аудит).
 *
 * Штамп у правилах — те, за чим живий зонд (`check:rules:live`) і смуга «оновіть
 * сторінку» впізнають редакцію. Змінені правила з незміненим штампом зонд назвав би
 * «збігається», а смуга не зʼявилася б ніколи. Незакомічені правила — редакція, якої
 * немає ні в історії, ні в збірці сайту, тобто невідомо, з яким клієнтом вона житиме.
 */
function refuse(message) {
	console.error(`\nПРАВИЛА НЕ ВИКЛАДЕНО: ${message}\n`);
	process.exit(1);
}
try {
	execFileSync(process.execPath, [join('scripts', 'rules-stamp.mjs'), '--check'], {
		stdio: 'pipe'
	});
} catch {
	refuse(
		'штамп у правилах не збігається з їхнім вмістом. Спершу `npm run rules:stamp`, закомітити, і вже тоді викладати.'
	);
}
try {
	const dirty = execFileSync('git', ['status', '--porcelain', '--', 'database.rules.json'], {
		encoding: 'utf8'
	});
	if (dirty.trim() !== '')
		refuse('`database.rules.json` має незакомічені зміни. Викладається лише те, що в git.');
} catch (error) {
	if (error?.code === 'ENOENT')
		console.warn('rules-deploy: git не знайдено — перевірку чистого дерева пропущено.');
	else throw error;
}

const how = credentials();

if (!how) {
	console.error(`
ВИКЛАСТИ ПРАВИЛА НЕМА ЧИМ: облікових даних Firebase не знайдено.

Два способи, і обидва робочі.

  1. ВІДПРАВИТИ В main — і хай викладе CI. Секрет FIREBASE_SERVICE_ACCOUNT уже
     в репозиторії, джоб «rules_deploy» виконає викладання й одразу перевірить
     результат зондом. Локально не потрібно нічого:

         git push

  2. ВИКЛАСТИ ЗІ СВОЄЇ МАШИНИ. Один раз увійти в браузері:

         npm run firebase:login

     і далі \`npm run rules:deploy\` працюватиме завжди.

  (Третій спосіб — покласти завантажений JSON сервісного акаунта на диск і
  вказати на нього GOOGLE_APPLICATION_CREDENTIALS. Він робочий, але тримати
  приватний ключ файлом на робочій машині гірше за обидва варіанти вище: ключ
  обходить правила безпеки цілком, а відкликати його можна лише в консолі.)
`);
	process.exit(1);
}

console.log(`rules-deploy: входимо через ${how}`);

/*
 * Через ту саму обгортку, що й решта викликів CLI: `firebase-tools` не стоїть у
 * залежностях, бо його транзитивний `superstatic` не приймає сучасний Node, а в
 * проєкті `engine-strict=true` — деталі в `scripts/firebase-cli.mjs`.
 */
const child = spawn(
	process.execPath,
	[join('scripts', 'firebase-cli.mjs'), 'deploy', '--only', 'database', '--project', PROJECT],
	{ stdio: 'inherit' }
);
child.on('exit', (code) => {
	if (code === 0) {
		console.log(
			'\nrules-deploy: правила викладено. Сайт мусить виїхати СЛІДОМ (CI робить це сам;' +
				' руками — щойно зелений `check:rules:live`), інакше стара збірка живе з новими правилами.'
		);
	}
	process.exit(code ?? 1);
});
