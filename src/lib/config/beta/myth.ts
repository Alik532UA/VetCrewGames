import type { BetaTab } from '../betaChecks';

/** «Міф чи правда» — твердження про тварин і дві кнопки. */
export const mythTab: BetaTab = {
	id: 'myth',
	title: { uk: 'Міф чи правда', en: 'Myth or truth' },
	routes: ['game-mythbusters'],
	checks: [
		{
			id: 'myth_1',
			category: { uk: 'Твердження', en: 'The statement' },
			text: {
				uk: 'Твердження мусить читатися повністю, без обрізаного хвоста, і на телефоні теж.',
				en: 'The statement must be readable in full, with no cut-off tail, on a phone as well.'
			},
			coverage: 'manual'
		},
		{
			id: 'myth_2',
			category: { uk: 'Твердження', en: 'The statement' },
			text: {
				uk: 'З обох кнопок мусить бути зрозуміло, яка з них означає «це міф», а яка — «це правда», без здогадок.',
				en: 'Both buttons must make it clear which one means «this is a myth» and which means «this is true», with no guessing.'
			},
			coverage: 'manual',
			testid: 'mythbusters-myth-btn'
		},
		{
			id: 'myth_3',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Дайте відповідь, тоді натисніть другу кнопку. Рахунок не мусить змінитися від другого натискання.',
				en: 'Answer, then press the other button. The score must not change from that second press.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/mythGame.svelte.test.ts',
			testid: 'mythbusters-truth-btn',
			negative: true
		},
		{
			id: 'myth_4',
			category: { uk: 'Відповідь', en: 'Answering' },
			text: {
				uk: 'Порахуйте свої правильні відповіді за партію. Рахунок наприкінці мусить дорівнювати саме цьому числу.',
				en: 'Count your correct answers over the game. The final score must equal exactly that number.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/mythGame.svelte.test.ts'
		},
		{
			id: 'myth_5',
			category: { uk: 'Пояснення', en: 'Explanations' },
			text: {
				uk: 'Після відповіді мусить зʼявитися пояснення, чому це міф або правда — і воно мусить стосуватися саме того твердження, що на екрані.',
				en: 'After answering an explanation must appear of why it is a myth or the truth — and it must be about the statement actually on screen.'
			},
			coverage: 'manual'
		},
		{
			id: 'myth_6',
			category: { uk: 'Пояснення', en: 'Explanations' },
			text: {
				uk: 'Кнопка «Далі» мусить зʼявлятися лише після відповіді: пропустити раунд, не відповівши, не мусить бути можливо.',
				en: 'The «Next» button must appear only after an answer: skipping a round without answering must not be possible.'
			},
			coverage: 'testable',
			testid: 'mythbusters-next-btn',
			negative: true
		},
		{
			id: 'myth_7',
			category: { uk: 'Раунди', en: 'Rounds' },
			text: {
				uk: 'Пройдіть десять раундів. Те саме твердження не мусить трапитися двічі за партію.',
				en: 'Play ten rounds. The same statement must not come up twice in one game.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/quizSeed.test.ts',
			negative: true
		},
		{
			id: 'myth_8',
			category: { uk: 'Кінець партії', en: 'The end' },
			text: {
				uk: 'Наприкінці мусить бути видно підсумок і спосіб почати знову, не повертаючись у меню руками.',
				en: 'At the end there must be a summary and a way to start again without going back to the menu by hand.'
			},
			coverage: 'manual'
		}
	]
};
