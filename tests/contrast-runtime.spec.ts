import { expect, test, type Page } from '@playwright/test';
import { APP_PAGES, expectAllRoutesListed } from './support/pages';
import { reduceMotion, settlePage } from './support/settle';

/**
 * КОНТРАСТ У РАНТАЙМІ: чотири теми × усі сторінки, з реальним складанням шарів.
 *
 * ## Навіщо третя перевірка контрасту, коли вже є дві
 *
 * `src/contrast.test.ts` читає ДЖЕРЕЛА і сам, у власному докблоці, перелічує, чого
 * не бачить: «`color-mix()`, напівпрозоре тло (`rgba` з альфою), градієнти,
 * тло-зображення, а також текст, що успадковує колір від батька або лежить на
 * тлі, заданому в іншому компоненті».
 *
 * `tests/a11y.spec.ts` (axe) бачить рантайм, але дивиться на ДВІ сторінки з
 * одинадцяти й на дві теми з чотирьох.
 *
 * Дефект, через який ця перевірка з'явилася, лежав рівно в перетині цих двох
 * прогалин — і його знайшло ОКО АВТОРА, не гейт: `.btn-menu` («Головне меню») у
 * світлих темах — білий текст на світлому тлі. Тло — `rgba(255, 255, 255, 0.1)`,
 * тобто напівпрозоре (для юніт-перевірки НЕПОКРИТО за визначенням), а сторінка —
 * екран підсумку гри, куди axe не заходить.
 *
 * Найгірше в тій історії те, що ПРАВИЛО В ПРОЄКТІ ВЖЕ БУЛО. 2026-08-23 перший
 * прогін axe знайшов той самий клас на головній, і `.game-title` та
 * `.menu-btn--link` тоді ж перевели на `--color-text-on-panel` із коментарями
 * «а не зашитий `#ffffff`». Але виправили рівно там, куди axe дивиться, — і на
 * сторінках ігор той самий зашитий білий прожив далі. Ця перевірка існує, щоб
 * «виправлено там, де подивилися» більше не читалося як «виправлено».
 *
 * ## Як міряється
 *
 * Ефективне тло СКЛАДАЄТЬСЯ вгору по дереву, поки не трапиться непрозорий шар.
 * Конвертація кольору — канвою (`fillStyle` + `getImageData`), а не регуляркою:
 * Chrome обчислює `color-mix()` в `oklab(…)`, і регулярка на `rgba?\(…\)` такий
 * шар МОВЧКИ пропускає. Перша редакція цього заміру саме так і збрехала — вона
 * не побачила панелі під текстом і показала контраст 1.10 там, де насправді 1.80.
 * Канва конвертує будь-який валідний CSS-колір і на невалідному рядку лишає
 * прозоре, тобто «шару немає» — безпечне тлумачення, а не хибний чорний.
 *
 * ## Що ця перевірка НЕ покриває — свідомо, з названою межею
 *
 * 1. **Стани.** Замір бачить сторінку такою, якою вона відкрилася. Наведення,
 *    фокус, меню шапки, екран підсумку гри — ні. Наведення й фокус звіряє
 *    `src/contrast.test.ts` (він для цього і збирає базовий стан окремо від
 *    `:hover`), екран підсумку — око людини за чеклистом.
 *
 *    ОДИН ВИНЯТОК З 2026-08-24: вибір країни розкривається й міряється
 *    відкритим. Причина — у `countryPickerScopes` нижче: доти цей стан не
 *    покривався ні тут, ні деінде, бо був нативним `<select>`, і саме в ньому
 *    прожив дефект «світлий текст на світлому фоні».
 * 2. **Фотографія тла.** `--bg-image` — це знімок, і його місцева яскравість
 *    невідома. Коли найближчий непрозорий шар — той самий елемент, що несе
 *    знімок, у звіті стоїть `фото`, а за тло беруться оголошені `--color-bg`
 *    теми. Що під текстом узагалі є підкладка, стереже `src/backdrop.test.ts`.
 * 3. **Малюнок у SVG.** Міряється `color` (ним лucide малює значки через
 *    `currentColor`), але не `fill`/`stroke`, вписані літералами. Інакше кожна
 *    ілюстрація проєкту давала б хибні дефекти. Наслідок названий: біла обводка
 *    `.circle-fill` у `GameHeader` виправлена тим самим комітом РУКАМИ, і гейт
 *    її не тримає.
 *
 * ## Зворотний експеримент (AI-AGENT-PITFALLS-v8 § 1.1)
 *
 * Повернуто `color: #ffffff` у `.header-btn` (`global.css`) — прогін упав на темі
 * `winter` із 2.68:1 при потрібних трьох, назвавши тему, сторінку, селектор і
 * обидва кольори. Тобто перевірка ловить саме той дефект, задля якого й з'явилася.
 *
 * Побічний висновок того ж прогону, вартий запису: у `light-green` той самий
 * повернутий білий лишився ТРОХИ вище планки. Виправлення `.header-btn` було
 * подвійним — колір тексту плюс тло домішкою кольору теми замість білої, — і
 * друга половина сама піднімає контраст у світлих темах настільно, що першої
 * майже досить. Тобто число 2.41:1 із початкового заміру належало старій парі
 * цілком, і одну з двох правок скасувати не можна, не втративши іншу.
 */

