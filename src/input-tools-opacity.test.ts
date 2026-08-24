// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * ДРАБИНА ПРОЗОРОСТІ КНОПОК У ПОЛІ ТРИМАЄТЬСЯ НА ВАЗІ СЕЛЕКТОРІВ — і саме тому
 * ламалася тихо.
 *
 * `INPUT-TOOLS-v8` § 4.1 задає чотири рівні: 30% у спокої, 60% коли курсор
 * десь у полі, 90% коли він у смузі кнопок, 100% на самій кнопці. А § 4.2
 * додає два стани, де прозорості немає зовсім: `:focus-visible` і
 * `@media (hover: none)`.
 *
 * Усі шість правил ставлять ОДНУ властивість одному класу. Отже котре
 * спрацює — вирішує лише вага селектора, і різниця в один клас переставляє
 * рівні місцями. Написано було так:
 *
 *     .has-input-tools:hover .tools__btn   (0,3,0)   opacity .6
 *     .tools:hover .tools__btn             (0,3,0)   opacity .9
 *     .tools__btn:focus-visible            (0,2,0)   opacity 1   ← слабше
 *     @media (hover: none) { .tools__btn } (0,1,0)   opacity 1   ← слабше за все
 *
 * Наслідки не «трохи не той відтінок», а два зі шести станів, яких немає:
 *
 *  - кнопка у фокусі світилася на повну лише доки курсор поза полем. Заходиш
 *    мишею в поле — і те, що зараз у фокусі, падає до 60%;
 *  - `@media` не міняє ваги, тож на сенсорному екрані правило лишалося
 *    найслабшим. А сенсорні браузери тримають «липке» наведення після дотику —
 *    тобто значок опускався назад рівно після того, як до поля торкнулися.
 *    Саме тоді, коли він потрібен.
 *
 * Червоного при цьому ніде: CSS валідний, `svelte-check` мовчить, гейт
 * контрасту міряє колір, а не вагу, а тест на розмітку не знає, які правила до
 * неї застосуються. Автор питав «хто постійно це ламає» — ламав це я, двічі, і
 * причина щоразу та сама: жодна перевірка не дивилася на вагу. Тепер дивиться.
 *
 * Зворотний дослід (`AI-AGENT-PITFALLS-v8` § 1.1): звузити будь-яке з двох
 * правил § 4.2 назад до `.tools__btn:focus-visible` — перевірка мусить
 * почервоніти з назвою селектора й обома числами. Зроблено, падає.
 */

const CSS = resolve(__dirname, '..', 'src', 'lib', 'styles', 'global.css');
const TARGET = '.tools__btn';

/** Одне правило: селектори, значення `opacity` і чи воно під `@media (hover: none)`. */
interface Rule {
	selector: string;
	opacity: number;
	touch: boolean;
}

/**
 * Вага селектора трійкою (id, клас, елемент) — рівно як її рахує браузер.
 *
 * ПсевдоКЛАСИ (`:hover`, `:focus-visible`) важать як клас, псевдоЕЛЕМЕНТИ
 * (`::before`) — як елемент. Порядок перевірок тут обовʼязковий: `::` мусить
 * зустрітися раніше за `:`, інакше подвійна двокрапка порахується двічі як
 * псевдоклас, і вага вийде завищеною саме там, де вона й важлива.
 */
function weight(selector: string): [number, number, number] {
	let ids = 0;
	let classes = 0;
	let elements = 0;

	for (let i = 0; i < selector.length; i += 1) {
		const ch = selector[i];
		if (ch === '#') {
			ids += 1;
		} else if (ch === '.' || ch === '[') {
			classes += 1;
		} else if (ch === ':') {
			if (selector[i + 1] === ':') {
				elements += 1;
				i += 1;
			} else {
				classes += 1;
			}
		}
	}

	// Імена елементів (`input`, `button`) у цій драбині не вживаються, тож
	// рахувати їх нічим — і навмисно: припущення назване, а не заховане.
	return [ids, classes, elements];
}

function compare(a: [number, number, number], b: [number, number, number]): number {
	for (let i = 0; i < 3; i += 1) {
		if (a[i] !== b[i]) return a[i] - b[i];
	}
	return 0;
}

const show = (w: [number, number, number]) => `(${w[0]},${w[1]},${w[2]})`;

/**
 * Правила, що ставлять `opacity` цільовому класу.
 *
 * Розбір навмисно простий і НЕ загальний: він знає лише те, що є в цьому файлі
 * — плоскі правила та один рівень `@media`. Загальний парсер CSS тут був би
 * більшим за те, що охороняє, і сам став би місцем для помилки.
 */
