import type { BetaTab } from '../betaChecks';

/**
 * Акаунт, профіль і підписки.
 *
 * Тут майже все — `manual`, і причина конкретна: перевіряти треба саме те, чого
 * автотест не бачить. Правила бази вже доведені гейтом (91 випадок), програма
 * партій — тестами; лишається те, що живе між двома людьми й двома пристроями:
 * чи справді `uid` не змінився після реєстрації, чи справді взаємна підписка дає
 * кімнати друзів угорі списку.
 *
 * Перший пункт найдорожчий. Реєстрація — це `linkWithCredential`, тобто
 * привʼязка до НАЯВНОГО анонімного входу. Якщо вона колись стане
 * `createUserWithEmailAndPassword`, усе працюватиме як раніше, крім одного:
 * кімнати й підписки лишаться під старим `uid`. Це найтихіший різновид дефекту —
 * ніщо не падає, просто зникає минуле.
 *
 * ## ЧОТИРИ ШЛЯХИ ВВІЙТИ, і саме тут вони й перевіряються
 *
 * Двадцять пунктів вище прожили без жодного слова про Google і без жодного про
 * відновлення пароля — доти, доки одна редакція форми не прибрала обидві кнопки
 * разом із зайвим вибором режиму. Мережевий шар при цьому лишився цілий, тобто
 * можливості не зникли, а ВІДʼЄДНАЛИСЯ: код на місці, викликати нікому.
 *
 * Червоного не було ніде, і не могло бути: перевірка типів не скаржиться на
 * функцію без споживача, гейт коду теж, а тести форми перевіряють те, що в ній
 * є, а не те, чого немає. Людина ж це бачить за секунду — досить відкрити
 * сторінку. Тобто це рівно той різновид, для якого чеклист і існує, і його тут
 * не було.
 *
 * Звідси пункти нижче: усі чотири шляхи названі поіменно, і два з них —
 * перевірки межі, бо вибір режиму повернути легше, ніж здається.
 */
