import type { RouteRest } from '$lib/i18n/routing';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * Перелік ігор вікторини для меню — один на весь проєкт.
 *
 * Доти він жив у розмітці сторінки `quiz/play`. Виніс його той період, коли меню
 * було два — розділи в роботі й плоский перелік у збірці для людей; тепер меню
 * одне (розділи), а перелік лишився тут, бо його читає й сторінка «Грати», і
 * спільна вікторина (`config/quizOnline.ts` бере з нього набір ігор кімнати).
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

/*
 * ПЕРЕЛІКУ «MENU_GAMES» ТУТ БІЛЬШЕ НЕМА — і це прибирання, а не переїзд.
 *
 * Він існував для головного меню збірки для людей: шість ігор плоским списком,
 * бо розділи ще нічого не обіцяли. Тепер головне меню однакове в роботі й у
 * продакшні (`routes/[[lang=lang]]/+page.svelte`), тобто плоского переліку на
 * головній немає взагалі, а «Знайди пару» стоїть окремим розділом.
 *
 * `QUIZ_GAMES` лишається: саме він за «Грати» всередині вікторини.
 */
