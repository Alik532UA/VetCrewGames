import { LANGUAGE_ROUTES, type RouteRest } from '$lib/i18n/routing';

/**
 * Випадкова гра з головного меню.
 *
 * **Перелік виводиться з маршрутів, а не пишеться руками.** Другий список
 * розійшовся б із першим на наступній грі: додав маршрут — і забув додати його
 * у «випадкову». Тут навпаки: щойно гра з'явилася в `LANGUAGE_ROUTES`, вона
 * одразу може випасти.
 */

/**
 * Усе, що є ГРОЮ.
 *
 * Викидаються двоє: порожній ключ — це головна, а `game-habitat` — вибір
 * підрежиму, тобто ще одне меню. Кнопка обіцяє гру, тож випадати мають самі
 * підрежими, і вони в переліку є окремими адресами.
 *
 * Доти режим доводилося передавати модульною змінною повз адресу: «Де живем?»
 * була одним URL на три екрани, і сказати «відкрий одразу континенти» не було
 * чим. Той обхідний шлях зник разом із причиною.
 */
const NOT_A_GAME = new Set<RouteRest>(['', 'game-habitat']);

export const PLAYABLE_ROUTES = (Object.keys(LANGUAGE_ROUTES) as RouteRest[]).filter(
	(route): route is Exclude<RouteRest, ''> => !NOT_A_GAME.has(route)
);

export function pickRandomRoute(random: () => number = Math.random): Exclude<RouteRest, ''> {
	return PLAYABLE_ROUTES[Math.floor(random() * PLAYABLE_ROUTES.length)];
}
