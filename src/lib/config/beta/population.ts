import type { BetaTab } from '../betaChecks';

/** «Скільки нас?» — тварин треба поставити в порядку чисельності. */
export const populationTab: BetaTab = {
	id: 'population',
	title: { uk: 'Скільки нас?', en: 'How many of us?' },
	routes: ['game-population'],
	checks: [
		{
			id: 'population_1',
			category: { uk: 'Правило гри', en: 'The rule' },
			text: {
				uk: 'До першого ходу мусить бути видно, у якому порядку ставити тварин — від найчисленніших до найрідших чи навпаки, — а не доводитися вгадувати.',
				en: 'Before the first move it must be clear which order to arrange the animals in — most numerous to rarest or the other way round — rather than left to guesswork.'
			},
			coverage: 'manual'
		},
		{
			id: 'population_2',
			category: { uk: 'Перестановка', en: 'Rearranging' },
			text: {
				uk: 'Поміняйте двох тварин місцями. Вони мусять помінятися обидві, з анімацією, і жодна не мусить зникнути чи роздвоїтися.',
				en: 'Swap two animals. Both must move, with an animation, and neither may disappear or turn into two copies.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/populationGame.svelte.test.ts',
			negative: true
		},
		{
			id: 'population_3',
			category: { uk: 'Перестановка', en: 'Rearranging' },
			text: {
				uk: 'На телефоні переставте тварин пальцем. Перетягування мусить працювати так само, як мишею.',
				en: 'On a phone rearrange the animals with your finger. Dragging must work the same as with a mouse.'
			},
			coverage: 'manual'
		},
		{
			id: 'population_4',
			category: { uk: 'Перевірка', en: 'Checking' },
			text: {
				uk: 'Натисніть «Перевірити». Мусить бути показаний правильний порядок, а переставляти тварин після цього вже не мусить бути можливо.',
				en: 'Press «Check». The correct order must be shown, and rearranging the animals after that must no longer be possible.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/populationGame.svelte.test.ts',
			testid: 'population-check-btn',
			negative: true
		},
		{
			id: 'population_5',
			category: { uk: 'Перевірка', en: 'Checking' },
			text: {
				uk: 'Після перевірки мусить бути видно, які тварини стояли правильно, а які ні — не лише загальний рахунок.',
				en: 'After checking it must be visible which animals were in the right place and which were not — not just a total score.'
			},
			coverage: 'manual'
		},
		{
			id: 'population_6',
			category: { uk: 'Числа', en: 'The numbers' },
			text: {
				uk: 'Натисніть «Перевірити» й придивіться до чисел чисельності — до перевірки їх не показують. Велике число мусить бути округлене зі словом — «~1,2 млн», «~500 тис» — і слово мусить бути мовою сторінки, а не злитим рядком цифр.',
				en: 'Press «Check» and look at the population figures — they are not shown before that. A large number must be rounded with a word — «~1.2 M», «~500 K» — and that word must be in the pages language, not one long run of digits.'
			},
			coverage: 'testable',
			testid: 'population-check-btn'
		},
		{
			id: 'population_7',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Придивіться до тварин ОДНОГО раунду: та сама тварина не мусить трапитися в ньому двічі. Між раундами тварини повторюватися можуть — це не помилка.',
				en: 'Look at the animals within ONE round: the same animal must not appear in it twice. Between rounds animals may repeat — that is not a bug.'
			},
			coverage: 'covered',
			test: 'src/lib/config/population-game.test.ts',
			negative: true
		},
		{
			id: 'population_8',
			category: { uk: 'Екран', en: 'Screen' },
			text: {
				uk: 'На вузькому екрані всіх тварин раунду мусить бути видно одночасно — або мусить бути очевидно, що список прокручується.',
				en: 'On a narrow screen all of the rounds animals must be visible at once — or it must be obvious that the list scrolls.'
			},
			coverage: 'manual'
		}
	]
};
