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
				uk: 'У лобі кімнати вимкніть одну гру в «Ігри в кімнаті». У партії мусять попадатися лише ввімкнені ігри.',
				en: 'In the room lobby turn one game off in «Games in this room». Only the games left on may come up during the match.'
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
				uk: 'Відповідайте, поки суперник не відповідає. Дошка з вашою відповіддю мусить лишитися, а замість кнопки «Далі» — зʼявитися рядок «Чекаємо на решту.»; далі ви не йдете, доки не відповіли всі або не вийшов час.',
				en: 'Answer while the opponent does not. The board with your answer must stay, and the line “Waiting for the others.” must take the place of the “Next” button; you do not move on until everyone answers or the time runs out.'
			},
			coverage: 'manual',
			testid: 'quiz-answered-text'
		},
		{
			id: 'quizonline_6',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Відкрийте адресу кімнати вікторини, підставивши після «room=» код кімнати «Знайди пару». Мусить відкритися «Знайди пару» з цією кімнатою, а не порожній екран чи відмова; «назад» не мусить вертати на адресу вікторини.',
				en: 'Open a quiz room address with the code of a «Find a pair» room after «room=». «Find a pair» must open with that room — not an empty screen or a refusal; Back must not return to the quiz address.'
			},
			coverage: 'manual'
		},
		{
			id: 'quizonline_7',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Поверніться назад із партії кнопкою браузера. Мусить відкритися сторінка «Грати онлайн» з переліком кімнат, а не меню «Вікторина».',
				en: 'Go back from the match with the browser button. The «Play online» page with the room list must open, not the Quiz menu.'
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
				uk: 'У лобі кімнати подивіться на «Ігри в кімнаті». У переліку мусить бути ШІСТЬ ігор, серед них дві про те, де живуть тварини — про континенти й про природні зони.',
				en: 'In the room lobby look at “Games in this room”. The list must have SIX games, two of them about where animals live — one about continents and one about biomes.'
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
				uk: 'Під час раунду закрийте вкладку другого гравця. У першого мусить з’явитися вікно ПО ЦЕНТРУ, яке перекриває гру, а смуга часу мусить СТАТИ. За 15 секунд відкриється кнопка «Грати далі» — вікно саме НЕ зникає. Натисніть її: партія піде далі, і до часу додасться три секунди.',
				en: 'During a round, close the second player’s tab. The first player must get a window IN THE CENTRE that covers the game, and the time bar must STOP. After 15 seconds the “Play on” button unlocks — the window does NOT close on its own. Press it: the game goes on and three seconds are added.'
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
				uk: 'Під час раунду натисніть «Пауза». Смуга часу мусить СТАТИ в обох, і обидва мусять побачити, ХТО поставив паузу. У того, хто ставив, кнопка «Продовжити» є одразу; у другого «Грати далі» відкривається лише після відліку.',
				en: 'During a round press “Pause”. The time bar must STOP for both, and both must see WHO paused. Whoever paused has “Resume” at once; the other gets “Play on” only after the countdown.'
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
			id: 'quizonline_18',
			category: { uk: 'Набір ігор', en: 'The set of games' },
			text: {
				uk: 'Уже в кімнаті, до початку партії, змініть набір ігор. Другий гравець мусить побачити зміну в себе; сам він набір змінити НЕ мусить — правити його може лише господар (спершу — той, хто кімнату створив).',
				en: 'Already in the room, before the game starts, change the set of games. The other player must see the change; they must NOT be able to change the set themselves — only the host can (at first whoever created the room).'
			},
			negative: true,
			coverage: 'manual',
			testid: 'quiz-games-fieldset'
		},
		{
			/*
			 * РАУНД БЕЗ МЕЖІ — лише руками й лише на двох пристроях. Автотест доводить,
			 * що контролер не закінчує такий раунд за часом і що швидкість рахується від
			 * прихованої межі (рішення автора 2026-09-27); не доводить він того, що ДРУГИЙ
			 * гравець справді бачить питання, доки думає перший, і що табло приходить само,
			 * щойно відповіли обидва.
			 */
			id: 'quizonline_19',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'У лобі виберіть у «Час на раунд» варіант «Не обмежений» і почніть партію. Смуги часу й кнопки «Пауза» мусить НЕ бути — на їхньому місці рядок «Час не обмежений, але швидша відповідь дає більше очок». Раунд мусить чекати, доки відповідять ОБИДВА, скільки б це не тривало, і лише тоді показати табло. Швидша правильна відповідь мусить дати більше очок, ніж повільна, а відповідь через кілька хвилин — 50, а не нуль.',
				en: 'In the lobby pick “No limit” under “Round time” and start the game. There must be NO time bar and no “Pause” button — a “No time limit, but a faster answer earns more points” line stands in their place. The round must wait until BOTH have answered, however long it takes, and only then show the scoreboard. A faster correct answer must bring more points than a slow one, and an answer after several minutes must still bring 50, not zero.'
			},
			coverage: 'manual',
			testid: 'quiz-round-unlimited-text'
		},
		{
			/*
			 * ХТО ДУМАЄ ДОВШЕ ЗА ПРИХОВАНУ МЕЖУ (рішення автора 2026-09-27, 5-B). Правила —
			 * `idleWait.test.ts` і перепрогін, а те, що вікно справді зʼявляється в того, хто
			 * відповів, і не зʼявляється в того, хто думає, — лише на двох пристроях.
			 */
			id: 'quizonline_30',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'У «Не обмежений» відповідайте на одному пристрої, а на другому — ні, нічого не натискайте. За 36–100 секунд, залежно від гри (удвічі довше за межу «Повільно» цієї гри), у того, хто відповів, мусить зʼявитися вікно «Ще не вибрали відповідь:» з імʼям другого й кнопкою «Грати далі». Натиск — і раунд мусить піти на табло. У того, хто думає, вікна мусить НЕ бути, і відповісти він мусить могти аж до натиску.',
				en: 'In “No limit”, answer on one device and do nothing on the other. After 36–100 seconds, depending on the game (twice its “Slow” limit), the one who answered must see a “Have not chosen an answer yet:” window with the other player’s name and a “Play on” button. Pressing it must take the round to the scoreboard. The one still thinking must NOT see that window and must be able to answer right up to the press.'
			},
			coverage: 'manual',
			testid: 'quiz-away-panel'
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
				uk: 'Посеред раунду вимкніть мережу на пристрої господаря й зачекайте пʼятнадцять секунд. У нього мусить бути смуга «немає звʼязку» — і НЕ мусить бути ні вікна «Чекаємо: <його імʼя>», ні кнопки «Виключити» навпроти себе. Другий гравець тим часом бачить, що чекають господаря.',
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
				uk: 'Посеред раунду вимкніть мережу в гостя. Коли в господаря скінчиться відлік, натисніть «Виключити» навпроти гостя, а тоді поверніть гостеві мережу. Гість мусить побачити «Господар прибрав вас із кімнати» й опинитися на сторінці «Грати онлайн», а не на дошці, де кожна відповідь падає з «Сервер не дозволив цю дію».',
				en: 'In the middle of a round turn off the guest’s network. When the host’s countdown runs out, press “Remove” next to the guest, then give the guest the network back. The guest must see “The host removed you from the room” and land on the «Play online» page, not on a board where every answer fails with “The server refused this action.”'
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
				en: 'In the middle of a round reload the host’s page. On the guest side the time bar must stop while the host is gone and move on when the host is back. Answer as the guest AFTER the usual time limit would have passed: the answer must count with points, and this round’s scoreboard must show for both.'
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
				en: 'Play the game to the end. Right after the last round a BIG “Game over!” scoreboard must appear with the last round’s “+points” and the places — with no “Next round” step and no small panel after it. The “Play again” and “Close the room” buttons must come alive within a few seconds; a guest sees “Waiting for the host to start a new game.” under the scoreboard.'
			},
			coverage: 'manual',
			testid: 'quiz-over-panel'
		},
		{
			/*
			 * БЕЗ ПОВТОРІВ ПИТАНЬ (прохання автора 2026-09-26, `utils/quizDeck.ts`). Правила
			 * колоди доводять юніт-тести на тисячі зерен; руками — справжня кімната й
			 * «Грати знову».
			 */
			id: 'quizonline_26',
			category: { uk: 'Питання', en: 'Questions' },
			text: {
				uk: 'Зіграйте партію з усіма шістьма іграми. Жодне питання не мусить повторитися, і та сама тварина — теж, навіть у різних іграх. Натисніть «Грати знову»: у новій партії питання мусять бути інші.',
				en: 'Play a game with all six games selected. No question may repeat, and neither may the same animal — even across different games. Press “Play again”: the new game must bring different questions.'
			},
			coverage: 'covered',
			test: 'src/lib/utils/quizDeck.test.ts',
			testid: 'quiz-board-panel'
		},
		{
			/*
			 * ВЕСТИ НІКОМУ Й ВЕДЕННЯ ПІСЛЯ ПАРТІЇ (шостий аудит, S1). Правило доводять гейт
			 * правил і контракт, смугу — юніт-тести сесії й `NetLost`; руками — три пристрої.
			 */
			id: 'quizonline_27',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Двома пристроями почніть вікторину, третім зайдіть у неї посеред партії гравцем, а тоді на двох перших закрийте вкладки. За ~20 с на третьому мусить зʼявитися смуга «Господаря немає, а підхопити ведення нікому…» з кнопками «Створити кімнату» й «Вийти з кімнати»; «Створити кімнату» мусить відкрити нове лобі, де ви господар.',
				en: 'Start a quiz on two devices, join it mid-game as a player on a third, then close the tabs on the first two. Within ~20 s the third must show a strip «The host is gone, and nobody here can take over the lead…» with «Create a room» and «Leave the room» buttons; «Create a room» must open a new lobby where you are the host.'
			},
			coverage: 'manual',
			testid: 'room-no-lead-new-btn'
		},
		{
			id: 'quizonline_28',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Двома пристроями почніть вікторину, третім і четвертим зайдіть посеред партії гравцями й дограйте. Після фіналу закрийте вкладки на двох перших: приблизно за хвилину третій мусить почути «тепер партію ведете ви» й зуміти почати реванш із четвертим. Смуги «підхопити ведення нікому» при цьому бути не мусить.',
				en: 'Start a quiz on two devices, join it mid-game as players on a third and a fourth, and play to the end. After the final close the tabs on the first two: in about a minute the third must hear «you are leading the game now» and be able to start a rematch with the fourth. The «nobody here can take over the lead» strip must not appear.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			/*
			 * РЕВАНШ БЕЗ ПАРИ — ТАК САМО, ЯК У «ЗНАЙДИ ПАРУ» (шостий аудит, A4). Показ доводить
			 * `QuizRoom.final.test.ts`, умову — тест сесії (`canRematch`).
			 */
			id: 'quizonline_29',
			category: { uk: 'Фінал', en: 'The final' },
			text: {
				uk: 'Дограйте вікторину удвох, а тоді на пристрої гостя закрийте вкладку. У господаря замість «Грати знову» мусить стояти «Потрібні щонайменше двоє гравців.», а «Закрити кімнату» — лишитися.',
				en: 'Play a quiz to the end with two players, then close the tab on the guest device. Instead of «Play again» the host must see «At least two players are needed.», and «Close the room» must stay.'
			},
			coverage: 'covered',
			test: 'src/lib/components/quiz/QuizRoom.final.test.ts',
			testid: 'quiz-reveal-note-text',
			negative: true
		},
		{
			// РАУНД ВІДКРИВАЄТЬСЯ НИЗОМ (прохання автора 2026-09-28) — та сама дія, що в соло.
			id: 'quizonline_31',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'Зіграйте вікторину на телефоні. Коли раунд не вміщається в екран, він мусить відкриватися НИЗОМ — з варіантами й кнопкою відповіді на екрані. Прокрутіть угору — сторінка не мусить смикатися назад до кінця раунду. Табло між раундами й підсумок донизу не тягнуться: там угорі рахунок.',
				en: 'Play a quiz on a phone. When a round does not fit the screen, it must open at the BOTTOM — with the options and the answer button on screen. Scroll up — the page must not jerk back until the round ends. The scoreboard between rounds and the final are not pulled down: the score is on top there.'
			},
			coverage: 'manual'
		},
		{
			/*
			 * РОЗБІР ПІД ТАБЛОМ (прохання автора 2026-09-28: «між раундами оновлений рахунок та
			 * нижче пояснення відповідей минулого раунду»). Покрито: `QuizRoom.reveal.test.ts`
			 * бачить розбір кожної гри під рахунком і ту саму дошку з відповіддю гравця.
			 */
			id: 'quizonline_32',
			category: { uk: 'Табло', en: 'Scoreboard' },
			text: {
				uk: 'Зіграйте кілька раундів різних ігор. Між раундами під рахунком мусить стояти розбір щойно зіграного питання — без картинок і варіантів: ваша відповідь (правильно чи ні) і пояснення. Не встигли відповісти — видно правильну відповідь і пояснення, але без «Неправильно». Рахунок і розбір разом уміщаються в екран телефона.',
				en: 'Play several rounds of different games. Between rounds the breakdown of the question just played must stand under the score — without pictures or options: your answer (right or not) and the explanation. If you did not answer in time, the right answer and the explanation show, but without «Wrong». The score and the breakdown together fit a phone screen.'
			},
			coverage: 'covered',
			test: 'src/lib/components/quiz/QuizRoom.reveal.test.ts',
			testid: 'quiz-reveal-panel'
		},
		{
			/*
			 * РАУНДИ ПРОПОРЦІЙНО ПУЛУ (прохання автора 2026-09-28). Доти — порівну, і в пункті
			 * `quizonline_26` стояло «раундів кожної гри — порівну (два)»: ту половину звідти
			 * прибрано, щоб давня позначка не підтверджувала правило, якого вже немає.
			 */
			id: 'quizonline_33',
			category: { uk: 'Питання', en: 'Questions' },
			text: {
				uk: 'Зіграйте кілька партій у кімнаті з усіма шістьма іграми. «Правда чи міф?», де питань найбільше, мусить траплятися найчастіше (пʼять раундів із дванадцяти), а «Що їмо?» й «Хто з іншої родини?», де їх найменше, — рівно по разу; кожна вибрана гра є в кожній партії. Набори «Що їмо?» не мусять повторюватися десять партій поспіль.',
				en: 'Play several games in a room with all six games selected. «Fact or Myth?», which has the most questions, must come up most often (five rounds of twelve), and «What do they eat?» and «Who is from another family?», which have the fewest, exactly once each; every selected game is in every game. The «What do they eat?» sets must not repeat for ten games in a row.'
			},
			coverage: 'covered',
			test: 'src/lib/utils/quizDeck.test.ts',
			testid: 'quiz-board-panel'
		},
		{
			/*
			 * ПЛАВНИЙ ПЕРЕХІД МІЖ РАУНДАМИ Й ТАБЛОМ (прохання автора 2026-09-28: «перемикання
			 * жорстке → плавне з анімацією, як меню»). Юніт-тест бачить лише, що перехід є;
			 * чи він плавний — око.
			 */
			id: 'quizonline_34',
			category: { uk: 'Раунд', en: 'The round' },
			text: {
				uk: 'Зіграйте кілька раундів. Коли раунд скінчився, смуга гравців має плавно згорнутися, табло — виїхати згори, а від дошки має лишитися розбір без стрибка. На новий раунд табло й розбір їдуть ліворуч, нова дошка — праворуч, як сторінки меню. З увімкненим «зменшити рух» у системі все міняється одразу, без анімації.',
				en: 'Play several rounds. When a round ends, the players bar must fold away smoothly, the scoreboard slide in from the top, and the board must turn into the breakdown without a jump. On a new round the scoreboard and the breakdown move left and the new board comes in from the right, like menu pages. With «reduce motion» on in the system everything switches at once, without animation.'
			},
			coverage: 'manual',
			testid: 'quiz-board-panel'
		}
	]
};
