import type { BetaTab } from '../betaChecks';

/** «Хто наша родина» — вибрати родича названої тварини й прочитати чому. */
export const familyTab: BetaTab = {
	id: 'family',
	title: { uk: 'Хто з іншої родини?', en: 'Who is from another family?' },
	routes: ['game-family'],
	checks: [
		{
			id: 'family_1',
			category: { uk: 'Питання', en: 'The question' },
			text: {
				uk: 'Над чотирма тваринами мусить стояти завдання знайти ту, що з іншої біологічної групи. З екрана мусить бути зрозуміло, що саме від вас хочуть.',
				en: 'Above four animals the task must say to find the one from another biological group. The screen must make it clear what is being asked.'
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
			testid: 'family-animal-btn-*',
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
				uk: 'Пояснення мусить говорити саме про тих тварин, які на екрані, — а не про якихось інших.',
				en: 'The explanation must be about the animals actually on screen — not about some others.'
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
				uk: 'Пройдіть десять раундів. Той самий набір із чотирьох тварин не мусить трапитися двічі за партію.',
				en: 'Play ten rounds. The same set of four animals must not come up twice in one game.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/familyGame.svelte.test.ts',
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
				uk: 'Наприкінці мусить бути видно рахунок — по 3 очки за кожну правильну відповідь — і спосіб почати знову.',
				en: 'At the end it must show the score — 3 points per right answer — and a way to start again.'
			},
			coverage: 'manual'
		},
		{
			// ПЕРЕГЛЯД МИНУЛИХ ПИТАНЬ (прохання автора 2026-09-26). Рівень `testable`, а
			// не `covered` (§ 3: рівень — те, що тест СПРАВДІ доводить): юніт-тест тримає
			// знімок раунду й дошку перегляду, але що сегмент на СТОРІНЦІ відкриває саме
			// це питання, а «назад» повертає поточне, — не доводить жоден.
			id: 'family_9',
			category: { uk: 'Перегляд питань', en: 'Reviewing questions' },
			text: {
				uk: 'Відповідайте на два питання й натисніть перший сегмент смужки вгорі. Мусять відкритися ті самі чотири тварини в тому самому порядку, ваш вибір і правильна відповідь із поясненням; натиснути тварину там не можна. Під підсумком — перелік усіх питань, і рядок відкриває своє.',
				en: 'Answer two questions and press the first segment of the bar on top. The same four animals must open in the same order, with your choice and the right answer with its explanation; the animals there cannot be pressed. Under the summary there is a list of every question, and a row opens its own.'
			},
			coverage: 'testable',
			testid: 'round-review-*-btn'
		}
	]
};
