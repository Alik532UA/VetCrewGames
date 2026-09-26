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
				uk: 'Дайте таймеру дійти до кінця, не відповідаючи. Посередині мусить зʼявитися табло з усіма гравцями — не вужче за 70% ширини вікна на будь-якому екрані, зокрема у вікні на пів екрана. Якщо потягнути край вікна, табло росте чи меншає плавно, без стрибка з «картки» у «велике». Рахунок мусить НАБИРАТИСЯ (а не стрибнути), а табло — простояти стільки, скільки задано в «Час на перегляд відповіді», і піти САМЕ — натискати нічого не треба. Смуга гравців зверху на цей час зникає.',
				en: 'Let the timer run out without answering. A scoreboard with every player must appear in the middle — at least 70% of the window width on any screen, a half-screen window included. Dragging the window edge makes it grow or shrink smoothly, with no jump from a “card” to a “big board”. The score must COUNT UP (not jump), and the scoreboard must stay as long as “Answer review time” says and move on BY ITSELF — nothing needs pressing. The player strip on top disappears for that time.'
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
			testid: 'quiz-reveal-*-value'
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
		},
		{
			/*
			 * РАУНД БЕЗ МЕЖІ — лише руками й лише на двох пристроях. Автотест доводить,
			 * що контролер не закінчує такий раунд за часом і що повільна правильна
			 * відповідь коштує як швидка; не доводить він того, що ДРУГИЙ гравець справді
			 * бачить питання, доки думає перший, і що табло приходить само, щойно
			 * відповіли обидва.
			 */
			id: 'quizonline_19',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'У лобі виберіть у «Час на раунд» варіант «Не обмежений» і почніть партію. Смуги часу й кнопки «Пауза» мусить НЕ бути — на їхньому місці рядок «Час не обмежений». Раунд мусить чекати, доки відповідять ОБИДВА, скільки б це не тривало, і лише тоді показати табло. За правильну повільну відповідь мусить прийти стільки ж очок, скільки за швидку.',
				en: 'In the lobby pick “No limit” under “Round time” and start the game. There must be NO time bar and no “Pause” button — a “No time limit” line stands in their place. The round must wait until BOTH have answered, however long it takes, and only then show the scoreboard. A correct slow answer must bring as many points as a fast one.'
			},
			coverage: 'manual',
			testid: 'quiz-round-unlimited-text'
		},
		{
			/*
			 * СЕБЕ ЗНИКЛИМ НЕ ПОКАЗУЄ (аудит 2026-09-24). Правило перевіряє контролер
			 * (`QuizMatch.awayOthers`), а екран — джерело (`awaySelf.test.ts`), але саму
			 * причину — те, що SDK без мережі прибирає мене з присутності в мене ж, — у
			 * тестах не відтворити: підставна кімната мережі не має. Тому руками.
			 */
			id: 'quizonline_20',
			category: { uk: 'Зниклий гравець', en: 'A player who vanished' },
			text: {
				uk: 'Посеред раунду вимкніть мережу на пристрої господаря й зачекайте пʼятнадцять секунд. У нього мусить бути смуга «немає звʼязку» — і НЕ мусить бути ні вікна «Чекаємо: <його імʼя>», ні кнопки «прибрати» навпроти себе. Другий гравець тим часом бачить, що чекають господаря.',
				en: 'In the middle of a round turn off the network on the host device and wait fifteen seconds. The host must get the “no connection” bar — and must NOT get a “Waiting: <their own name>” window or a “remove” button next to themselves. Meanwhile the other player sees that the host is being waited for.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-away-backdrop'
		},
		{
			id: 'quizonline_21',
			category: { uk: 'Зниклий гравець', en: 'A player who vanished' },
			text: {
				uk: 'Посеред раунду вимкніть мережу в гостя. Коли в господаря скінчиться відлік, натисніть «Прибрати» навпроти гостя, а тоді поверніть гостеві мережу. Гість мусить побачити «Господар прибрав вас із кімнати» й опинитися на формі входу, а не на дошці, де кожна відповідь падає з «Сервер не дозволив цю дію».',
				en: 'In the middle of a round turn off the guest network. When the host countdown runs out, press “Remove” next to the guest, then give the guest the network back. The guest must see “The host removed you from the room” and land on the entry form, not on a board where every answer fails with “The server did not allow this action”.'
			},
			coverage: 'manual',
			testid: 'quiz-away-*-btn'
		},
		{
			/*
			 * ПАУЗУ ПИШЕ КОЖЕН ГРАВЕЦЬ (аудит 2026-09-24). Контролер і перепрогін це
			 * доводять на підставній кімнаті; руками — те, чого вона не має: справжнє
			 * перезавантаження сторінки ведучого посеред раунду.
			 */
			id: 'quizonline_22',
			category: { uk: 'Зниклий гравець', en: 'A player who vanished' },
			text: {
				uk: 'Посеред раунду перезавантажте сторінку господаря. У гостя смуга часу мусить стати, поки господаря немає, і піти далі, коли він повернеться. Відповідайте гостем уже ПІСЛЯ того, як минула б звичайна межа часу: відповідь мусить зарахуватися з очками, а табло цього раунду — показатися обом.',
				en: 'In the middle of a round reload the host page. On the guest side the time bar must stop while the host is gone and move on when the host is back. Answer as the guest AFTER the usual time limit would have passed: the answer must count with points, and this round scoreboard must show for both.'
			},
			coverage: 'manual',
			testid: 'quiz-round-progress'
		},
		{
			id: 'quizonline_23',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'У лобі третім пристроєм виберіть роль «Глядач», а тоді почніть партію. Глядач мусить бачити питання й рядок «Ви дивитеся — відповіді глядача не зараховуються»; кнопки «Пауза» в нього НЕ мусить бути, а його відповідь НЕ мусить дати йому очок ні в табло, ні після фіналу.',
				en: 'In the lobby pick the “Spectator” role on a third device, then start the game. The spectator must see the questions and the line “You are watching — a spectator’s answers do not count”; there must be NO “Pause” button for them, and their answer must NOT give them points on the scoreboard or after the final.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-watching-text'
		},
		{
			// РІВНІ БАЛИ ДІЛЯТЬ МІСЦЕ (прохання автора 2026-09-26): 1, 1, 3, як у спорті.
			id: 'quizonline_24',
			category: { uk: 'Очки', en: 'Points' },
			text: {
				uk: 'Двома пристроями відповідайте однаково й однаково швидко, доки рахунок не зрівняється. На таблі між раундами й на підсумку обидва мусять стояти на ОДНОМУ місці (1 і 1), а наступний гравець — на третьому.',
				en: 'On two devices answer the same way and equally fast until the scores are level. On the scoreboard between rounds and on the final one both must share ONE place (1 and 1), and the next player must be third.'
			},
			coverage: 'covered',
			test: 'src/lib/components/quiz/standings.test.ts',
			testid: 'quiz-reveal-*-place-value'
		},
		{
			/*
			 * ФІНАЛ — ТАБЛО ОСТАННЬОГО РАУНДУ (прохання автора 2026-09-26). Правило
			 * екрана перевіряє `utils/quizScreen.test.ts`, вигляд — `standings.test.ts`;
			 * руками — те, чого вони не мають: справжня партія до кінця.
			 */
			id: 'quizonline_25',
			category: { uk: 'Фінал', en: 'The final' },
			text: {
				uk: 'Дограйте партію до кінця. Після останнього раунду мусить одразу зʼявитися ВЕЛИКЕ табло «Гру завершено!» з «+балами» останнього раунду й місцями — без проміжного «Наступний раунд» і без маленької панелі після нього. Кнопки «Грати знову» й «Закрити кімнату» за кілька секунд мусять ожити; у гостя під табло — «Чекаємо, доки лідер почне нову партію.»',
				en: 'Play the game to the end. Right after the last round a BIG “Game over!” scoreboard must appear with the last round’s “+points” and the places — with no “Next round” step and no small panel after it. The “Play again” and “Close room” buttons must come alive within a few seconds; a guest sees “Waiting for the host to start a new game.” under the scoreboard.'
			},
			coverage: 'manual',
			testid: 'quiz-over-panel'
		},
		{
			/*
			 * БЕЗ ПОВТОРІВ ПИТАНЬ (прохання автора 2026-09-26, `config/quizDeck.ts`). Правила
			 * колоди доводять юніт-тести на тисячі зерен; руками — справжня кімната й
			 * «Грати знову».
			 */
			id: 'quizonline_26',
			category: { uk: 'Питання', en: 'Questions' },
			text: {
				uk: 'Зіграйте партію з усіма шістьма іграми. Жодне питання не мусить повторитися, і та сама тварина — теж, навіть у різних іграх; раундів кожної гри — порівну (два). Натисніть «Грати знову»: у новій партії питання мусять бути інші.',
				en: 'Play a game with all six games selected. No question may repeat, and neither may the same animal — even across different games; each game gets an equal share of rounds (two). Press “Play again”: the new game must bring different questions.'
			},
			coverage: 'covered',
			test: 'src/lib/config/quizDeck.test.ts',
			testid: 'quiz-board-panel'
		}
	]
};