function collect(css: string): Rule[] {
	const out: Rule[] = [];
	// Коментарі геть: у них теж є `.tools__btn` і числа, і саме такий текст
	// стоїть у пояснювальних блоках цього файлу.
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');

	const touchStart = clean.search(/@media\s*\(\s*hover\s*:\s*none\s*\)\s*\{/);
	let touchEnd = -1;
	if (touchStart !== -1) {
		// Межа блоку — за балансом дужок, а не за першою закривною: усередині
		// лежать власні правила зі своїми дужками.
		let depth = 0;
		for (let i = clean.indexOf('{', touchStart); i < clean.length; i += 1) {
			if (clean[i] === '{') depth += 1;
			else if (clean[i] === '}') {
				depth -= 1;
				if (depth === 0) {
					touchEnd = i;
					break;
				}
			}
		}
	}

	const rule = /([^{}]+)\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = rule.exec(clean)) !== null) {
		const head = match[1].trim();
		const body = match[2];
		if (head.startsWith('@')) continue;

		const opacity = /(?:^|;)\s*opacity\s*:\s*([\d.]+)/.exec(body);
		if (opacity === null) continue;

		const touch = touchStart !== -1 && match.index > touchStart && match.index < touchEnd;

		for (const one of head.split(',')) {
			const selector = one.trim();
			if (!selector.includes(TARGET)) continue;
			out.push({ selector, opacity: Number(opacity[1]), touch });
		}
	}

	return out;
}

describe('прозорість кнопок у полі', () => {
	const css = readFileSync(CSS, 'utf8');
	const rules = collect(css);
	const ladder = rules.filter((r) => !r.touch && r.opacity < 1);
	const exemptions = rules.filter((r) => r.touch || r.selector.includes(':focus-visible'));

	it('розбір знаходить і драбину, і винятки — перевірка жива', () => {
		// Без цього все нижче проходило б на порожніх списках: саме так гейт і
		// перетворюється на зелений напис, що нічого не означає.
		expect(ladder.length).toBeGreaterThanOrEqual(2);
		expect(exemptions.length).toBeGreaterThanOrEqual(2);
		expect(rules.every((r) => Number.isFinite(r.opacity))).toBe(true);
	});

	it('вага рахується так, як її рахує браузер', () => {
		expect(weight('.tools__btn')).toEqual([0, 1, 0]);
		expect(weight('.tools__btn:focus-visible')).toEqual([0, 2, 0]);
		expect(weight('.has-input-tools:hover .tools__btn')).toEqual([0, 3, 0]);
		// Псевдоелемент — рівень елемента, а не класу. Якби `::` рахувалося як
		// два псевдокласи, вага вийшла б (0,3,0) замість (0,1,1).
		expect(weight('.tools__btn::before')).toEqual([0, 1, 1]);
	});

	it('фокус не слабший за найважчу сходинку драбини', () => {
		/*
		 * ФОКУС — одне правило, і тому міра до нього суворіша, ніж до сенсорного
		 * блоку.
		 *
		 * `:focus-visible` мусить діяти в будь-якому стані наведення: кнопка у
		 * фокусі не має права згаснути через те, що курсор зайшов у поле. Отже
		 * одного селектора досить, але важити він мусить не менше за НАЙВАЖЧУ
		 * сходинку.
		 *
		 * Сенсорний блок влаштований інакше — там група селекторів, і кожен
		 * перебиває свою сходинку. Слабкий селектор у ній законний: він існує, щоб
		 * перебити базові 30%, а важчі сходинки перебивають його сусіди. Судить це
		 * наступна перевірка, за покриттям, а не за максимумом; звести обидві в
		 * одну — і законна група починає падати.
		 */
		const heaviest = ladder.reduce<[number, number, number]>(
			(max, r) => (compare(weight(r.selector), max) > 0 ? weight(r.selector) : max),
			[0, 0, 0]
		);

		const focus = exemptions.filter((r) => !r.touch && r.selector.includes(':focus-visible'));
		expect(focus.length, 'правила для :focus-visible немає зовсім (§ 4.2)').toBeGreaterThan(0);

		const weak = focus
			.filter((r) => compare(weight(r.selector), heaviest) < 0)
			.map((r) => `${r.selector} — ${show(weight(r.selector))} проти ${show(heaviest)} у драбини`);

		expect(
			weak,
			'правило фокуса важить менше за сходинку, тобто діє лише поки курсор ' +
				'поза полем: заходиш мишею в поле — і те, що зараз у фокусі, гасне'
		).toEqual([]);
	});

	it('сенсорний виняток покриває КОЖНУ сходинку, а не лише найслабшу', () => {
		// `@media` не міняє ваги. Тому одного селектора там не досить: він мусить
		// перебити кожну сходинку окремо, інакше липке наведення на телефоні
		// повертає саме ту сходинку, яку не перебили.
		const touch = rules.filter((r) => r.touch).map((r) => weight(r.selector));
		const uncovered = ladder
			.filter((step) => !touch.some((t) => compare(t, weight(step.selector)) >= 0))
			.map((step) => `${step.selector} ${show(weight(step.selector))} → opacity ${step.opacity}`);

		expect(
			uncovered,
			'сходинку не перебито в @media (hover: none): після дотику до поля значок ' +
				'опуститься назад саме до цього рівня'
		).toEqual([]);
	});

	it('канонні чотири рівні на місці', () => {
		const values = [...new Set(rules.filter((r) => !r.touch).map((r) => r.opacity))].sort();
		// § 4.1: 30 / 60 / 90 / 100. Число 0.3 тут головне — саме його я двічі
		// підміняв на 0.85, «щоб пройшов гейт контрасту», і двічі це було
		// виправлено з боку автора.
		expect(values).toEqual([0.3, 0.6, 0.9, 1]);
	});
});

describe('файл стилів на місці', () => {
	it('шлях до global.css актуальний', () => {
		// Перейменування файлу зробило б усе вище зеленим на порожньому тексті.
		expect(() => readFileSync(join(CSS), 'utf8')).not.toThrow();
	});
});
