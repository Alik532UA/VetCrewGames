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

export interface MenuGame {
	key: TranslationKey;
	route: RouteRest;
}

/** П'ятірка вікторини: саме вона лежить за «Грати» й за «Випадковою грою». */
export const QUIZ_GAMES: readonly MenuGame[] = [
	{ key: 'menu.game.mythbusters', route: 'game-mythbusters' },
	{ key: 'menu.game.population', route: 'game-population' },
	{ key: 'menu.game.habitat', route: 'game-habitat' },
	{ key: 'menu.game.family', route: 'game-family' },
	{ key: 'menu.game.feeding', route: 'game-feeding' }
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
	{ key: 'menu.game.memory', route: 'game-memory' }
];
