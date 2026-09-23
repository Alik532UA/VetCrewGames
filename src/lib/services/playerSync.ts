import { mergePlay, readPlay, watchPlay, writePlay, type PlayData } from '$lib/net/play';
import { readMyProfile, type Profile } from '$lib/net/account';
import { publishLeader } from '$lib/net/leaders';
import { playerData } from './playerData.svelte';
import { forgetName } from './nameSync';

/**
 * СИНХРОНІЗАЦІЯ РАХУНКУ Й РЕКОРДІВ: мережева половина `playerData`.
 *
 * ## Чому окремий файл, а не метод там
 *
 * Не з чистоти шарів, а за виміром. `playerData` тягне `settings`, а `settings` —
 * кожна сторінка; отже все, що імпортовано в тому модулі, лежить у чанку
 * кореневого layout і приїжджає КОЖНОМУ. Одного статичного `net/play` там
 * вистачило, щоб бюджет layout пішов із 120 КБ у 122, а сторінка акаунта — з 217
 * у 305 (`npm run check:build`, обидва числа з прогону).
 *
 * Тут же мережа доречна: цей модуль завантажують ДИНАМІЧНО й лише тоді, коли
 * акаунт є (кореневий layout) або коли людина щойно ввійшла (контролер акаунта).
 * Хто просто грає — не тягне ні цей файл, ні SDK бази.
 *
 * ## Одна підписка на застосунок
 *
 * Друга давала б два злиття на кожну зміну й два записи назад. Тому стан
 * підписки живе тут, у модулі, а не в кожного, хто попросив синхронізацію.
 */

/** Скільки чекати перед записом: партія дає багато дрібних змін рахунку. */
const PUSH_DELAY_MS = 3000;

let unwatch: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Свій профіль — рівно для рядка таблиці лідерів.
 *
 * Кешований навмисно: рядок публікується після кожного запису рахунку, а профіль
 * міняється раз на місяць. Читати його щоразу означало б зайве читання на кожні
 * три секунди активної гри. Оновлює кеш `refreshProfile()` — його кличе сторінка
 * акаунта, коли профіль справді змінився.
 */
let profile: Profile | null = null;

/**
 * Рахунок, що вже ЛЕЖИТЬ у базі, — і тільки його показує таблиця.
 *
 * Правило `leaders` не пускає в рядок число, більше за `users/{uid}/play/score`
 * (аудит 2026-09-23). Місцевий рахунок випереджає хмарний на відкладену
 * відправку — до трьох секунд гри, — і рядок із ним дістав би відмову саме тоді,
 * коли людина набирає очки. `null` — хмарного ще не бачили, і показувати нічого.
 */
let stored: number | null = null;

/**
 * Що вже показано: той самий профіль із тим самим рахунком удруге не пишеться.
 *
 * Власний запис рахунку вертається підпискою ще до підтвердження, тож без цієї
 * памʼяті кожна відправка давала б два однакові рядки таблиці, а кожен рядок у
 * топі розсилається всім, хто зараз дивиться таблицю.
 */
let shown: { profile: Profile; score: number } | null = null;

/**
 * Відправка, що зараз у дорозі, і та, яку база щойно відкинула.
 *
 * Без них відмова правила ставала б нескінченним колом. SDK повертає відкинутий
 * запис подією підписки РАНІШЕ, ніж сам запис скаже «не вдалося»; злиття бачить
 * місцеве більшим за хмарне — і відсилає те саме знову, щоразу мережевим
 * запитом. Тепер той самий вміст удруге не відсилається, а нова зміна рахунку —
 * відсилається (`pushSoon`).
 */
let sending: PlayData | null = null;
let refused: PlayData | null = null;

/**
 * Номер акаунта в цьому браузері: росте з кожним входом і виходом.
 *
 * Запис і читання профілю в дорозі переживають вихід. Без номера відповідь, що
 * приїхала вже після зміни акаунта, записала б старий рахунок у `stored` нового
 * або закешувала б чужий профіль — і таблиця показала б чуже.
 */
let account = 0;

/**
 * Дані приїхали з бази — злити з місцевими.
 *
 * Якщо після злиття місцеве БІЛЬШЕ за хмарне, різницю треба відіслати: інакше
 * рахунок, награний офлайн, лишився б лише на цьому пристрої. Порівнюється
 * результат злиття з тим, ЩО ПРИЙШЛО, а не з тим, що ми колись відсилали, — тому
 * власний запис, який повернувся підпискою, другого запису не викликає, і кола
 * «запис → подія → запис» не існує.
 */
function absorb(cloud: PlayData | null): void {
	const merged = mergePlay(playerData.snapshot(), cloud);
	playerData.apply(merged);
	if (cloud) stored = cloud.score;
	if (same(merged, cloud)) void showInBoard();
	else if (!same(merged, sending) && !same(merged, refused)) void pushPlay(merged);
}

/**
 * Відіслати рахунок — і ЛИШЕ ПІСЛЯ підтвердження оновити таблицю.
 *
 * Не поруч: два записи наввипередки давали б відмову правила щоразу, коли рядок
 * таблиці доїжджав до бази раніше за рахунок, якого він стосується. Чому запис
 * не вдався, `writePlay` пише в журнал сам.
 */