export const accountTab: BetaTab = {
	id: 'account',
	title: { uk: 'Акаунт і друзі', en: 'Account and friends' },
	routes: ['account'],
	checks: [
		{
			id: 'account_1',
			category: { uk: 'Реєстрація', en: 'Registering' },
			text: {
				uk: 'Створіть кімнату анонімно, вийдіть із неї, потім зареєструйтеся поштою. Рядок «продовжити партію» мусить лишитися: `uid` не змінився.',
				en: 'Create a room anonymously, leave it, then register with an email. The “resume the game” row must stay: the uid did not change.'
			},
			coverage: 'manual',
			// Локатор — САМА кнопка «Зареєструватись». Доти тут стояв
			// `account-submit-btn`: одна кнопка, чий підпис мінявся від
			// сегментованого вибору режиму. Вибору режиму більше немає (див.
			// `components/auth/AuthForm.svelte`), і намір тепер називає кнопка.
			testid: 'auth-register-btn'
		},
		{
			id: 'account_2',
			category: { uk: 'Реєстрація', en: 'Registering' },
			text: {
				uk: 'Спробуйте зареєструватися поштою, яка вже зайнята. Мусить бути порада натиснути «Увійти», а не загальне «не вдалося».',
				en: 'Try registering with an email that is already taken. It must advise pressing “Sign in”, not a generic failure.'
			},
			coverage: 'manual',
			testid: 'account-error-text'
		},
		{
			id: 'account_3',
			category: { uk: 'Профіль', en: 'Profile' },
			text: {
				uk: 'Введіть у псевдонім великі літери й кирилицю. Поле мусить лишити тільки малі латинські, цифри й підкреслення — одразу, під час набору.',
				en: 'Type capitals and Cyrillic into the handle. The field must keep only lower-case Latin letters, digits and underscores — right as you type.'
			},
			coverage: 'manual',
			testid: 'account-handle-input'
		},
		{
			id: 'account_4',
			category: { uk: 'Профіль', en: 'Profile' },
			text: {
				uk: 'Займіть псевдонім, який уже є в іншого. Мусить бути відмова, а профіль — лишитися незмінним.',
				en: 'Claim a handle somebody else already has. It must refuse, and the profile must stay unchanged.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-profile-error-text'
		},
		/*
			Номер НЕ за порядком навмисно: `id` — ключ прогресу у сховищі, тож
			перенумерувати наступні означало б переставити вже поставлені галочки
			на сусідні пункти. Місце в переліку — за змістом, номер — наступний
			вільний.
		*/
		{
			id: 'account_30',
			category: { uk: 'Профіль', en: 'Profile' },
			text: {
				uk: 'Натисніть «Зберегти» з порожнім або надто коротким псевдонімом. Повідомлення мусить назвати САМЕ це — «щонайменше три символи», а не «уже зайнятий».',
				en: 'Press “Save” with the handle empty or shorter than three characters. The message must say exactly that — “at least three characters”, not “already taken”.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-profile-error-text'
		},
		{
			id: 'account_5',
			category: { uk: 'Пошук і підписки', en: 'Search and follows' },
			text: {
				uk: 'Знайдіть другого гравця за початком псевдоніма (щонайменше дві літери) і підпишіться. У нього в списку підписок вас поки НЕ мусить бути.',
				en: 'Find the second player by the start of their handle (at least two letters) and follow them. You must NOT yet appear in their own following list.'
			},
			coverage: 'manual',
			testid: 'account-search-input'
		},
		{
			id: 'account_6',
			category: { uk: 'Пошук і підписки', en: 'Search and follows' },
			text: {
				uk: 'Підпишіться назустріч із другого пристрою. В обох мусить зʼявитися позначка «взаємно» — саме вона й означає друзів.',
				en: 'Follow back from the second device. The “mutual” mark must appear on both — that is exactly what friends means.'
			},
			coverage: 'manual',
			testid: 'account-following-list'
		},
		{
			id: 'account_7',
			category: { uk: 'Кімнати друзів', en: 'Friends’ rooms' },
			text: {
				uk: 'Маючи взаємну підписку, створіть відкриту кімнату на одному пристрої. На другому вона мусить стояти ОКРЕМОЮ групою «Кімнати друзів» над рештою.',
				en: 'With a mutual follow in place, create an open room on one device. On the other it must sit in a SEPARATE “Friends’ rooms” group above the rest.'
			},
			coverage: 'manual',
			testid: 'pairs-friend-rooms-list'
		},
		{
			id: 'account_8',
			category: { uk: 'Приватність', en: 'Privacy' },
			text: {
				uk: 'Вимкніть «Показувати мене в пошуку» й пошукайте себе з другого пристрою за початком псевдоніма. Вас НЕ мусить бути видно — межу тримає правило бази, а не екран.',
				en: 'Turn off “Show me in search” and look for yourself from the second device by the start of your handle. You must NOT be found — the boundary is held by the database rule, not the screen.'
			},
			negative: true,
			coverage: 'manual',
			// Локатор із `*`: три перемикачі малює один `{#each}`, тож у розмітці стоїть
			// шаблон `account-privacy-{id}-btn`. Гейт чеклиста саме так і збирає
			// динамічні локатори — підстановкою зірки (`betaChecks.test.ts`).
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_9',
			category: { uk: 'Приватність', en: 'Privacy' },
			text: {
				uk: 'Вимкніть «Дозволяти підписуватися на мене» й спробуйте підписатися з другого пристрою. Мусить бути відмова з підказкою, а не мовчазна кнопка.',
				en: 'Turn off “Let others follow me” and try to follow from the second device. It must refuse with a hint, not sit there silently.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_10',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Наберіть щонайменше 50 очок і відкрийте акаунт: ваш рядок мусить зʼявитися в таблиці з тим самим імʼям, аватаром і прапором, що в профілі.',
				en: 'Score at least 50 points and open the account: your row must appear on the board with the same name, avatar and flag as in the profile.'
			},
			coverage: 'manual',
			testid: 'account-board-list'
		},
		{
			id: 'account_11',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Вимкніть «Показувати мене в таблиці лідерів». Ваш рядок мусить зникнути й НЕ повернутися після наступної партії.',
				en: 'Turn off “Show me on the leaderboard”. Your row must disappear and must NOT come back after the next game.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-privacy-*-btn'
		},
		{
			id: 'account_12',
			category: { uk: 'Таблиця лідерів', en: 'Leaderboard' },
			text: {
				uk: 'Маючи взаємну підписку, відкрийте вкладку «Друзі» в таблиці. Там мусять бути лише взаємні підписки — односторонньої там бути не мусить.',
				en: 'With a mutual follow in place, open the “Friends” tab on the board. Only mutual follows may be there — a one-way follow must not.'
			},
			coverage: 'manual',
			testid: 'account-board-friends-btn'
		},
		{
			id: 'account_13',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Наберіть очок анонімно, потім зареєструйтеся. Рахунок у шапці мусить лишитися тим самим: анонімний доробок зливається з акаунтом.',
				en: 'Score some points anonymously, then register. The score in the header must stay the same: the anonymous progress merges into the account.'
			},
			coverage: 'manual',
			testid: 'auth-register-btn'
		},
		{
			id: 'account_14',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Увійдіть тим самим акаунтом на другому пристрої. Рахунок і рекорди мусять приїхати; награне на першому — доїхати, поки другий відкритий.',
				en: 'Sign in with the same account on the second device. The score and records must arrive; what you play on the first must reach the second while it is open.'
			},
			coverage: 'manual',
			testid: 'auth-login-btn'
		},
		{
			id: 'account_15',
			category: { uk: 'Рахунок в акаунті', en: 'Score in the account' },
			text: {
				uk: 'Вийдіть з акаунта. Рахунок у шапці мусить стати нулем, а заповідник — початися заново: інакше рахунок можна було б переписати в новий акаунт.',
				en: 'Sign out. The score in the header must drop to zero and the reserve must start over: otherwise a score could be copied into a new account.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'account-leave-btn'
		},
		{
			id: 'account_16',
			category: { uk: 'Пароль', en: 'Password' },
			text: {
				uk: 'Змініть пароль, вийдіть і зайдіть новим. Старий пароль після цього НЕ мусить пускати.',
				en: 'Change the password, sign out and sign in with the new one. The old password must NOT work afterwards.'
			},
			coverage: 'manual',
			testid: 'account-password-change-btn'
		},
		{
			id: 'account_17',
			category: { uk: 'Видалення акаунта', en: 'Deleting the account' },
			text: {
				uk: 'Видаліть акаунт із другого пристрою, де ви були в підписках. У першого гравця ваш рядок мусить зникнути з підписок і з таблиці лідерів.',
				en: 'Delete the account from the second device, where you were in the follows. On the first player your row must disappear from the follows and from the leaderboard.'
			},
			coverage: 'manual',
			testid: 'account-delete-confirm-btn'
		},
		{
			id: 'account_18',
			category: { uk: 'Видалення акаунта', en: 'Deleting the account' },
			text: {
				uk: 'Після видалення спробуйте ввійти тією самою поштою. Мусить бути відмова, а сайт — лишитися робочим: після видалення одразу вертається анонімний вхід.',
				en: 'After deleting, try to sign in with the same email. It must refuse, and the site must stay working: deleting immediately returns to anonymous.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'auth-login-btn'
		},
		{
			id: 'account_19',
			category: { uk: 'Видалення акаунта', en: 'Deleting the account' },
			text: {
				uk: 'Звільнений псевдонім мусить бути знову вільним: займіть його з іншого акаунта.',
				en: 'The released handle must be free again: claim it from another account.'
			},
			coverage: 'manual',
			testid: 'account-handle-input'
		},
		{
			id: 'account_20',
			category: { uk: 'Вихід', en: 'Signing out' },
			text: {
				uk: 'Вийдіть з акаунта. Сайт мусить лишитися робочим — перелік кімнат читається, кімнату можна створити: вихід одразу вертає анонімний вхід.',
				en: 'Sign out. The site must stay working — the room list reads, a room can be created: signing out immediately returns to anonymous.'
			},
			coverage: 'manual',
			testid: 'account-leave-btn'
		},
		{
			id: 'account_21',
			category: { uk: 'Чотири шляхи ввійти', en: 'Four ways in' },
			text: {
				uk: 'Відкрийте акаунт анонімним. На екрані мусять бути СІМ речей: кнопка входу через Google, слово «або», поле пошти, поле пароля зі значком ока, рядок «Відновити пароль», «Увійти» й «Зареєструватись».',
				en: 'Open the account page as an anonymous player. SEVEN things must be on screen: the Google sign-in button, the word “or”, the email field, the password field with an eye icon, a “reset password” line, “Sign in” and “Register”.'
			},
			coverage: 'manual',
			testid: 'auth-google-btn'
		},
		{
			id: 'account_22',
			category: { uk: 'Чотири шляхи ввійти', en: 'Four ways in' },
			text: {
				uk: 'Приміряйте оком ширину й висоту: кнопка Google, обидва поля й обидві кнопки мусять бути однакової міри. Жодна не мусить бути вужчою чи вищою за сусідню.',
				en: 'Compare width and height by eye: the Google button, both fields and both buttons must be the same size. None may be narrower or taller than its neighbour.'
			},
			coverage: 'manual',
			testid: 'auth-register-btn'
		},
		{
			id: 'account_23',
			category: { uk: 'Чотири шляхи ввійти', en: 'Four ways in' },
			text: {
				uk: 'Над полями НЕ мусить бути вибору «Що зробити: створити акаунт / зайти в наявний». Намір називає сама кнопка, і кнопок дві.',
				en: 'Above the fields there must be NO “what to do: create an account / sign in to an existing one” choice. The button itself names the intent, and there are two buttons.'
			},
			/*
			 * ПЕРЕВІРКА МЕЖІ. Вибір режиму виглядає корисним — поля однакові,
			 * наслідки протилежні, — і саме тому вертається легко. Автотест його
			 * відсутності не судить: у формі просто не було б одного елемента.
			 */
			negative: true,
			coverage: 'manual',
			testid: 'auth-login-btn'
		},
		{
			id: 'account_24',
			category: { uk: 'Відновлення пароля', en: 'Resetting the password' },
			text: {
				uk: 'Натисніть «Відновити пароль» і надішліть лист на пошту, якої в грі точно немає. Повідомлення мусить бути ТЕ САМЕ, що для наявної пошти: інакше сторонній перебирав би адреси й дізнавався, хто зареєстрований.',
				en: 'Press the reset link and send a letter to an email that certainly is not in the game. The message must be THE SAME as for an existing email: otherwise a stranger could try addresses and learn who is registered.'
			},
			coverage: 'manual',
			testid: 'auth-forgot-btn'
		},
		{
			id: 'account_25',
			category: { uk: 'Відновлення пароля', en: 'Resetting the password' },
			text: {
				uk: 'На екрані відновлення поля пароля бути НЕ мусить — його ж і забули. Мусить бути лише пошта, попередження про теку «Спам» і шлях назад до входу.',
				en: 'On the reset screen there must be NO password field — that is the thing that was forgotten. Only the email, a warning about the spam folder and a way back to signing in.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'reset-submit-btn'
		},
		{
			id: 'account_26',
			category: { uk: 'Значки в полі пароля', en: 'Icons inside the password field' },
			text: {
				uk: 'На телефоні торкніться поля пароля пальцем. Значки в ньому мусять стати повністю видимими й ЛИШИТИСЯ такими, доки ви в полі, а не пригаснути назад після дотику.',
				en: 'On a phone, touch the password field with a finger. The icons inside it must become fully visible and STAY that way while you are in the field, not dim back down after the touch.'
			},
			coverage: 'manual',
			testid: 'account-password-toggle-btn'
		},
		{
			id: 'account_27',
			category: { uk: 'Значки в полі пароля', en: 'Icons inside the password field' },
			text: {
				uk: 'На комп’ютері наведіть курсор на поле пароля й, не забираючи його, дійдіть до значка ока клавішею табуляції. Значок у фокусі мусить бути повністю видимим, а не напівпрозорим.',
				en: 'On a desktop, hover the pointer over the password field and, without moving it away, reach the eye icon with the tab key. The focused icon must be fully visible, not semi-transparent.'
			},
			coverage: 'manual',
			testid: 'account-password-toggle-btn'
		},
		{
			id: 'account_28',
			category: { uk: 'Аватарка', en: 'Avatar' },
			text: {
				uk: 'Виберіть значок і колір аватарки, збережіть профіль і зайдіть у кімнату з другого пристрою. Ваша аватарка мусить бути видна в переліку гравців поруч із іменем, тим самим значком і кольором.',
				en: 'Pick an avatar icon and colour, save the profile and join a room from another device. Your avatar must be visible in the player list next to your name, with the same icon and colour.'
			},
			coverage: 'manual',
			testid: 'account-avatar-icon-*-radio'
		},
		{
			id: 'account_31',
			category: { uk: 'Аватарка', en: 'Avatar' },
			text: {
				uk: 'Лишіть аватарку типовою (людина на бірюзовому) і зайдіть у спільну партію. Між прапором та іменем у переліку гравців плитки бути НЕ мусить — вона зʼявляється лише тоді, коли аватарка відрізняється від типової. Так само в шапці: типова аватарка лишає звичайний значок акаунта.',
				en: 'Leave the avatar at its default (the person on teal) and join a shared game. There must be NO tile between the flag and the name in the player list — it appears only when the avatar differs from the default. Same in the header: a default avatar keeps the plain account icon.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-scores-list'
		},
		{
			id: 'account_32',
			category: { uk: 'Імʼя в грі', en: 'Name in the game' },
			text: {
				uk: 'Змініть імʼя в профілі, збережіть і відкрийте сторінку спільної гри: у полі «Як вас звати?» мусить стояти те саме імʼя. Потім змініть його там, зайдіть у кімнату й вернітесь у профіль — імʼя мусить бути новим і тут.',
				en: 'Change the name in the profile, save it and open the shared-game page: the “What is your name?” field must show the same name. Then change it there, join a room and go back to the profile — the name must be the new one here too.'
			},
			coverage: 'manual',
			testid: 'pairs-name-input'
		},
		{
			id: 'account_33',
			category: { uk: 'Імʼя в грі', en: 'Name in the game' },
			text: {
				uk: 'На сторінці спільної гри почніть друкувати своє імʼя й не спиняйтеся кілька секунд. Поле НЕ мусить перескочити на імʼя з профілю посеред набору — підтягується воно лише в те, чого ви не торкалися.',
				en: 'On the shared-game page start typing your name and keep typing for a few seconds. The field must NOT jump to the profile name mid-typing — it is pulled in only where you have not touched it.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'pairs-name-input'
		},
		{
			id: 'account_29',
			category: { uk: 'Вибір країни', en: 'Choosing a country' },
			text: {
				uk: 'На телефоні відкрийте вибір країни. Перелік мусить прокручуватися пальцем, а назва країни під пальцем — читатися: у вузькому вікні колонка одна, і це нормально.',
				en: 'On a phone, open the country picker. The list must scroll with a finger and the country under it must stay readable: in a narrow window there is one column, and that is fine.'
			},
			coverage: 'manual',
			testid: 'account-country-menu'
		}
	]
};
