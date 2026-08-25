import { loadQuizText } from '$lib/i18n/quiz';
import { languageFromParam } from '$lib/i18n/routing';
import type { PageLoad } from './$types';

export { languageEntries as entries } from '$lib/i18n/entries';

/**
 * Словник спільної вікторини приїжджає РАЗОМ ЗІ СТОРІНКОЮ.
 *
 * Доти його тягнув `onMount`, і в `build/quiz/online/index.html` через це лежали
 * три сирі ключі — підписи фільтра ігор (`quiz.gamesFilter`, `quiz.gamesWanted`,
 * `quiz.gamesFilterHint`). Пререндер малює сторінку до будь-якого чанку, тож це
 * не «мить»: саме ці рядки бачить пошуковик і кожен, у кого JS ще не виконався.
 *
 * Причина виносу словника в окремий чанк лишається (`i18n/quiz/index.ts`): у
 * головному він важив 0,5 КБ gzip у першому payload кожного відвідувача.
 * Змінюється лише МОМЕНТ: `load` виконується до малювання і на сервері, і на
 * клієнті.
 *
 * Мова — з адреси: під час пререндеру налаштувань ще немає.
 */
export const load: PageLoad = async ({ params }) => ({
	quizText: await loadQuizText(languageFromParam(params.lang))
});
