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
				uk: 'Натисніть кнопку зміни теми в шапці чотири рази підряд. Кольори мусять пройти чотири різні набори й на пʼятому натисканні повернутися до першого.',
				en: 'Press the theme button in the header four times in a row. The colours must go through four different sets and return to the first one on the fifth press.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_2',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'У кожній із чотирьох тем перегляньте шапку, кнопки й підсумок гри: жоден напис не мусить зникати, зливаючись із тлом.',
				en: 'In each of the four themes look at the header, the buttons and a game summary: no text may disappear by blending into its background.'
			},
			// НЕ `covered`, хоч спокуса є: `themes.test.ts` доводить, що в кожної теми
			// є повний набір токенів, а не що їхні ЗНАЧЕННЯ дають контраст. Різницю
			// видно лише оком — доти, доки не зʼявиться перевірка контрастності, яку
			// цей пункт і замовляє.
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
				uk: 'Змініть мову на англійську. В адресі мусить зʼявитися /en/, а кнопка «назад» у браузері — повернути українську версію тієї самої сторінки.',
				en: 'Switch the language to English. The address must gain /en/, and the browser Back button must return the Ukrainian version of the same page.'
			},
			coverage: 'covered',
			test: 'src/lib/i18n/routing.test.ts'
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
				uk: 'Виберіть тему, мову й шрифт, тоді перезавантажте сторінку. Усі три мусять лишитися ті самі, а не скочити на початкові.',
				en: 'Pick a theme, a language and a font, then reload the page. All three must stay as chosen instead of jumping back to the defaults.'
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
				uk: 'Стрілка «назад» у шапці з гри мусить вести в той розділ, з якого гра відкрилася, а не на головну через голову розділу.',
				en: 'The back arrow in the header must lead to the section the game was opened from, not straight to the home page over that section.'
			},
			coverage: 'manual'
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
		}
	]
};
