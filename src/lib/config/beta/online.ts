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
				uk: 'Створіть кімнату на одному пристрої й зайдіть у неї з другого за пʼятилітерним кодом. Обидва мусять побачити ОДНАКОВУ розкладку карток.',
				en: 'Create a room on one device and join it from another with the five-letter code. Both must see the SAME card layout.'
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
		}
	]
};
