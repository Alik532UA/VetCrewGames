import { expect, test, type Page } from './fixtures';
import { APP_PAGES } from './support/pages';
import { reduceMotion, settlePage } from './support/settle';

/**
 * ВМІСТ ЗАЙМАЄ ЕКРАН, І РОСТЕ ВСЕ ОДНИМ МАСШТАБОМ (прохання автора 2026-09-27).
 *
 * Спершу: «чому у нас 95% порожнє, а ми мілким елементом пишемо інформацію? знайти і
 * виправити всі місця, де контент займає менше 30% екрану». Потім, після першої спроби:
 * «масштабування не пропорційне, маленький хедар, частина кнопок великі, в яких текст
 * займає всього 10%». Звідси три перевірки нижче, по одній на кожну частину двох прохань.
 *
 * ## Що знайшлося, коли перевірку писали
 *
 * Заміряно 2026-09-27 на 1280×800, до правок. Підкладка «Чекаємо: …» займала 0,8% екрана,
 * «Грати» 4,3%, «Вікторина» 7,3%, 404 10,6%, головне меню 12%. Вікно «хто зможе зайти» 12,7%,
 * «Де живем?» 15,2%, «Кого більше?» 17,7%, акаунт 21%. Тобто нижче межі було майже все, що
 * не гра з картками, а ігри — лише тому, що їх масштаб умів тільки зменшуватися.
 *
 * ## Як міряється частка
 *
 * Прямокутник, що обіймає весь вміст `main`: текст, кнопки, посилання, картинки, поля й усе,
 * що має власне тло. Він ділиться на площу вікна під шапкою. Обгортки й підкладки на весь
 * екран (≥ 90% площі) не рахуються: це фон, а не вміст. Міра навмисно щедра до розкиданого
 * вмісту — два кутові рядки дали б великий прямокутник — і саме тому нижча межа тут 30%, а
 * не 50%: вона ловить «дрібне посеред порожнечі», а не оцінює композицію.
 *
 * ## Межа перевірки
 *
 * Стан одразу після переходу, як у `reflow.spec.ts`. Вікна кімнат, лобі й підкладка
 * очікування потребують бази й сюди не входять; їх заміряно тими самими числами руками,
 * на тимчасовому маршруті над `LocalRoom`. «Заповідник» (`/reserve/`) — виняток із причиною:
 * це недобудована гра, видна лише в роботі, і вона вже на 1280×800 прокручується, тобто їй
 * бракує не масштабу, а розкладки на два стовпці. Виняток названо, а не сховано.
 */

const SCREENS = [
	{ width: 1280, height: 800, why: 'ноутбук' },
	{ width: 1600, height: 800, why: 'вікно автора (знімок 2000×991 при 125%)' },
	{ width: 1920, height: 1080, why: 'монітор' },
	{ width: 390, height: 844, why: 'телефон' }
];

const MIN_SHARE = 0.3;

const EXEMPT: Record<string, string> = {
	'/VetCrewGames/reserve/':
		'недобудована гра лише для роботи; прокручується вже на 1280×800 — потрібна розкладка, а не масштаб'
};

/**
 * Масштаб ігор (`fitToViewport`) стає не одразу: вимір відкладений на 140 мс спокою. Чекаємо,
 * доки `zoom` сторінки перестане мінятися між двома зчитуваннями.
 */
async function waitForZoom(page: Page) {
	const read = () =>
		page.evaluate(() =>
			Array.from(document.querySelectorAll<HTMLElement>('main [style*="zoom"]'))
				.map((el) => el.style.zoom)
				.join('|')
		);
	let previous = await read();
	for (let attempt = 0; attempt < 10; attempt += 1) {
		await page.waitForTimeout(250);
		const current = await read();
		if (current === previous) return;
		previous = current;
	}
}

async function contentShare(page: Page) {
	return page.evaluate(() => {
		const header = document.querySelector('.game-header');
		const main = document.querySelector('main');
		const top = header ? header.getBoundingClientRect().bottom : 0;
		const width = document.documentElement.clientWidth;
		const height = window.innerHeight;
		const available = width * (height - top);
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		const add = (box: DOMRect) => {
			if (box.width <= 0 || box.height <= 0) return;
			const left = Math.max(box.left, 0);
			const upper = Math.max(box.top, top);
			const right = Math.min(box.right, width);
			const lower = Math.min(box.bottom, height);
			if (right <= left || lower <= upper) return;
			x0 = Math.min(x0, left);
			y0 = Math.min(y0, upper);
			x1 = Math.max(x1, right);
			y1 = Math.max(y1, lower);
		};
		if (!main) return { share: -1, main: false };

		const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!node.textContent?.trim() || !node.parentElement) continue;
			if (getComputedStyle(node.parentElement).visibility === 'hidden') continue;
			const range = document.createRange();
			range.selectNodeContents(node);
			for (const box of range.getClientRects()) add(box);
		}
		const INTERACTIVE = ['BUTTON', 'A', 'IMG', 'SVG', 'INPUT', 'TEXTAREA', 'SELECT', 'CANVAS'];
		for (const element of main.querySelectorAll('*')) {
			const box = element.getBoundingClientRect();
			if (box.width * box.height >= 0.9 * available) continue;
			const style = getComputedStyle(element);
			if (style.display === 'none' || style.visibility === 'hidden') continue;
			const painted =
				(style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') ||
				style.backgroundImage !== 'none';
			if (INTERACTIVE.includes(element.tagName.toUpperCase()) || painted) add(box);
		}
		const share = x1 > x0 ? ((x1 - x0) * (y1 - y0)) / available : 0;
		return { share, main: true };
	});
}

