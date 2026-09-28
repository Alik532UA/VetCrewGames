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
	// `quiz` і `pairs` — старі адреси розділів, що тепер переадресовують у «Грати».
	routes: ['', 'play', 'quiz', 'quiz/play', 'pairs', 'game-habitat', 'reserve'],
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
			 * Тепер цей пункт покривають ДВІ перевірки, і разом вони закривають ту
			 * діру, через яку 2026-08-23 дефект знайшовся оком автора, а не гейтом.
			 *
			 * `src/contrast.test.ts` розвʼязує пари, де обидва боки — токени тем: 156
			 * пар. Але 400 лишалися непокритими, і не випадково: тло застосунку —
			 * фотографія, а панелі поверх неї — `color-mix(… transparent 25%)`.
			 * Більшість написів, про які й питає цей пункт, стояли саме на тому, чого
			 * статична перевірка не бачить.
			 *
			 * `tests/contrast-runtime.spec.ts` міряє їх у браузері зі СКЛАДАННЯМ
			 * шарів: 4 теми × 11 сторінок, ~450 елементів на прохід. Першим прогоном
			 * він знайшов 174 вузли у 18 селекторах — усі у двох світлих темах, від
			 * 1,50:1 до 3,90:1. Виправлено того ж дня, зараз нуль.
			 *
			 * РІВЕНЬ УСЕ ОДНО `testable`, і це § 3 канону, а не недогляд: рівень
			 * визначає те, що тест СПРАВДІ доводить. Цей пункт просить подивитися й
			 * на «підсумок гри», а до нього не доходить жоден гейт — щоб екран
			 * підсумку зʼявився, партію треба дограти. Так само поза замірами лишаються
			 * ВІДКРИТІ меню: `analyze()` і замір бачать сторінку такою, якою вона
			 * відкрилася. Обидва стани — за людиною, і саме через екран підсумку
			 * прожив непоміченим `.btn-menu` («Головне меню») білим на світлому.
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
			id: 'common_25',
			category: { uk: 'Акаунт', en: 'Account' },
			text: {
				uk: 'Натисніть свою аватарку в шапці — між прапором мови й кнопкою повного екрана. Мусить відкритися сторінка акаунта тією ж мовою, що й поточна сторінка.',
				en: 'Press your avatar tile in the header — between the language flag and the fullscreen button. The account page must open in the same language as the current page.'
			},
			coverage: 'manual',
			testid: 'header-account-link'
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
			/*
			 * ЗНАЧОК ПІСЛЯ ПЕРЕЗАВАНТАЖЕННЯ ЦІЛИЙ (2026-09-13 і 2026-09-27: змішувався з
			 * пререндереним). Кожен значок кожної сторінки звіряє e2e `icon-hydration`.
			 */
			id: 'common_31',
			category: { uk: 'Памʼять між заходами', en: 'Settings that persist' },
			text: {
				uk: 'Виберіть тему «Сонячний сад» і перезавантажте сторінку. Значок теми в шапці мусить бути цілим сонцем — колом із променями, без серпа місяця чи чужих ліній. Те саме із «Зимовою казкою» (сніжинка) і «Магічним заходом» (листок).',
				en: 'Pick the «Green» theme and reload the page. The theme icon in the header must be a whole sun — a circle with rays, with no crescent moon or stray lines. The same with «Winter» (a snowflake) and «Vibrant» (a leaf).'
			},
			coverage: 'covered',
			test: 'tests/icon-hydration.spec.ts',
			testid: 'header-theme-btn',
			negative: true
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
			/*
			 * «ПОКРИТО» ТУТ БУЛО НЕПРАВДОЮ до 2026-09-28: автор знайшов кнопку, що вела в
			 * заповідник і вікно входу, а тест це пропускав — рахував «усі адреси, крім
			 * винятків», тобто той самий спосіб, що й код. Тепер тест тримає обіцянку кнопки:
			 * рівно шість ігор меню, і жодної адреси поза ними (`randomGame.test.ts`).
			 */
			id: 'common_11',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Відкрийте «Грати» → «Вікторина» і натисніть «Випадкова гра» десять разів. Щоразу мусить відкриватися одна з шести ігор — «Правда чи міф?», «Кого більше?», «Де живем?» (континенти чи природні зони), «Хто з іншої родини?», «Що їмо?» — і жодного разу меню, вибір режиму, заповідник, вікно входу чи онлайн-кімната.',
				en: 'Open «Play» → «Quiz» and press «Random game» ten times. Each time one of the six games must open — «Fact or Myth?», «Who is more?», «Where do they live?» (continents or biomes), «Who is from another family?», «What do they eat?» — and never a menu, a mode choice, the reserve, the sign-in window or an online room.'
			},
			coverage: 'covered',
			test: 'src/lib/services/randomGame.test.ts',
			testid: 'menu-random-btn',
			negative: true
		},
		{
			id: 'common_26',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'На головній мусить бути ДВА пункти — «Грати» й «Грати онлайн» — і жодного окремого пункту гри. «Заповідник» у зібраному сайті поки не показується: він ще будується.',
				en: 'The home screen must show TWO entries — «Play» and «Play online» — and no separate game entries. «Reserve» is not shown on the built site yet: it is still being built.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'menu-play-link'
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
		 * (`data-fake-fullscreen`), який вмикався не лише на iPhone, а щоразу,
		 * коли справжній Fullscreen API відмовив. Сам режим прибрано 2026-09-26: на
		 * iPhone він панелей Safari не ховав, тож кнопка читалася як баг; тепер її
		 * там немає зовсім (`common_29`).
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
				uk: 'Із будь-якої гри натисніть значок будиночка в шапці. Мусить відкритися головна тією самою мовою, якою ви грали.',
				en: 'From inside any game press the house icon in the header. The home page must open in the same language you were playing in.'
			},
			coverage: 'manual',
			testid: 'header-home-link'
		},
		{
			id: 'common_15',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'На компʼютері чи Android натисніть кнопку розгортання на весь екран у шапці (на iPhone її немає — для нього окремий пункт нижче). Сторінка мусить зайняти весь екран, а значок зі стрілок НАЗОВНІ мусить стати стрілками ВСЕРЕДИНУ; повторне натискання мусить повернути як було.',
				en: 'On a computer or Android press the full-screen button in the header (an iPhone has none — it has its own item below). The page must fill the screen, and the arrows pointing OUT must become arrows pointing IN; pressing it again must bring back the previous view.'
			},
			coverage: 'manual',
			testid: 'header-fullscreen-btn'
		},
		{
			id: 'common_16',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Розгорніть на весь екран і подивіться на фон. Фотографія теми мусить лишитися на місці; фон НЕ мусить стати суцільним кольором. Перевірте в кожній із чотирьох тем — у кожної своя фотографія.',
				en: 'Go full screen and look at the background. The theme photograph must stay in place; the background must NOT turn into a solid colour. Check in each of the four themes — each has its own photograph.'
			},
			coverage: 'manual',
			testid: 'header-fullscreen-btn',
			negative: true
		},
		{
			/*
			 * iPhone не дає сторінкам повного екрана (лише відео), і кнопка, що міняла
			 * тільки власний значок, читалася як баг сайту (прохання автора 2026-09-26).
			 * Ховання й умову перевіряють `src/fullscreen-first-frame.test.ts` і
			 * `features/homeScreenHint.test.ts`; руками — те, чого jsdom не має:
			 * справжній Safari на телефоні.
			 */
			id: 'common_29',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Відкрийте сайт на iPhone у Safari. Кнопки «на весь екран» у шапці НЕ мусить бути; при першому відкритті внизу мусить зʼявитися підказка «Поділитися → На початковий екран», а після перезавантаження — вже ні. Відкрийте сайт з початкового екрана: ні кнопки, ні підказки.',
				en: 'Open the site on an iPhone in Safari. There must be NO full-screen button in the header; on the first visit a hint “Share → Add to Home Screen” must appear at the bottom, and after a reload it must not. Open the site from the Home Screen: neither the button nor the hint.'
			},
			coverage: 'manual',
			testid: 'header-fullscreen-btn',
			negative: true
		},
		{
			/*
			 * PWA (прохання автора 2026-09-27): маніфест і значки — `src/pwa.test.ts`; руками —
			 * справжнє встановлення, якого браузер у тесті не робить.
			 */
			id: 'common_32',
			category: { uk: 'Застосунок на телефоні', en: 'App on the phone' },
			text: {
				uk: 'Встановіть сайт як застосунок: на iPhone — «Поділитися → На початковий екран», на Android — меню Chrome → «Установити застосунок». На початковому екрані мусить стояти мавпочка на світлому тлі, а не знімок сторінки, з назвою «VetCrewGames», і застосунок мусить відкритися без адресного рядка.',
				en: 'Install the site as an app: on an iPhone — «Share → Add to Home Screen», on Android — Chrome menu → «Install app». The Home Screen must show the monkey on a light tile, not a screenshot of the page, named «VetCrewGames», and the app must open without an address bar.'
			},
			coverage: 'manual'
		},
		{
			/*
			 * «Щоб при оновленні не треба було перевстановлювати» — сама скарга автора.
			 * Логіку повернення тримає `lib/pwa/register.test.ts`, а те, що воркер бере
			 * керування одразу, — `src/pwa.test.ts`; руками — справжній деплой на телефоні.
			 */
			id: 'common_33',
			category: { uk: 'Застосунок на телефоні', en: 'App on the phone' },
			text: {
				uk: 'У встановленому застосунку запамʼятайте номер версії на сторінці бета-чекліста й поверніться на головну. Коли вийде нова версія, відкрийте застосунок знову, НЕ перевстановлюючи: головна мусить за кілька секунд перезавантажитися сама, а номер версії на сторінці бета-чекліста — стати новим. Посеред гри партія НЕ мусить обриватися: нова версія приїжджає з першим переходом на іншу сторінку.',
				en: 'In the installed app note the version number on the beta checklist page and go back to the home page. When a new version is out, open the app again WITHOUT reinstalling: the home page must reload by itself within a few seconds, and the version number on the beta checklist page must be the new one. In the middle of a game the game must NOT be cut short: the new version arrives with the first move to another page.'
			},
			coverage: 'manual',
			testid: 'beta-version-text'
		},
		{
			id: 'common_34',
			category: { uk: 'Застосунок на телефоні', en: 'App on the phone' },
			text: {
				uk: 'Відкрийте застосунок з інтернетом і зайдіть у «Грати». Тоді вимкніть інтернет і відкрийте застосунок знову: головна й «Грати» мусять відкритися, а сторінка, де ви ще не були, мусить привести на головну, а не на порожній екран браузера.',
				en: 'Open the app while online and go to «Play». Then turn the internet off and open the app again: the home page and «Play» must open, and a page you have not visited yet must lead to the home page rather than an empty browser screen.'
			},
			coverage: 'covered',
			test: 'tests/pwa.spec.ts',
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
		},

		/*
		 * ─── ДОСТУПНІСТЬ: РІВНО ТЕ, ЧОГО axe НЕ БАЧИТЬ ───────────────────────
		 *
		 * З 2026-08-23 у проєкті є `tests/a11y.spec.ts` — axe над зібраним сайтом,
		 * головна й чеклист, у світлій і темній темі. Він ловить приблизно третину
		 * проблем доступності: те, що видно з атрибутів і обчислених кольорів.
		 *
		 * Пункти нижче — друга половина, і вони не «про всяк випадок». Кожен
		 * названий саме тому, що axe його НЕ ПОБАЧИТЬ у принципі:
		 *   • порядок фокуса — це послідовність, а не атрибут;
		 *   • осмисленість підпису — це мова, а не наявність рядка;
		 *   • працездатність focus trap — це поведінка при натисканні;
		 *   • стан під анімацією — axe міряє після неї свідомо (`reducedMotion`),
		 *     бо інакше гейт плаває.
		 *
		 * Рівень `manual` тут не «ще не покрито», а «машина цього не вміє».
		 */
		{
			id: 'common_19',
			category: { uk: 'Доступність', en: 'Accessibility' },
			text: {
				uk: 'Не торкаючись мишки, пройдіть головну лише клавішею Tab від початку до кінця. Рамка фокуса мусить бути видною на КОЖНОМУ кроці, а порядок — іти зверху вниз, як читається сторінка, без стрибків назад.',
				en: 'Without touching the mouse, walk the home page with Tab alone from start to finish. The focus ring must be visible at EVERY step, and the order must go top to bottom the way the page reads, without jumping back.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_20',
			category: { uk: 'Доступність', en: 'Accessibility' },
			text: {
				uk: 'У заповіднику дочекайтеся вікна «Потрібен лікар» (хвора тварина без ветеринара) і пройдіть Tab-ом п’ять-шість кроків. Фокус мусить лишатися ВСЕРЕДИНІ вікна й не виходити на гру під ним, а після вибору — повернутися на гру.',
				en: 'In the reserve wait for the «A vet is needed» window (a sick animal with no vet) and walk five or six Tab steps. Focus must stay INSIDE the window and never reach the game behind it, and go back to the game after the choice.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_21',
			category: { uk: 'Доступність', en: 'Accessibility' },
			text: {
				uk: 'Увімкніть екранний читач (Windows: Ctrl+Win+Enter) і пройдіть шапку. Кожна кнопка мусить називатися тим, що вона робить — «Змінити тему», «Змінити мову», «На весь екран». Назви виду «кнопка», «зображення» або сам символ іконки означають дефект.',
				en: 'Turn on a screen reader (Windows: Ctrl+Win+Enter) and go through the header. Each button must be announced by what it does — «Change theme», «Change language», «Enter fullscreen». Announcements like «button», «image» or the icon character itself mean a defect.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_22',
			category: { uk: 'Доступність', en: 'Accessibility' },
			text: {
				uk: 'Увімкніть у системі «зменшити рух» (Windows: Параметри → Спеціальні можливості → Візуальні ефекти → Анімаційні ефекти вимкнути) і перезавантажте головну. Картки мусять з’явитися ОДРАЗУ, без наростання й розмиття. Це той самий режим, у якому міряє axe, тож тут перевіряється ще й достовірність гейта.',
				en: 'Turn on «reduce motion» in the system (Windows: Settings → Accessibility → Visual effects → Animation effects off) and reload the home page. Cards must appear AT ONCE, with no fade-in or blur. This is the same mode axe measures in, so this check also validates the gate itself.'
			},
			coverage: 'manual'
		},
		{
			id: 'common_23',
			category: { uk: 'Доступність', en: 'Accessibility' },
			text: {
				uk: 'Пройдіть Tab-ом по головній і подивіться, чи фокус НЕ потрапляє на власну смугу прокрутки праворуч. Вона дублює звичайну прокрутку, тож у порядку фокуса її бути не мусить — інакше на шляху до вмісту з’являється зупинка, яка нічого не робить.',
				en: 'Tab through the home page and check that focus does NOT land on the custom scrollbar on the right. It duplicates ordinary scrolling, so it must stay out of the focus order — otherwise there is a stop on the way to the content that does nothing.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'common_24',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'У кожній із чотирьох тем відкрийте список тем і список мов у шапці. Обраний пункт мусить бути видно як обраний (у списку мов — суцільна пляма акценту, у списку тем — суцільна рамка кольору самої теми), пункт під курсором — як інший, а підпис на обох мусить читатися. Кольори не мусять виглядати брудними чи «болотними».',
				en: 'In each of the four themes open the theme list and the language list in the header. The selected item must look selected (in the language list a solid accent fill, in the theme list a solid ring in the theme’s own colour), the hovered one must look different, and the label on both must stay readable. The colours must not look muddy.'
			},
			/*
			 * ВІДКРИТЕ МЕНЮ — ЗА ЛЮДИНОЮ, і це названо межею методу, а не забуто.
			 *
			 * Ні axe (`tests/a11y.spec.ts`), ні замір контрасту
			 * (`tests/contrast-runtime.spec.ts`) відкритого меню не бачать: обидва
			 * дивляться на сторінку такою, якою вона відкрилася, а меню в ній
			 * закрите. Через це попередні кольори — акцент під прозорістю 85% і 70% —
			 * прожили тут довго: обидва стани були одним кольором під різною
			 * прозорістю, тобто «під курсором» і «обрано» майже не відрізнялися, а
			 * жовтогарячий акцент поверх сіро-зеленого тла давав брудний оливковий.
			 * Знайшов це автор оком.
			 *
			 * Заміряно вручну в браузері після правки (4 теми × 2 стани):
			 * звичайний пункт 12,3–13,6:1, обраний 7,4–7,8:1. Числа тут, бо гейта,
			 * який їх повторить, поки немає.
			 */
			coverage: 'manual',
			testid: 'header-theme-menu'
		},
		{
			id: 'common_27',
			category: { uk: 'Теми', en: 'Themes' },
			text: {
				uk: 'На комп’ютері відкрийте список тем і наведіть курсор на тему, якою ЗАРАЗ не користуєтесь, не натискаючи. Сторінка мусить показати цю тему цілком, а щойно курсор піде — повернутися до попередньої. Самі пункти списку мусять бути пофарбовані кожен під СВОЮ тему, а не всі під поточну.',
				en: 'On a desktop, open the theme list and hover a theme you are NOT using, without clicking. The page must show that theme in full and return to the previous one as soon as the pointer leaves. The list items themselves must each be coloured in THEIR OWN theme, not all in the current one.'
			},
			coverage: 'manual',
			testid: 'header-theme-menu'
		},
		{
			id: 'common_28',
			category: { uk: 'Приватність', en: 'Privacy' },
			/*
			 * ВІДМОВА ВІД ВІДСТЕЖЕННЯ — за людиною, бо міряється в мережі, а не
			 * в розмітці: жоден із наявних гейтів не дивиться на те, які запити
			 * сторінка справді відправила.
			 */
			text: {
				uk: 'Увімкніть у браузері «Не відстежувати» (Chrome: Налаштування → Конфіденційність; Firefox: «Надсилати сайтам сигнал Do Not Track»), відкрийте сайт і подивіться вкладку Network за словом «google». Запитів до аналітики бути НЕ мусить. Вимкніть цей режим, перезавантажте — запити мусять з’явитися.',
				en: 'Turn on “Do Not Track” in the browser (Chrome: Settings → Privacy; Firefox: “Send websites a Do Not Track signal”), open the site and check the Network tab for the word “google”. There must be NO analytics requests. Turn the setting off, reload — the requests must appear.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'common_30',
			category: { uk: 'Шапка й навігація', en: 'Header and navigation' },
			text: {
				uk: 'Відкрийте стару адресу розділу гри — з закладок чи давнього повідомлення. Мусить відкритися «Грати», а стрілка «назад» браузера не мусить вертати на стару адресу.',
				en: 'Open an old address of a game section — from bookmarks or an old message. «Play» must open, and the browser back arrow must not return to the old address.'
			},
			coverage: 'manual',
			testid: 'moved-play-link',
			negative: true
		}
	]
};
