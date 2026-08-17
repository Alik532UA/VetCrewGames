import type { BetaTab } from '../betaChecks';

/** «Що їмо?» — корм треба розкласти тваринам і натиснути «Погодувати». */
export const feedingTab: BetaTab = {
	id: 'feeding',
	title: { uk: 'Що їмо?', en: 'What do we eat?' },
	routes: ['game-feeding'],
	checks: [
		{
			id: 'feeding_1',
			category: { uk: 'Розкладання корму', en: 'Handing out food' },
			text: {
				uk: 'Перетягніть корм до тварини. Він мусить лишитися саме там, куди ви його поклали, і зникнути з переліку нерозкладеного.',
				en: 'Drag a piece of food to an animal. It must stay exactly where you put it and leave the list of food not yet handed out.'
			},
			coverage: 'manual'
		},
		{
			id: 'feeding_2',
			category: { uk: 'Розкладання корму', en: 'Handing out food' },
			text: {
				uk: 'Заберіть покладений корм назад, поки не натиснули «Погодувати». Це мусить бути можливо, і корм мусить повернутися в перелік.',
				en: 'Take a placed piece of food back before pressing «Feed». That must be possible, and the food must return to the list.'
			},
			coverage: 'testable'
		},
		{
			id: 'feeding_3',
			category: { uk: 'Розкладання корму', en: 'Handing out food' },
			text: {
				uk: 'На телефоні розкладіть корм пальцем. Перетягування мусить працювати без мишки.',
				en: 'On a phone hand out the food with your finger. Dragging must work without a mouse.'
			},
			coverage: 'manual'
		},
		{
			id: 'feeding_4',
			category: { uk: 'Погодувати', en: 'Feeding' },
			text: {
				uk: 'Натисніть «Погодувати». Результат мусить бути окремий по КОЖНОМУ продукту, а не одне слово на весь раунд.',
				en: 'Press «Feed». The result must be given for EACH item of food separately, not as one word for the whole round.'
			},
			coverage: 'manual',
			testid: 'feeding-feed-btn'
		},
		{
			id: 'feeding_5',
			category: { uk: 'Погодувати', en: 'Feeding' },
			text: {
				uk: 'Натисніть «Погодувати» двічі в тому самому раунді. Другий раз не мусить нічого додати до рахунку.',
				en: 'Press «Feed» twice in the same round. The second press must not add anything to the score.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/feedingGame.svelte.test.ts',
			negative: true
		},
		{
			id: 'feeding_6',
			category: { uk: 'Рахунок', en: 'Score' },
			text: {
				uk: 'Порахуйте продукти в раунді. Рахунок за раунд не мусить перевищувати їхньої кількості.',
				en: 'Count the items of food in the round. The score for that round must not exceed how many there were.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/feedingGame.svelte.test.ts',
			negative: true
		},
		{
			id: 'feeding_7',
			category: { uk: 'Пояснення', en: 'Explanations' },
			text: {
				uk: 'Помильтеся навмисне. Мусить бути сказано, чому цей корм не годиться саме цій тварині.',
				en: 'Get it wrong on purpose. It must say why that food does not suit that particular animal.'
			},
			coverage: 'manual'
		},
		{
			id: 'feeding_8',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Пройдіть партію до кінця. Тварини й набори корму мусять змінюватися щораунду, а наприкінці мусить бути видно підсумок.',
				en: 'Play a game to the end. The animals and the sets of food must change every round, and a summary must appear at the end.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/quizSeed.test.ts'
		}
	]
};
