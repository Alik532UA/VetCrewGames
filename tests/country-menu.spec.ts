import { expect, test, type Page } from './fixtures';
import { reduceMotion, settlePage } from './support/settle';

/**
 * Багатоколонкова панель вибору країни: розкладка й клавіатура в ній.
 *
 * ## Чому цей файл існує
 *
 * Скарга автора зі знімками: «актуальний результат — довгий список; очікуваний —
 * кілька колонок як у CV». Панель була одною вузькою колонкою, і без прокрутки в
 * ній було видно ВІСІМ країн із 262 — на екрані будь-якої ширини, бо ширину й
 * висоту задавали `24rem` і `22rem`, які про вільне місце навколо не знали
 * нічого.
 *
 * Колонки при цьому — не оздоба, а те, що ламає клавіатуру, якщо про неї не
 * подумати: у стовпцях «вниз» природно означає «в межах колонки», а «вправо» —
 * «у сусідню». Тому тут перевіряється саме зв'язка «розкладка + клавіші», і
 * перевіряється натисканням, а не оком.
 *
 * ## ДВА РЕЖИМИ, і кожен перевіряється окремо
 *
 * Друга скарга автора: «актуальний результат — прапор і текст; очікуваний —
 * тільки прапор, але пошук по тексту працює». Тож без запиту панель малює СІТКУ
 * прапорів, а назви й колонки повертаються, щойно набрано літеру.
 *
 * НА ВСІХ СТОРІНКАХ ОДНАКОВО. Доти це залежало від компактного режиму кнопки, і
 * на акаунті панель малювала 262 назви — про це прийшла та сама скарга вдруге.
 * Тепер `compact` стосується лише кнопки; сторінка «Знайди пару» тут і далі
 * компактна, але вигляд панелі з цього більше не випливає.
 *
 * Це знову зв'язка з клавіатурою, і знову інша: у сітці порядок документа йде
 * РЯДКАМИ, тобто наступний пункт лежить праворуч, а «вниз» мусить вести окрема
 * арифметика (`rowNeighbourIn`). Тому нижче парами: сітка без запиту й колонки
 * після набору.
 *
 * ## Що перевіряється деінде
 *
 * Правило сусідства як арифметика — `src/lib/utils/menuColumns.test.ts` (там
 * випадки, яких у справжній панелі не спіймати навмисно). Кольори відкритої
 * панелі в усіх чотирьох темах — `contrast-runtime.spec.ts`. Тут — тільки те, що
 * без справжньої розкладки не існує.
 */

const PAGE = '/VetCrewGames/online/';
const SCOPE = 'pairs-country';

/**
 * Скільки пікселів вважати «та сама колонка» й «той самий рядок».
 *
 * У вікні 1280×720 колонки стоять на ~240px одна від одної, рядок сітки — ~72px
 * (доти, у панелі під кнопкою, — 188 і 44). Допуск у 2px покриває дроби
 * `getBoundingClientRect()` і не дозволяє переплутати сусідів.
 */
const NEAR = 2;

interface Spot {
	id: string;
	left: number;
	top: number;
	text: string;
}

/** Відкрити панель і дочекатися, поки вона стане на місце. */
async function openMenu(page: Page) {
	await reduceMotion(page);
	await page.goto(PAGE);
	await settlePage(page);
	await page.locator(`[data-testid="${SCOPE}-select"]`).click();
	await page.locator(`[data-testid="${SCOPE}-menu"]`).waitFor({ state: 'visible' });
}

/**
 * Активний пункт — той, на який показує `aria-activedescendant`.
 *
 * Координати беруться через `offsetLeft`/`offsetTop`, а не з
 * `getBoundingClientRect()`: перші НЕ залежать від прокрутки списку, а стрілка
 * прокрутку рухає (`scrollIntoView`). З екранними координатами твердження «крок
 * униз збільшує `top`» ламалося б саме на краю видимої частини.
 */
async function activeSpot(page: Page): Promise<Spot | null> {
	return page.evaluate((scope) => {
		const field = document.querySelector(`[data-testid="${scope}-search-input"]`);
		const id = field?.getAttribute('aria-activedescendant') ?? '';
		const option = id ? document.getElementById(id) : null;
		if (!option) return null;
		return {
			id,
			left: option.offsetLeft,
			top: option.offsetTop,
			text: option.textContent?.trim() ?? ''
		};
	}, SCOPE);
}

