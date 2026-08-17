import type { BetaTab } from '../betaChecks';

/** «Знайди пару» поодинці й на гарячому місці — та сама дошка, але без мережі. */
export const memoryTab: BetaTab = {
	id: 'memory',
	title: { uk: 'Знайди пару (соло)', en: 'Memory (solo)' },
	routes: ['game-memory'],
	checks: [
		{
			id: 'memory_1',
			category: { uk: 'Дошка', en: 'The board' },
			text: {
				uk: 'Дошка мусить уміщуватися в екран цілком — і на телефоні, і на компʼютері — без прокрутки сторінки, щоб побачити нижній рядок карток.',
				en: 'The whole board must fit on the screen — on a phone and on a computer alike — with no page scrolling needed to see the bottom row of cards.'
			},
			coverage: 'covered',
			test: 'src/lib/utils/fitZoom.test.ts',
			testid: 'memory-deck-container'
		},
		{
			id: 'memory_2',
			category: { uk: 'Дошка', en: 'The board' },
			text: {
				uk: 'Почніть партію заново двічі. Розкладка мусить бути щоразу інша, а не та сама.',
				en: 'Start a new game twice. The layout must be different each time, not the same one again.'
			},
			coverage: 'manual'
		},
		{
			id: 'memory_3',
			category: { uk: 'Картки', en: 'The cards' },
			text: {
				uk: 'Відкрийте дві однакові картки. Вони мусять лишитися відкритими до кінця партії, скільки б ви по них не натискали.',
				en: 'Open two matching cards. They must stay open until the end of the game, no matter how often you click them.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/memoryGame.svelte.test.ts'
		},
		{
			id: 'memory_4',
			category: { uk: 'Картки', en: 'The cards' },
			text: {
				uk: 'Відкрийте дві РІЗНІ картки. Вони мусять закритися самі приблизно за секунду, і за цей час мусить бути видно обидві.',
				en: 'Open two DIFFERENT cards. They must close by themselves in about a second, and both must be visible during that time.'
			},
			coverage: 'manual'
		},
		{
			id: 'memory_5',
			category: { uk: 'Картки', en: 'The cards' },
			text: {
				uk: 'Не чекаючи, поки закриються дві різні картки, натисніть третю. У соло-партії третя мусить одразу відкритися — грати швидко ніщо не мусить заважати.',
				en: 'Without waiting for two different cards to close, click a third one. In a solo game the third must open right away — nothing should get in the way of playing fast.'
			},
			coverage: 'testable'
		},
		{
			id: 'memory_6',
			category: { uk: 'Лічильники', en: 'Counters' },
			text: {
				uk: 'Натисніть кілька разів по вже відкритій картці. Лічильник ходів не мусить рости від цього.',
				en: 'Click an already open card several times. The move counter must not grow from that.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/memoryGame.svelte.test.ts',
			testid: 'memory-moves-value',
			negative: true
		},
		{
			id: 'memory_7',
			category: { uk: 'Двоє на одному пристрої', en: 'Two on one device' },
			text: {
				uk: 'Грайте вдвох на одному пристрої. Знайдена пара мусить лишати хід тому самому гравцеві, а промах — передавати наступному.',
				en: 'Play two on one device. A found pair must keep the turn with the same player, while a miss must pass it to the next one.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/memoryGame.svelte.test.ts'
		},
		{
			id: 'memory_8',
			category: { uk: 'Кінець партії', en: 'The end' },
			text: {
				uk: 'Дограйте до кінця. Мусить бути видно, хто переміг, і сума знайдених пар у гравців мусить дорівнювати кількості пар на дошці.',
				en: 'Play to the end. It must show who won, and the players found pairs must add up to the number of pairs on the board.'
			},
			coverage: 'manual'
		}
	]
};