test.describe('вміст займає щонайменше 30% екрана під шапкою', () => {
	for (const { width, height, why } of SCREENS) {
		test.describe(`${width}×${height} — ${why}`, () => {
			test.use({ viewport: { width, height } });

			for (const url of APP_PAGES) {
				if (url in EXEMPT) continue;
				test(`${url}`, async ({ page }) => {
					await reduceMotion(page);
					await page.goto(url);
					await settlePage(page);
					await waitForZoom(page);

					const measured = await contentShare(page);
					expect(measured.main, 'на сторінці немає <main> — міряти нема чого').toBe(true);
					expect(
						measured.share,
						`вміст займає ${(measured.share * 100).toFixed(1)}% екрана під шапкою`
					).toBeGreaterThanOrEqual(MIN_SHARE);
				});
			}
		});
	}

	test('винятки справжні: кожен названий виняток є серед сторінок', () => {
		for (const url of Object.keys(EXEMPT)) expect(APP_PAGES as readonly string[]).toContain(url);
	});
});

/*
 * «Частина кнопок великі, в яких текст займає всього 10%» — на 1600×800 плитка «Грати» була
 * 1085×237 px на знімку автора з підписом 155×30, тобто 1,8% площі. Тепер у плитці значок і
 * підпис від тієї самої одиниці, що й поля, і їхня частка однакова на будь-якому екрані.
 * Межа 12% — з запасом в обидва боки: плитка зараз дає понад 20%, рядок переліку понад 30%.
 */
const MIN_FILL = 0.12;
const MENUS = ['/VetCrewGames/', '/VetCrewGames/play/', '/VetCrewGames/quiz/play/'];

test.describe('кнопка меню — не коробка з дрібним текстом', () => {
	for (const viewport of [
		{ width: 1600, height: 800 },
		{ width: 390, height: 844 }
	]) {
		test.describe(`${viewport.width}×${viewport.height}`, () => {
			test.use({ viewport });

			for (const url of MENUS) {
				test(`${url}`, async ({ page }) => {
					await reduceMotion(page);
					await page.goto(url);
					await settlePage(page);

					const buttons = await page.evaluate(() =>
						Array.from(document.querySelectorAll<HTMLElement>('.menu-btn')).map((button) => {
							const own = button.getBoundingClientRect();
							let x0 = Infinity;
							let y0 = Infinity;
							let x1 = -Infinity;
							let y1 = -Infinity;
							const boxes: DOMRect[] = [];
							// Значок або логотип (`img`) плюс підпис — усе, чим кнопка каже, що вона таке.
							for (const mark of button.querySelectorAll('svg, img'))
								boxes.push(mark.getBoundingClientRect());
							const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
							for (let node = walker.nextNode(); node; node = walker.nextNode()) {
								if (!node.textContent?.trim()) continue;
								const range = document.createRange();
								range.selectNodeContents(node);
								boxes.push(...range.getClientRects());
							}
							for (const box of boxes) {
								if (box.width <= 0 || box.height <= 0) continue;
								x0 = Math.min(x0, box.left);
								y0 = Math.min(y0, box.top);
								x1 = Math.max(x1, box.right);
								y1 = Math.max(y1, box.bottom);
							}
							const content = x1 > x0 ? (x1 - x0) * (y1 - y0) : 0;
							return {
								label: button.textContent?.trim() ?? '',
								fill: content / (own.width * own.height)
							};
						})
					);

					expect(
						buttons.length,
						'кнопок меню не знайдено — перевірка дивиться не туди'
					).toBeGreaterThan(0);
					const empty = buttons.filter((button) => button.fill < MIN_FILL);
					expect(
						empty.map((b) => `«${b.label}»: ${(b.fill * 100).toFixed(1)}%`),
						'вміст займає замалу частку кнопки'
					).toEqual([]);
				});
			}
		});
	}
});

/*
 * «Масштабування не пропорційне, маленький хедар»: шапка стояла на пікселях, а меню під нею
 * росло. Пропорція між кнопкою шапки й підписом плитки мусить бути та сама на телефоні й на
 * великому екрані — тоді більший екран означає той самий інтерфейс, лише більший.
 */
test('шапка росте разом із меню: та сама пропорція на телефоні й на 1600×800', async ({ page }) => {
	await reduceMotion(page);
	const ratio = async (width: number, height: number) => {
		await page.setViewportSize({ width, height });
		await page.goto('/VetCrewGames/');
		await settlePage(page);
		const measured = await page.evaluate(() => {
			const button = document.querySelector('.game-header .header-btn');
			const label = document.querySelector('.menu-tile span');
			if (!button || !label) return null;
			return {
				button: button.getBoundingClientRect().height,
				label: parseFloat(getComputedStyle(label).fontSize)
			};
		});
		expect(measured, 'кнопки шапки чи плитки меню не знайдено').not.toBeNull();
		return measured!;
	};

	const phone = await ratio(390, 844);
	const wide = await ratio(1600, 800);
	expect(wide.button, 'шапка на великому екрані не виросла').toBeGreaterThan(phone.button * 1.3);
	expect(wide.button / wide.label).toBeCloseTo(phone.button / phone.label, 1);
});
