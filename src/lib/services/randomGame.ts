import { LANGUAGE_ROUTES, type RouteRest } from '$lib/i18n/routing';
import type { HabitatMode } from '$lib/config/habitat-game';

/**
 * Випадкова гра з головного меню.
 *
 * **Перелік виводиться з маршрутів, а не пишеться руками.** Другий список
 * розійшовся б із першим на наступній грі: додав маршрут — і забув додати його
 * у «випадкову». Тут навпаки: щойно гра з'явилася в `LANGUAGE_ROUTES`, вона
 * одразу може випасти.
 */

/** Усе, що є грою: у мапі маршрутів є ще головна, і вона порожній ключ. */
export const PLAYABLE_ROUTES = (Object.keys(LANGUAGE_ROUTES) as RouteRest[]).filter(
	(route): route is Exclude<RouteRest, ''> => route !== ''
);

export function pickRandomRoute(random: () => number = Math.random): Exclude<RouteRest, ''> {
	return PLAYABLE_ROUTES[Math.floor(random() * PLAYABLE_ROUTES.length)];
}

/**
 * Підрежим, обраний за гравця.
 *
 * «Де живем?» починається з вибору режиму, а випадкова гра має відкриватися
 * ГРОЮ — питати після «випадкової» означало б не виконати обіцянку кнопки.
 *
 * Передається модульною змінною, а не адресою: параметр у query ламав би
 * prerender (`page.url.searchParams` на prerender-сторінці кидає виняток), а
 * у сховищі він пережив би сесію й спрацював би там, де його не просили.
 * Одноразовість тут головна властивість — звідси `take`, а не `get`.
 */
let pendingHabitatMode: HabitatMode | null = null;

export function armHabitatMode(mode: HabitatMode): void {
	pendingHabitatMode = mode;
}

/** Забрати намір і одразу його погасити: другий виклик поверне `null`. */
export function takeHabitatMode(): HabitatMode | null {
	const mode = pendingHabitatMode;
	pendingHabitatMode = null;
	return mode;
}

export function pickHabitatMode(random: () => number = Math.random): HabitatMode {
	return random() < 0.5 ? 'continents' : 'biomes';
}
