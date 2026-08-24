import { mergePlay, readPlay, watchPlay, writePlay, type PlayData } from '$lib/net/play';
import { playerData } from './playerData.svelte';
import { logService } from './logService.svelte';

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
	if (!same(merged, cloud)) void writePlay(merged);
}

/** Відкладений запис: десятки змін за партію — це один запит, а не десятки. */
function pushSoon(): void {
	if (!playerData.linked) return;
	if (timer !== null) clearTimeout(timer);
	timer = setTimeout(() => {
		timer = null;
		void writePlay(playerData.snapshot()).then((ok) => {
			if (!ok) logService.warn('network', 'score not synced', { score: playerData.score });
		});
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
	playerData.markLinked();
	const merged = mergePlay(playerData.snapshot(), await readPlay());
	playerData.apply(merged);
	await writePlay(merged);
	await startPlaySync();
}

/** Вихід: підписка знімається, місцеве стирається (див. `clearLocal`). */
export function signedOut(): void {
	stopPlaySync();
	playerData.clearLocal();
}

function same(a: PlayData, b: PlayData | null): boolean {
	if (!b || a.score !== b.score) return false;
	for (const id of new Set([...Object.keys(a.games), ...Object.keys(b.games)])) {
		if (a.games[id]?.best !== b.games[id]?.best) return false;
		if (a.games[id]?.plays !== b.games[id]?.plays) return false;
	}
	return true;
}
