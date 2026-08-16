export const ui = {
	// App
	'app.title': 'Vet Crew Games',
	// Used for the meta description and link previews, so it has to read as a
	// standalone sentence rather than as UI copy.
	'app.description':
		'Безкоштовні освітні ігри про тварин: перевір, що знаєш про їхнє харчування, чисельність і поширені міфи. Проєкт на підтримку захисту тварин.',

	// Main menu
	'menu.title': 'Vet Crew Games',
	'menu.game.feeding': 'Що їмо?',
	'menu.game.memory': 'Знайди пару',
	'menu.game.random': 'Випадкова гра',
	'menu.reserve': 'Заповiдник',
	'menu.quiz': 'Вiкторина',

	// Підписи трьох пунктів, однакових для «Вікторини» й «Знайди пару»: різниця
	// лише в тому, куди веде «Грати».
	'menu.play': 'Грати',
	'menu.playWithFriends': 'Грати з друзями',
	'menu.playOnline': 'Грати онлайн',
	'menu.comingSoon': 'Ще в розробцi',
	'menu.game.population': 'Кого більше?',
	'menu.game.habitat': 'Де живем?',
	'menu.game.mythbusters': 'Правда чи міф?',
	'menu.game.family': 'Хто з іншої родини?',
	'menu.link.vetcrew': 'Vet Crew',
	'menu.link.order': 'Замовити гру чи сайт',

	// Common
	'common.skipLink': 'Перейти до основного вмісту',
	'common.check': 'Перевірити',
	// Підписи задано SCROLLBAR-v8 § 2.2.1, щоб два сайти на цьому пакеті
	// називали одне й те саме однаково.
	'scrollbar.title': 'Смуга прокрутки',
	'scrollbar.standard': 'Стандартна',
	'scrollbar.custom': 'Авторська',
	'memory.title': 'Знайди пару',
	'memory.card': 'Картка',
	'memory.prompt': 'Перевертай по дві картки. Однакові лишаються відкритими.',
	'memory.you': 'Ти',
	'memory.rival': 'Суперник',
	'memory.moves': 'Ходів',
	'memory.resized': 'Розмiр екрана змiнився. Розкладка лишилася тою, з якою починалася партiя.',
	'memory.relayout': 'Перерозкласти',
	'memory.found': 'Знайдено',
	'memory.turn': 'Ходить',
	'common.playAgain': 'Грати знову',
	'common.next': 'Далі',
	'common.back': 'Назад',
	'common.mainMenu': 'Головне меню',
	'common.close': 'Закрити',
	'common.correct': 'Правильно!',
	'common.incorrect': 'Неправильно!',
	'common.gameOver': 'Гру завершено!',
	'common.yourScore': 'Ваш рахунок:',

	// Підписи кнопок-значків у шапці. Це не текст на екрані, а те, що читає
	// скрінрідер — і саме тому воно теж має бути перекладене: інакше
	// україномовний користувач чує англійські команди (ACCESSIBILITY-v8 § 4.1).
	// Дієслово-дія, а не назва стану: «Змінити тему», не «Тема».
	'header.toggleTheme': 'Змінити тему',
	'header.toggleLocale': 'Змінити мову',
	'header.toggleFullscreen': 'На весь екран',
	'header.exitFullscreen': 'Вийти з повноекранного режиму',
	'header.score': 'Загальний рахунок',

	// Назви тем — уже ТЕКСТ на екрані, а не підпис для читалки: вони стоять
	// пунктами списку. Названі тим, що видно, а не значенням у сховищі:
	// «orange-purple» нікому нічого не каже, а «Осіння» каже все.
	'theme.dark': 'Темна',
	'theme.light-green': 'Свiтло-зелена',
	'theme.winter': 'Зимова',
	'theme.orange-purple': 'Осiння',

	// Кнопка збору логів. У продакшні вмикається debug-режимом.
	'debug.copyLogs': 'Скопіювати звіт логів',

	// Errors
	'error.title': 'Щось пішло не так',
	'error.message': 'Сталася неочікувана помилка. Спробуйте ще раз.',
	'error.retry': 'Спробувати знову',
	'error.goHome': 'На головну'
} as const;