/**
 * Набрати запит — і тим самим перевести панель у режим НАЗВ.
 *
 * У компактному режимі (а сторінка «Знайди пару» саме такий) панель без запиту
 * малює лише прапори сіткою: назви там нічого не додають, бо кнопка — сам
 * прапор. Назви, колонки й усе, що з них випливає, з'являються рівно тоді, коли
 * набрано хоч літеру, — тобто твердження про колонки треба перевіряти саме
 * після набору, а не «на відкритій панелі».
 *
 * `а` вибрано навмисно: під нього підходять сотні країн, отже колонок лишається
 * кілька, і жодне з наступних тверджень не спирається на короткий список.
 */
async function typeToNames(page: Page, query = 'а') {
	await page.keyboard.type(query);
	await expect(page.locator(`[data-testid="${SCOPE}-menu"] .menu__name`).first()).toBeVisible();
}

/** Каретка в полі пошуку: де стоїть і що виділено. */
async function caret(page: Page) {
	return page.evaluate((scope) => {
		const field = document.querySelector<HTMLInputElement>(`[data-testid="${scope}-search-input"]`);
		return { at: field?.selectionStart ?? -1, value: field?.value ?? '' };
	}, SCOPE);
}

test('панель розкладається в колонки й не вилазить за вікно', async ({ page }) => {
	await openMenu(page);

	const shape = await page.evaluate((scope) => {
		const menu = document.querySelector(`[data-testid="${scope}-menu"]`)!;
		const box = menu.getBoundingClientRect();
		const options = [...menu.querySelectorAll<HTMLElement>('[role="option"]')];
		const scroll = menu.querySelector('[role="listbox"]')!.parentElement!;
		const view = scroll.getBoundingClientRect();
		return {
			columns: new Set(options.map((o) => Math.round(o.offsetLeft))).size,
			options: options.length,
			visible: options.filter((o) => {
				const r = o.getBoundingClientRect();
				return r.top >= view.top - 0.5 && r.bottom <= view.bottom + 0.5;
			}).length,
			overRight: Math.round(box.right - window.innerWidth),
			overBottom: Math.round(box.bottom - window.innerHeight),
			spilling: options.filter((o) => o.scrollWidth > o.clientWidth + 1).length
		};
	}, SCOPE);

	/*
	 * Число колонок НЕ стверджується точним: воно похідне від вільного місця, і
	 * зашите тут «чотири» перетворило б гейт на опис однієї ширини вікна. Але
	 * «більше за одну» — це і є суть скарги, і без цього рядка решта файлу
	 * перевіряла б клавіатуру в списку, у якому колонок немає.
	 */
	expect(
		shape.columns,
		`колонок мусить бути більше однієї: ${JSON.stringify(shape)}`
	).toBeGreaterThan(1);
	expect(shape.options).toBeGreaterThan(200);
	/*
	 * Двадцять — це з великим запасом менше за заміряні сорок при вікні 1280×720,
	 * і водночас утричі більше за вісім, які були до колонок. Тобто рядок
	 * упаде саме тоді, коли панель повернеться до однієї вузької колонки.
	 */
	expect(shape.visible, 'без прокрутки мусить бути видно значно більше, ніж було').toBeGreaterThan(
		20
	);
	expect(shape.overRight, 'панель вилізла за правий край вікна').toBeLessThanOrEqual(0);
	expect(shape.overBottom, 'панель вилізла за низ вікна').toBeLessThanOrEqual(0);
	expect(shape.spilling, 'назва вилізла за свою колонку').toBe(0);
});

