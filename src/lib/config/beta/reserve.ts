import type { BetaTab } from '../betaChecks';

/**
 * Заповідник — партія, що триває, а не раунд. Звідси й характер перевірок:
 * майже все тут про те, чи витримує стан час, перезавантаження й другу ділянку.
 *
 * Найважливіші пункти — про підписи змін показників. Показник, що змінився без
 * причини, неможливо ні перевірити, ні оскаржити: людина бачить «-235» і не має
 * жодного способу дізнатися, за що.
 */
export const reserveTab: BetaTab = {
	id: 'reserve',
	title: { uk: 'Заповідник', en: 'The reserve' },
	routes: ['reserve/forest', 'reserve/tundra', 'reserve/savanna', 'reserve/rainforest'],
	checks: [
		{
			id: 'reserve_1',
			category: { uk: 'Початок партії', en: 'Starting out' },
			text: {
				uk: 'Виберіть ділянку. Заповідник мусить будуватися зі смужкою поступу, яка рухається, — а не завмирати на кілька секунд без жодної ознаки життя.',
				en: 'Pick a site. The reserve must build with a progress bar that moves — not freeze for a few seconds with no sign of life.'
			},
			coverage: 'manual'
		},
		{
			id: 'reserve_2',
			category: { uk: 'Початок партії', en: 'Starting out' },
			text: {
				uk: 'Відкрийте дві різні ділянки, скажімо ліс і савану. Це дві окремі партії: гроші й тварини однієї не мусять зʼявлятися в другій.',
				en: 'Open two different sites, say the forest and the savanna. These are two separate games: money and animals from one must not show up in the other.'
			},
			coverage: 'covered',
			test: 'src/lib/reserve/save.test.ts',
			negative: true
		},
		{
			id: 'reserve_3',
			category: { uk: 'Тварини й вольєри', en: 'Animals and enclosures' },
			text: {
				uk: 'Придивіться до тварин у вольєрах: у них мусять бути голова, лапи й хвіст, і різні види мусять бути різними на вигляд — не однаковими капсулами.',
				en: 'Look closely at the animals in the enclosures: they must have a head, legs and a tail, and different species must look different — not like identical capsules.'
			},
			coverage: 'manual'
		},
		{
			id: 'reserve_4',
			category: { uk: 'Тварини й вольєри', en: 'Animals and enclosures' },
			text: {
				uk: 'Порівняйте, скільки місця у вольєрі займають слон, орел і мишка. Різниця мусить бути помітна на око, і жодна тварина не мусить губитися точкою у своєму вольєрі.',
				en: 'Compare how much of an enclosure an elephant, an eagle and a mouse take up. The difference must be visible to the eye, and no animal may shrink to a dot inside its own enclosure.'
			},
			coverage: 'covered',
			test: 'src/lib/components/reserve/anatomy.test.ts'
		},
		{
			id: 'reserve_5',
			category: { uk: 'Тварини й вольєри', en: 'Animals and enclosures' },
			text: {
				uk: 'Натисніть на тварину. Її вікно мусить відкритися ПОВЕРХ нижньої смуги й мінікарти, і його мусить бути чим закрити.',
				en: 'Click an animal. Its window must open ON TOP of the bottom bar and the minimap, and there must be a way to close it.'
			},
			coverage: 'manual',
			testid: 'reserve-animal-*-btn'
		},
		{
			id: 'reserve_6',
			category: { uk: 'Тварини й вольєри', en: 'Animals and enclosures' },
			text: {
				uk: 'Натисніть на ПОРОЖНІЙ вольєр. Мусить відкритися вікно самого вольєра — з його станом і кнопками — а не вікно тварини й не нічого.',
				en: 'Click an EMPTY enclosure. The enclosure window must open — with its condition and its buttons — not an animal window and not nothing at all.'
			},
			coverage: 'manual',
			testid: 'reserve-enclosure-*-btn'
		},
		{
			id: 'reserve_7',
			category: { uk: 'Показники й гроші', en: 'Numbers and money' },
			text: {
				uk: 'Натисніть на показник у шапці, щоб побачити історію. Кожен рядок мусить називати ПРИЧИНУ: зарплату, корм, ремонт — а не просто число.',
				en: 'Click a number in the header to see its history. Every row must name a REASON — wages, feed, repairs — not just an amount.'
			},
			coverage: 'covered',
			test: 'src/lib/reserve/ledger.test.ts',
			testid: 'reserve-*-history-btn'
		},
		{
			id: 'reserve_8',
			category: { uk: 'Показники й гроші', en: 'Numbers and money' },
			text: {
				uk: 'Складіть суми в історії показника. Вони мусять дати саму зміну показника, а рядка «Інше» з великою сумою в списку бути не мусить.',
				en: 'Add up the amounts in a numbers history. They must equal the change in that number, and there must be no «Other» row carrying a large amount.'
			},
			coverage: 'covered',
			test: 'src/lib/reserve/ledger.test.ts',
			negative: true
		},
		{
			id: 'reserve_9',
			category: { uk: 'Показники й гроші', en: 'Numbers and money' },
			text: {
				uk: 'Наведіть курсор на відкрите вікно історії й потримайте. Воно не мусить закриватися саме, поки курсор усередині.',
				en: 'Move the cursor onto an open history window and hold it there. The window must not close by itself while the cursor is inside.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'reserve_10',
			category: { uk: 'Показники й гроші', en: 'Numbers and money' },
			text: {
				uk: 'Лишіть тварині незакриту потребу на кілька днів і наймайте персонал. Стрес мусить лишатися помітним: жодна кількість працівників не опускає його до нуля, поки потреба відкрита.',
				en: 'Leave an animal with an unmet need for a few days and keep hiring staff. Stress must stay visible: no amount of staff brings it to zero while the need is open.'
			},
			coverage: 'covered',
			test: 'src/lib/reserve/care.test.ts',
			negative: true
		},
		{
			id: 'reserve_11',
			category: { uk: 'Збереження', en: 'Saving' },
			text: {
				uk: 'Перезавантажте сторінку посеред партії. Тварини, гроші й номер дня мусять лишитися ті самі.',
				en: 'Reload the page in the middle of a game. The animals, the money and the day number must stay the same.'
			},
			coverage: 'covered',
			test: 'src/lib/reserve/save.test.ts'
		},
		{
			id: 'reserve_12',
			category: { uk: 'Збереження', en: 'Saving' },
			text: {
				uk: 'Натисніть «Почати все заново», тоді перезавантажте сторінку. Гроші мусять бути початковими, а вольєри порожніми — стара партія не мусить повернутися.',
				en: 'Press «Start over», then reload the page. The money must be back to its starting amount and the enclosures empty — the old game must not come back.'
			},
			coverage: 'covered',
			test: 'src/lib/controllers/reserve.svelte.test.ts',
			testid: 'reserve-startover-btn',
			negative: true
		},
		{
			id: 'reserve_13',
			category: { uk: 'Мінікарта й камера', en: 'Minimap and camera' },
			text: {
				uk: 'Відкрийте мінікарту, тоді натисніть на тварину. Вікно тварини мусить бути поверх мінікарти, і мінікарту мусить бути чим закрити.',
				en: 'Open the minimap, then click an animal. The animal window must sit above the minimap, and there must be a way to close the minimap.'
			},
			coverage: 'manual',
			testid: 'reserve-minimap-panel'
		},
		{
			id: 'reserve_14',
			category: { uk: 'Мінікарта й камера', en: 'Minimap and camera' },
			text: {
				uk: 'На телефоні поводіть по заповіднику пальцем і зведіть двома пальцями. Сцена мусить рухатися й масштабуватися, а сторінка під нею — не прокручуватися.',
				en: 'On a phone drag across the reserve with one finger and pinch with two. The scene must pan and zoom while the page underneath must not scroll.'
			},
			coverage: 'manual',
			negative: true
		},
		{
			id: 'reserve_15',
			category: { uk: 'Сповіщення подій', en: 'Event notifications' },
			text: {
				uk: 'Візьміть врятовану тварину без ветеринара й пустіть час на ×5. Коли здоровʼя дійде нуля, ЗВЕРХУ ЛІВОРУЧ мусить прийти сповіщення «Тварина померла від хвороби» — тварина не має зникати молча. Найміть ветеринара до іншої: коли вилікується, мусить прийти «Тварина одужала».',
				en: 'Take a rescued animal without a vet and run time at ×5. When health reaches zero a notification «An animal died of illness» must appear TOP LEFT — the animal must not vanish silently. Hire a vet for another one: when it recovers, «An animal has recovered» must appear.'
			},
			coverage: 'manual',
			testid: 'reserve-card-health'
		},
		{
			id: 'reserve_16',
			category: { uk: 'Сповіщення подій', en: 'Event notifications' },
			text: {
				uk: 'Дочекайтеся браконьєрів і НЕ відповідайте на вікно. Коли терпіння вийде, мусить прийти окреме сповіщення про те, що тварину забрали, бо ви не відповіли, — а не тиша. Сповіщення НЕ мусить накривати показники зверху.',
				en: 'Wait for poachers and do NOT answer the window. When their patience runs out a separate notification must say the animal was taken because you did not answer — not silence. The notification must NOT cover the stats at the top.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'reserve-hud-header'
		},
		{
			id: 'reserve_17',
			category: { uk: 'Вибір без працівника', en: 'Choice without a worker' },
			text: {
				uk: 'Візьміть врятовану тварину й НЕ наймайте лікаря. Коли її здоровʼя впаде нижче половини, мусить зʼявитися вікно з трьома кнопками — найняти, зробити самому, нічого не робити — і час мусить СТАТИ, поки вікно відкрите.',
				en: 'Take a rescued animal and do NOT hire a vet. When its health drops below half, a window with three buttons must appear — hire, do it yourself, do nothing — and time must STOP while the window is open.'
			},
			coverage: 'manual',
			testid: 'reserve-care-panel'
		},
		{
			id: 'reserve_18',
			category: { uk: 'Вибір без працівника', en: 'Choice without a worker' },
			text: {
				uk: 'Натисніть «Зробити самому»: мусить запуститися перевірка на пʼять раундів — над дошкою смуга з пʼяти позначок, під нею рядок «Балів». Кожен раунд — ІНША міні-гра, і після кожної відповіді мусить зʼявитися розбір із кнопкою «Далі», а не одразу наступне питання. Наберіть понад 70% балів — здоровʼя тварини мусить підрости так само, як від дня роботи лікаря. Наберіть менше — день витрачено, здоровʼя не змінилося.',
				en: 'Press “Do it yourself”: a five-round trial must start — a five-segment bar above the board and a “Points” line below it. Every round is a DIFFERENT mini-game, and after each answer the review with a “Next” button must appear instead of the next question straight away. Score over 70% of points — the animal’s health must rise as much as from one day of a vet. Score less — the day is spent and health does not change.'
			},
			coverage: 'manual',
			testid: 'reserve-trial-panel'
		},
		{
			id: 'reserve_19',
			category: { uk: 'Вибір без працівника', en: 'Choice without a worker' },
			text: {
				uk: 'Натисніть «Нічого не робити». Наступного дня про ЦЮ САМУ тварину питати НЕ мусить — витримка пʼять діб, щоб питання не стало щоденним. Про іншу тварину спитати може.',
				en: 'Press “Do nothing”. The next day it must NOT ask about THAT SAME animal — there is a five-day cooldown so the question does not become daily. It may ask about another animal.'
			},
			negative: true,
			coverage: 'manual',
			testid: 'reserve-care-ignore-btn'
		},
		{
			id: 'reserve_20',
			category: { uk: 'Браконьєри', en: 'Poachers' },
			text: {
				uk: 'Коли прийдуть браконьєри, виберіть «Вийти самому». Замість списку тактик мусить відкритися та сама перевірка на пʼять раундів із пʼятьох різних міні-ігор: понад 70% балів — тварина лишається, менше — її забирають. Кнопка мусить бути доступна без грошей і без рейнджера.',
				en: 'When poachers come, choose “Go out yourself”. Instead of the tactic list the same five-round trial of five different mini-games must open: over 70% of points keeps the animal, less loses it. The button must be available without money and without a ranger.'
			},
			coverage: 'manual',
			testid: 'reserve-trial-panel'
		},
		{
			id: 'reserve_21',
			category: { uk: 'Вольєри', en: 'Enclosures' },
			text: {
				uk: 'Побудуйте три вольєри поспіль — простий, добрий і відмінний — і наблизьте камеру. Паркани мусять виглядати ПО-РІЗНОМУ: простий низький і сірий, добрий із свіжої деревини, відмінний вищий, світло-сірий, із трьома жердинами й накривками на стовпчиках. Дочекайтеся зносу відмінного нижче 60% — його паркан мусить стати таким, як у доброго.',
				en: 'Build three enclosures in a row — simple, good and excellent — and zoom the camera in. The fences must look DIFFERENT: the simple one low and grey, the good one fresh wood, the excellent one taller, light grey, with three rails and caps on the posts. Let the excellent one wear below 60% — its fence must become the same as the good one’s.'
			},
			coverage: 'manual'
		}
	]
};
