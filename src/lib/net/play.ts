import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';

/**
 * ДАНІ ГРАВЦЯ В АКАУНТІ: наскрізний рахунок і рекорд кожної гри.
 *
 * ## Чому це взагалі з'явилося
 *
 * Доти рахунок жив лише в `localStorage`, тобто належав БРАУЗЕРУ, а не людині:
 * акаунт, відкритий на новому телефоні, починався з нуля, а один пристрій на
 * двох показував обом один рахунок. Сусідні проєкти вже пройшли цей шлях —
 * `Slovko` тримає прогрес у Firestore і зливає його при вході, `MindStep`
 * зберігає рекорд і нагороди.
 *
 * ## Форма: `play/{score, at, games/{id}/{best, plays}}`
 *
 * Вузол на кожну гру, і ключ гри — рядок із `config/menu-games.ts`, а не
 * маршрут: маршрут перейменують, а під старим ключем лишиться все, що людина
 * набрала. Взірець ключа перевіряє правило бази, тож НОВА ГРА не вимагає ні
 * правки правил, ні їхнього деплою — лише рядка в конфігу.
 *
 * ## Місцеве — головне, хмара — друга копія
 *
 * Гра не чекає на мережу: рахунок росте у сховищі, а сюди приїжджає згодом
 * (`services/playerData.svelte.ts` тримає обидві половини). Тому всі функції тут
 * НЕ КИДАЮТЬ на мережевій невдачі: партія, яка впала через обрив зв'язку, була б
 * гіршою бідою за незбережений рекорд.
 *
 * Виняток — `mergePlay`: вона чиста, синхронна й тестується без емулятора.
 */

/** Рекорд однієї гри: найкраща партія і скільком партіям вона підсумок. */
export interface GameRecord {
	best: number;
	plays: number;
}

/** Те, що лежить під `users/{uid}/play`. */
export interface PlayData {
	score: number;
	games: Record<string, GameRecord>;
}

export const EMPTY_PLAY: PlayData = { score: 0, games: {} };

/**
 * Злити дві копії даних гравця. Обидва напрямки, один результат.
 *
 * ## Максимум, а не сума — і це не спрощення
 *
 * Злиття кличеться не один раз: при вході в акаунт, при кожному приході даних із
 * другого пристрою, при повторному під'єднанні після обриву. Сума на повторному
 * прогоні дала б подвоєння того самого — рахунок, який росте від самого факту
 * синхронізації. Максимум ІДЕМПОТЕНТНИЙ: скільки разів не злий, результат той
 * самий.
 *
 * Ціна названа: партії, награні офлайн на двох пристроях одночасно, не
 * складаються — лишається більший результат. Це чесніше за рахунок, який росте
 * сам.
 */
export function mergePlay(local: PlayData | null, cloud: PlayData | null): PlayData {
	const mine = local ?? EMPTY_PLAY;
	const theirs = cloud ?? EMPTY_PLAY;
	const games: Record<string, GameRecord> = {};

	for (const id of new Set([...Object.keys(mine.games), ...Object.keys(theirs.games)])) {
		const a = mine.games[id];
		const b = theirs.games[id];
		games[id] = {
			best: Math.max(a?.best ?? 0, b?.best ?? 0),
			plays: Math.max(a?.plays ?? 0, b?.plays ?? 0)
		};
	}

	return { score: Math.max(mine.score, theirs.score), games };
}

/**
 * Привести прочитане з бази до форми, якій можна вірити.
 *
 * База віддає те, що в ній лежить, а не те, що описує тип: запис старої збірки,
 * ручна правка в консолі, поле, якого вже немає. Числом тут вважається лише
 * скінченне невід'ємне число — інакше `NaN` розійшовся б по всьому рахунку й
 * ніде не впав.
 */
function sanitize(raw: unknown): PlayData | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const source = raw as { score?: unknown; games?: unknown };
	const games: Record<string, GameRecord> = {};

	if (typeof source.games === 'object' && source.games !== null) {
		for (const [id, value] of Object.entries(source.games as Record<string, unknown>)) {
			const record = value as { best?: unknown; plays?: unknown };
			games[id] = { best: count(record?.best), plays: count(record?.plays) };
		}
	}

	return { score: count(source.score), games };
}

function count(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** Дані гравця з бази. `null` — їх ще немає або прочитати не дали. */
export async function readPlay(): Promise<PlayData | null> {
	try {
		const { uid, db } = await connect();
		const { get, ref } = await import('firebase/database');
		const snapshot = await get(ref(db, `users/${uid}/play`));
		return snapshot.exists() ? sanitize(snapshot.val()) : null;
	} catch (error) {
		logService.warn('network', 'play data not read', { reason: String(error) });
		return null;
	}
}

/**
 * Записати дані гравця. `false` — не записалися, і це нормальний хід подій.
 *
 * `at` — СЕРВЕРНА позначка часу, і правило бази вимагає саме її: інакше пристрій
 * із поламаним годинником оголошував би свої дані найсвіжішими.
 */
export async function writePlay(data: PlayData): Promise<boolean> {
	try {
		const { uid, db } = await connect();
		const { ref, serverTimestamp, set } = await import('firebase/database');
		await set(ref(db, `users/${uid}/play`), {
			score: data.score,
			games: data.games,
			at: serverTimestamp()
		});
		return true;
	} catch (error) {
		logService.warn('network', 'play data not written', { reason: String(error) });
		return false;
	}
}

/**
 * Слухати дані гравця в базі. Повертає ЗНЯТТЯ підписки.
 *
 * Підписка, а не одноразове читання: рахунок, набраний на телефоні, мусить
 * доїхати до ноутбука, який зараз відкритий, — інакше «синхронізація» означала б
 * «наступного разу». Слухач один на застосунок: другий давав би дві копії
 * одного факту й два злиття на кожну зміну.
 */
export async function watchPlay(onData: (data: PlayData | null) => void): Promise<() => void> {
	try {
		const { uid, db } = await connect();
		const { off, onValue, ref } = await import('firebase/database');
		const node = ref(db, `users/${uid}/play`);
		const listener = onValue(node, (snapshot) => {
			onData(snapshot.exists() ? sanitize(snapshot.val()) : null);
		});
		return () => off(node, 'value', listener);
	} catch (error) {
		logService.warn('network', 'play data not watched', { reason: String(error) });
		return () => {};
	}
}

/**
 * Прибрати дані гравця з бази — потрібне видаленню акаунта.
 *
 * КИДАЄ, на відміну від решти: видалення, яке не вдалося, не можна показати як
 * видалення, бо людина натиснула «видалити акаунт» і мусить дізнатися правду.
 */
export async function removePlay(uid: string): Promise<void> {
	const { db } = await connect();
	const { ref, remove } = await import('firebase/database');
	await remove(ref(db, `users/${uid}/play`));
}