test('без запиту розділ — СІТКА прапорів, а заголовок стоїть окремим рядком', async ({ page }) => {
	await openMenu(page);

	/*
	 * Скарга автора: «актуальний результат — прапор і текст; очікуваний — тільки
	 * прапор, але пошук по тексту працює». Тобто без запиту назв бути не мусить, а
	 * прапори мусять стояти сіткою — інакше 262 плитки знову витягуються в колонку.
	 */
	const grid = await page.evaluate((scope) => {
		const menu = document.querySelector(`[data-testid="${scope}-menu"]`)!;
		const group = menu.querySelector('[role="group"]')!;
		const heading = group.querySelector<HTMLElement>('div')!;
		const options = [...group.querySelectorAll<HTMLElement>('[role="option"]')];

		/*
		 * ПРОКРУТКА ЗБИВАЄТЬСЯ ПЕРЕД ЗАМІРОМ, і це не педантизм.
		 *
		 * Заголовок регіону `position: sticky`, тобто при прокрученому списку він
		 * ЇДЕ ВНИЗ за вікном перегляду — і `offsetTop` віддає його зсунуте
		 * положення, а не місце в розкладці. Рядок «заголовок стоїть окремо»
		 * ставав від цього залежним від того, чи хтось встиг прокрутити список:
		 * локально гейт був зелений, а в CI цей самий рядок упав.
		 */
		const scroll = menu.querySelector('[role="listbox"]')!.parentElement!;
		scroll.scrollTop = 0;

		return {
			names: menu.querySelectorAll('.menu__name').length,
			labelled: options.every((o) => (o.getAttribute('aria-label') ?? '').length > 1),
			columns: new Set(options.map((o) => Math.round(o.offsetLeft))).size,
			/*
			 * ГОЛОВНЕ ТВЕРДЖЕННЯ — ШИРИНА, а не координата: «окремим рядком» тут
			 * означає рівно `flex: 0 0 100%` на заголовку. Ширину не зсуває ні
			 * прокрутка, ні `sticky`, ні шрифт, тобто вона стверджує саме те
			 * правило CSS, заради якого рядок і написаний.
			 */
			headingSpans: heading.offsetWidth / group.clientWidth,
			underHeading: options.every((o) => o.offsetTop > heading.offsetTop),
			square: options.every((o) => Math.abs(o.offsetWidth - o.offsetHeight) <= 2)
		};
	}, SCOPE);

	/*
	 * Назва «без прапора» лишається текстом — це не країна, а свідома відповідь
	 * «не показувати», і плиткою її не покажеш. Тому один `.menu__name` тут
	 * законний, а 262 — ні.
	 */
	expect(grid.names, 'назви країн мусять зникнути, поки нічого не набрано').toBeLessThanOrEqual(1);
	expect(grid.labelled, 'пункт без назви в `aria-label` — це «кнопка» для скрінрідера').toBe(true);
	expect(grid.columns, 'прапори мусять стояти сіткою, а не стовпцем').toBeGreaterThan(1);
	expect(
		grid.headingSpans,
		'заголовок мусить займати весь рядок — інакше прапори стануть поруч із ним'
	).toBeGreaterThan(0.9);
	expect(grid.underHeading, 'прапори мусять починатися ПІД заголовком').toBe(true);
	expect(grid.square, 'плитка мусить бути квадратною сенсорною ціллю').toBe(true);
});

test('після набору розділ не розрізаний між колонками, заголовок при своїх країнах', async ({
	page
}) => {
	await openMenu(page);
	await typeToNames(page);

	const groups = await page.evaluate((scope) => {
		const menu = document.querySelector(`[data-testid="${scope}-menu"]`)!;
		return [...menu.querySelectorAll('[role="group"]')].map((group) => {
			const options = [...group.querySelectorAll<HTMLElement>('[role="option"]')];
			const heading = group.querySelector<HTMLElement>('div')!;
			return {
				name: group.getAttribute('aria-label') ?? '',
				count: options.length,
				columns: [...new Set(options.map((o) => Math.round(o.offsetLeft)))],
				headingLeft: Math.round(heading.offsetLeft)
			};
		});
	}, SCOPE);

	expect(groups.length).toBeGreaterThan(1);
	const split = groups.filter((g) => g.columns.length !== 1);
	expect(
		split.map((g) => `${g.name}: ${g.count} країн у ${g.columns.length} колонках`),
		'розділ розрізано між колонками — заголовок лишиться над половиною списку'
	).toEqual([]);
	const orphan = groups.filter((g) => g.headingLeft !== g.columns[0]);
	expect(
		orphan.map((g) => g.name),
		'заголовок розділу стоїть в іншій колонці, ніж його країни'
	).toEqual([]);
});