/** Порядок як у `src/contrast.test.ts`, щоб звіти двох перевірок читалися разом. */
const THEMES = ['dark', 'light-green', 'winter', 'orange-purple'] as const;

/** Те, що бачить замір усередині сторінки: про адресу він не знає. */
type PageFinding = {
	theme: string;
	sel: string;
	text: string;
	fg: string;
	bg: string;
	ratio: number;
	need: number;
	photo: boolean;
};

/** Те саме плюс адреса — її дописує тест, який і ходив по сторінках. */
type Finding = PageFinding & { page: string };

type Report = {
	findings: PageFinding[];
	checked: number;
	skippedDisabled: number;
	/** Значки кнопок поля — названий виняток, див. коментар у зборі. */
	skippedTools: number;
};

/**
 * Замір виконується В СТОРІНЦІ: скласти шари можна лише там, де є справжній
 * `getComputedStyle` і справжнє дерево.
 */
async function measure(page: Page, theme: string): Promise<Report> {
	return page.evaluate((activeTheme) => {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

		/** Будь-який валідний CSS-колір → RGBA. `null` = шару немає. */
		function toRgba(value: string): [number, number, number, number] | null {
			if (!value) return null;
			ctx.clearRect(0, 0, 1, 1);
			// Прозоре як стартове значення: невалідний рядок присвоєння ігнорується,
			// і шар лишається прозорим замість того, щоб стати чорним.
			ctx.fillStyle = 'rgba(0, 0, 0, 0)';
			ctx.fillStyle = value;
			ctx.fillRect(0, 0, 1, 1);
			const d = ctx.getImageData(0, 0, 1, 1).data;
			const alpha = d[3] / 255;
			return alpha === 0 ? null : [d[0], d[1], d[2], alpha];
		}

		const channel = (v: number) => {
			const c = v / 255;
			return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
		};
		const luminance = (c: number[]) =>
			0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
		const contrast = (a: number[], b: number[]) => {
			const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		const composite = (top: number[], under: number[]) =>
			[0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));

		/** Складає тло вгору по дереву до першого непрозорого шару. */
		function effectiveBackground(el: Element) {
			const layers: number[][] = [];
			let node: Element | null = el;
			let photo = false;
			while (node) {
				const cs = getComputedStyle(node);
				const colour = toRgba(cs.backgroundColor);
				if (colour) {
					layers.push(colour);
					if (colour[3] >= 0.999) {
						// Знімок лежить ПОВЕРХ кольору того самого елемента, тож саме він і є
						// справжнім тлом — колір теми тут лишається наближенням.
						photo = cs.backgroundImage !== 'none';
						break;
					}
				}
				node = node.parentElement;
			}
			let base = [255, 255, 255];
			for (let i = layers.length - 1; i >= 0; i -= 1) base = composite(layers[i], base);
			return { bg: base, photo };
		}

		/** WCAG 1.4.3 і 1.4.11: 4.5 звичайний текст, 3 великий, 3 значки. */
		function required(cs: CSSStyleDeclaration, isIcon: boolean) {
			if (isIcon) return 3;
			const px = parseFloat(cs.fontSize);
			const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
			return px >= 24 || (px >= 18.66 && bold) ? 3 : 4.5;
		}

		function describe(el: Element) {
			const parts: string[] = [];
			let node: Element | null = el;
			for (let i = 0; i < 3 && node; i += 1, node = node.parentElement) {
				let s = node.tagName.toLowerCase();
				const cls = typeof node.className === 'string' ? node.className.trim() : '';
				if (cls) {
					const useful = cls
						.split(/\s+/)
						.filter((c) => !/^svelte-/.test(c))
						.slice(0, 2);
					if (useful.length) s += `.${useful.join('.')}`;
				}
				parts.unshift(s);
			}
			return parts.join(' > ');
		}

		const findings: PageFinding[] = [];
		let checked = 0;
		let skippedDisabled = 0;
		let skippedTools = 0;

		/**
		 * ЗНАЧОК У ГРІ ЛИШЕ ТОДІ, КОЛИ ВІН ЄДИНЕ, ЩО НАЗИВАЄ КНОПКУ.
		 *
		 * WCAG 1.4.11 говорить про «візуальну інформацію, потрібну, щоб РОЗПІЗНАТИ
		 * елемент керування», і прямо звільняє суто оздобне. Тобто в межах правила —
		 * значок у кнопці без підпису (кнопки шапки: тема, мова, «назад»), а не
		 * будь-який SVG на сторінці.
		 *
		 * Без цієї межі перевірка ловила 84 вузли на `game-memory`: відпечаток лапки
		 * на ЗВОРОТІ картки, `color-mix(--color-accent, transparent 35%)`, 1.00:1.
		 * Він і оздоба (грань позначена `aria-hidden="true"`), і взагалі не видний
		 * (`backface-visibility: hidden` на неперегорнутій картці), а «сорочка»
		 * картки читається тлом грані, не лапкою.
		 *
		 * Умова «немає ні тексту, ні картинки» відрізняє одне від одного точно:
		 * кнопка шапки містить лише `svg`, а картка пам'яті — ще й `img` лицевої
		 * грані, тобто розпізнається не значком.
		 */
		function isMeaningfulIcon(el: Element): boolean {
			const control = el.closest('button, a, [role="button"], [role="menuitem"], summary, label');
			if (!control) return false;
			if ((control.textContent ?? '').trim() !== '') return false;
			return control.querySelector('img, picture, video') === null;
		}

		for (const el of Array.from(document.querySelectorAll('*'))) {
			const isIcon = el.tagName === 'svg' && isMeaningfulIcon(el);
			const ownsText = Array.from(el.childNodes).some(
				(n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== ''
			);
			if (!ownsText && !isIcon) continue;

			const box = el.getBoundingClientRect();
			if (box.width < 2 || box.height < 2) continue;

			const cs = getComputedStyle(el);
			if (cs.visibility === 'hidden' || cs.display === 'none') continue;

			/*
			 * Неактивні елементи керування — той самий виняток, що в
			 * `src/contrast.test.ts`: WCAG 1.4.3 прямо не вимагає контрасту для тексту
			 * неактивних елементів, а приглушений вигляд там САМ Є сигналом
			 * недоступності. Робити його контрастним означало б стерти цей сигнал.
			 */
			if (el.closest('[disabled], [aria-disabled="true"]')) {
				skippedDisabled += 1;
				continue;
			}

			/*
			 * ЗНАЧКИ КНОПОК ПОЛЯ ВВОДУ — названий виняток, а не послаблення гейта.
			 *
			 * INPUT-TOOLS-v8 § 4 вимагає, щоб ці кнопки в спокої були на 30%: у
			 * порожньому полі два значки не мусять відбирати увагу в самого поля.
			 * 30% від приглушеного кольору — це нижче за WCAG 1.4.11 (3:1 для
			 * елементів керування), і § 4.2 канону це прямо визнає, називаючи умову
			 * прийнятності: кожна кнопка ДУБЛЮЄ дію, доступну інакше.
			 *
			 * Тут ця умова виконана, і перевірити її можна очима в коді:
			 * `ui/InputTools.svelte` малює «вставити» (`Ctrl+V`), «скопіювати»
			 * (`Ctrl+C`) і «стерти» (виділення й `Delete`). Плюс два стани, де
			 * прозорості немає зовсім: `:focus-visible` і `@media (hover: none)` —
			 * тобто на клавіатурі й на сенсорному екрані значки завжди повні.
			 *
			 * Виняток ВУЗЬКИЙ навмисно: рівно клас `.tools__btn`, рівно значок
			 * усередині. Текст у цих кнопках не буває — вони самі лише зі значка, а
			 * назву дає `aria-label`. Тобто гейт і далі бачить усе, крім рівня
			 * прозорості, який канон дозволив явно.
			 *
			 * Заміряно, чому це не «просто підняти число»: на 30% вийшло 1.79:1, на
			 * 65% — 2.51:1, тобто прохідним стало б лише ~0.9, а це вже не
			 * «проявляється, коли до нього тягнуться».
			 */
			if (isIcon && el.closest('.tools__btn')) {
				skippedTools += 1;
				continue;
			}

			const ink = toRgba(cs.color);
			if (!ink) continue;

			/*
			 * ПРОЗОРІСТЬ СКЛАДАЄТЬСЯ, А НЕ ПРОПУСКАЄТЬСЯ.
			 *
			 * Перша редакція просто оминала все з `opacity < 0.9` під приводом «це
			 * приглушений стан, а не пара кольорів». Дірку знайшов той самий комміт,
			 * що й додав цю перевірку: `opacity: 0.75` на підказці в `OnlineGate`
			 * давало 3.75:1 — і гейт мовчав, бо сам себе туди не пускав. Тобто
			 * найпростіший спосіб приглушити текст був заразом способом сховати його
			 * від перевірки.
			 *
			 * `opacity` множиться по всьому ланцюжку батьків: приглушує як власна
			 * прозорість, так і успадкована від контейнера, і на екрані вони
			 * перемножуються.
			 *
			 * Повністю прозоре (`0`) пропускається: читати там нічого, і жодна пара
			 * кольорів цього не змінить.
			 */
			let alpha = ink[3];
			for (let node: Element | null = el; node; node = node.parentElement) {
				alpha *= parseFloat(getComputedStyle(node).opacity);
			}
			if (alpha <= 0) continue;

			const { bg, photo } = effectiveBackground(el);
			checked += 1;

			const shown = composite([ink[0], ink[1], ink[2], Math.min(alpha, 1)], bg);
			const ratio = contrast(shown, bg);
			const need = required(cs, isIcon);
			if (ratio >= need) continue;

			findings.push({
				theme: activeTheme,
				sel: describe(el),
				text: (el.textContent ?? '').trim().slice(0, 24),
				// Колір ПІСЛЯ складання прозорості: у звіті мусить стояти те, що видно
				// на екрані, інакше числа не сходяться з оголошеним у CSS.
				fg: alpha < 0.999 ? `rgb(${shown.map(Math.round).join(', ')})` : cs.color,
				bg: `rgb(${bg.map(Math.round).join(', ')})`,
				ratio: Math.round(ratio * 100) / 100,
				need,
				photo
			});
		}

		return { findings, checked, skippedDisabled, skippedTools };
	}, theme);
}

/**
 * ВИБІР КРАЇНИ РОЗКРИВАЄТЬСЯ ПЕРЕД ЗАМІРОМ — єдиний стан, який цей гейт бачить.
 *
 * Раніше пункт 1 у «чого не покриває» стосувався й цієї панелі, і рівно тому
 * дефект, задля якого її переписали, гейт не бачив узагалі: вибір країни був
 * нативним `<select>`, а його випадний список НЕ Є ЧАСТИНОЮ DOM — його малює
 * браузер. Обчислений `background-color` у `<option>` дорівнював
 * `rgba(0, 0, 0, 0)` в усіх чотирьох темах, тобто складати шари було нічого, і
 * замір чесно нічого не знаходив. Заміряно перед заміною: успадкований колір
 * тексту проти світлого списку давав 1.26:1 у `dark` і 1.20:1 у
 * `orange-purple`, проти темного — 1.35:1 у `light-green` і 1.25:1 у `winter`.
 *
 * Відколи панель наша, вона в DOM — і мусить міритися разом з усім іншим,
 * інакше зміна повернеться тихо. Розкриття зроблено саме тут, а не окремим
 * тестом: пари кольорів усередині панелі залежать від того, що під нею, тобто
 * від сторінки й теми, а їх перебирає цей цикл.
 *
 * Решта пунктів «чого не покриває» лишається як була: наведення, фокус і меню
 * шапки цей гейт і далі не бачить.
 *
 * Кнопки шукаються за РОЛЛЮ (`aria-haspopup="listbox"`), а не за іменем
 * локатора: так само знайдеться будь-який наступний вибірник із випадним
 * списком, і його теж почнуть міряти без правки цього файлу.
 *
 * ЗВОРОТНИЙ ЕКСПЕРИМЕНТ (AI-AGENT-PITFALLS-v8 § 1.1) проведено: `color` пункту
 * зроблено рівним `--color-bg-surface`, тобто кольором тла під ним. Прогін
 * `тема winter` упав, назвавши сторінку разом зі станом —
 * «/VetCrewGames/quiz/online/ [pairs-country відкрито] button.menu__option».
 * Тобто зелений результат тут неможливий через те, що панель не розкрилася.
 *
 * @returns основи `data-testid` знайдених вибірників; порожній масив — на цій
 * сторінці їх немає, і другий замір не робиться.
 */
async function countryPickerScopes(page: Page): Promise<string[]> {
	const triggers = page.locator('button[aria-haspopup="listbox"][data-testid]');
	const scopes: string[] = [];
	for (let i = 0; i < (await triggers.count()); i += 1) {
		const id = (await triggers.nth(i).getAttribute('data-testid')) ?? '';
		scopes.push(id.replace(/-select$/, ''));
	}
	return scopes;
}

/**
 * Сторінка відкривається у заданій темі.
 *
 * Тема кладеться у СХОВИЩЕ до завантаження, а не атрибутом після: це справжній
 * шлях справжнього відвідувача — `settings` читає `vetcrewgames_theme` у
 * конструкторі, а інлайн-скрипт `app.html` ставить `data-theme` ще до першого
 * кадру. Атрибут, підкладений тестом після завантаження, перевіряв би стан, у
 * якому застосунок ніколи не буває.
 *
 * `addInitScript` викликається ОДИН раз на тест (не в цьому хелпері): повторні
 * виклики накопичуються, і до останньої сторінки їх було б стільки, скільки
 * сторінок.
 */
async function openIn(page: Page, url: string, theme: string) {
	await page.goto(url);
	/*
	 * Умова спокою — спільна з `a11y.spec.ts` і зібрана в `support/settle.ts`.
	 *
	 * Саме її бракувало, коли замір почав складати прозорість: перший прогін дав
	 * 281 «дефект» у всіх чотирьох темах, усі з однаковою прикметою — колір
	 * тексту, складений майже точно в колір тла, тобто прозорість близько 0.05.
	 * Це були кадри анімацій входу, а не порушення контрасту. Там же описано
	 * знайдений дефект: `reducedMotion` із конфігу до сторінки не доходив узагалі.
	 */
	await settlePage(page);
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

/*
 * Кожна тема — САМОДОСТАТНІЙ тест, без спільного стану між ними.
 *
 * `fullyParallel: true` розкидає тести по воркерах, тобто по окремих процесах:
 * змінна на рівні модуля НЕ спільна, і накопичувач у ній читався б порожнім у
 * тому воркері, що не заповнював його. Перша редакція саме так і збирала звіт —
 * тобто «нуль порушень» означало б «нуль у цьому процесі».
 */
for (const theme of THEMES) {
	test(`контраст у рантаймі: тема ${theme}`, async ({ page }) => {
		await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
			'vetcrewgames_theme',
			theme
		] as const);
		// Емуляція ставиться ДО першого `goto`: анімації входу починаються з першим
		// кадром, і настройка, увімкнена пізніше, вже нічого не гасить.
		await reduceMotion(page);

		const findings: Finding[] = [];
		let checked = 0;
		let disabled = 0;

		for (const url of APP_PAGES) {
			await openIn(page, url, theme);
			const report = await measure(page, theme);
			checked += report.checked;
			disabled += report.skippedDisabled;
			findings.push(...report.findings.map((f) => ({ ...f, page: url })));

			/*
			 * Кожен вибірник розкривається ОКРЕМО, і після заміру закривається.
			 *
			 * Не всі разом: клік по другій кнопці — це `pointerdown` поза першою
			 * панеллю, тобто вона закрилася б сама (так і задумано в компоненті), і
			 * звіт стверджував би, що міряв два відкритих меню, маючи одне.
			 */
			for (const scope of await countryPickerScopes(page)) {
				await page.locator(`[data-testid="${scope}-select"]`).click();
				await page.locator(`[data-testid="${scope}-menu"]`).waitFor({ state: 'visible' });
				const withPanel = await measure(page, theme);
				checked += withPanel.checked;
				disabled += withPanel.skippedDisabled;
				findings.push(
					...withPanel.findings.map((f) => ({ ...f, page: `${url} [${scope} відкрито]` }))
				);
				await page.keyboard.press('Escape');
			}
		}

		/*
		 * Канарка на сам замір. Порожній прохід дав би «нуль порушень» і зелений
		 * результат ні про що (AI-AGENT-PITFALLS-v8 § 1) — саме той обман, від
		 * якого захищається й `a11y.spec.ts` перевіркою `results.passes.length`.
		 */
		expect(checked, `тема ${theme}: замір не оглянув жодного елемента`).toBeGreaterThan(200);

		const report = findings
			.sort((a, b) => a.ratio - b.ratio)
			.map(
				(f) =>
					`${f.ratio.toFixed(2)}:1 (треба ${f.need})  ${f.page}${f.photo ? '  [тло — фото, колір теми взято за наближення]' : ''}\n      ${f.sel}  «${f.text}»\n      текст ${f.fg} на ${f.bg}`
			)
			.join('\n');

		expect(
			findings.map((f) => `${f.page} ${f.sel}`),
			`\nОглянуто елементів: ${checked}. Пропущено неактивних: ${disabled}.\n\n${report}\n`
		).toEqual([]);
	});
}

/**
 * Повнота переліку живе у `support/pages.ts` разом із самим переліком: інакше
 * два тести стверджували б її окремо, і кожен — про свою копію списку.
 */
test('перелік сторінок покриває всі маршрути', () => {
	expectAllRoutesListed();
});
