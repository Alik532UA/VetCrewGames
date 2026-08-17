import type { BetaTab } from '../betaChecks';

/**
 * «Де живемо?» — два підрежими, континенти й біоми, і в кожному раунді
 * правильних відповідей може бути кілька.
 */
export const habitatTab: BetaTab = {
	id: 'habitat',
	title: { uk: 'Де живемо?', en: 'Where do we live?' },
	routes: ['game-habitat/continents', 'game-habitat/biomes'],
	checks: [
		{
			id: 'habitat_1',
			category: { uk: 'Вибір режиму', en: 'Choosing a mode' },
			text: {
				uk: 'Виберіть «Континенти», тоді «Біоми». Адреса мусить змінюватися, і посиланням на конкретний режим мусить бути можливо поділитися.',
				en: 'Pick «Continents», then «Biomes». The address must change, and it must be possible to share a link to a particular mode.'
			},
			coverage: 'covered',
			test: 'src/lib/i18n/routing.test.ts'
		},
		{
			id: 'habitat_2',
			category: { uk: 'Вибір режиму', en: 'Choosing a mode' },
			text: {
				uk: 'Стрілка «назад» із режиму мусить вести у вибір режиму, а не на головну сторінку.',
				en: 'The back arrow inside a mode must lead to the mode choice, not to the home page.'
			},
			coverage: 'manual'
		},
		{
			id: 'habitat_3',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Виберіть кілька варіантів одночасно. Позначити більше одного мусить бути можливо, і зарахувати мусить лише повний правильний набір.',
				en: 'Select several options at once. Marking more than one must be possible, and only the complete correct set may count.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/habitatGame.svelte.test.ts'
		},
		{
			id: 'habitat_4',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Натисніть «Перевірити», тоді спробуйте змінити вибір. Після перевірки вибір не мусить змінюватися.',
				en: 'Press «Check», then try to change your selection. After checking the selection must not change.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/habitatGame.svelte.test.ts',
			negative: true
		},
		{
			id: 'habitat_5',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Натисніть «Перевірити», нічого не вибравши. Раунд не мусить зараховуватися тихо: або кнопка не діє, або сказано, що вибору немає.',
				en: 'Press «Check» without selecting anything. The round must not be scored silently: either the button does nothing, or it says nothing is selected.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'habitat_6',
			category: { uk: 'Після перевірки', en: 'After checking' },
			text: {
				uk: 'Після перевірки правильні, пропущені й помилкові варіанти мусять відрізнятися на вигляд — і різницю мусить бути видно в кожній із чотирьох тем.',
				en: 'After checking the correct, the missed and the wrong options must look different — and that difference must be visible in each of the four themes.'
			},
			coverage: 'manual'
		},
		{
			id: 'habitat_7',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Пройдіть десять раундів. Та сама тварина не мусить трапитися двічі за партію.',
				en: 'Play ten rounds. The same animal must not come up twice in one game.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/quizSeed.test.ts',
			negative: true
		},
		{
			id: 'habitat_8',
			category: { uk: 'Екран', en: 'Screen' },
			text: {
				uk: 'На телефоні всі варіанти раунду мусять бути досяжні пальцем без збільшення сторінки.',
				en: 'On a phone every option in the round must be reachable with a finger without zooming the page.'
			},
			coverage: 'manual'
		}
	]
};
