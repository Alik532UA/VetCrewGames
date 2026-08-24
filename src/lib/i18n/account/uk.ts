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
	'account.signInTitle': 'Вхід',
	'account.why': 'Акаунт потрібен лише для друзів: щоб підписатися, вас мусять упізнати наступного дня. Грати можна й без нього.',
	'account.signIn': 'Увійти',
	'account.register': 'Зареєструватись',
	'account.signInHint': 'Увага: вхід у інший акаунт замінить поточного гравця. Те, що зроблено анонімно, лишиться під ним.',
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
	'account.google': 'Увійти через Google',
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
};
