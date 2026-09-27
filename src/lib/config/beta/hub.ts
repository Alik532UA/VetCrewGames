import type { BetaTab } from '../betaChecks';

/**
 * «Грати онлайн» — хаб обох спільних ігор (рішення автора 2026-09-26).
 *
 * Тут усе, що відбувається ДО кімнати: автоматичний пошук, створення з окремим вікном
 * «хто може зайти», підключення за кодом без вибору гри й перелік кімнат обох ігор. Самі
 * партії — у вкладках «Знайди пару разом» і «Вікторина разом».
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
				uk: 'На двох пристроях лишіть увімкненими обидві гри й натисніть «Автоматичний пошук» на обох майже одночасно. За кілька секунд обидва мусять опинитися в ОДНІЙ кімнаті, і партія мусить початися сама.',
				en: 'On two devices keep both games on and press «Automatic search» on both at almost the same time. Within a few seconds both must end up in the SAME room, and the game must start by itself.'
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
				uk: 'Вимкніть на пристрої інтернет (режим польоту) і натисніть «Автоматичний пошук». Мусить одразу зʼявитися сповіщення «Немає звʼязку з сервером гри…» — а НЕ «Шукаємо гравця…» без кінця й не «спробуйте ще раз» без причини.',
				en: 'Turn the internet off on the device (flight mode) and press «Automatic search». The notification «There is no connection to the game server…» must appear at once — NOT an endless «Looking for a player…» and not a reasonless «try again».'
			},
			coverage: 'manual',
			testid: 'toast-body-text',
			negative: true
		},
		{
			id: 'hub_5',
			category: { uk: 'Створити кімнату', en: 'Creating a room' },
			text: {
				uk: 'Натисніть «Вікторина» під «Створити кімнату». Мусить відкритися окреме вікно «Хто може зайти»; виберіть «Лише друзі». На другому пристрої цієї кімнати в переліку НЕ мусить бути, а за кодом зайти мусить вийти.',
				en: 'Press «Quiz» under «Create a room». A separate «Who can join» window must open; choose «Friends only». On the second device this room must NOT be in the list, but joining with the code must work.'
			},
			coverage: 'manual',
			testid: 'online-create-quiz-btn',
			negative: true
		},
		{
			id: 'hub_6',
			category: { uk: 'Підключитися', en: 'Joining' },
			text: {
				uk: 'Введіть код кімнати «Знайди пару» й натисніть «Підключитися». Мусить відкритися саме «Знайди пару» — без вибору гри й без напису «Ця кімната для іншої гри».',
				en: 'Enter the code of a «Find a pair» room and press «Join». «Find a pair» itself must open — with no game choice and no «This room is for another game».'
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
		}
	]
};
