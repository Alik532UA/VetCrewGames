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
	'quiz.gamesInRoom': 'Spiele in diesem Raum',
	'quiz.gamesFilter': 'Spielfilter',
	'quiz.gamesWanted': 'Was ich spielen will',
	'quiz.gamesFilterHint':
		'Filtert die Raumliste — und legt die Spiele für einen Raum fest, den du erstellst.',
	'quiz.gamesLast': 'Mindestens ein Spiel muss bleiben',
	'quiz.unknownGame': 'Dieses Spiel kommt aus einer neueren Version. Seite neu laden.',
	'quiz.skipStep': 'Überspringen',
	'quiz.roundTimer': 'Rundenzeit',
	'quiz.revealTimer': 'Bis zur nächsten Runde',
	'quiz.answered': 'Warten auf die anderen.',
	'quiz.awayWait': 'Warten:',
	'quiz.pauseBy': 'Pause von:',
	'quiz.paceRound': 'Rundenzeit',
	'quiz.paceReveal': 'Zeit für die Auflösung',
	'quiz.pace.fast': 'Schnell',
	'quiz.pace.normal': 'Standard',
	'quiz.pace.slow': 'Langsam',
	'quiz.pause': 'Pause',
	'quiz.pauseResume': 'Weiter',
	'quiz.awayGoOn': 'Weiterspielen',
	'quiz.awayVoted': 'Deine Stimme ist gezählt',
	'quiz.awayKick': 'Entfernen',
	'quiz.nextRound': 'Nächste Runde'
};
