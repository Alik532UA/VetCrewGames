import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

/**
 * Підпис картки не має права розсувати картку.
 *
 * ## Дефект, через який цей файл існує
 *
 * Скарга автора зі скріншотами: довга назва робила картку ШИРШОЮ за її слот —
 * заміряно 118.78px картки в 110px слоті. Картка визирала з-під рамки й штовхала
 * сусідів у рядку. Найдовші назви трапляються в німецькій і нідерландській:
 * `Stachelschwein`, `Reuzenmiereneter`, `Manoel (pallaskat)`.
 *
 * Причина була структурна: картка — елемент сітки, а елемент сітки типово не може
 * стати вужчим за свій `min-content`, і для нерозривного слова цей мінімум і є
 * ширина слова.
 *
 * ## Що перевіряється тут, а що юнітом
 *
 * Арифметику масштабу перевіряє `src/lib/utils/labelScale.test.ts` — там межі,
 * крок і дно. Браузер потрібен для іншого, і саме це вимога автора:
 *
 *   картка не виїжджає за слот НІКОЛИ;
 *   кегль зменшується САМЕ ТОДІ, коли текст не вміщається;
 *   кегль НЕ зменшується, коли текст уміщається.
 *
 * ## «Вміщається» міряється при БАЗОВОМУ кеглі, і це головна тонкість файлу
 *
 * Перша редакція питала `scrollWidth <= clientWidth` як є — тобто ВЖЕ ПІСЛЯ
 * зменшення. Для довгої назви це давало «вміщається», і перевірка вимагала від неї
 * базового кегля: тест падав на `Reuzenmiereneter: 12px`, тобто на цілком
 * правильному коді. Тому `readLabels` знімає масштаб, міряє природну ширину й
 * повертає масштаб назад — так само, як це робить сама дія.
 */

/** Базовий кегль підпису — `--font-size-md`, тобто 1rem. */
const BASE_FONT_PX = 16;

/**
 * Наскільки звузити слот, щоб не вміщалася ЖОДНА назва.
 *
 * Число заміряне, а не вибране. Перша редакція брала 40px — і тест плавав: при
 * такому слоті підпису лишається близько 20px, а найкоротші назви («Bij», «Kip»,
 * «Mol») у 16px займають ~19px, тобто ВМІЩАЮТЬСЯ. Прогін падав лише тоді, коли в
 * раунд трапилася коротка назва, і повідомлення казало «Bij: 16px, слот 40.0px» —
 * тобто код був правий, а тест ні.
 *
 * При 24px доступного місця лишаються одиниці пікселів: не вміщається нічого.
 */
const NARROW_SLOT_CSS = '.game-container { max-width: 24px !important; }';

interface LabelState {
	name: string;
	slotWidth: number;
	cardWidth: number;
	fontSize: number;
	/** Чи вміщався б рядок при БАЗОВОМУ кеглі. Саме це і є «вміщається». */
	fitsAtBase: boolean;
	whiteSpace: string;
}

async function readLabels(page: Page): Promise<LabelState[]> {
	return page.$$eval('.game-card', (cards) =>
		cards.map((card) => {
			const slot = card.closest('.game-container') as HTMLElement;
			const text = card.querySelector('.game-card__name-text') as HTMLElement;
			const cs = getComputedStyle(text);

			/*
			 * Знімаємо масштаб, міряємо, повертаємо — усе синхронно, тож браузер між
			 * цими рядками не малює і блимання не буде. Це той самий прийом, яким
			 * міряє сама дія: природну ширину рядка видно лише при кеглі 1.
			 */
			const savedScale = text.style.getPropertyValue('--label-scale');
			const savedWrap = text.style.getPropertyValue('--label-wrap');
			text.style.removeProperty('--label-scale');
			text.style.removeProperty('--label-wrap');
			const natural = text.scrollWidth;
			const available = (text.parentElement as HTMLElement).clientWidth;
			if (savedScale) text.style.setProperty('--label-scale', savedScale);
			if (savedWrap) text.style.setProperty('--label-wrap', savedWrap);

			return {
				name: (text.textContent ?? '').trim(),
				slotWidth: slot.getBoundingClientRect().width,
				cardWidth: card.getBoundingClientRect().width,
				fontSize: parseFloat(cs.fontSize),
				// Той самий запас в один піксель, що в `labelScale.ts`.
				fitsAtBase: natural <= available - 1,
				whiteSpace: cs.whiteSpace
			};
		})
	);
}

