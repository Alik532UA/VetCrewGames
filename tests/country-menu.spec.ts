import { expect, test, type Page } from '@playwright/test';
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
 * ## Що перевіряється деінде
 *
 * Правило сусідства як арифметика — `src/lib/utils/menuColumns.test.ts` (там
 * випадки, яких у справжній панелі не спіймати навмисно). Кольори відкритої
 * панелі в усіх чотирьох темах — `contrast-runtime.spec.ts`. Тут — тільки те, що
 * без справжньої розкладки не існує.
 */

const PAGE = '/VetCrewGames/pairs/online/';
const SCOPE = 'pairs-country';

/**
 * Скільки пікселів вважати «та сама колонка» й «той самий рядок».
 *
 * Колонки стоять на ~188px одна від одної, рядок — 44px. Допуск у 2px покриває
 * дроби `getBoundingClientRect()` і не дозволяє переплутати сусідів.
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

test('розділ не розрізаний між колонками, заголовок при своїх країнах', async ({ page }) => {
	await openMenu(page);

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

test('стрілка вниз іде в межах колонки, вбік — у сусідню', async ({ page }) => {
	await openMenu(page);

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

	// І назад — у ту саму колонку, звідки прийшли.
	await page.keyboard.press('ArrowLeft');
	const back = await activeSpot(page);
	expect(
		Math.abs(back!.left - before.left),
		'стрілка вліво не повернула в колонку'
	).toBeLessThanOrEqual(NEAR);

	// З першої колонки вліво не веде нікуди: без стрибка через увесь екран.
	await page.keyboard.press('Home');
	const first = await activeSpot(page);
	await page.keyboard.press('ArrowLeft');
	expect((await activeSpot(page))!.id, 'вліво з першої колонки кудись поїхало').toBe(first!.id);
});

test('стрілки вбік не забирають каретку в полі пошуку', async ({ page }) => {
	await openMenu(page);

	// Запит, під який підходять сотні країн, тобто колонок лишається кілька.
	await page.keyboard.type('а');
	await expect(page.locator(`[data-testid="${SCOPE}-menu"] [role="option"]`).first()).toBeVisible();
	expect((await caret(page)).at, 'каретка мусить стояти в кінці набраного').toBe(1);

	const chosen = await activeSpot(page);

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
