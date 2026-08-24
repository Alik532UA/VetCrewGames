import type { RouteRest } from '$lib/i18n/routing';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Перелік ігор для меню — один на весь проєкт.
 *
 * Доти він жив у розмітці сторінки `quiz/play`, і поки меню було одне, цього
 * вистачало. Тепер їх ДВА: у робочій версії головне меню показує розділи
 * («Заповідник», «Вікторина», «Знайди пару»), а у збірці для людей — плоский
 * перелік ігор, бо режимів, які ті розділи обіцяють, ще немає, і вкладеність
 * лише відволікає. Два переліки в двох файлах розійшлися б на наступній грі.
 */

/**
 * КЛЮЧІ ІГОР — під ними лежить рекорд у сховищі й у базі (`net/play.ts`).
 *
 * Окремі від маршрутів навмисно, хоч і схожі на них. Маршрут — це адреса, і його
 * колись перейменують (уже перейменовували: `quiz/play` став меню). Ключ рекорду
 * перейменувати не можна: під старим лишиться все, що людина набрала, і рекорд
 * зникне без жодної помилки — найтихіший різновид втрати.
 *
 * Взірець ключа стереже правило бази (`users/$uid/play/games/$gameId`): малі
 * латинські, цифри й дефіс. Тобто нова гра — це рядок ТУТ і більше нічого: ні
 * правки правил, ні деплою бази.
 *
 * Об'єкт, а не масив рядків: контролер називає гру `GAME_ID.population`, і
 * помилку в назві ловить компілятор, а не тиха відсутність рекорду.
 */
export const GAME_ID = {
	mythbusters: 'mythbusters',
	population: 'population',
	habitat: 'habitat',
	family: 'family',
	feeding: 'feeding',
	memory: 'memory'
} as const;

export type GameId = (typeof GAME_ID)[keyof typeof GAME_ID];

export interface MenuGame {
	id: GameId;
	key: TranslationKey;
	route: RouteRest;
}

/** П'ятірка вікторини: саме вона лежить за «Грати» й за «Випадковою грою». */
export const QUIZ_GAMES: readonly MenuGame[] = [
	{ id: GAME_ID.mythbusters, key: 'menu.game.mythbusters', route: 'game-mythbusters' },
	{ id: GAME_ID.population, key: 'menu.game.population', route: 'game-population' },
	{ id: GAME_ID.habitat, key: 'menu.game.habitat', route: 'game-habitat' },
	{ id: GAME_ID.family, key: 'menu.game.family', route: 'game-family' },
	{ id: GAME_ID.feeding, key: 'menu.game.feeding', route: 'game-feeding' }
];

/**
 * Що показує головне меню у збірці для людей.
 *
 * Ті самі п'ять плюс «Знайди пару». Заповідника тут немає навмисно: він ще
 * будується, і кнопка, за якою недороблена гра, псує враження від шести
 * готових. У робочій версії він доступний із меню розділів.
 */
export const MENU_GAMES: readonly MenuGame[] = [
	...QUIZ_GAMES,
	{ id: GAME_ID.memory, key: 'menu.game.memory', route: 'game-memory' }
];
