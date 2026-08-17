import type { BetaTab } from '../betaChecks';

/** «Хто наша родина» — вибрати родича названої тварини й прочитати чому. */
export const familyTab: BetaTab = {
	id: 'family',
	title: { uk: 'Хто наша родина', en: 'Who are our relatives' },
	routes: ['game-family'],
	checks: [
		{
			id: 'family_1',
			category: { uk: 'Питання', en: 'The question' },
			text: {
				uk: 'Питання мусить називати тварину, а кнопки — можливих родичів. З екрана мусить бути зрозуміло, що саме від вас хочуть.',
				en: 'The question must name an animal and the buttons must offer possible relatives. The screen must make it clear what is being asked.'
			},
			coverage: 'manual',
			testid: 'family-prompt-text'
		},
		{
			id: 'family_2',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Дайте відповідь, тоді натисніть інші кнопки того ж раунду. Вони не мусять реагувати, а рахунок — змінюватися.',
				en: 'Answer, then press the other buttons in the same round. They must not react and the score must not change.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/familyGame.svelte.test.ts',
			negative: true
		},
		{
			id: 'family_3',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Дайте одну правильну й одну неправильну відповідь. Рахунок мусить вирости лише за правильну.',
				en: 'Give one right and one wrong answer. The score must grow only for the right one.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/familyGame.svelte.test.ts'
		},
		{
			id: 'family_4',
			category: { uk: 'Пояснення', en: 'Explanations' },
			text: {
				uk: 'Пояснення мусить говорити саме про тих двох тварин, які на екрані, — а не про якихось інших.',
				en: 'The explanation must be about the two animals actually on screen — not about some others.'
			},
			coverage: 'manual',
			testid: 'family-explanation-text'
		},
		{
			id: 'family_5',
			category: { uk: 'Пояснення', en: 'Explanations' },
			text: {
				uk: 'Довге пояснення не мусить виїжджати за край екрана на телефоні й не мусить накривати кнопку «Далі».',
				en: 'A long explanation must not run off the edge of a phone screen and must not cover the «Next» button.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'family_6',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Пройдіть десять раундів. Та сама тварина в питанні не мусить трапитися двічі за партію.',
				en: 'Play ten rounds. The same animal must not appear in the question twice in one game.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/quizSeed.test.ts',
			negative: true
		},
		{
			id: 'family_7',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Кнопка «Далі» мусить зʼявлятися лише після відповіді.',
				en: 'The «Next» button must appear only after an answer.'
			},
			coverage: 'testable',
			testid: 'family-next-btn'
		},
		{
			id: 'family_8',
			category: { uk: 'Кінець партії', en: 'The end' },
			text: {
				uk: 'Наприкінці мусить бути видно, скільки правильних відповідей з десяти, і спосіб почати знову.',
				en: 'At the end it must show how many of the ten answers were right, and a way to start again.'
			},
			coverage: 'manual'
		}
	]
};
