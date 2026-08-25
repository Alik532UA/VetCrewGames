import type { BetaTab } from '../betaChecks';

/**
 * Спільна вікторина — і майже кожен пункт тут вимагає ДВОХ пристроїв.
 *
 * Причина в самій моделі партії: усі відповідають одночасно, кожен на своєму
 * екрані, а спільні лише програма й рахунок. Автотест доводить, що програма
 * виводиться з зерна однаково й що рахунок не подвоюється, — але не доводить, що
 * двоє на різних телефонах справді побачили ті самі питання.
 *
 * Тому перший пункт тут головний: він перевіряє саме те, на чому тримається все
 * інше. Якщо питання різні, спільної партії немає, хоч би табло й рахувало
 * правильно.
 *
 * ## РАУНД — одиниця партії, і два пункти тут через це вже відставали
 *
 * Гра синхронна: раунд починається одним ходом господаря, від цієї серверної
 * позначки кожен рахує свій дедлайн, і ніхто не йде далі за інших. Звідси все
 * інше: смуга таймера в двох гравців в одному місці, під раундом видно ЛИШЕ хто
 * відповів (без очок), очки зʼявляються за секунду після останньої відповіді, а
 * екран підсумків стоїть чотири секунди й іде сам.
 *
 * Доти тут стояли два пункти зі старої, несинхронної моделі: один просив
 * «закінчити програму раніше за суперника» й побачити «Ви закінчили, чекаємо на
 * решту», другий — побачити очки в табло під час гри. Обидва стани зникли разом
 * із переписуванням, і разом із ними лишився мертвий рядок словника
 * `quiz.waitingOthers` у чотирьох мовах — тобто картина була несуперечлива:
 * пункт просить, рядок є, стану немає. Тестувальник поставив би «не працює»
 * справному коду.
 *
 * Це той самий різновид, що вже коштував цьому чеклисту пункта про тему: пункт
 * пишеться з того, що малює екран, а не з того, що лишилося в даних.
 */
