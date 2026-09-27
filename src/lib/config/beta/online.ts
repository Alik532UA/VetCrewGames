import type { BetaTab } from '../betaChecks';

/**
 * Спільна партія «Знайди пару» — найсвіжіший і найкрихкіший код у проєкті.
 *
 * Тут найбільше пунктів `manual`, і не через лінощі: половина цих перевірок
 * вимагає ДВОХ пристроїв і двох живих людей. Автотест ганяє двох учасників в
 * одному процесі — це доводить правила, але не доводить ні мережі, ні того, що
 * обидва бачать однакову дошку на різних екранах.
 */
export const onlineTab: BetaTab = {
	id: 'online',
	title: { uk: 'Знайди пару разом', en: 'Memory together' },
	routes: ['pairs/online'],
	checks: [
		{
			id: 'online_1',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Створіть кімнату «Знайди пару» на одному пристрої й зайдіть у неї з другого за кодом кімнати (цифри). Обидва мусять побачити ОДНАКОВУ розкладку карток.',
				en: 'Create a «Find a pair» room on one device and join it from another with the room code (digits). Both must see the SAME card layout.'
			},
			coverage: 'manual',
			testid: 'online-create-pairs-btn'
		},
		{
			id: 'online_2',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Скопіюйте адресу з кодом кімнати й відкрийте її на другому пристрої. Кімната мусить відкритися без введення коду руками.',
				en: 'Copy the address that carries the room code and open it on the second device. The room must open without typing the code by hand.'
			},
			coverage: 'manual'
		},
		{
			id: 'online_3',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Перезавантажте сторінку посеред партії. Ви мусите повернутися в ту саму кімнату, з тим самим імʼям і на своє місце в черзі — дошка при цьому не мусить перероздатися.',
				en: 'Reload the page in the middle of a game. You must come back to the same room, with the same name and your own place in the turn order — and the board must not be re-dealt.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'online_4',
			category: { uk: 'Черга ходів', en: 'Whose turn it is' },
			text: {
				uk: 'Коли черга не ваша, натисніть пʼять різних карток. Жодна не мусить відкритися, і лічильник ходів не мусить змінитися.',
				en: 'When it is not your turn, click five different cards. None of them may open, and the move counter must not change.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts',
			testid: 'pairs-card-btn-*',
			negative: true
		},
		{
			id: 'online_5',
			category: { uk: 'Черга ходів', en: 'Whose turn it is' },
			text: {
				uk: 'Відкрийте дві різні картки й, не чекаючи, поки вони закриються, натисніть третю. Третя НЕ мусить відкриватися: клік лише закриває дві попередні й передає хід.',
				en: 'Open two different cards and, without waiting for them to close, click a third one. The third must NOT open: the click only closes the previous two and passes the turn.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts',
			testid: 'pairs-card-btn-*',
			negative: true
		},
		{
			id: 'online_6',
			category: { uk: 'Черга ходів', en: 'Whose turn it is' },
			text: {
				uk: 'Натисніть ту саму картку одночасно на обох пристроях. Хід мусить зарахуватися один раз, і дошки мусять лишитися однаковими.',
				en: 'Click the same card on both devices at the same time. The move must count once, and the two boards must stay identical.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts',
			testid: 'pairs-card-btn-*'
		},
		{
			id: 'online_7',
			category: { uk: 'Глядач', en: 'Spectator' },
			text: {
				uk: 'Зайдіть у кімнату глядачем із третього пристрою. Дошку й чужі ходи мусить бути видно, але від ваших кліків жодна картка не відкривається.',
				en: 'Join the room as a spectator from a third device. The board and the others players moves must be visible, but no card opens from your clicks.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts',
			negative: true
		},
		{
			id: 'online_8',
			category: { uk: 'Глядач', en: 'Spectator' },
			text: {
				uk: 'Зайдіть глядачем посеред партії, коли частину пар уже знайдено. Ви мусите побачити дошку в тому самому стані, що й гравці, а не порожню.',
				en: 'Join as a spectator in the middle of a game, when some pairs are already found. You must see the board in the same state as the players, not an empty one.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts'
		},
		{
			id: 'online_9',
			category: { uk: 'Господар кімнати', en: 'The host' },
			text: {
				uk: 'Кнопки «Зіграти ще» й «Закрити кімнату» мусять бути лише в того, хто створив кімнату. У другого гравця їх не мусить бути видно.',
				en: 'The «Play again» and «Close room» buttons must belong only to whoever created the room. The other player must not see them at all.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'online_10',
			category: { uk: 'Господар кімнати', en: 'The host' },
			text: {
				uk: 'Господар натискає «Зіграти ще» після кінця партії. На обох пристроях мусить зʼявитися нова розкладка, а рахунок — почати з нуля.',
				en: 'The host presses «Play again» after the game ends. A new layout must appear on both devices and the score must start from zero.'
			},
			coverage: 'manual'
		},
		{
			id: 'online_11',
			category: { uk: 'Господар кімнати', en: 'The host' },
			text: {
				uk: 'Господар натискає «Закрити кімнату». Обидва мусять вийти з партії, а спроба зайти за тим самим кодом — сказати, що кімнати немає.',
				en: 'The host presses «Close room». Both must leave the game, and trying the same code again must say the room is gone.'
			},
			coverage: 'manual'
		},
		{
			id: 'online_12',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Закрийте вкладку в другого гравця. Його імʼя в списку мусить збліднути за кілька секунд — а не лишитися таким, ніби він досі тут.',
				en: 'Close the tab on the other player. Their name in the list must fade within a few seconds instead of staying as if they were still there.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'online_13',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Хай один пристрій відкриє сайт із давньої версії (не оновлюючи сторінку тиждень) і спробує зайти в кімнату. Мусить бути зрозуміла відмова, а не інша дошка в того самого коду.',
				en: 'Have one device open an old version of the site (a page left unreloaded for a week) and try to join the room. There must be a clear refusal, not a different board under the same code.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'online_14',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Наприкінці партії підсумок мусить називати переможця тим імʼям, яке людина ввела, і без дієслова, що вгадує її стать.',
				en: 'At the end the summary must name the winner with the name the person typed, and without a verb that guesses their gender.'
			},
			coverage: 'manual'
		},
		{
			id: 'online_15',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Утрьох: посеред партії третій виходить назовсім (смуга «Вас чекають» → «Вийти»). У двох інших дошка не мусить перероздатися, зібрані пари мусять лишитися на місці, а вибулий — у табло зі своїм імʼям. Коли дійде його черга, через півтори хвилини її можна забрати.',
				en: 'With three players: in the middle of a game the third one leaves for good (the “You are awaited” bar → “Leave”). The other two must not get a re-dealt board, the collected pairs must stay, and the one who left must stay on the scoreboard under their name. When their turn comes, it can be taken after a minute and a half.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/pairsMatch.svelte.test.ts',
			negative: true
		},
		{
			id: 'online_16',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Той, хто вийшов посеред партії, заходить у ту саму кімнату за кодом ще раз. Він мусить повернутися ГРАВЦЕМ на своє місце в черзі, а не глядачем.',
				en: 'The one who left in the middle of a game joins the same room with the code again. They must come back as a PLAYER in their own place in the turn order, not as a spectator.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/roomSession.svelte.test.ts'
		},
		{
			id: 'online_17',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Автоматичний пошук: коли вас звело й іде відлік до старту, другий гравець закриває вкладку. Відлік мусить зупинитися, а партія — не початися з тим, кого вже немає. Після реваншу, від якого суперник пішов, господар мусить почути «потрібен ще гравець», а не почати гру сам із собою.',
				en: 'Automatic search: once you are matched and the countdown runs, the second player closes the tab. The countdown must stop, and the game must not start with someone who is gone. On a rematch after the opponent left, the host must hear “one more player needed” instead of starting a game alone.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/roomSession.svelte.test.ts',
			negative: true
		},
		{
			/*
			 * ПІШОВ НАЗОВСІМ — ХІД `leave` (аудит 2026-09-24). Правила черги перевіряє
			 * `pairsMatch.svelte.test.ts`, запис — емулятор; руками лишається дорога
			 * людини: смуга «Вас чекають» на іншій сторінці й її кнопка.
			 */
			id: 'online_18',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Партія на трьох: один гравець іде зі сторінки гри на головну й у смузі «Вас чекають у грі» натискає «Вийти назовсім». У решти його черга мусить більше НЕ приходити: хід одразу переходить до наступного, без півтори хвилини чекання й без «Забрати хід».',
				en: 'A game of three: one player goes from the game page to the main page and presses “Leave for good” in the “You are awaited” bar. The others must NOT get that player turn any more: the move passes to the next one at once, with no ninety-second wait and no “Take the turn”.'
			},
			coverage: 'manual',
			testid: 'awaited-room-leave-btn'
		},
		{
			/*
			 * СІТКУ ВИБИРАЄ НАЙМЕНШИЙ ЕКРАН (рішення автора 2026-09-26). Правило вибору й
			 * запис одним рядком доводять юніт-тести й контракт над емулятором; руками —
			 * справжні два пристрої.
			 */
			id: 'online_19',
			category: { uk: 'Дошка', en: 'The board' },
			text: {
				uk: 'Створіть кімнату з компʼютера, а зайдіть у неї з телефона. Після старту в ОБОХ дошка мусить бути телефонна — чотири колонки й пʼять рядів, — і на телефоні всі картки видно без прокрутки. Кімната лише з компʼютерів — сім колонок.',
				en: 'Create a room on a computer and join it from a phone. After the start BOTH must get the phone board — four columns and five rows — and on the phone every card is visible without scrolling. A room of computers only gets seven columns.'
			},
			coverage: 'manual',
			testid: 'pairs-deck-container'
		},
		{
			/*
			 * АВАТАРКА У ФОРМІ ВХОДУ (прохання автора 2026-09-26). Відкриття, підписи й пару
			 * тримає юніт-тест `AvatarChooser`; руками — що вибір доходить до шапки й кімнати.
			 */
			id: 'online_20',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'На сторінці переліку кімнат натисніть плитку між прапором та іменем і виберіть інший колір і значок. Плитка в шапці мусить змінитися одразу, а в лобі нової кімнати біля вашого імені мусить стояти саме вона. Тут можна вибрати будь-яку пару: кімнати ще немає, тож і зайнятих немає.',
				en: 'On the room list page press the tile between the flag and the name and pick another colour and icon. The tile in the header must change at once, and in the lobby of a new room exactly that tile must stand next to your name. Any pair can be picked here: there is no room yet, so nothing is taken.'
			},
			coverage: 'manual',
			testid: 'pairs-avatar-toggle-btn'
		},
		{
			/*
			 * ПЛИТКА ПІСЛЯ ПЕРЕЗАВАНТАЖЕННЯ ЦІЛА (скарга автора 2026-09-27: «змішані
			 * спотворені аватарки»). Причина й захист — `ui/DynamicIcon.svelte`; кожен значок
			 * кожної сторінки звіряє e2e `icon-hydration`.
			 */
			id: 'online_30',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Виберіть у формі входу аватарку й перезавантажте сторінку переліку кімнат. Плитка мусить показувати цілий значок, який ви вибрали, — без кружечків чи ліній від іншого значка. Повторіть із трьома різними значками.',
				en: 'Pick an avatar in the entry form and reload the room list page. The tile must show the whole icon you picked — with no circles or lines from another icon. Repeat with three different icons.'
			},
			coverage: 'covered',
			test: 'tests/icon-hydration.spec.ts',
			testid: 'pairs-avatar-toggle-btn',
			negative: true
		},
		{
			/*
			 * ОДНА ПАРА НА КІМНАТУ (рішення автора 2026-09-26). Правило заміни доводять
			 * юніт-тести (`utils/roomAvatars`, сесія над `LocalRoom`); руками — два пристрої.
			 */
			id: 'online_21',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Удвох на двох пристроях виберіть у формі входу ОДНАКОВУ аватарку — той самий значок і колір — і зайдіть в одну кімнату. Хто зайшов другим, мусить отримати іншу плитку й коротке пояснення; у того, хто зайшов першим, аватарка лишається своя. На обох екранах біля кожного імені мусить стояти та сама плитка, що й на іншому.',
				en: 'Two people on two devices pick the SAME avatar in the entry form — the same icon and colour — and enter one room. Whoever entered second must get another tile and a short explanation; the one who entered first keeps their own. On both screens every name must have the same tile as on the other screen.'
			},
			coverage: 'manual',
			testid: 'pairs-member-*-item'
		},
		{
			/*
			 * ВИПАДКОВУ МІНЯЮТЬ МОВЧКИ (рішення автора 2026-09-27, 9-A): пояснення — лише
			 * тому, хто аватарку вибирав. Збіг двох випадкових руками не підлаштувати, тож
			 * доводить це сесія над `LocalRoom`.
			 */
			id: 'online_27',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Зайдіть у кімнату з аватаркою, якої ви не вибирали (новий гравець), коли таку саму пару вже тримає хтось інший. Плитка мусить змінитися на вільну, але пояснення «вашу аватарку замінено» НЕ мусить зʼявитися: ви її не вибирали.',
				en: 'Enter a room with an avatar you did not pick (a new player) while someone else already holds the same pair. The tile must change to a free one, but the «your avatar was replaced» note must NOT appear: you did not pick it.'
			},
			negative: true,
			coverage: 'covered',
			test: 'src/lib/controllers/roomSession.svelte.test.ts',
			testid: 'pairs-member-*-item'
		},
		{
			/*
			 * БЕЗ ПОВТОРІВ ЗНАЧКА Й КОЛЬОРУ, АКАУНТ — ПЕРШИЙ (рішення автора 2026-09-27, 9-A і
			 * 10-A). Правило доводять `utils/roomAvatars` і правила бази (`check:rules`);
			 * руками — справжній акаунт і справжній анонім.
			 */
			id: 'online_28',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'На першому пристрої ввійдіть в акаунт і виберіть кота будь-якого кольору; на другому, без акаунта, виберіть кота іншого кольору. Зайдіть в одну кімнату в будь-якому порядку. Кіт мусить лишитися в того, хто з акаунтом, а в другого — інший значок і інший колір; однакових значків чи кольорів у складі НЕ мусить бути.',
				en: 'On the first device sign in and pick a cat of any colour; on the second, without an account, pick a cat of another colour. Enter one room in any order. The cat must stay with the one who has an account, and the other must get another icon and another colour; there must be NO repeated icons or colours in the list.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'pairs-member-*-item'
		},
		{
			// «Посеред партії ніколи» (9-A) — доводить конверт кімнати.
			id: 'online_29',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Зайдіть у вікторину, що вже йде, з тією самою аватаркою, що в когось зі складу. Посеред партії плитки НЕ мусять мінятися ні у вас, ні в нього.',
				en: 'Join a quiz that is already running with the same avatar as someone in the list. Mid-game the tiles must NOT change — neither yours nor theirs.'
			},
			negative: true,
			coverage: 'covered',
			test: 'src/lib/utils/roomEnvelope.test.ts',
			testid: 'pairs-member-*-item'
		},
		{
			id: 'online_22',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'У лобі натисніть плитку біля «Ваша аватарка» під складом. Пари, які вже тримають інші, мусять бути приглушені й не натискатися, а скрінрідер мусить називати, чия це пара. Вибір вільної мусить одразу змінити плитку біля вашого імені — і на екрані іншого гравця теж.',
				en: 'In the lobby press the tile next to «Your avatar» under the list. Pairs other people already hold must be dimmed and not pressable, and a screen reader must say whose pair it is. Picking a free one must change the tile next to your name at once — on the other player’s screen too.'
			},
			coverage: 'manual',
			testid: 'lobby-avatar-toggle-btn',
			negative: true
		},
		{
			/*
			 * ВІКНО «ВАС ЗАПРОСИЛИ» (рішення автора 2026-09-26). Кому його показувати, доводить
			 * юніт-тест `roomInvite`; руками — справжній QR-код і справжній телефон.
			 */
			id: 'online_23',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Відскануйте QR-код лобі телефоном, на якому ви ще не заходили в цю кімнату. Мусить відкритися вікно «Вас запросили в кімнату» з кодом: імʼя, прапор і аватарка (зайняті в кімнаті — не вибрати) і кнопка «Зайти». Лише після неї ви в лобі — з тим підписом, який вибрали. Оновіть сторінку вже в кімнаті: вікна більше немає, ви повертаєтеся самі.',
				en: 'Scan the lobby QR code with a phone that has never joined this room. A «You are invited to room» window with the code must open: name, flag and avatar (the ones taken in the room cannot be picked) and a «Join» button. Only after it you are in the lobby — with the signature you picked. Reload the page once inside: the window is gone, you come back by yourself.'
			},
			coverage: 'manual',
			testid: 'room-invite-join-btn'
		},
		{
			/*
			 * ЖУРНАЛ ЛИШЕ В ПАРТІЇ (A2, аудит 2026-09-26). Правила й відмови доводять гейт
			 * правил і контракт; руками — справжня передача ведення на двох пристроях.
			 */
			id: 'online_24',
			category: { uk: 'Господар кімнати', en: 'The host' },
			text: {
				uk: 'Створіть кімнату «Знайди пару», зайдіть у неї з другого пристрою, а на першому закрийте вкладку й зачекайте ~20 с: другий мусить підхопити ведення. Тоді почніть партію з другого — вона мусить початися без жодного повідомлення про помилку, а дошка — бути свіжою, без відкритих карток.',
				en: 'Create a «Find the pair» room, join it from a second device, then close the tab on the first one and wait ~20 s: the second must take over the lead. Then start the game from the second — it must start without any error message, and the board must be fresh, with no open cards.'
			},
			coverage: 'manual',
			testid: 'pairs-start-btn'
		},
		{
			id: 'online_25',
			category: { uk: 'Господар кімнати', en: 'The host' },
			text: {
				uk: 'Дограйте партію, у якій ведення перехопив гість, і почніть реванш із його пристрою. Реванш мусить початися на обох пристроях з новою дошкою — і без жодного повідомлення про помилку ні на тому, ні на іншому.',
				en: 'Finish a game in which a guest took over the lead, and start the rematch from their device. The rematch must start on both devices with a new board — and with no error message on either of them.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			/*
			 * ВІКНО ВИКЛАДКИ (сьомий аудит, R7.1). Правило смуги доводить тест `reloadBanner`; руками —
			 * справжня викладка під відкритою партією.
			 */
			id: 'online_26',
			category: { uk: 'Зайти в кімнату', en: 'Getting into a room' },
			text: {
				uk: 'Грайте партію, поки виходить нова версія сайту (або почніть її до викладки й грайте ще ~5 хв після). Посеред партії смуги «Вийшла нова версія гри» бути не мусить — партія йде далі; після фіналу й у лобі смуга мусить зʼявитися.',
				en: 'Play a game while a new version of the site goes out (or start it before the deploy and keep playing for ~5 min after). Mid-game there must be no «A new version of the game is out» strip — the game goes on; after the final and in the lobby the strip must appear.'
			},
			coverage: 'manual',
			testid: 'net-lost-text',
			negative: true
		}
	]
};
