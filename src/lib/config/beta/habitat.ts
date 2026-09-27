import type { BetaTab } from '../betaChecks';

/**
 * «Де живемо?» — два підрежими, континенти й біоми, і в кожному раунді
 * правильних відповідей може бути кілька.
 */
export const habitatTab: BetaTab = {
	id: 'habitat',
	title: { uk: 'Де живем?', en: 'Where do they live?' },
	routes: ['game-habitat/continents', 'game-habitat/biomes'],
	checks: [
		{
			id: 'habitat_1',
			category: { uk: 'Вибір режиму', en: 'Choosing a mode' },
			text: {
				uk: 'Виберіть «Континенти», тоді «Природні зони». Адреса мусить змінюватися, і посиланням на конкретний режим мусить бути можливо поділитися.',
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
				uk: 'Виберіть кілька варіантів одночасно. Позначити більше одного мусить бути можливо. Правильно — лише повний набір без зайвих; неповний зараховується частково, по очку за кожне влучання; зайвий варіант робить відповідь неправильною й забирає одне влучання.',
				en: 'Select several options at once. Marking more than one must be possible. Only the full set with nothing extra is correct; an incomplete one counts as partial, a point per hit; an extra option makes the answer wrong and cancels one hit.'
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
			testid: 'habitat-check-btn',
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
			testid: 'habitat-check-btn',
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
			test: 'src/lib/controllers/habitatGame.svelte.test.ts',
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
		},
		{
			// ПЕРЕГЛЯД МИНУЛИХ ПИТАНЬ (прохання автора 2026-09-26). Рівень `testable`, а
			// не `covered` (§ 3: рівень — те, що тест СПРАВДІ доводить): юніт-тест тримає
			// знімок раунду й дошку перегляду, але що сегмент на СТОРІНЦІ відкриває саме
			// це питання, а «назад» повертає поточне, — не доводить жоден.
			id: 'habitat_9',
			category: { uk: 'Перегляд питань', en: 'Reviewing questions' },
			text: {
				uk: 'Дайте відповідь на два питання й натисніть перший сегмент смужки вгорі. Мусить відкритися та сама тварина з вашим вибором, позначками й правильною відповіддю; змінити вибір там не можна, а «Перевірити» й «Далі» немає. Під підсумком — перелік усіх питань, і рядок відкриває своє.',
				en: 'Answer two questions and press the first segment of the bar on top. The same animal must open with your choice, the marks and the right answer; the choice cannot be changed there, and there is no «Check» or «Next». Under the summary there is a list of every question, and a row opens its own.'
			},
			coverage: 'testable',
			testid: 'round-review-*-btn'
		},
		{
			/*
			 * ПЛИТКИ ВИБОРУ РЕЖИМУ (прохання автора 2026-09-27: «класична проблема, що 50%
			 * вільного простору — зробити наш новий підхід з великими кнопками»).
			 */
			id: 'habitat_10',
			category: { uk: 'Вибір режиму', en: 'Choosing a mode' },
			text: {
				uk: 'Відкрийте «Де живем?» на телефоні й на компʼютері. «Континенти» й «Природні зони» мусять бути ВЕЛИКИМИ плитками зі значком над назвою — як у меню «Грати», — на телефоні одна під одною, на компʼютері поруч, і разом займати більшу частину екрана, а не половину.',
				en: 'Open «Where do they live?» on a phone and on a computer. «Continents» and «Biomes» must be BIG tiles with the icon above the name — as in the «Play» menu — one under the other on a phone, side by side on a computer, and together take most of the screen rather than half.'
			},
			coverage: 'manual',
			testid: 'habitat-mode-continents-link'
		},
		{
			/*
			 * ВАРІАНТИ — ВЕЛИКИМ ТЕКСТОМ (прохання автора 2026-09-28: «текст кнопок від 30% до
			 * 70% кнопки → від 55% до 95%»). Рівень `manual`: частку кнопки міряли руками на
			 * семи розмірах екрана, а тест, що тримав би її, — окрема робота.
			 */
			id: 'habitat_11',
			category: { uk: 'Екран', en: 'Screen' },
			text: {
				uk: 'Відкрийте «Континенти» й «Природні зони» на телефоні й на компʼютері. Назви на кнопках мусять бути великими: найкоротша («Азія», «Гори») сягає десь половини кнопки, найдовша — майже її краю, і жодне слово не рветься посередині. На телефоні кнопки стоять у дві колонки, на компʼютері — у два ряди, картинка завжди ліворуч від назви; усе разом із «Перевірити» вміщається в екран без прокрутки. Питання над кнопками — на всю ширину.',
				en: 'Open «Continents» and «Biomes» on a phone and on a computer. The names on the buttons must be big: the shortest («Asia», «Ocean») reaches about half the button, the longest nearly its edge, and no word breaks in the middle. On a phone the buttons stand in two columns, on a computer in two rows, the picture always left of the name; all of it together with «Check» fits the screen without scrolling. The question above the buttons spans the full width.'
			},
			coverage: 'manual',
			testid: 'habitat-option-btn-*'
		},
		{
			// НАЗВА НА КАРТИНЦІ (прохання автора 2026-09-28) — так само, як у «Правда чи міф?».
			id: 'habitat_12',
			category: { uk: 'Екран', en: 'Screen' },
			text: {
				uk: 'Назва тварини мусить стояти НА її картинці внизу праворуч, у темній плашці, — а не окремим рядком під картинкою. Так само в спільній вікторині.',
				en: 'The animal name must sit ON its picture at the bottom right, in a dark box, not as a separate line under the picture. The same in the shared quiz.'
			},
			coverage: 'manual',
			testid: 'habitat-animal-name-text'
		},
		{
			/*
			 * ЕКРАН ГРИ ПРИТИСНУТИЙ ДОНИЗУ (прохання автора 2026-09-28: «якщо є скрол — завжди
			 * скролити донизу»). Дія одна на всі ігри (`pinToBottom`); e2e тримає її на цій
			 * сторінці, бо дев'ять зон на 360×520 не вміщаються навіть на дні масштабу.
			 */
			id: 'habitat_13',
			category: { uk: 'Екран', en: 'Screen' },
			text: {
				uk: 'Відкрийте «Природні зони» у низькому вікні, де сторінка прокручується (телефон горизонтально або зменшене вікно). Раунд мусить відкриватися НИЗОМ: варіанти й «Перевірити» на екрані, смужка раундів за верхнім краєм. Прокрутіть угору — сторінка не мусить смикатися назад; після «Далі» новий раунд знову відкривається низом. Так само в «Хто з іншої родини?», «Що їмо?», «Правда чи міф?» і «Кого більше?».',
				en: 'Open «Biomes» in a short window where the page scrolls (a phone held sideways or a shrunk window). A round must open at the BOTTOM: the options and «Check» on screen, the round bar above the top edge. Scroll up — the page must not jerk back; after «Next» the new round again opens at the bottom. The same in «Who is from another family?», «What do they eat?», «Fact or Myth?» and «Who is more?».'
			},
			coverage: 'covered',
			test: 'tests/game-scroll.spec.ts',
			testid: 'habitat-next-btn'
		}
	]
};
