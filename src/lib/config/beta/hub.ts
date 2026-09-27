import type { BetaTab } from '../betaChecks';

/**
 * «Грати онлайн» — хаб обох спільних ігор (рішення автора 2026-09-26).
 *
 * Тут усе, що відбувається ДО кімнати: три дороги — автоматичний пошук, створення (гра,
 * тоді «хто може зайти») і підключення за кодом без вибору гри, кожна у своєму вікні
 * (рішення автора 2026-09-27), — і перелік кімнат обох ігор. Самі партії — у вкладках
 * «Знайди пару разом» і «Вікторина разом».
 *
 * Головне тут вимагає двох пристроїв: зустріч двох шукачів, які натиснули майже разом, —
 * це мережа й час, а тест доводить лише правила зустрічі.
 */
export const hubTab: BetaTab = {
	id: 'hub',
	title: { uk: 'Грати онлайн', en: 'Play online' },
	routes: ['online'],
	checks: [
		{
			id: 'hub_1',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'На двох пристроях відкрийте «Автоматичний пошук», лишіть увімкненими обидві гри й натисніть «Шукати» на обох майже одночасно. За кілька секунд обидва мусять опинитися в ОДНІЙ кімнаті, і партія мусить початися сама.',
				en: 'On two devices open «Automatic search», keep both games on and press «Search» on both at almost the same time. Within a few seconds both must end up in the SAME room, and the game must start by itself.'
			},
			coverage: 'manual',
			testid: 'online-search-btn'
		},
		{
			id: 'hub_2',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'На першому пристрої вимкніть у пошуку «Знайди пару» й почніть пошук; на другому лишіть обидві гри й почніть пошук. Обидва мусять опинитися в кімнаті вікторини.',
				en: 'On the first device switch «Find a pair» off in the search and start searching; on the second keep both games on and start searching. Both must end up in a quiz room.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/autoSearch.svelte.test.ts',
			testid: 'online-search-*-toggle'
		},
		{
			id: 'hub_3',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'Спробуйте вимкнути в пошуку обидві гри. Остання ввімкнена НЕ мусить вимикатися, а підказка при наведенні — казати чому.',
				en: 'Try to switch both games off in the search. The last one that is on must NOT switch off, and the hover hint must say why.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/autoSearch.svelte.test.ts',
			testid: 'online-search-*-toggle',
			negative: true
		},
		{
			id: 'hub_4',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'Почніть пошук на одному пристрої й натисніть «Скасувати». Тоді почніть пошук на другому: він НЕ мусить знайти перший — той уже не шукає.',
				en: 'Start a search on one device and press «Cancel». Then start a search on the second: it must NOT find the first one — that one no longer searches.'
			},
			coverage: 'manual',
			testid: 'online-search-cancel-btn',
			negative: true
		},
		{
			// Прохання автора 2026-09-27: збій пошуку називає причину, а не «спробуйте ще раз».
			id: 'hub_8',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'Вимкніть на пристрої інтернет (режим польоту), відкрийте «Автоматичний пошук» і натисніть «Шукати». Мусить одразу зʼявитися сповіщення «Немає звʼязку з сервером гри…» — а НЕ «Шукаємо гравця…» без кінця й не «спробуйте ще раз» без причини.',
				en: 'Turn the internet off on the device (flight mode), open «Automatic search» and press «Search». The notification «There is no connection to the game server…» must appear at once — NOT an endless «Looking for a player…» and not a reasonless «try again».'
			},
			coverage: 'manual',
			testid: 'toast-body-text',
			negative: true
		},
		{
			id: 'hub_5',
			category: { uk: 'Створити кімнату', en: 'Creating a room' },
			text: {
				uk: 'Натисніть «Створити кімнату» й виберіть «Вікторина». У тому самому вікні мусить зʼявитися питання «Хто може зайти»; виберіть «Лише друзі». На другому пристрої цієї кімнати в переліку НЕ мусить бути, а за кодом зайти мусить вийти.',
				en: 'Press «Create a room» and choose «Quiz». The same window must then ask «Who can join»; choose «Friends only». On the second device this room must NOT be in the list, but joining with the code must work.'
			},
			coverage: 'manual',
			testid: 'online-create-quiz-btn',
			negative: true
		},
		{
			id: 'hub_6',
			category: { uk: 'Підключитися', en: 'Joining' },
			text: {
				uk: 'Натисніть «Підключитися», введіть код кімнати «Знайди пару» й натисніть «Підключитися» у вікні. Мусить відкритися саме «Знайди пару» — без вибору гри й без напису «Ця кімната для іншої гри».',
				en: 'Press «Join», enter the code of a «Find a pair» room and press «Join» in the window. «Find a pair» itself must open — with no game choice and no «That room is for a different game.»'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/onlineHub.svelte.test.ts',
			testid: 'online-join-btn'
		},
		{
			id: 'hub_7',
			category: { uk: 'Перелік кімнат', en: 'The room list' },
			text: {
				uk: 'З двох інших пристроїв створіть по одній кімнаті «Для всіх» — вікторини й «Знайди пару». У переліку мусять бути обидві, і в кожному рядку — назва гри.',
				en: 'From two other devices create one «Everyone» room each — a quiz and a «Find a pair». Both must be in the list, each row naming its game.'
			},
			coverage: 'manual',
			testid: 'online-room-*-game-text'
		},
		{
			// Рішення автора 2026-09-27, 6-A: «вікно з вибором ігор, які запамʼятовуються».
			id: 'hub_9',
			category: { uk: 'Автоматичний пошук', en: 'Automatic search' },
			text: {
				uk: 'Відкрийте «Автоматичний пошук», вимкніть «Знайди пару», натисніть «Назад» і перезавантажте сторінку. Відкрийте пошук знову: «Знайди пару» мусить лишитися вимкненою.',
				en: 'Open «Automatic search», switch «Find a pair» off, press «Back» and reload the page. Open the search again: «Find a pair» must still be off.'
			},
			coverage: 'covered',
			test: 'tests/hub-windows.spec.ts',
			testid: 'online-search-*-toggle'
		},
		{
			id: 'hub_10',
			category: { uk: 'Три дороги', en: 'Three ways in' },
			text: {
				uk: 'Відкрийте кожне з трьох вікон самою клавіатурою (Tab і Enter). Фокус мусить стати у вікні — у «Підключитися» одразу в поле коду, — а «Назад» мусить повернути його на кнопку, що відкрила вікно, а НЕ на початок сторінки.',
				en: 'Open each of the three windows with the keyboard alone (Tab and Enter). Focus must land in the window — in «Join» right in the code field — and «Back» must return it to the button that opened the window, NOT to the start of the page.'
			},
			coverage: 'covered',
			test: 'tests/hub-windows.spec.ts',
			testid: 'online-*-open-btn',
			negative: true
		},
		{
			/*
			 * ВЛАСНА ЦИФРОВА КЛАВІАТУРА (прохання автора 2026-09-27). Мишу на компʼютері
			 * перевіряє `tests/hub-windows.spec.ts`; те, що системна клавіатура телефона
			 * справді не вилазить, у настільному браузері не побачити — лише на телефоні.
			 */
			id: 'hub_11',
			category: { uk: 'Підключитися', en: 'Joining' },
			text: {
				uk: 'На телефоні натисніть «Підключитися» й торкніться поля коду. Системна клавіатура НЕ мусить зʼявитися; цифри мусять набиратися клавішами вікна, а клавіша стирання — прибирати останню.',
				en: 'On a phone press «Join» and tap the code field. The system keyboard must NOT appear; digits must be typed with the window keys, and the erase key must remove the last one.'
			},
			coverage: 'manual',
			testid: 'online-key-*-btn',
			negative: true
		},
		{
			/*
			 * ПЛИТКИ, А НЕ РЯДКИ (скарга автора 2026-09-27: «великі відступи і не великі
			 * кнопки»). Висоту плиток і поля вікна міряє e2e `hub-windows`.
			 */
			id: 'hub_12',
			category: { uk: 'Створити кімнату', en: 'Create a room' },
			text: {
				uk: 'На телефоні натисніть «Створити кімнату». І гра, і «Хто може зайти» мусять вибиратися ВЕЛИКИМИ плитками зі значком — такими самими, як у меню «Грати», — а над заголовком вікна й під «Назад» не мусить стояти порожніх смуг.',
				en: 'On a phone press «Create a room». Both the game and «Who can join» must be picked with BIG tiles with an icon — the same as in the «Play» menu — and there must be no empty bands above the window title or under «Back».'
			},
			coverage: 'covered',
			test: 'tests/hub-windows.spec.ts',
			testid: 'online-create-quiz-btn'
		},
		{
			/*
			 * ДО 90% ЕКРАНА Й ПОСЕРЕДИНІ (правило автора 2026-09-27: «елементи разом на 90%
			 * екрану», «всі меню по центру»). П'ять розмірів екрана міряє e2e `hub-windows`.
			 */
			id: 'hub_13',
			category: { uk: 'Вікна хабу', en: 'Hub windows' },
			text: {
				uk: 'Відкрийте по черзі «Автоматичний пошук», «Створити кімнату» й «Підключитися» на невеликому телефоні й на компʼютері. Кожне вікно мусить стояти посередині екрана й уміщатися цілком — «Назад» видно без прокрутки, — а не займати половину екрана чи виходити за його край.',
				en: 'Open «Automatic search», «Create a room» and «Join» in turn on a small phone and on a computer. Each window must sit in the middle of the screen and fit whole — «Back» visible without scrolling — rather than taking half the screen or running past its edge.'
			},
			coverage: 'covered',
			test: 'tests/hub-windows.spec.ts',
			testid: 'online-search-panel'
		},
		{
			/*
			 * ДВА РЯДКИ Й ПЛИТКИ ПОШУКУ (прохання автора 2026-09-27). Розкладку міряє e2e
			 * `hub-windows`; руками — чи це читається як вибір і як один рядок підпису.
			 */
			id: 'hub_14',
			category: { uk: 'Вікна хабу', en: 'Hub windows' },
			text: {
				uk: 'На телефоні подивіться на «Як вас звати?»: прапор, аватарка й підпис мусять стояти ОДНИМ рядком, а поле імені з кубиком — другим. Відкрийте «Автоматичний пошук»: ігри мусять вибиратися великими плитками зі значком, а ввімкнену гру видно за рамкою й галочкою.',
				en: 'On a phone look at «What’s your name?»: the flag, the avatar and the label must stand on ONE line, and the name field with the dice on the second. Open «Automatic search»: the games must be picked with big tiles with an icon, and the game that is on is shown by a ring and a check mark.'
			},
			coverage: 'manual',
			testid: 'online-search-*-toggle'
		}
	]
};