async function pushPlay(data: PlayData): Promise<void> {
	const epoch = account;
	sending = data;
	const ok = await writePlay(data);
	if (epoch !== account) return;
	if (sending === data) sending = null;
	if (!ok) {
		refused = data;
		return;
	}
	refused = null;
	stored = data.score;
	await showInBoard();
}

/**
 * Оновити свій рядок у таблиці лідерів — рахунком, що вже є в базі.
 *
 * Без профілю рядка не буває: у ньому імʼя, псевдонім і аватар, а не самий
 * рахунок. Профіль може бути ще не створеним — тоді таблиця просто чекає, поки
 * людина його заповнить.
 *
 * НЕ КИДАЄ й нічого не перевіряє: поріг у 50 очок і згоду на показ тримає правило
 * бази, і відмова тут — нормальний стан, а не помилка (`net/leaders.ts`).
 * Невдалий рядок забувається, щоб наступна нагода спробувала знову.
 */
async function showInBoard(): Promise<void> {
	if (stored === null) return;
	const epoch = account;
	const score = stored;
	const own = profile ?? (await readMyProfile());
	if (epoch !== account || !own) return;
	profile = own;
	if (shown?.profile === own && shown.score === score) return;
	const row = { profile: own, score };
	shown = row;
	if (!(await publishLeader(own, score)) && shown === row) shown = null;
}

/**
 * Профіль змінився — перечитати його й оновити рядок таблиці.
 *
 * Кличе сторінка акаунта після збереження профілю й після зміни перемикачів
 * приватності: інакше в таблиці лишилося б старе імʼя або старий аватар, і
 * виглядало б це як таблиця, що відстає на місяць.
 */
export async function refreshProfile(): Promise<void> {
	profile = null;
	await showInBoard();
}

/**
 * Усе, що належить АКАУНТУ, а не браузеру.
 *
 * Профіль тут кешований, і доти його не забував ні вихід, ні вхід в інший
 * акаунт: перший же рядок таблиці нового акаунта публікувався б з іменем і
 * псевдонімом попереднього. Тепер це ловить і правило (псевдонім мусить бути
 * свій), але правильний рядок від цього не зʼявлявся — його треба писати зі
 * свого профілю.
 */
function forgetAccount(): void {
	account += 1;
	profile = null;
	stored = null;
	shown = null;
	sending = null;
	refused = null;
}

/** Відкладений запис: десятки змін за партію — це один запит, а не десятки. */
function pushSoon(): void {
	if (!playerData.linked) return;
	if (timer !== null) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		void pushPlay(playerData.snapshot());
	}, PUSH_DELAY_MS);
}

/**
 * Почати синхронізацію. Повертає зняття — його кличе той, хто просив.
 *
 * Ідемпотентна: другий виклик не додає ні підписки, ні слухача змін.
 */
export async function startPlaySync(): Promise<() => void> {
	playerData.onChange = pushSoon;
	if (!unwatch) unwatch = await watchPlay(absorb);
	return stopPlaySync;
}

/** Зняти підписку й скасувати відкладений запис. */
export function stopPlaySync(): void {
	unwatch?.();
	unwatch = null;
	playerData.onChange = null;
	if (timer !== null) {
		clearTimeout(timer);
		timer = null;
	}
}

/**
 * Людина щойно ввійшла або зареєструвалася.
 *
 * ЗЛИТТЯ, а не заміна, і саме в цьому вся суть: те, що награно анонімно, мусить
 * доїхати в акаунт — інакше «увійти» означало б «почати з нуля», і вхід ставав би
 * покаранням за те, що людина спершу грала.
 */
export async function mergeOnSignIn(): Promise<void> {
	/*
	 * ПОПЕРЕДНЯ ПІДПИСКА ЗНІМАЄТЬСЯ ПЕРШОЮ, і це не косметика.
	 *
	 * Вхід у ІНШИЙ акаунт міняє `uid`, а підписка, створена до входу, слухає
	 * вузол попереднього: після входу вона отримувала б відмову правила, а нову —
	 * `startPlaySync` не створив би, бо стара ще «є». Тобто живої синхронізації
	 * не було б саме там, де вона найпотрібніша.
	 */
	stopPlaySync();
	forgetAccount();
	playerData.markLinked();
	const merged = mergePlay(playerData.snapshot(), await readPlay());
	playerData.apply(merged);
	await writePlay(merged);
	await startPlaySync();
}

/**
 * Вихід: підписка знімається, місцеве стирається (див. `clearLocal`).
 *
 * Заразом забувається кеш імені профілю: далі підпис належить браузеру, а не
 * акаунту, і порівнювати нове імʼя з чужим профілем нема сенсу. З тієї самої
 * причини — і профіль для таблиці лідерів (`forgetAccount`).
 */
export function signedOut(): void {
	stopPlaySync();
	forgetAccount();
	playerData.clearLocal();
	forgetName();
}

function same(a: PlayData, b: PlayData | null): boolean {
	if (!b || a.score !== b.score) return false;
	for (const id of new Set([...Object.keys(a.games), ...Object.keys(b.games)])) {
		if (a.games[id]?.best !== b.games[id]?.best) return false;
		if (a.games[id]?.plays !== b.games[id]?.plays) return false;
	}
	return true;
}