test('у сітці прапорів «вниз» веде РЯДКОМ нижче, а «вбік» — на плитку', async ({ page }) => {
	await openMenu(page);

	/*
	 * У колонках лінійний крок і є «вниз»: multicol заповнює спершу всю першу
	 * колонку. У сітці порядок документа йде РЯДКАМИ, тобто наступний пункт лежить
	 * ПРАВОРУЧ — і «вниз» мусить веcти інша арифметика (`rowNeighbourIn`). Без
	 * цього 262 прапори проходилися б по одному, і кожен крок «униз» їхав би вбік.
	 */
	await page.keyboard.press('Home');
	const start = await activeSpot(page);
	await page.keyboard.press('ArrowDown');
	const below = await activeSpot(page);
	expect(below!.top, 'крок униз мусить піти нижче').toBeGreaterThan(start!.top);
	expect(
		Math.abs(below!.left - start!.left),
		`крок униз поїхав убік: ${start!.text} → ${below!.text}`
	).toBeLessThanOrEqual(NEAR);

	await page.keyboard.press('ArrowRight');
	const aside = await activeSpot(page);
	expect(aside!.left, 'крок убік мусить перейти на сусідню плитку').toBeGreaterThan(
		below!.left + NEAR
	);
	expect(Math.abs(aside!.top - below!.top), 'крок убік поїхав по висоті').toBeLessThanOrEqual(NEAR);

	await page.keyboard.press('ArrowUp');
	const up = await activeSpot(page);
	expect(up!.top, 'крок угору мусить піти вище').toBeLessThan(aside!.top);

	/*
	 * З першої плитки вліво не веде нікуди — горизонталь не закільцьована
	 * навмисно: «вліво» з початку рядка на його кінець це стрибок через увесь
	 * екран. Перевіряти це можна лише за ПОРОЖНЬОГО запиту: коли в полі щось
	 * набрано, стрілка вбік належить каретці (див. окремий тест про це).
	 */
	await page.keyboard.press('Home');
	const first = await activeSpot(page);
	await page.keyboard.press('ArrowLeft');
	expect((await activeSpot(page))!.id, 'вліво з першої плитки кудись поїхало').toBe(first!.id);
});

test('після набору стрілка вниз іде в межах колонки, вбік — у сусідню', async ({ page }) => {
	await openMenu(page);
	await typeToNames(page);

	// Початок з відомого місця: Home ставить активним найперший пункт панелі.
	await page.keyboard.press('Home');
	const start = await activeSpot(page);
	expect(start).not.toBeNull();

	/*
	 * Дванадцять кроків униз — і всі в одній колонці.
	 *
	 * Дванадцять, а не два: у першій колонці вміщається понад пʼятдесят пунктів,
	 * тож стільки кроків гарантовано не доходять до її кінця, і збіг тут
	 * неможливий.
	 */
	const down: Spot[] = [];
	for (let i = 0; i < 12; i += 1) {
		await page.keyboard.press('ArrowDown');
		const spot = await activeSpot(page);
		expect(spot).not.toBeNull();
		down.push(spot!);
	}

	const strayed = down.filter((s) => Math.abs(s.left - start!.left) > NEAR);
	expect(
		strayed.map((s) => `${s.text} на ${s.left}`),
		'крок униз вивів з колонки, а мусив лишитися в ній'
	).toEqual([]);
	for (let i = 1; i < down.length; i += 1) {
		expect(down[i].top, `крок ${i} не пішов нижче`).toBeGreaterThan(down[i - 1].top);
	}

	// Вправо: інша колонка, та сама висота (з точністю до рядка з переносом).
	const before = down.at(-1)!;
	await page.keyboard.press('ArrowRight');
	const right = await activeSpot(page);
	expect(right!.left, 'стрілка вправо не перейшла в наступну колонку').toBeGreaterThan(
		before.left + NEAR
	);
	expect(
		Math.abs(right!.top - before.top),
		`вправо поїхало по висоті: ${before.text} (${before.top}) → ${right!.text} (${right!.top})`
	).toBeLessThanOrEqual(88);

	/*
	 * «Назад тією самою стрілкою» тут НЕ перевіряється, і це не пропуск: у полі
	 * щось набрано, тож `ArrowLeft` спершу веде КАРЕТКУ — так і задумано, інакше
	 * набране «німеччнина» неможливо було б виправити, не стерши до помилки. Саме
	 * цю пару правил перевіряє тест «стрілки вбік не забирають каретку», а
	 * повернення в ту саму колонку — тест про сітку вище, де запит порожній.
	 */
});

