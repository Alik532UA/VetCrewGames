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
				uk: 'Створіть кімнату на одному пристрої й зайдіть у неї з другого за кодом кімнати (цифри). Обидва мусять побачити ОДНАКОВУ розкладку карток.',
				en: 'Create a room on one device and join it from another with the room code (digits). Both must see the SAME card layout.'
			},
			coverage: 'manual',
			testid: 'pairs-create-btn'
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
				uk: 'Швидка гра: під час відліку до старту другий гравець закриває вкладку. Відлік мусить зупинитися, а партія — не початися з тим, кого вже немає. Після реваншу, від якого суперник пішов, господар мусить почути «потрібен ще гравець», а не почати гру сам із собою.',
				en: 'Quick game: during the countdown the second player closes the tab. The countdown must stop, and the game must not start with someone who is gone. On a rematch after the opponent left, the host must hear “one more player needed” instead of starting a game alone.'
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
		}
	]
};
