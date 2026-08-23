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
	'menu.reserve': 'Заповідник',
	'menu.quiz': 'Вікторина',
	'quiz.gamesInRoom': 'Ігри в кімнаті',
	'quiz.gamesLast': 'Хоч одна гра мусить лишитися',
	'quiz.otherGame': 'Ця кімната для іншої гри.',
	'quiz.waitingOthers': 'Ви закінчили. Чекаємо на решту.',
	'quiz.finished': 'готово',
	'quiz.unknownGame': 'Ця гра з новішої версії. Оновіть сторінку.',
	'quiz.skipStep': 'Пропустити',

	// Підписи трьох пунктів, однакових для «Вікторини» й «Знайди пару»: різниця
	// лише в тому, куди веде «Грати».
	'menu.play': 'Грати',
	'menu.playOnline': 'Грати онлайн',

	// Спільна партія «Знайди пару»: лобі, роль, черга.
	'pairs.over': 'Партія скінчилася',
	'pairs.won': 'Перемога',
	'pairs.draw': 'Нічия',
	'pairs.rematch': 'Зіграти ще',
	'pairs.closeRoom': 'Закрити кімнату',
	'pairs.actionFailed': 'Сервер не дозволив цю дію.',
	'pairs.createRoom': 'Створити кімнату',
	'pairs.joinRoom': 'Зайти за кодом',
	'pairs.roomCode': 'Код кімнати',
	'pairs.qrHint': 'Наведіть камеру, щоб зайти',
	'pairs.qrLabel': 'QR-код на цю кімнату',
	'pairs.yourName': 'Як вас звати?',
	'pairs.rolePlayer': 'Гравець',
	'pairs.roleSpectator': 'Глядач',
	'pairs.start': 'Почати партію',
	'pairs.startWhenReady': 'Натисніть «Почати партію», коли будете готові.',
	'pairs.needPlayers': 'Потрібні щонайменше двоє гравців.',
	'pairs.waitingHost': 'Чекаємо, доки лідер почне.',
	'pairs.yourTurn': 'Ваш хід',
	'pairs.waitingFor': 'Хід',
	'pairs.noRoom': 'Такої кімнати немає.',
	'pairs.oldVersion': 'Гра оновилася. Перезавантажте сторінку — і ви, і суперник.',
	'pairs.rulesMissing': 'Спільна гра ще не ввімкнена на сервері.',
	'pairs.netFailed': 'Не вдалося зайти в кімнату. Спробуйте ще раз.',
	'pairs.opponentGone': 'Суперник довго не грає.',
	'pairs.takeTurn': 'Забрати хід',
	'pairs.away': 'немає зʼязку',
	'pairs.awayYourTurn': 'Зараз ваш хід — грайте далі.',
	'pairs.yieldIn': 'Забрати хід можна за',
	'pairs.endMatch': 'Завершити партію',
	'pairs.endedEarly': 'Партію завершено, не догравши: суперник не повернувся.',
	'pairs.resume': 'Продовжити партію',
	'pairs.resumeHint': 'Партія вже йде, і ви в ній.',
	'pairs.resumeOne': 'Вернутися',
	'pairs.otherName': 'Інше імʼя',
	'pairs.nickname': 'Нікнейм',
	'pairs.country': 'Прапор',
	'pairs.countryNone': 'Без прапора',
	'pairs.you': 'ви',
	'pairs.myRole': 'Ваша роль',
	'pairs.visibility': 'Хто може зайти',
	'pairs.friendsOnly': 'Лише друзі',
	'pairs.everyone': 'Для всіх',
	'pairs.visibilityHint': 'Лише друзі — кімнати немає в списку, зайти можна тільки за кодом, який ви комусь надішлете. Для всіх — кімната зʼявиться в списку в кожного.',
	'pairs.rooms': 'Кімнати',
	'pairs.noRooms': 'Відкритих кімнат поки немає',
	'pairs.noRoomsHint': 'Створіть свою — і вона зʼявиться тут у кожного, хто відкрив цю сторінку.',
	'pairs.players': 'Гравців',
	'pairs.enter': 'Зайти',
	'pairs.quickGame': 'Швидка гра',
	'pairs.quickGameHint': 'Зайдемо у вільну кімнату, а якщо таких немає — створимо нову, відкриту.',
	'pairs.shownNewest': 'Показано найновіші — є ще',
	'pairs.startingIn': 'Починаємо за',
	'pairs.seconds': 'с',
	'pairs.roomsUnavailable': 'Перелік кімнат недоступний. Зайти за кодом і створити кімнату можна й без нього.',

	// Імена команди для спільної партії. ЦІЛІ фрази: складання прикметника з
	// Імена для спільної партії: прикметник + тварина. Тварини — ті самі слова,
	// що на картках (`animals.ts`). Фрази ЦІЛІ, бо узгодження роду різне в трьох
	// мовах із чотирьох — див. `config/crewNames.ts`.
	'menu.comingSoon': 'Ще в розробці',
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
	'memory.resized': 'Розмір екрана змінився. Розкладка лишилася тою, з якою починалася партія.',
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
	'common.maxScore': 'Максимум у цій партії',
	'common.paste': 'Вставити',
	'common.copy': 'Скопіювати',
	'common.clear': 'Стерти',
	'common.copied': 'Скопійовано',
	'common.pasteDenied': 'Браузер не дав прочитати буфер обміну. Вставте вручну: Ctrl+V.',
	'common.copyDenied': 'Браузер не дав записати в буфер обміну. Скопіюйте вручну: Ctrl+C.',

	// Підписи кнопок-значків у шапці. Це не текст на екрані, а те, що читає
	// скрінрідер — і саме тому воно теж має бути перекладене: інакше
	// україномовний користувач чує англійські команди (ACCESSIBILITY-v8 § 4.1).
	// Дієслово-дія, а не назва стану: «Змінити тему», не «Тема».
	'header.toggleTheme': 'Змінити тему',
	'header.toggleLocale': 'Змінити мову',
	'header.toggleFullscreen': 'На весь екран',
	'header.exitFullscreen': 'Вийти з повноекранного режиму',
	'header.score': 'Загальний рахунок',

	// Вимикач одиночних літерних скорочень (WCAG SC 2.1.4, рівень A).
	// Підпис називає ДІЮ, яку виконає натиск, а не поточний стан: стан читалка
	// бере з `aria-pressed`, і дублювати його текстом означало б сказати людині
	// протилежне до того, що станеться.
	'header.shortcutsOn': 'Вимкнути гарячі клавіші',
	'header.shortcutsOff': 'Увімкнути гарячі клавіші',

	// Назви тем — уже ТЕКСТ на екрані, а не підпис для читалки: вони стоять
	// пунктами списку. Названі тим, що видно, а не значенням у сховищі:
	// «orange-purple» нікому нічого не каже, а «Осіння» каже все.
	'theme.dark': 'Темна',
	'theme.light-green': 'Світло-зелена',
	'theme.winter': 'Зимова',
	'theme.orange-purple': 'Осіння',

	// Кнопка збору логів. У продакшні вмикається debug-режимом.
	'debug.copyLogs': 'Скопіювати звіт логів',

	// Errors
	'error.title': 'Щось пішло не так',
	'error.message': 'Сталася неочікувана помилка. Спробуйте ще раз.',
	'error.retry': 'Спробувати знову',
	'error.goHome': 'На головну',
	// Сторінка чеклиста бета-тестування. Тексти САМИХ пунктів тут не живуть — вони
	// в `src/lib/config/beta/` двома мовами, бо їх десятки й вони змінюються
	// окремим циклом від інтерфейсу.
	'beta.title': 'Бета-тестування',
	'beta.intro':
		'Список того, що варто перевірити. Позначайте пункти, а наприкінці скопіюйте звіт і надішліть його нам.',
	'beta.progress': 'Позначено на цій версії',
	'beta.vote.none': 'Не перевірено',
	'beta.vote.fail': 'Не працює',
	'beta.vote.weird': 'Працює, але дивно',
	'beta.vote.ok': 'Працює',
	'beta.coverage.manual': 'Тільки людина',
	'beta.coverage.testable': 'Автотесту ще немає',
	'beta.coverage.covered': 'Покрито автотестом',
	'beta.coverage.manualHint': 'Цього не перевіряє жодна машина — тут потрібне саме ваше око.',
	'beta.coverage.testableHint': 'Це можна перевіряти автоматично, але такої перевірки ще немає.',
	'beta.coverage.coveredHint':
		'Тут уже дивиться автотест. Якщо ви знайдете помилку — значить, помиляється тест, і це для нас особливо цінно.',
	'beta.stale': 'позначено на іншій версії',
	'beta.copy': 'Скопіювати звіт',
	'beta.copied': 'Звіт у буфері',
	'beta.clear': 'Стерти позначки',
	'beta.copyFailed':
		'Не вдалося скопіювати самому браузеру. Виділіть текст нижче й скопіюйте вручну.',
	'beta.rulesTitle': 'Правила доступу до бази',
	'beta.rulesCheck': 'Перевірити',
	'beta.rulesChecking': 'Питаю базу…',
	'beta.rulesFresh': 'Викладена редакція збігається з цією збіркою',
	'beta.rulesStale': 'У базі ІНША редакція правил — цю збірку ще не викладено',
	'beta.rulesUnknown': 'Не вдалося дізнатися: немає мережі або база недоступна',
	'pairs.startMode': 'Початок партії',
	'pairs.modeAuto': 'Автостарт',
	'pairs.modeConfirm': 'Підтвердження готовності',
	'pairs.modeAutoHint': 'Партія почнеться сама, щойно зберуться двоє гравців.',
	'pairs.modeConfirmHint': 'Партія чекає, доки лідер натисне «Почати партію».',
	'pairs.rulesStale': 'Сервер не пускає в кімнату. Найчастіша причина — правила бази старіші за цю версію гри.',
} as const;