test('стрілки вбік не забирають каретку в полі пошуку', async ({ page }) => {
	await openMenu(page);

	// Запит, під який підходять сотні країн, тобто колонок лишається кілька.
	await page.keyboard.type('а');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"] [role="option"]`).first()).toBeVisible();
	expect((await caret(page)).at, 'каретка мусить стояти в кінці набраного').toBe(1);

	const chosen = await activeSpot(page);

	// Тесту потрібна колонка ПРАВОРУЧ від активного пункту, а стартує він з поточної
	// країни. Її фіксує `fixCountry` у фікстурах: на раннері CI зі США активною ставала
	// країна в останній колонці, і тест падав нижче незрозумілим «386 > 388».
	const lastColumn = await page
		.locator(`[data-testid="${SCOPE}-menu"] [role="option"]`)
		.evaluateAll((options) =>
			Math.max(...options.map((option) => (option as HTMLElement).offsetLeft))
		);
	expect(chosen!.left, 'активний пункт уже в останній колонці — праворуч іти нікуди').toBeLessThan(
		lastColumn - NEAR
	);

	// Каретка в кінці, стрілка ВЛІВО — рухається каретка, активний пункт стоїть.
	await page.keyboard.press('ArrowLeft');
	expect((await caret(page)).at).toBe(0);
	expect((await activeSpot(page))!.id, 'вліво посеред набраного зрушило список').toBe(chosen!.id);

	// Каретка на початку, стрілка ВПРАВО — знову рухається каретка.
	await page.keyboard.press('ArrowRight');
	expect((await caret(page)).at).toBe(1);
	expect((await activeSpot(page))!.id, 'вправо посеред набраного зрушило список').toBe(chosen!.id);

	// А тепер каретка вже в кінці — і та сама клавіша веде в сусідню колонку.
	await page.keyboard.press('ArrowRight');
	const aside = await activeSpot(page);
	expect(aside!.left, 'з краю набраного стрілка вбік мусить перейти в колонку').toBeGreaterThan(
		chosen!.left + NEAR
	);
	expect((await caret(page)).value, 'набране не мусило змінитися').toBe('а');
});

/**
 * ВИБІР — ОКРЕМЕ ВІКНО НА ПОНАД 90% ЕКРАНА, і воно в `<body>`.
 *
 * Прохання автора 2026-09-29: «реалізований як випадаючий список під кнопкою, як
 * наслідок користувач бачить невелике вікно на 15–25% екрану; очікуваний — окреме
 * вікно, щоб більше 90% було зайнято активністю, по прикладу вибору аватарки».
 * Відповідь на уточнення — «~90% екрана скрізь», тобто і на телефоні, і на
 * ноутбуці; тому розміри нижче парою.
 *
 * `<body>` — не звичка, а те, що тримає «понад 90%» і «не за екраном» разом: хаб
 * росте до екрана одним `zoom` (`fitToViewport`), а верхній шар `<dialog>` масштаб
 * предків успадковує. Вікно, лишене в хабі, було б 94% × масштаб, тобто за краєм.
 * Та сама причина, що й у вибору аватарки.
 *
 * Зворотні експерименти (2026-09-29), кожен червоний уже на 390×844: без `toBody` —
 * «вікно мусить бути в body»; вікно завбільшки як у аватарки (30rem × 36rem) —
 * «понад 90% висоти»; без розміру зовсім — «за нижнім краєм» (вікно міряється
 * вмістом, тобто 262 прапорами); `open` замість `showModal()` — «модальне».
 */
