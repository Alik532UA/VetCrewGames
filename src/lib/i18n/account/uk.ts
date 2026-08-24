/**
 * Рядки сторінки акаунта — ОКРЕМИЙ словник, а не частина `ui`.
 *
 * Причина заміряна, і вона та сама, що в `i18n/crew`: усі чотири мови
 * імпортуються в кореневий layout, тобто потрапляють у перший payload КОЖНОГО
 * відвідувача. Двадцять вісім рядків на мову додали до нього 2 КБ gzip і
 * перевищили бюджет layout (122 проти 120) — заради сторінки, яку відкриє
 * далеко не кожен.
 *
 * Тепер словник довантажується динамічно — див. `i18n/account/index.ts`.
 * Паритет мов стереже `src/i18n-account.test.ts`, бо `check:i18n` звіряє
 * зібрані словники й цих ключів більше не бачить.
 */
export const account: Record<string, string> = {
	'account.signInTitle': 'Вхід або реєстрація',
	'account.infoFriends': 'Друзі — це взаємна підписка, тож акаунт потрібен обом. Псевдонім і аватар задаються після входу, у профілі.',
	'account.infoSignIn': 'Вхід у вже створений акаунт відкриває саме його — з його імʼям, псевдонімом і друзями. Рахунок і рекорди з цього браузера додаються до нього; незакінчені кімнати, створені до входу, в акаунт не переїжджають.',
	'account.infoRegister': 'Реєстрація не починає гру заново. Гравець той самий, набране лишається з вами — і далі зберігається в акаунті, тобто відкривається на інших ваших пристроях.',
	'account.infoWhy': 'Без акаунта працює все: грати, створювати кімнати, набирати очки. Але рахунок і рекорди тоді живуть лише в цьому браузері — і зникнуть разом із його даними.',
	'account.infoOpen': 'Як працює акаунт',
	'account.signIn': 'Увійти',
	'account.register': 'Зареєструватись',
	'account.email': 'Пошта',
	'account.password': 'Пароль',
	'account.errorTaken': 'Ця пошта вже зайнята. Спробуйте «Увійти».',
	'account.errorWeak': 'Пароль надто простий — щонайменше шість символів.',
	'account.errorEmail': 'Пошта записана неправильно.',
	'account.errorWrong': 'Пошта або пароль не збігаються.',
	'account.errorOther': 'Не вдалося. Спробуйте ще раз.',
	'account.profileTitle': 'Профіль',
	'account.handle': 'Псевдонім',
	'account.handleHint': 'Малі латинські літери, цифри й підкреслення; від 3 до 20 символів. За ним вас знайдуть.',
	'account.handleTaken': 'Цей псевдонім уже зайнятий.',
	'account.errorNameEmpty': 'Імʼя порожнє — саме його бачать інші, тож без нього не зберегти.',
	'account.errorHandleShape': 'Псевдонім надто короткий — щонайменше три символи.',
	'account.avatarColors': 'Колір',
	'account.avatarIcons': 'Значок',
	'account.avatarColor.red': 'Червоний',
	'account.avatarColor.orange': 'Оранжевий',
	'account.avatarColor.green': 'Зелений',
	'account.avatarColor.teal': 'Бірюзовий',
	'account.avatarColor.blue': 'Синій',
	'account.avatarColor.violet': 'Фіолетовий',
	'account.avatarColor.pink': 'Рожевий',
	'account.avatarColor.slate': 'Сірий',
	'account.avatarIcon.user': 'Людина',
	'account.avatarIcon.cat': 'Кіт',
	'account.avatarIcon.dog': 'Пес',
	'account.avatarIcon.rabbit': 'Кролик',
	'account.avatarIcon.bird': 'Пташка',
	'account.avatarIcon.fish': 'Риба',
	'account.avatarIcon.snail': 'Равлик',
	'account.avatarIcon.turtle': 'Черепаха',
	'account.avatarIcon.bug': 'Жук',
	'account.avatarIcon.smile': 'Смайл',
	'account.avatarIcon.star': 'Зірка',
	'account.avatarIcon.heart': 'Серце',
	'account.avatarIcon.zap': 'Блискавка',
	'account.avatarIcon.target': 'Ціль',
	'account.save': 'Зберегти',
	'account.signOut': 'Вийти з акаунта',
	'account.findTitle': 'Знайти людей',
	'account.nobody': 'Нікого не знайдено.',
	'account.follow': 'Підписатися',
	'account.unfollow': 'Відписатися',
	'account.followingTitle': 'Мої підписки',
	'account.noFollowing': 'Ви ще ні на кого не підписані.',
	'account.mutual': 'взаємно',
	'account.passwordShow': 'Показати пароль',
	'account.passwordHide': 'Приховати пароль',
	'account.capsLock': 'Увімкнено Caps Lock',
	'account.checkLayout': 'Перевірте розкладку — введено нелатинські символи',
	'account.forgotPassword': 'Відновити пароль',
	'account.resetTitle': 'Відновлення пароля',
	'account.resetHint': 'Введіть пошту, на яку зареєстровано акаунт.',
	'account.resetSpam': 'Лист може потрапити в теку «Спам» — застосунок новий.',
	'account.resetSend': 'Надіслати лист',
	'account.resetBack': 'Повернутися до входу',
	'account.resetSent': 'Якщо така пошта є, лист уже надіслано.',
	'account.google': 'Авторизація через Google',
	'account.or': 'або',
	'account.errorGoogleOff': 'Вхід через Google ще не ввімкнений. Скористайтеся поштою.',
	/*
	 * НАЗВИ РЕГІОНІВ і рядки панелі вибору прапора.
	 *
	 * Живуть тут, а не в головному словнику, з тієї самої причини, що й решта
	 * цього файлу: головний імпортується кореневим layout усіма чотирма мовами,
	 * тобто кожні дев'ять рядків тут — це чотири×дев'ять у першому payload
	 * КОЖНОГО відвідувача, включно з тим, хто панелі вибору не відкриє ніколи.
	 *
	 * Чому назви регіонів не з `Intl.DisplayNames`, як назви країн, — виміряно й
	 * записано в `config/regions.ts`: ICU називає макрорегіони формами, що
	 * навмисно не збігаються з назвами країн («Північноамериканський регіон»),
	 * і заголовком у списку це канцелярит.
	 */
	'account.regionEurope': 'Європа',
	'account.regionAsia': 'Азія',
	'account.regionAfrica': 'Африка',
	'account.regionNorthAmerica': 'Північна Америка',
	'account.regionSouthAmerica': 'Південна Америка',
	'account.regionOceania': 'Океанія',
	'account.regionAntarctic': 'Антарктика',
	'account.countrySearch': 'Пошук країни',
	'account.countryNotFound': 'Нічого не знайдено',
	/*
	 * ПРИВАТНІСТЬ І ТАБЛИЦЯ ЛІДЕРІВ.
	 *
	 * Перемикачі приватності описані словом «база» навмисно: вони справді тримаються
	 * правилом бази, а не фільтром на екрані, і людині варто це знати — від цього
	 * залежить, чи вірити перемикачу.
	 */
	'account.privacyTitle': 'Приватність',
	'account.privacyHint': 'Ці перемикачі тримає сама база: вимкнене тут не видно нікому, а не лише на цьому екрані.',
	'account.privacy.search': 'Показувати мене в пошуку',
	'account.privacy.follow': 'Дозволяти підписуватися на мене',
	'account.privacy.board': 'Показувати мене в таблиці лідерів',
	'account.privacyOn': 'Увімкнено',
	'account.privacyOff': 'Вимкнено',
	'account.boardTitle': 'Таблиця лідерів',
	'account.boardAll': 'Усі',
	'account.boardFriends': 'Друзі',
	'account.boardEmpty': 'Порожньо: у таблицю потрапляють від {score} очок.',
	'account.boardNoFriends': 'Тут будуть друзі — взаємні підписки, у яких уже є рахунок.',
	'account.errorNotAllowed': 'Не дозволено — можливо, ця людина закрила підписки на себе.',
	// Пароль і видалення акаунта — обидві дії незворотні, обидві під підтвердженням.
	'account.securityTitle': 'Пароль і видалення',
	'account.passwordCurrent': 'Поточний пароль',
	'account.passwordNew': 'Новий пароль',
	'account.passwordChange': 'Змінити пароль',
	'account.passwordChanged': 'Пароль змінено.',
	'account.passwordGoogle': 'Вхід через Google — окремого пароля тут немає.',
	'account.deleteTitle': 'Видалити акаунт',
	'account.deleteHint': 'Видалення незворотне: зникнуть профіль, псевдонім, підписки, рахунок і рекорди.',
	'account.deletePassword': 'Пароль для підтвердження',
	'account.deleteConfirm': 'Так, видалити',
	'account.deleteCancel': 'Скасувати',
	'account.errorPasswordNeeded': 'Потрібен пароль, щоб підтвердити.',
};