/**
 * Перелік заміряного — щоб повідомлення про невдачу було самодостатнім.
 *
 * `expect.poll(...).toBe(true)` при падінні каже лише «expected true, received
 * false», і плаваюче падіння лишається без жодних чисел. Саме через це перші
 * редакції цих перевірок довелося ловити наосліп; із числами причина знайшлася з
 * першого падіння.
 */
function report(labels: LabelState[]): string {
	return labels
		.map(
			(l) =>
				`${l.name}: ${l.fontSize}px, слот ${l.slotWidth.toFixed(1)}px, ` +
				`${l.fitsAtBase ? 'вміщається' : 'НЕ вміщається'}`
		)
		.join('; ');
}

/**
 * Нідерландська: саме там найдовші назви, і саме на ній автор побачив дефект.
 *
 * Кінцева коса обов'язкова: без неї preview статичного адаптера віддає підказку
 * «did you mean …/?» замість сторінки, і перша редакція цього файлу падала на
 * «карток немає» — не тому, що щось зламано.
 */
async function openGame(page: Page) {
	await page.goto('/VetCrewGames/nl/game-population/');
	await expect(page.locator('.game-card').first()).toBeVisible();
	await page.evaluate(() => document.fonts?.ready);
}

test.describe('підпис картки', () => {
	test('картка не ширша за свій слот', async ({ page }) => {
		await openGame(page);
		const labels = await readLabels(page);

		expect(labels.length, 'карток на екрані немає — перевіряти нічого').toBeGreaterThan(0);
		for (const l of labels) {
			// Пів пікселя допуску: обидві ширини дробові.
			expect(
				l.cardWidth,
				`«${l.name}»: картка ${l.cardWidth.toFixed(2)}px у слоті ${l.slotWidth.toFixed(2)}px`
			).toBeLessThanOrEqual(l.slotWidth + 0.5);
		}
	});

	/**
	 * Головна перевірка файлу — рівно вимога автора, обидві її половини.
	 *
	 * Працює на будь-якій трійці тварин: короткі назви перевіряють «не зменшувати»,
	 * довгі — «зменшити». Нічого підмінювати не треба.
	 *
	 * Опитування, а не одне читання: вимір у дії відкладений на ~140 мс після того,
	 * як розкладка вгамувалася (`SETTLE_MS`), тож стан приходить не в тому кадрі, у
	 * якому з'явилися картки.
	 */
	test('кегль зменшується тільки тоді, коли текст не вміщається', async ({ page }) => {
		await openGame(page);

		await expect
			.poll(
				async () => {
					const labels = await readLabels(page);
					if (labels.length === 0) return 'карток немає';
					const wrong = labels.filter((l) =>
						l.fitsAtBase ? l.fontSize !== BASE_FONT_PX : l.fontSize >= BASE_FONT_PX
					);
					return wrong.length === 0 ? 'усе за правилом' : report(wrong);
				},
				{ timeout: 10_000 }
			)
			.toBe('усе за правилом');
	});

	/**
	 * Слот звужується так, що не вміщається жодна назва — механізм під тиском.
	 *
	 * `!important` обов'язковий: `max-width` слота задано в компоненті, і без нього
	 * правило з тесту програє за специфічністю, а тест лишиться зеленим, не
	 * перевіривши нічого.
	 */
	test('коли місця стає обмаль, зменшуються всі — і картка все одно в межах слота', async ({
		page
	}) => {
		await openGame(page);
		await page.addStyleTag({ content: NARROW_SLOT_CSS });

		await expect
			.poll(
				async () => {
					const big = (await readLabels(page)).filter((l) => l.fontSize >= BASE_FONT_PX);
					return big.length === 0 ? 'усі зменшені' : report(big);
				},
				{ timeout: 10_000 }
			)
			.toBe('усі зменшені');

		const after = await readLabels(page);
		for (const l of after) {
			expect(
				l.cardWidth,
				`«${l.name}»: картка ${l.cardWidth.toFixed(2)}px у слоті ${l.slotWidth.toFixed(2)}px`
			).toBeLessThanOrEqual(l.slotWidth + 0.5);
		}

		/*
		 * На такому слоті дна масштабу не досить нікому, тож підпис мусить перейти в
		 * два рядки. Обрізане «Reuzenmierenet…» у грі, де тварину впізнають за
		 * назвою, гірше за дрібний шрифт у два рядки.
		 */
		expect(
			after.every((l) => l.whiteSpace === 'normal'),
			`на дні масштабу підпис мусить переноситися: ${report(after)}`
		).toBe(true);
	});

	/**
	 * Масштаб не «залипає»: коли місце повертається, повертається й кегль.
	 *
	 * Порівнюється з ТИМ, ЩО БУЛО, а не з базовим кеглем. Довга назва
	 * (`Reuzenmiereneter`) законно лишається зменшеною й при звичайному слоті —
	 * саме на цьому падала перша редакція цієї перевірки.
	 *
	 * Дефект, від якого це стереже, справжній і знайдений тут: спостерігач стояв на
	 * самому підписі, а його ширина для короткої назви дорівнює ширині ТЕКСТУ,
	 * тобто від розширення картки не змінюється зовсім. Зменшений кегль лишався
	 * назавжди — і залежало це від довжини слова.
	 */
	test('коли місце повертається, кегль повертається до того, що був', async ({ page }) => {
		await openGame(page);

		// Знімок «як було» — уже після того, як дія відпрацювала перший вимір.
		await expect
			.poll(async () => (await readLabels(page)).length, { timeout: 5000 })
			.toBeGreaterThan(0);
		await page.waitForTimeout(400);
		const before = await readLabels(page);

		const narrow = await page.addStyleTag({ content: NARROW_SLOT_CSS });
		await expect
			.poll(async () => (await readLabels(page)).every((l) => l.fontSize < BASE_FONT_PX), {
				timeout: 10_000
			})
			.toBe(true);

		await narrow.evaluate((node) => (node as HTMLElement).remove());
		await expect
			.poll(
				async () => {
					const now = await readLabels(page);
					const stuck = now.filter((l, i) => l.fontSize !== before[i]?.fontSize);
					return stuck.length === 0 ? 'усі повернулися' : report(stuck);
				},
				{ timeout: 10_000 }
			)
			.toBe('усі повернулися');
	});
});