export const quizOnlineTab: BetaTab = {
	id: 'quizonline',
	title: { uk: 'Вікторина разом', en: 'Quiz together' },
	routes: ['quiz/online'],
	checks: [
		{
			id: 'quizonline_1',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Створіть кімнату на одному пристрої й зайдіть із другого. Почніть партію: обидва мусять побачити ОДНЕ І ТЕ САМЕ перше питання, і далі ті самі в тому самому порядку.',
				en: 'Create a room on one device and join from another. Start the game: both must see the SAME first question, and the same ones after it in the same order.'
			},
			coverage: 'manual',
			testid: 'quiz-board-panel'
		},
		{
			id: 'quizonline_2',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Вимкніть одну гру в наборі перед створенням кімнати. У партії мусять попадатися лише ввімкнені ігри.',
				en: 'Turn one game off in the set before creating the room. Only the games left on may come up during the match.'
			},
			coverage: 'manual',
			testid: 'quiz-board-panel'
		},
		{
			id: 'quizonline_3',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Спробуйте вимкнути ВСІ ігри. Остання ввімкнена не мусить вимикатися — партія без питань неможлива.',
				en: 'Try turning ALL games off. The last one left on must not switch off — a match with no questions is impossible.'
			},
			/*
			 * ПЕРЕВІРКА МЕЖІ, і саме тому вона позначена.
			 *
			 * Межа, що перестала діяти, виглядає точно як межа, що діє: набір
			 * порожніє, партія все одно починається (порожнеча трактується як
			 * «усі»), і людина отримує протилежне тому, що просила. Інваріант
			 * чеклиста вимагає хоч одного такого пункта на вкладку.
			 */
			negative: true,
			coverage: 'manual'
		},
		{
			id: 'quizonline_4',
			category: { uk: 'Табло', en: 'Scoreboard' },
			text: {
				uk: 'Відповідайте швидше за суперника. Коли всі відповіли, за секунду в табло мусять зʼявитися очки, і у швидшого їх більше; поряд рядків — за очками, однаково на ОБОХ пристроях.',
				en: 'Answer faster than the opponent. Once everyone has answered, points must appear in the scoreboard a second later, and the faster player has more; rows are ordered by points, identically on BOTH devices.'
			},
			coverage: 'manual',
			testid: 'quiz-scores-list'
		},
		{
			id: 'quizonline_5',
			category: { uk: 'Табло', en: 'Scoreboard' },
			text: {
				uk: 'Відповідайте, поки суперник не відповідає. Дошка мусить зникнути й змінитися рядком «Відповідь прийнято» — далі ви не йдете, доки не відповіли всі або не вийшов час.',
				en: 'Answer while the opponent does not. The board must disappear and give way to an “answer accepted” line — you do not move on until everyone answers or the time runs out.'
			},
			coverage: 'manual',
			testid: 'quiz-answered-text'
		},
		{
			id: 'quizonline_6',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Спробуйте зайти в кімнату «Знайди пару» за її кодом із вікторини. Мусить бути відмова «ця кімната для іншої гри», а не порожній екран.',
				en: 'Try joining a Memory room by its code from the quiz. It must refuse with “that room is for a different game”, not show an empty screen.'
			},
			coverage: 'manual'
		},
		{
			id: 'quizonline_7',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Поверніться назад із партії кнопкою браузера. Мусить відкритися форма входу з переліком кімнат, а не меню «Вікторина».',
				en: 'Go back from the match with the browser button. The entry form with the room list must open, not the Quiz menu.'
			},
			coverage: 'manual'
		},
		{
			id: 'quizonline_8',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'Дивіться на смугу під питанням на обох пристроях одночасно. Вона мусить коротшати й доходити до кінця в ОБОХ в один і той самий момент — раунд спільний, а не в кожного свій.',
				en: 'Watch the bar under the question on both devices at once. It must shorten and run out on BOTH at the very same moment — the round is shared, not one per player.'
			},
			coverage: 'manual',
			testid: 'quiz-round-progress'
		},
		{
			id: 'quizonline_9',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'Відповідайте першим і подивіться в табло, поки суперник ще думає. Проти його імені мусить бути видно, що він ЩЕ НЕ відповів, і жодних очок ні в кого.',
				en: 'Answer first and look at the scoreboard while the opponent is still thinking. Their row must show that they have NOT answered yet, and nobody has any points.'
			},
			/*
			 * ПЕРЕВІРКА МЕЖІ. Очки під раундом — це підказка: видно, хто відповів
			 * правильно, ще до того, як відповів ти. Показує їх той самий компонент
			 * табло, тож повернути їх можна одним пропом, і ніщо не почервоніє.
			 */
			negative: true,
			coverage: 'manual',
			testid: 'quiz-scores-list'
		},
		{
			id: 'quizonline_10',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'Дайте таймеру дійти до кінця, не відповідаючи. Посередині мусить зʼявитися табло з усіма гравцями, рахунок мусить НАБИРАТИСЯ (а не стрибнути), простояти чотири секунди й піти САМ — натискати нічого не треба. Смуга гравців зверху на цей час зникає.',
				en: 'Let the timer run out without answering. A scoreboard with every player must appear in the middle, the score must COUNT UP (not jump), stand for four seconds and move on BY ITSELF — nothing needs pressing. The player strip on top disappears for that time.'
			},
			coverage: 'manual',
			testid: 'quiz-reveal-panel'
		},
		{
			id: 'quizonline_11',
			category: { uk: 'Очки', en: 'Points' },
			text: {
				uk: 'Зіграйте два раунди: у першому відповідайте одразу, у другому — за мить до кінця смуги. За правильну швидку відповідь мусить прийти більше очок, ніж за правильну повільну.',
				en: 'Play two rounds: answer at once in the first, and just before the bar runs out in the second. A correct fast answer must bring more points than a correct slow one.'
			},
			coverage: 'manual',
			testid: 'quiz-score-*-value'
		},
		{
			id: 'quizonline_12',
			category: { uk: 'Очки', en: 'Points' },
			text: {
				uk: 'Натисніть свою відповідь двічі поспіль у тому самому раунді. Очки НЕ мусять додатися двічі — врахована лишається перша відповідь.',
				en: 'Press your answer twice in a row in the same round. The points must NOT be added twice — the first answer is the one that counts.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-board-panel'
		},
		{
			id: 'quizonline_13',
			category: { uk: 'Набір ігор', en: 'The set of games' },
			text: {
				uk: 'Відкрийте «Фільтр ігор» над списком кімнат. У переліку мусить бути ШІСТЬ ігор, серед них дві про те, де живуть тварини — про континенти й про природні зони.',
				en: 'Open “Game filter” above the room list. The list must have SIX games, two of them about where animals live — one about continents and one about biomes.'
			},
			coverage: 'manual',
			/*
			 * ГРУПА, а не окрема кнопка. Пункт перевіряє склад переліку, тобто
			 * рахує кнопки ВСЕРЕДИНІ — і мусить показувати на те, у межах чого
			 * рахує. Доти тут стояло `quiz-game-*-toggle`: зірочка підходила до
			 * будь-якої з шести кнопок і не називала жодної певної коробки.
			 */
			testid: 'quiz-games-fieldset'
		},
		{
			id: 'quizonline_14',
			category: { uk: 'Зниклий гравець', en: 'A player who vanished' },
			text: {
				uk: 'Під час раунду закрийте вкладку другого гравця. У першого мусить з’явитися вікно ПО ЦЕНТРУ, яке перекриває гру, а смуга часу мусить СТАТИ. За 15 секунд відкриється кнопка «Продовжити без нього» — вікно саме НЕ зникає. Натисніть її: партія піде далі, і до часу додасться три секунди.',
				en: 'During a round, close the second player’s tab. The first player must get a window IN THE CENTRE that covers the game, and the time bar must STOP. After 15 seconds the “Continue without them” button unlocks — the window does NOT close on its own. Press it: the game goes on and three seconds are added.'
			},
			coverage: 'manual',
			/*
			 * Підкладка, а не сама панель: перевіряється саме те, що гра ПЕРЕКРИТА.
			 * Панель видно й у стані «граємо далі», коли перекриття вже немає.
			 */
			testid: 'quiz-away-backdrop'
		},
		{
			id: 'quizonline_15',
			category: { uk: 'Пауза', en: 'Pause' },
			text: {
				uk: 'Під час раунду натисніть «Пауза». Смуга часу мусить СТАТИ в обох, і обидва мусять побачити, ХТО поставив паузу. У того, хто ставив, кнопка «Продовжити» є одразу; у другого «грати далі» відкривається лише після відліку.',
				en: 'During a round press “Pause”. The time bar must STOP for both, and both must see WHO paused. Whoever paused has “Resume” at once; the other gets “go on” only after the countdown.'
			},
			coverage: 'manual',
			testid: 'quiz-pause-btn'
		},
		{
			id: 'quizonline_16',
			category: { uk: 'Пауза', en: 'Pause' },
			text: {
				uk: 'Знявши свою паузу, спробуйте поставити її знову. Кнопка НЕ мусить приймати натиск ще хвилину — інакше нею можна смикати партію без кінця.',
				en: 'After lifting your own pause, try to pause again. The button must NOT accept a press for another minute — otherwise it can be used to jerk the game around endlessly.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-pause-btn'
		},
		{
			id: 'quizonline_17',
			category: { uk: 'Набір ігор', en: 'The set of games' },
			text: {
				uk: 'Зніміть у фільтрі всі ігри, крім однієї, і подивіться на список кімнат. Кімнати з іншими іграми мусять зникнути, а рядок під списком — сказати, скільки їх приховано.',
				en: 'In the filter leave a single game and look at the room list. Rooms with other games must disappear, and a line under the list must say how many are hidden.'
			},
			coverage: 'manual',
			testid: 'quiz-games-filter-toggle'
		},
		{
			id: 'quizonline_18',
			category: { uk: 'Набір ігор', en: 'The set of games' },
			text: {
				uk: 'Уже в кімнаті, до початку партії, змініть набір ігор. Другий гравець мусить побачити зміну в себе; сам він набір змінити НЕ мусить — правити його може лише той, хто кімнату створив.',
				en: 'Already in the room, before the game starts, change the set of games. The other player must see the change; they must NOT be able to change the set themselves — only whoever created the room can.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-games-fieldset'
		}
	]
};
