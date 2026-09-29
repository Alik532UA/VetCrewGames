import { langPath, type Language } from '$lib/i18n/routing';
import type { TranslationKey } from '$lib/i18n/translations/uk';

/**
 * ПЕРЕЇЗД У ДРУГУ ОНЛАЙН-ГРУ після фіналу.
 *
 * ## Що це вирішує
 *
 * Прохання автора: «після фіналу можна повторити і поточну гру „Грати знову“, і
 * іншу гру — якщо тільки що була гра „знайти пару“, то можна „вікторину“, і
 * навпаки». З двох варіантів автор вибрав той, у якому група лишається разом:
 * «господар створює кімнату іншої гри, а решті в старій кімнаті зʼявляється кнопка
 * „перейти“ з її кодом».
 *
 * ## Чому НЕ зміна гри в тій самій кімнаті
 *
 * У кімнати є `gameId`, і в коді записано «одна кімната — одна гра». Це не
 * формальність: журнал ходів, правила застосування й версія правил у двох іграх
 * різні, тож кімната, що вміє обидві, мусила б тримати два набори правил і
 * вирішувати, за якими програвати старі ходи. Тому переїзд — вказівник на НОВУ
 * кімнату, а не перевзуття старої.
 *
 * ## Як це працює зі двох сторін
 *
 * Господар відкриває сторінку другої гри з `?from=СТАРИЙ_КОД`. Створивши там
 * кімнату, вона дописує свій код у `info.nextCode` старої (`announceNext` у
 * `net/rtdbRoom.ts`). Решта бачить у старій кімнаті кнопку «перейти» з новим кодом
 * і заходить за ним звичайним шляхом — тобто ніяких особливих прав переїзд не дає.
 */

/** Дві онлайн-ігри проєкту. Третьої немає, і це видно з типу. */
export type OnlineGame = 'pairs' | 'quiz';

/** Чи це одна з онлайн-ігор проєкту — `gameId` кімнати приходить із бази рядком. */
export const isOnlineGame = (id: string): id is OnlineGame => id === 'pairs' || id === 'quiz';

/** Сторінка онлайн-гри — КЛЮЧ таблиці маршрутів: шлях із мовою й `base` складає `langPath`. */
export const onlineRoute = (game: OnlineGame): 'pairs/online' | 'quiz/online' => `${game}/online`;

/**
 * Куди ведуть двері сторінки гри (`controllers/roomPlace.ts`, `PlaceRoutes`): на хаб і на
 * сторінку гри за `gameId` кімнати. Однаково для обох ігор — тому тут, а не на сторінках.
 * Мова — ГЕТЕРОМ: сторінка міняє її без перемонтування, і шлях мусить іти за нею.
 */
export const onlineRoutes = (lang: () => Language) => ({
	hub: () => langPath(lang(), 'online'),
	game: (gameId: string) => (isOnlineGame(gameId) ? langPath(lang(), onlineRoute(gameId)) : null)
});

/** Куди веде «зіграти в іншу»: кожна гра вказує на другу. */
const OTHER: Record<OnlineGame, OnlineGame> = { pairs: 'quiz', quiz: 'pairs' };

/** Підпис кнопки — назва ТОЇ гри, у яку переходять. */
const INVITE: Record<OnlineGame, TranslationKey> = {
	pairs: 'room.playPairs',
	quiz: 'room.playQuiz'
};

export interface CrossGameLinks {
	/** Куда йде ГОСПОДАР, щоб створити кімнату іншої гри. */
	create: string;
	/** Підпис цієї кнопки: назва гри, у яку переходять. */
	createLabel: TranslationKey;
	/** Куда йдуть ВСІ, коли переїзд оголошено. `null` — ще нікуди. */
	next: string | null;
	/**
	 * ГОЛОВНЕ МЕНЮ. У фіналі це й «закрити кімнату» для господаря (прохання автора 2026-09-29:
	 * «Головне меню — це те саме, що Закрити кімнату»), тож адреса їде разом із переїздом.
	 */
	menu: string;
}

/**
 * Дві адреси для екрана підсумку.
 *
 * `code` порожній — кімнати немає, і створювати наступну нема від чого: посилання
 * без `?from` дало б кімнату, про яку стара не дізнається.
 */
export function crossGameLinks(
	lang: Language,
	game: OnlineGame,
	code: string,
	nextCode: string | null
): CrossGameLinks {
	const other = OTHER[game];
	/*
	 * Не `base`: у цьому проєкті так називається префікс адреси, і склеювання з ним
	 * руками — задокументована пастка (гейт структури ловить саме імʼя). Тут же це
	 * готовий шлях сторінки з `langPath`.
	 */
	const pagePath = langPath(lang, `${other}/online`);
	return {
		create: code ? `${pagePath}?from=${encodeURIComponent(code)}` : pagePath,
		createLabel: INVITE[other],
		/*
		 * `move=1` — «це група переїжджає»: вікна «вас запросили» (`RoomInvite`) їй не
		 * треба, бо все про себе вона сказала в попередній кімнаті хвилину тому.
		 */
		next: nextCode ? `${pagePath}?room=${encodeURIComponent(nextCode)}&move=1` : null,
		menu: langPath(lang)
	};
}

/**
 * ОГОЛОСИТИ ПЕРЕЇЗД, якщо в адресі є `?from`.
 *
 * Живе тут, а не на сторінці, з двох причин. Перша: обидві сторінки роблять це
 * дослівно однаково, і третя копія зʼявилася б разом із третьою онлайн-грою. Друга
 * прозаїчніша — обидві сторінки тоді стояли РІВНО на межі розміру (400 рядків), і
 * два рядки там коштували дорожче за функцію тут.
 *
 * Тихо не робить нічого без `?from`: кімнату створюють і просто так, і це не
 * помилковий стан.
 */
export async function announceFrom(url: URL, code: string): Promise<void> {
	const from = url.searchParams.get('from');
	if (!from) return;
	const { announceNext } = await import('$lib/net/rtdbRoom');
	await announceNext(from, code);
}