test('вибір — окреме вікно в body, понад 90% екрана і на телефоні, і на ноутбуці', async ({
	page
}) => {
	for (const size of [
		{ width: 390, height: 844 },
		{ width: 1280, height: 720 }
	]) {
		await page.setViewportSize(size);
		await openMenu(page);

		const place = await page.evaluate((scope) => {
			const menu = document.querySelector<HTMLElement>(`[data-testid="${scope}-menu"]`)!;
			const dialog = menu.closest('dialog');
			const box = document
				.querySelector<HTMLElement>(`[data-testid="${scope}-panel"]`)!
				.getBoundingClientRect();
			return {
				parent: dialog?.parentElement?.tagName,
				modal: dialog?.matches(':modal') ?? false,
				wide: box.width / innerWidth,
				tall: box.height / innerHeight,
				overRight: Math.round(box.right - innerWidth),
				overBottom: Math.round(box.bottom - innerHeight),
				focused: document.activeElement?.getAttribute('data-testid')
			};
		}, SCOPE);

		const at = `${size.width}×${size.height}`;
		expect(place.parent, `${at}: вікно мусить бути в body, а не в хабі під zoom`).toBe('BODY');
		expect(place.modal, `${at}: вікно модальне — сторінка під ним неактивна`).toBe(true);
		expect(place.wide, `${at}: вікно займає понад 90% ширини`).toBeGreaterThan(0.9);
		expect(place.tall, `${at}: вікно займає понад 90% висоти`).toBeGreaterThan(0.9);
		expect(place.overRight, `${at}: вікно за правим краєм`).toBeLessThanOrEqual(0);
		expect(place.overBottom, `${at}: вікно за нижнім краєм`).toBeLessThanOrEqual(0);
		expect(place.focused, `${at}: фокус — у полі пошуку`).toBe(`${SCOPE}-search-input`);

		// «Закрити» у вікні: вікно зникає, фокус вертається на кнопку.
		await page.getByTestId(`${SCOPE}-close-btn`).click();
		await expect(page.locator(`[data-testid="${SCOPE}-menu"]`)).toHaveCount(0);
		await expect(page.locator(`[data-testid="${SCOPE}-select"]`)).toBeFocused();
	}

	// Клік по тлу (кут екрана — поза вікном) теж закриває.
	await page.locator(`[data-testid="${SCOPE}-select"]`).click();
	await page.locator(`[data-testid="${SCOPE}-menu"]`).waitFor({ state: 'visible' });
	await page.mouse.click(2, 2);
	await expect(page.locator(`[data-testid="${SCOPE}-menu"]`)).toHaveCount(0);
});

/**
 * Слова назв, що стоять на РІЗНИХ рядках, — тобто назва розірвана посеред слова.
 *
 * `spilling` у першому тесті цього не бачить і не може: `.menu__name` має
 * `overflow-wrap: break-word`, тож задовге слово не вилазить за колонку, а рветься.
 *
 * Рядок літери — її `top`, але з допуском у пів висоти: `formatFont` малює «є»,
 * «ї» й «ґ» іншим шрифтом в окремому вузлі (а «ї» й «ґ» ще й зсуває на 0,06em
 * униз), тож верх такого гліфа стоїть на піксель-два інакше. Без допуску «Україна»
 * й «Єгипет» виходили б «розірваними» на будь-якому екрані — заміряно. Дефіс — законне місце розриву («Гвінея-Бісау»), тож слово ним
 * закінчується.
 */
async function brokenWords(page: Page): Promise<{ broken: string[]; names: string[] }> {
	return page.evaluate((scope) => {
		const names = [
			...document.querySelectorAll<HTMLElement>(`[data-testid="${scope}-menu"] .menu__name`)
		];
		const broken: string[] = [];
		for (const name of names) {
			const chars: { ch: string; top: number; h: number }[] = [];
			const walker = document.createTreeWalker(name, NodeFilter.SHOW_TEXT);
			for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text) {
				for (let i = 0; i < node.length; i += 1) {
					const range = document.createRange();
					range.setStart(node, i);
					range.setEnd(node, i + 1);
					const rect = range.getClientRects()[0];
					if (rect) chars.push({ ch: node.data[i], top: rect.top, h: rect.height });
				}
			}
			let word: typeof chars = [];
			const flush = () => {
				if (word.length > 1) {
					const tops = word.map((c) => c.top);
					const lines = Math.max(...tops) - Math.min(...tops);
					if (lines > 0.5 * Math.max(...word.map((c) => c.h))) {
						broken.push(word.map((c) => c.ch).join(''));
					}
				}
				word = [];
			};
			for (const c of chars) {
				if (/\s/.test(c.ch)) flush();
				else {
					word.push(c);
					if (c.ch === '-') flush();
				}
			}
			flush();
		}
		return { broken, names: names.map((n) => n.closest('[role="option"]')?.id ?? '') };
	}, SCOPE);
}