/**
 * ПІДПИС НА ЗОБРАЖЕННІ (`.image-caption`, `global.css`) — жодне слово назви не рветься, і
 * жодне не меншає без потреби.
 *
 * Назва тварини в «Правда чи міф?», «Де живем?» і «Хто зайвий?» лежить на самій картинці
 * (прохання автора 2026-09-28). Кегль там у `cqi`, тобто частка ширини картинки: 11cqi для
 * всіх назв, а слову, що в рядок не стає, `utils/fitCaption.ts` дає трохи менший — кроком
 * 5%, не менше 70%. Виняток, а не менший кегль для всіх, — прохання автора того ж дня: «не
 * роби шрифт усюди менше, а тільки виняток для таких довгих слів».
 *
 * ## Чому виняток міряється на пристрої, а не підбирається числом
 *
 * Перша редакція тримала «11cqi досить для найдовшого слова» й перевіряла рівно це. На
 * Windows нідерл. «Reuzenmiereneter» мав 4px запасу на картинці 142px, а Chromium у CI
 * (Linux) округлює ширини гліфів до цілих пікселів — і там слово рвалося на
 * «Reuzenmierene / ter». Число, підібране на одному комп'ютері, на іншому неправда. З тієї
 * самої причини менший кегль на Linux буває ширшим за пропорцію, тож дія перевіряє його
 * виміром, а перевірка під тиском відтворює це навмисно (`LINUX_ROUNDING_CSS`).
 *
 * ## Що перевіряється
 *
 *   слово, що стає в рядок, — кеглем 11cqi, без винятку;
 *   слово, що не стає, — меншає, стає в рядок і меншає не більше, ніж треба;
 *   кожне слово кожної назви чотирьох мов на трьох ширинах картинки рятує щонайменше дно.
 *
 * «Стає в рядок» міряється за МАСШТАБУ 1, як і в `readLabels` вище: `readCaptions` знімає
 * виняток, міряє й повертає — тим самим прийомом, що й дія.
 *
 * Зворотні експерименти (2026-09-28), кожен червоний: без `use:fitCaption` на дошці — обидві
 * перевірки з тиском; без множника `--caption-scale` у CSS — обидві («масштаб на кегль не
 * діє»); лише пропорція, без перевірки виміром — «виміром, а не пропорцією»; 10cqi для всіх
 * — обидві; «зменшувати завжди» — головна, після зняття тиску; «одразу на дно» — головна,
 * під тиском. Два останні спершу ПРОХОДИЛИ: опитування приймало стан до першого виміру, а
 * груба похибка округлення зводила всіх на дно, де «на дно» — правильна відповідь.
 */

