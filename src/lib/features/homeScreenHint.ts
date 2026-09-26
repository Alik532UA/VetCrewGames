import { storage } from '$lib/services/storage';
import { toast } from '$lib/controllers/toast.svelte';
import { wantsHomeScreenHint } from '$lib/services/fullscreen.svelte';

/**
 * ПІДКАЗКА «НА ПОЧАТКОВИЙ ЕКРАН» — ОДИН РАЗ НА ПРИСТРІЙ (прохання автора 2026-09-26).
 *
 * На iPhone кнопки «на весь екран» немає: Safari там не дає сторінкам повного
 * екрана, і кнопка, що нічого не робить, читалася як баг сайту. Справжній шлях
 * там один — «Поділитися → На початковий екран», і саме його підказка й називає.
 *
 * Один раз, а не щоразу: це порада, а не попередження, і повторена на кожному
 * вході вона стала б шумом, який вчить не читати тости взагалі. Позначка лягає
 * РАЗОМ із показом, а не після закриття: інакше тост, який сам зник за час,
 * показувався б знову.
 */

/** Ключ сховища: підказку на цьому пристрої вже показано. */
export const HINT_SHOWN_KEY = 'homeScreenHint';

/** Скільки тримати: текст у два кроки, і його треба встигнути прочитати. */
export const HINT_MS = 12_000;

export function hintHomeScreenOnce(): void {
	if (!wantsHomeScreenHint() || storage.get(HINT_SHOWN_KEY) !== null) return;
	toast.info('header.fullscreenHint', HINT_MS);
	storage.set(HINT_SHOWN_KEY, '1');
}