/**
 * НАЗВИ НЕ РВУТЬСЯ ПОСЕРЕД СЛОВА — і на ноутбуці, і на Full HD (2026-09-29).
 *
 * Вікно росте з екраном (`.fill`), і кегель назв із ним. Колонка, що лишилася 11rem,
 * дала на Full HD «Азербайд-жан» і «Аргентин-а»; колонка в 11 одиниць — одну
 * «Центральноафриканську». Тому розмір саме парою: на 1280×720 обидві помилки
 * мовчать, і ловить їх лише великий екран.
 *
 * Сім запитів — щоб пройти майже всі назви, а не лише ті, що під «а»: канарка
 * нижче стверджує, скільки різних назв оглянуто.
 *
 * Зворотний експеримент (2026-09-29): колонка 11 одиниць — червоніє 1920×1080,
 * «назва розірвана посеред слова». Колонку в 11rem видно на знімку, зробленому до
 * тесту: на 1920×1080 рвалися «Азербайджан», «Бангладеш», «Аргентина» та інші.
 */
test('після набору назви не рвуться посеред слова — на ноутбуці й на Full HD', async ({ page }) => {
	for (const size of [
		{ width: 1280, height: 720 },
		{ width: 1920, height: 1080 }
	]) {
		await page.setViewportSize(size);
		await openMenu(page);
		const seen = new Set<string>();
		const broken = new Set<string>();
		for (const query of ['а', 'о', 'і', 'е', 'у', 'и', 'я']) {
			await page.getByTestId(`${SCOPE}-search-input`).fill(query);
			await expect(page.locator(`[data-testid="${SCOPE}-menu"] .menu__name`).first()).toBeVisible();
			const found = await brokenWords(page);
			for (const id of found.names) seen.add(id);
			for (const word of found.broken) broken.add(word);
		}
		const at = `${size.width}×${size.height}`;
		expect(seen.size, `${at}: оглянуто замало назв`).toBeGreaterThan(240);
		expect([...broken], `${at}: назва розірвана посеред слова`).toEqual([]);
	}
});

/**
 * `Tab` ВЕДЕ ДО «ЗАКРИТИ», а не стоїть на полі (2026-09-29). Доти, у саморобній панелі,
 * `Tab` затримувався навмисно, і вихід був один — `Escape`. У модальному вікні фокус на
 * сторінку й так не піде, а затримка лише ховала б кнопку закриття від клавіатури.
 * Зворотний експеримент: повернена затримка `Tab` — червоніє перше ж `toBeFocused`.
 */
test('Shift+Tab із поля пошуку веде на «Закрити», Escape закриває', async ({ page }) => {
	await openMenu(page);
	await page.keyboard.press('Shift+Tab');
	await expect(page.getByTestId(`${SCOPE}-close-btn`)).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"]`)).toHaveCount(0);
	await expect(page.locator(`[data-testid="${SCOPE}-select"]`)).toBeFocused();
});

test('набір, Enter, Escape і порожній результат', async ({ page }) => {
	await openMenu(page);

	// Набір фільтрує, а активним стає перший рядок, що лишився.
	await page.keyboard.type('нім');
	const found = await activeSpot(page);
	expect(found!.text).toContain('меччина');

	await page.keyboard.press('Enter');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"]`)).toHaveCount(0);
	/*
	 * Вибране читається з КНОПКИ, а не з підпису значення окремо: у компактному
	 * режимі той підпис лишається в DOM візуально прихованим (він потрібен
	 * `aria-labelledby`), і власного локатора в нього немає — лише `id`.
	 */
	await expect(page.locator(`[data-testid="${SCOPE}-select"]`)).toContainText('меччина');
	await expect(page.locator(`[data-testid="${SCOPE}-select"]`)).toBeFocused();

	// Escape закриває й вертає фокус на кнопку.
	await page.locator(`[data-testid="${SCOPE}-select"]`).click();
	await page.locator(`[data-testid="${SCOPE}-menu"]`).waitFor({ state: 'visible' });
	await page.keyboard.press('Escape');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"]`)).toHaveCount(0);
	await expect(page.locator(`[data-testid="${SCOPE}-select"]`)).toBeFocused();

	// Порожній результат: жодного пункта й видимий напис.
	await page.locator(`[data-testid="${SCOPE}-select"]`).click();
	await page.locator(`[data-testid="${SCOPE}-menu"]`).waitFor({ state: 'visible' });
	await page.keyboard.type('жжщ');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"] [role="option"]`)).toHaveCount(0);
	await expect(page.locator(`[data-testid="${SCOPE}-empty-text"]`)).toBeVisible();
	expect(await activeSpot(page), 'активного пункта в порожньому списку бути не може').toBeNull();
});