/** Кегль підпису без винятку — 11cqi (рішення автора 2026-09-28). */
const BASE_CAPTION_CQI = 11;

/** Дно, крок і запас винятку — ті самі, що в `utils/labelScale.ts`. */
const CAPTION_FLOOR = 0.7;
const CAPTION_STEP = 0.05;
const CAPTION_SLACK_PX = 1;

/**
 * Ширини картинки — від найвужчої («Де живем?», 96px) до найширшої («Правда чи міф?», 216px).
 * Три, а не одна: частки однакові на всіх, тож розбіжність означає, що якийсь розмір знову
 * записали пікселями.
 */
const CAPTION_WIDTHS = [96, 142, 216] as const;

/**
 * Скільки місця лишити слову під тиском — частка від потрібного. Вистачає, щоб виняток
 * знадобився кожному слову, і не досить, щоб усіх звело на дно: тоді «не більше, ніж
 * треба» нічого б не перевіряло.
 */
const SQUEEZE_SHARE = 0.85;

/**
 * Менший кегль ширший за пропорцію — як на Linux, де ширини гліфів округлено до цілих
 * пікселів. Тут це зроблено навмисно й однаково на кожній машині: що менший масштаб, то
 * більший `letter-spacing`. За масштабу 1 додатку немає, тож «стає в рядок» не міняється.
 *
 * Похибка навмисно груба — до 0,6px на літеру на дні, — тож коротке слово на малій картинці
 * доходить і до дна. Для цієї перевірки досить, що кегль із пропорції тут НЕ проходить;
 * «не більше, ніж треба» тримає тиск без неї.
 */
const LINUX_ROUNDING_CSS =
	'.image-caption { letter-spacing: calc((1 - var(--caption-scale, 1)) * 2px) !important; }';

/** Слова з назв тварин — прямо з перекладів, щоб нова назва потрапляла сюди сама. */
function animalNameWords(): string[] {
	const words = new Set<string>();
	for (const lang of ['uk', 'en', 'de', 'nl']) {
		const source = readFileSync(`src/lib/i18n/translations/${lang}/animals.ts`, 'utf8');
		for (const [, single, double] of source.matchAll(
			/'animal\.[a-z_]+':\s*(?:'([^']*)'|"([^"]*)")/g
		)) {
			for (const word of (single ?? double).split(/\s+/)) if (word) words.add(word);
		}
	}
	return [...words];
}

interface CaptionState {
	name: string;
	/** `--caption-scale` на підписі; 1 — винятку немає. */
	scale: number;
	/** Кегль зараз і за масштабу 1, і скільки пікселів у 1cqi цієї картинки. */
	fontPx: number;
	basePx: number;
	cqiPx: number;
	/** Поля підпису й місце для тексту, px. */
	padding: number;
	room: number;
	/** Найдовше слово: за масштабу 1, за теперішнього й на крок більшого (`null` — там уже 1). */
	atBase: number;
	atScale: number;
	atStepUp: number | null;
}

