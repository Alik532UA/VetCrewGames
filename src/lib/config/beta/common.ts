import type { BetaTab } from '../betaChecks';

/**
 * Спільне для всього сайту: шапка, теми, мова, шрифт, памʼять між заходами.
 *
 * Ця вкладка стоїть першою не за старшинством, а тому що ламається одразу в
 * УСІХ іграх: тема, мова й шрифт — це кореневий layout. Дефект тут виглядає як
 * дефект тієї гри, у якій його побачили.
 */
export const commonTab: BetaTab = {
	id: 'common',
	title: { uk: 'Спільне для сайту', en: 'Site-wide' },
	// Меню — теж адреси, і теж мають бути перевірені. Вони тут, а не в іграх, бо
	// зламане меню — це одна поломка, а не шість.
	routes: ['', 'quiz', 'quiz/play', 'pairs', 'game-habitat', 'reserve'],
	checks: [
		{
			id: 'common_1',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'Натисніть кнопку теми в шапці. Мусить відкритися список із чотирьох тем, у якому позначено поточну; вибір теми зі списку одразу міняє кольори, а повторний натиск по кнопці список закриває.',
				en: 'Press the theme button in the header. A list of four themes must open with the current one marked; picking a theme changes the colours at once, and pressing the button again closes the list.'
			},
			coverage: 'manual',
			testid: 'header-theme-btn'
		},
		{
			id: 'common_2',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'У кожній із чотирьох тем перегляньте шапку, кнопки й підсумок гри: жоден напис не мусить зникати, зливаючись із тлом.',
				en: 'In each of the four themes look at the header, the buttons and a game summary: no text may disappear by blending into its background.'
			},
			/*
			 * Перевірка контрастності, яку цей пункт замовляв, зʼявилася:
			 * `src/contrast.test.ts`. Рівень усе одно лишається `testable`, і це не
			 * недогляд, а § 3 канону: рівень визначає те, що тест СПРАВДІ доводить.
			 *
			 * Він розвʼязує пари, у яких обидва боки — токени тем: 156 пар, і саме
			 * так знайшлися три дефекти, включно з підписом на 1,77:1. Але 400 пар
			 * лишаються непокритими, і не випадково: тло застосунку — фотографія, а
			 * панелі поверх неї — `color-mix(… transparent 25%)`. Тобто більшість
			 * написів, про які й питає цей пункт, стоять саме на тому, чого статична
			 * перевірка не бачить.
			 *
			 * Що змінилося: доти тут стояло «доки не зʼявиться перевірка
			 * контрастності». Перевірка є, і рядок почав описувати минуле — рівно та
			 * пастка, від якої застерігає § 7.1.
			 */
			coverage: 'testable',
			negative: true
		},
		{
			id: 'common_3',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'На телефоні увімкніть системний темний або «економний» режим і відкрийте сайт у СВІТЛІЙ темі. Кольори сайту не мусять інвертуватися.',
				en: 'On a phone turn on the system dark or battery-saver mode and open the site in a LIGHT theme. The site colours must not get inverted.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'common_4',
			category: { uk: 'Мова', en: 'Language' },
			text: {
				uk: 'Натисніть прапор у шапці й виберіть англійську. В адресі мусить зʼявитися /en/, а кнопка «назад» у браузері — повернути українську версію тієї самої сторінки.',
				en: 'Press the flag in the header and pick English. The address must gain /en/, and the browser Back button must return the Ukrainian version of the same page.'
			},
			coverage: 'covered',
			test: 'src/lib/i18n/routing.test.ts',
			testid: 'header-locale-btn'
		},
		{
			id: 'common_5',
			category: { uk: 'Мова', en: 'Language' },
			text: {
				uk: 'В українському тексті придивіться до літер «і», «ї», «є», «ґ»: вони мусять бути такої самої висоти й товщини, як сусідні літери, а не вужчими й не з іншого шрифту.',
				en: 'In Ukrainian text look closely at the letters «і», «ї», «є», «ґ»: they must be the same height and weight as their neighbours, not narrower and not from a different font.'
			},
			coverage: 'covered',
			test: 'src/i18n-font.test.ts'
		},
		{
			id: 'common_6',
			category: { uk: 'Мова', en: 'Language' },
			text: {
				uk: 'Перемкніть мову на німецьку або нідерландську й пройдіть меню та одну гру: підписів англійською чи українською серед них бути не мусить.',
				en: 'Switch to German or Dutch and walk through the menus and one game: no English or Ukrainian labels may be left among them.'
			},
			coverage: 'covered',
			test: 'src/i18n-completeness.test.ts',
			negative: true
		},
		{
			id: 'common_7',
			category: { uk: 'Памʼять між заходами', en: 'Settings that persist' },
			text: {
				uk: 'Виберіть тему, тоді перезавантажте сторінку. Тема мусить лишитися та сама, а не скочити на початкову. Мова теж мусить лишитися — вона живе в адресі.',
				en: 'Pick a theme, then reload the page. The theme must stay as chosen instead of jumping back to the default. The language must stay too — it lives in the address.'
			},
			coverage: 'covered',
			test: 'src/lib/services/settings.svelte.test.ts'
		},
		{
			id: 'common_8',
			category: { uk: 'Памʼять між заходами', en: 'Settings that persist' },
			text: {
				uk: 'Відкрийте сайт у режимі приватного перегляду. Сайт мусить працювати й дати грати, навіть якщо зберегти налаштування нікуди.',
				en: 'Open the site in a private browsing window. It must still work and let you play even when there is nowhere to save the settings.'
			},
			coverage: 'covered',
			test: 'src/lib/services/storage.test.ts'
		},
		{
			id: 'common_9',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'У кожній грі підпис у шапці мусить називати саму гру, а не розділ, з якого ви зайшли, і не «Vet Crew Games».',
				en: 'Inside each game the header caption must name that game — not the section you came from, and not «Vet Crew Games».'
			},
			coverage: 'covered',
			test: 'src/lib/services/headerClaim.test.ts'
		},
		{
			id: 'common_10',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Натисніть стрілку «назад» у шапці всередині гри. Вона мусить вести в той розділ, з якого гра відкрилася, а не на головну через голову розділу.',
				en: 'Press the back arrow in the header inside a game. It must lead to the section the game was opened from, not straight to the home page over that section.'
			},
			coverage: 'manual',
			testid: 'header-back-link'
		},
		{
			id: 'common_11',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Натисніть «Випадкова гра» пʼять разів. Щоразу мусить відкриватися ГРА — жодного разу меню чи сторінка вибору режиму.',
				en: 'Press «Random game» five times. Each time a GAME must open — never a menu or a mode-choice screen.'
			},
			coverage: 'covered',
			test: 'src/lib/services/randomGame.test.ts',
			testid: 'menu-random-btn',
			negative: true
		},
		{
			id: 'common_12',
			category: { uk: 'Дотик і розмір екрана', en: 'Touch and screen size' },
			text: {
				uk: 'На телефоні пройдіть меню й одну гру пальцем: кожна кнопка мусить натискатися з першого дотику й бути не меншою за подушечку пальця.',
				en: 'On a phone go through the menus and one game with your finger: every button must respond to the first tap and be no smaller than a fingertip.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_13',
			category: { uk: 'Дотик і розмір екрана', en: 'Touch and screen size' },
			text: {
				uk: 'Поверніть телефон з вертикального в горизонтальний і назад посеред гри. Сторінка мусить перебудуватися, а партія — лишитися тією самою.',
				en: 'Turn the phone from portrait to landscape and back in the middle of a game. The page must re-lay itself out while the game in progress stays the same.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_14',
			category: { uk: 'Коли щось не так', en: 'When something breaks' },
			text: {
				uk: 'Вимкніть інтернет і перезавантажте сторінку. Мусить бути або сайт, або зрозуміле повідомлення — але не порожній білий екран без нічого.',
				en: 'Turn off the internet and reload the page. You must get either the site or a clear message — never a blank white screen with nothing on it.'
			},
			coverage: 'manual',
			negative: true
		},
		/*
		 * Пункти, дописані 2026-08-19 після дефекту, знайденого ОКОМ, а не гейтом:
		 * НАТИСК на кнопку повного екрана заливав фон однотонним кольором —
		 * фотографія теми зникала. Причина була в запасному режимі повного екрана
		 * (`data-fake-fullscreen`), який вмикається не лише на iPhone, а щоразу,
		 * коли справжній Fullscreen API відмовив.
		 *
		 * Причина, чому цього не було в чеклисті, важливіша за сам дефект: кнопки
		 * повного екрана не згадував жоден пункт узагалі. Інваріант § 5.1 цього не
		 * бачить за побудовою — він вимагає, щоб кожен МАРШРУТ був заявлений
		 * вкладкою, а шапка стоїть на кожному маршруті, тобто «заявлена» вона
		 * завжди. Заявлення маршруту не є заявленням того, що на ньому намальовано.
		 */
		{
			id: 'common_18',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Із будь-якої гри натисніть назву сайту в шапці. Мусить відкритися головна тією самою мовою, якою ви грали.',
				en: 'From inside any game press the site name in the header. The home page must open in the same language you were playing in.'
			},
			coverage: 'manual',
			testid: 'header-home-link'
		},
		{
			id: 'common_15',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Натисніть кнопку розгортання на весь екран у шапці. Сторінка мусить зайняти весь екран, значок — змінитися на протилежний, а повторне натискання мусить повернути як було.',
				en: 'Press the full-screen button in the header. The page must fill the screen, the icon must switch to its opposite, and pressing it again must bring back the previous view.'
			},
			coverage: 'manual',
			testid: 'header-fullscreen-btn'
		},
		{
			id: 'common_16',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Розгорніть на весь екран і подивіться на фон. Фотографія теми мусить лишитися на місці; фон НЕ мусить стати суцільним кольором. Перевірте в кожній із чотирьох тем — на «Зимовій» і «Помаранчево-фіолетовій» фотографія інша, ніж на решті.',
				en: 'Go full screen and look at the background. The theme photograph must stay in place; the background must NOT turn into a solid colour. Check in each of the four themes — «Winter» and «Orange-purple» use a different photograph from the other two.'
			},
			coverage: 'manual',
			testid: 'header-fullscreen-btn',
			negative: true
		},
		{
			id: 'common_17',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'У кожній із чотирьох тем подивіться на фонову фотографію за шапкою й за картками: вона мусить бути видною крізь них, а не заміненою на суцільний колір.',
				en: 'In each of the four themes look at the background photograph behind the header and behind the cards: it must stay visible through them rather than being replaced by a solid colour.'
			},
			coverage: 'manual'
		}
	]
};
