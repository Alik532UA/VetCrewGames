import type { BetaTab } from '../betaChecks';

/**
 * Спільна вікторина — і майже кожен пункт тут вимагає ДВОХ пристроїв.
 *
 * Причина в самій моделі партії: усі відповідають одночасно, кожен на своєму
 * екрані, а спільні лише програма й рахунок. Автотест доводить, що програма
 * виводиться з зерна однаково й що рахунок не подвоюється, — але не доводить, що
 * двоє на різних телефонах справді побачили ті самі питання.
 *
 * Тому перший пункт тут головний: він перевіряє саме те, на чому тримається все
 * інше. Якщо питання різні, спільної партії немає, хоч би табло й рахувало
 * правильно.
 */
export const quizOnlineTab: BetaTab = {
	id: 'quizonline',
	title: { uk: 'Вікторина разом', en: 'Quiz together' },
	routes: ['quiz/online'],
	checks: [
		{
			id: 'quizonline_1',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Створіть кімнату на одному пристрої й зайдіть із другого. Почніть партію: обидва мусять побачити ОДНЕ І ТЕ САМЕ перше питання, і далі ті самі в тому самому порядку.',
				en: 'Create a room on one device and join from another. Start the game: both must see the SAME first question, and the same ones after it in the same order.'
			},
			coverage: 'manual',
			testid: 'quiz-board-panel'
		},
		{
			id: 'quizonline_2',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Вимкніть одну гру в наборі перед створенням кімнати. У партії мусять попадатися лише ввімкнені ігри.',
				en: 'Turn one game off in the set before creating the room. Only the games left on may come up during the match.'
			},
			coverage: 'manual',
			testid: 'quiz-board-panel'
		},
		{
			id: 'quizonline_3',
			category: { uk: 'Одна програма на всіх', en: 'One programme for everyone' },
			text: {
				uk: 'Спробуйте вимкнути ВСІ ігри. Остання ввімкнена не мусить вимикатися — партія без питань неможлива.',
				en: 'Try turning ALL games off. The last one left on must not switch off — a match with no questions is impossible.'
			},
			/*
			 * ПЕРЕВІРКА МЕЖІ, і саме тому вона позначена.
			 *
			 * Межа, що перестала діяти, виглядає точно як межа, що діє: набір
			 * порожніє, партія все одно починається (порожнеча трактується як
			 * «усі»), і людина отримує протилежне тому, що просила. Інваріант
			 * чеклиста вимагає хоч одного такого пункта на вкладку.
			 */
			negative: true,
			coverage: 'manual'
		},
		{
			id: 'quizonline_4',
			category: { uk: 'Табло', en: 'Scoreboard' },
			text: {
				uk: 'Відповідайте швидше за суперника. Табло на ОБОХ пристроях мусить показувати ваш крок і рахунок однаково, і поряд рядків — за рахунком.',
				en: 'Answer faster than the opponent. The scoreboard on BOTH devices must show your step and score identically, with rows ordered by score.'
			},
			coverage: 'manual',
			testid: 'quiz-scores-list'
		},
		{
			id: 'quizonline_5',
			category: { uk: 'Табло', en: 'Scoreboard' },
			text: {
				uk: 'Закінчіть програму раніше за суперника. Мусить зʼявитися «Ви закінчили, чекаємо на решту», а не екран підсумку.',
				en: 'Finish the programme before the opponent. “You are done, waiting for the others” must appear, not the results screen.'
			},
			coverage: 'manual'
		},
		{
			id: 'quizonline_6',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Спробуйте зайти в кімнату «Знайди пару» за її кодом із вікторини. Мусить бути відмова «ця кімната для іншої гри», а не порожній екран.',
				en: 'Try joining a Memory room by its code from the quiz. It must refuse with “that room is for a different game”, not show an empty screen.'
			},
			coverage: 'manual'
		},
		{
			id: 'quizonline_7',
			category: { uk: 'Кімната', en: 'The room' },
			text: {
				uk: 'Поверніться назад із партії кнопкою браузера. Мусить відкритися форма входу з переліком кімнат, а не меню «Вікторина».',
				en: 'Go back from the match with the browser button. The entry form with the room list must open, not the Quiz menu.'
			},
			coverage: 'manual'
		}
	]
};