async function readCaptions(page: Page): Promise<CaptionState[]> {
	return page.$$eval(
		'.image-caption',
		(captions, step) =>
			captions.map((element) => {
				const caption = element as HTMLElement;
				const zoom = (caption as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
				const style = getComputedStyle(caption);
				const fontPx = parseFloat(style.fontSize);
				const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
				const room = parseFloat(style.maxWidth) - padding;

				/*
				 * Найдовше слово — `min-content` без переносу посеред слова й без стелі ширини.
				 * Усе синхронно й повертається назад, тож браузер між цими рядками не малює, а
				 * дія не бачить нічого.
				 */
				const saved = caption.style.getPropertyValue('--caption-scale');
				const longestAt = (scale: number) => {
					caption.style.setProperty('--caption-scale', String(scale));
					caption.style.setProperty('max-width', 'none', 'important');
					caption.style.setProperty('overflow-wrap', 'normal', 'important');
					caption.style.setProperty('width', 'min-content', 'important');
					const width = caption.getBoundingClientRect().width / zoom - padding;
					caption.style.removeProperty('width');
					caption.style.removeProperty('overflow-wrap');
					caption.style.removeProperty('max-width');
					return width;
				};
				const scale = saved ? parseFloat(saved) : 1;
				const atBase = longestAt(1);
				const basePx = parseFloat(getComputedStyle(caption).fontSize);
				const atScale = longestAt(scale);
				const up = Number((scale + step).toFixed(4));
				const atStepUp = up < 1 ? longestAt(up) : null;
				if (saved) caption.style.setProperty('--caption-scale', saved);
				else caption.style.removeProperty('--caption-scale');

				// 1cqi — зондом у самій картинці: у неї рамка, а `cqi` рахується без рамки.
				const probe = document.createElement('div');
				probe.style.cssText = 'position: absolute; width: 100cqi; visibility: hidden;';
				caption.parentElement!.append(probe);
				const cqiPx = parseFloat(getComputedStyle(probe).width) / 100;
				probe.remove();

				return {
					name: (caption.textContent ?? '').trim(),
					scale,
					fontPx,
					basePx,
					cqiPx,
					padding,
					room,
					atBase,
					atScale,
					atStepUp
				};
			}),
		CAPTION_STEP
	);
}

/**
 * Усе, що не за правилом, — рядком із числами, щоб невдача опитування пояснювала себе сама
 * (див. `report` вище).
 *
 * На дні слову дозволено рватися — далі рятує перенос, і що жодна наявна назва до цього не
 * доходить, тримає перевірка даних. Тому окремо звіряється, що масштаб справді міняє
 * кегль: мутант «множник прибрано з CSS» доти проходив би — дія, не бачачи зміни кегля,
 * доходила до дна, а там уже дозволено все.
 */
function captionVerdict(captions: CaptionState[]): string {
	if (captions.length === 0) return 'підписів немає';
	const wrong = captions.flatMap((c) => {
		const fits = (width: number) => width <= c.room - CAPTION_SLACK_PX;
		const base = BASE_CAPTION_CQI * c.cqiPx;
		const where = `«${c.name}» ×${c.scale}: слово ${c.atBase.toFixed(1)}px, місця ${c.room.toFixed(1)}px`;

		if (Math.abs(c.basePx - base) > 0.1) {
			return [
				`«${c.name}»: кегль без винятку ${c.basePx.toFixed(2)}px, а 11cqi — ${base.toFixed(2)}px`
			];
		}
		if (Math.abs(c.fontPx - c.basePx * c.scale) > 0.1) {
			return [`${where} — а кегль ${c.fontPx.toFixed(2)}px: масштаб на кегль не діє`];
		}
		if (fits(c.atBase)) return c.scale === 1 ? [] : [`${where} — стає в рядок, а кегль менший`];
		if (c.scale >= 1) return [`${where} — не стає в рядок, а винятку немає`];
		if (c.scale > CAPTION_FLOOR && !fits(c.atScale)) {
			return [`${where} — і з винятком ${c.atScale.toFixed(1)}px, рветься`];
		}
		if (c.atStepUp !== null && fits(c.atStepUp)) {
			return [`${where} — на крок більший кегль уже ставав у рядок, зменшено зайве`];
		}
		return [];
	});
	return wrong.length === 0 ? 'усе за правилом' : wrong.join('; ');
}

/** «Хто зайвий?» нідерландською: відкривається одразу раундом, а найдовші назви — там. */
async function openFamily(page: Page) {
	await page.goto('/VetCrewGames/nl/game-family/');
	await expect(page.locator('[data-testid^="family-animal-btn-"]').first()).toBeVisible();
	await page.evaluate(() => document.fonts?.ready);
}

/**
 * Тиск: кожному підпису лишається `SQUEEZE_SHARE` місця, якого потребує його найдовше слово.
 *
 * У `cqi`, як і сам підпис: зміниться розмір картинки — частка лишиться. `!important`, бо
 * стеля підпису задана в `global.css`, і без нього правило тесту могло б програти каскаду
 * й не перевірити нічого; тому ж `verdict` спершу звіряє, що тиск діє.
 *
 * ТИСК ТРИМАЄ СЕБЕ САМ. Перший прогін у CI (run 36412285614) упав на «тиск не діє:
 * Sifaka»: слово, заміряне для правила, потім стало вужчим більш ніж на 15% — на
 * повільному раннері щось у розкладці (шрифт чи масштаб сторінки) лягло вже після
 * розрахунку, і повтор пройшов. Тож тиск, що перестав діяти, перераховується з нового
 * виміру, а опитування йде далі: це умова самого тесту, а не поведінка дії, і вердикт
 * про дію від цього не м'якшає.
 */
async function squeeze(page: Page, extraCss = '') {
	let style: Awaited<ReturnType<Page['addStyleTag']>> | null = null;
	const apply = async (captions: CaptionState[]) => {
		await page.$$eval('.image-caption', (nodes) =>
			nodes.forEach((node, i) => ((node as HTMLElement).dataset.squeeze = String(i)))
		);
		const rules = captions.map((c, i) => {
			const maxWidth = (c.atBase * SQUEEZE_SHARE + c.padding) / c.cqiPx;
			return `.image-caption[data-squeeze='${i}'] { max-width: ${maxWidth.toFixed(3)}cqi !important; }`;
		});
		await style?.evaluate((node) => (node as HTMLElement).remove());
		style = await page.addStyleTag({ content: [...rules, extraCss].join('\n') });
	};

	const first = await readCaptions(page);
	expect(first.length, 'підписів на дошці немає').toBeGreaterThan(0);
	await apply(first);

	return {
		/** Вердикт під тиском — або рядок про перерахований тиск, і тоді опитування йде далі. */
		async verdict(): Promise<string> {
			const now = await readCaptions(page);
			const loose = now.filter((c) => c.atBase <= c.room - CAPTION_SLACK_PX);
			if (loose.length === 0) return captionVerdict(now);
			await apply(now);
			const which = loose.map(
				(c) => `«${c.name}» ${c.atBase.toFixed(1)} із ${c.room.toFixed(1)}px`
			);
			return `тиск не діяв, перераховано: ${which.join(', ')}`;
		},
		async release() {
			await style?.evaluate((node) => (node as HTMLElement).remove());
		}
	};
}

test.describe('підпис на зображенні', () => {
	/**
	 * Дані: кожне слово кожної назви окремо, у справжньому класі, на трьох ширинах. Слово
	 * стоїть у рядок, коли висота підпису та сама, що в однолітерного, — своїм кеглем, а ні,
	 * то на дні винятку. Рветься й там — отже, така назва на картинку вже не лізе.
	 */
	test('кожне слово кожної назви стає в рядок — своїм кеглем або винятком', async ({ page }) => {
		const words = animalNameWords();
		expect(words.length, 'назв тварин не знайдено — шлях до перекладів змінився?').toBeGreaterThan(
			100
		);

		await page.goto('/VetCrewGames/');
		const { broken, exceptions } = await page.evaluate(
			async ({ words, widths, floor }) => {
				const host = document.createElement('div');
				document.body.append(host);
				const heightOf = (width: number, text: string, scale: number) => {
					const frame = document.createElement('div');
					frame.style.cssText = `position: relative; container-type: inline-size; width: ${width}px; height: 200px;`;
					const caption = document.createElement('span');
					caption.className = 'image-caption';
					caption.style.setProperty('--caption-scale', String(scale));
					caption.textContent = text;
					frame.append(caption);
					host.append(frame);
					return caption.getBoundingClientRect().height;
				};
				// Шрифт вантажиться на вимогу: без цього міряється запасний.
				await document.fonts.load('700 16px Inglobal', words.join(' '));
				await document.fonts.ready;

				const broken: string[] = [];
				const exceptions: string[] = [];
				for (const width of widths) {
					const oneLine = heightOf(width, 'A', 1);
					const oneLineAtFloor = heightOf(width, 'A', floor);
					for (const word of words) {
						if (heightOf(width, word, 1) <= oneLine + 0.5) continue;
						exceptions.push(`${word} @ ${width}px`);
						if (heightOf(width, word, floor) > oneLineAtFloor + 0.5) {
							broken.push(`${word} @ ${width}px`);
						}
					}
				}
				host.remove();
				return { broken, exceptions };
			},
			{ words, widths: CAPTION_WIDTHS, floor: CAPTION_FLOOR }
		);

		// Кому знадобився виняток — у звіт прогону: видно, чи він досі рідкість.
		test.info().annotations.push({
			type: 'виняток fitCaption',
			description: exceptions.join(', ') || 'нікому'
		});
		expect(broken, `слова, що рвуться й на дні винятку: ${broken.join(', ')}`).toEqual([]);
	});

	/**
	 * Головна перевірка — рівно прохання автора: слово, що не стає в рядок, меншає рівно
	 * настільки, щоб стати, а слово, що стає, лишається кеглем 11cqi. На будь-якій четвірці
	 * тварин.
	 *
	 * Спершу тиск: кожному слову лишається 85% місця, якого воно потребує. Без дії слово
	 * лишається свого кегля; без множника в CSS масштаб не міняє кегля; «одразу на дно» — на
	 * крок більший кегль уже ставав у рядок. Опитування тут не проходить саме собою: до
	 * виміру під тиском винятку немає, а слово не стає.
	 *
	 * ПОТІМ ТИСК ЗНЯТО — і це не прикраса. Перша редакція просто опитувала дошку, і
	 * зворотний експеримент «зменшувати завжди» пройшов: до першого виміру дії (~140 мс після
	 * того, як розкладка вгамувалася) винятку немає ні в кого, і правило «стає — без винятку»
	 * виконується саме собою. Коли тиск спершу зменшив усіх, повернення до 11cqi видно лише
	 * після нового виміру. Заодно видно, що виняток не залипає, коли місце повертається
	 * (дефект, який `fitLabel` уже мав).
	 */
	test('слово, що не стає в рядок, меншає рівно настільки, а що стає, — кеглем 11cqi', async ({
		page
	}) => {
		await openFamily(page);
		const pressure = await squeeze(page);
		await expect.poll(() => pressure.verdict(), { timeout: 10_000 }).toBe('усе за правилом');

		await pressure.release();
		await expect
			.poll(async () => captionVerdict(await readCaptions(page)), { timeout: 10_000 })
			.toBe('усе за правилом');
	});

	/**
	 * Той самий тиск, і менший кегль ширший за пропорцію, як на Linux. Без перевірки виміром
	 * дія бере кегль із пропорції — і слово рветься вже зменшеним. Саме так підпис рвався б
	 * у CI і з винятком.
	 */
	test('менший кегль перевіряється виміром, а не пропорцією', async ({ page }) => {
		await openFamily(page);
		const pressure = await squeeze(page, LINUX_ROUNDING_CSS);
		await expect.poll(() => pressure.verdict(), { timeout: 10_000 }).toBe('усе за правилом');
	});

	/** На справжній дошці підпис — усередині картинки, а не під нею чи за її краєм. */
	test('на дошці підпис лежить у межах своєї картинки', async ({ page }) => {
		await openFamily(page);
		const cards = page.locator('[data-testid^="family-animal-btn-"]');

		const outside = await cards.evaluateAll((buttons) =>
			buttons.flatMap((button) => {
				const frame = button.querySelector('.animal-card__image-wrap')!.getBoundingClientRect();
				const caption = button.querySelector('.image-caption');
				if (!caption) return [`${button.dataset.testid}: підпису на картинці немає`];
				const box = caption.getBoundingClientRect();
				const inside =
					box.left >= frame.left - 0.5 &&
					box.right <= frame.right + 0.5 &&
					box.top >= frame.top - 0.5 &&
					box.bottom <= frame.bottom + 0.5;
				return inside ? [] : [`${caption.textContent?.trim()}: поза картинкою`];
			})
		);
		expect(outside).toEqual([]);
	});
});
