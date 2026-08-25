/**
 * Рядки СПІЛЬНОЇ ВІКТОРИНИ — окремий словник, що довантажується.
 *
 * Причина заміряна, і вона та сама, що в `i18n/account` та `i18n/crew`:
 * `i18n/index.ts` імпортує всі чотири мови СТАТИЧНО, тобто вони лежать у бандлі
 * кореневого layout — у першому payload КОЖНОГО відвідувача. Одинадцять рядків
 * на мову коштували 0,5 КБ gzip і перевищили бюджет layout (120,5 проти 120)
 * заради кімнати, у яку зайде далеко не кожен.
 *
 * Правильний хід — не підняти бюджет (жодна стеля тут не послаблюється), а
 * винести дані туди, де вони потрібні.
 *
 * ЩО ЛИШИЛОСЯ В ГОЛОВНОМУ СЛОВНИКУ: `quiz.otherGame`. Його показує тост при
 * спробі зайти в кімнату іншої гри, а тост перекладає глобальним `t()` — тобто
 * лінивого словника не бачить.
 *
 * ЦІНА НАЗВАНА: паритет цих ключів більше не стереже `check:i18n` — він звіряє
 * зібрані словники. Замість нього це робить `src/i18n-quiz.test.ts`, який
 * імпортує всі чотири файли й падає і на бракуючому рядку, і на зайвому.
 */
export const quiz: Record<string, string> = {
	'quiz.gamesInRoom': 'Games in this room',
	'quiz.gamesLast': 'At least one game must stay on',
	'quiz.unknownGame': 'This game comes from a newer version. Reload the page.',
	'quiz.skipStep': 'Skip',
	'quiz.roundTimer': 'Round time',
	'quiz.answered': 'Waiting for the others.',
	'quiz.awayWait': 'Waiting:',
	'quiz.pauseBy': 'Paused by:',
	'quiz.pause': 'Pause',
	'quiz.pauseResume': 'Resume',
	'quiz.awayGoOn': 'Play on',
	'quiz.awayVoted': 'Your vote is counted',
	'quiz.awayKick': 'Remove',
	'quiz.nextRound': 'Next round'
};
