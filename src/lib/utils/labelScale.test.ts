// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
	labelFit,
	largestFittingScale,
	LABEL_SLACK_PX,
	LABEL_STEP,
	MIN_LABEL_SCALE
} from './labelScale';

/**
 * Арифметика підпису картки.
 *
 * Головна вимога автора тут не «зменшити», а «зменшити ТІЛЬКИ якщо не
 * вміщається»: назва, яка й так уміщалася, мусить лишитися того самого кегля.
 * Тому перша й найважливіша перевірка — та, що НІЧОГО не робить.
 *
 * Друга вимога — картка не має права стати ширшою. Її тримає CSS
 * (`min-width: 0` плюс `overflow: hidden`), а не ці числа; тут перевіряється
 * лише те, що результат ніколи не просить більше місця, ніж є.
 */
describe('масштаб підпису', () => {
	it('перевірка жива: задовгому тексту масштаб зменшується', () => {
		expect(labelFit(200, 94).scale).toBeLessThan(1);
	});

	it('текст, який вміщається, НЕ зменшується', () => {
		expect(labelFit(50, 94)).toEqual({ scale: 1, wrap: false });
		expect(labelFit(90, 94)).toEqual({ scale: 1, wrap: false });
	});

	/**
	 * Межа: рівно по краю вважається «не вміщається».
	 *
	 * Запас у піксель тут не про перфекціонізм: ширина коробки дробова, а гліфи
	 * дають розбіжність у частку пікселя, тож підпис, який «рівно вміщався», у
	 * наступному кадрі виїжджає (FLUID-SIZING-v8 § 8.1).
	 */
	it('рівно по краю — вже завузько', () => {
		expect(labelFit(94, 94).scale).toBeLessThan(1);
		expect(labelFit(94 - LABEL_SLACK_PX, 94).scale).toBe(1);
	});

	/**
	 * Результат мусить бути НЕРУХОМОЮ ТОЧКОЮ, як і в `fitZoom`, — але з іншої
	 * причини. Тут немає зворотного зв'язку через розкладку (ширина картки задана
	 * слотом і від кегля не залежить), проте `ResizeObserver` спостерігає сам
	 * підпис, і зміна кегля міняє його висоту. Отже другий вимір із тими самими
	 * числами мусить дати те саме, інакше запис покличе спостерігача знову.
	 */
	it('другий вимір із тими самими числами дає те саме', () => {
		const first = labelFit(140, 94);
		expect(labelFit(140, 94)).toEqual(first);
	});

	it('масштаб округлюється ВНИЗ до кроку', () => {
		// (94 - 1) / 140 = 0.6642… → на дні, бо нижче за MIN_LABEL_SCALE
		expect(labelFit(140, 94).scale).toBe(MIN_LABEL_SCALE);
		// (94 - 1) / 110 = 0.8454… → 0.80, а не 0.85: догори могло б не вміститися
		expect(labelFit(110, 94).scale).toBe(0.8);
	});

	it('масштаб завжди кратний кроку і в межах [дно, 1]', () => {
		for (let needed = 20; needed <= 400; needed += 3) {
			const { scale } = labelFit(needed, 94);
			expect(scale).toBeGreaterThanOrEqual(MIN_LABEL_SCALE);
			expect(scale).toBeLessThanOrEqual(1);
			// Кратність: інакше два підписи однакової довжини отримали б розмір, що
			// відрізняється на пів відсотка, і в одному рядку карток це видно.
			expect(Math.abs(scale / LABEL_STEP - Math.round(scale / LABEL_STEP))).toBeLessThan(1e-9);
		}
	});

	/**
	 * Дно не «здається»: воно передає роботу переносу.
	 *
	 * Обрізане «Reuzenmierenet…» у грі, де тварину треба впізнати за назвою, гірше
	 * за дрібний шрифт у два рядки.
	 */
	it('коли дна не досить — дозволяється перенос, і масштаб стоїть на дні', () => {
		const fit = labelFit(300, 94);
		expect(fit.scale).toBe(MIN_LABEL_SCALE);
		expect(fit.wrap).toBe(true);
	});

	it('перенос НЕ дозволяється, поки масштаб іще має запас', () => {
		expect(labelFit(110, 94).wrap).toBe(false);
		expect(labelFit(120, 94).wrap).toBe(false);
	});

	it('незаміряний елемент лишається недоторканим', () => {
		expect(labelFit(0, 94)).toEqual({ scale: 1, wrap: false });
		expect(labelFit(140, 0)).toEqual({ scale: 1, wrap: false });
		expect(labelFit(-5, -5)).toEqual({ scale: 1, wrap: false });
	});
});

/**
 * Крок, перевірений виміром (`largestFittingScale`, підпис на картинці).
 *
 * Пропорція `labelFit` правдива, поки ширини гліфів дробові. Chromium на Linux округлює
 * їх до цілих пікселів, і менший кегль буває ширшим або вужчим за пропорцію на кілька
 * пікселів — так у CI підпис і рвався. Тут ширина рядка — пропорція плюс ця похибка.
 */
describe('найбільший крок, за якого справді вміщається', () => {
	const ROOM = 100;
	const NEEDED = 120;
	/** Ширина рядка за масштабу: пропорція плюс похибка округлення. */
	const fitsWith = (needed: number, error: number) => (scale: number) =>
		needed * scale + error <= ROOM - LABEL_SLACK_PX;

	/**
	 * Пошук із лічильником вимірів. Кожен вимір на сторінці — перерахунок розкладки, а в сітці
	 * сім кроків, тож двадцять — це вже зациклення. Без ліку тест такого не червонив би, а
	 * вішав воркер: так і було з мутантом «крок угору до `up <= 1`», який крутився на стелі 1.
	 */
	const search = (first: number, fits: (scale: number) => boolean) => {
		let calls = 0;
		return largestFittingScale(first, (scale) => {
			if (++calls > 20) throw new Error(`пошук не зупиняється: уже ${calls} вимірів`);
			return fits(scale);
		});
	};

	it('коли пропорція правдива — та сама відповідь, що в labelFit', () => {
		// (100 - 1) / 120 = 0.825 → 0.80
		const first = labelFit(NEEDED, ROOM).scale;
		expect(first).toBe(0.8);
		expect(search(first, fitsWith(NEEDED, 0))).toBe(first);
	});

	it('менший кегль ширший за пропорцію — крок униз, поки не вміститься', () => {
		// +4px: ×0.80 дає 100 із 99 — ні; ×0.75 дає 94 — так.
		expect(search(0.8, fitsWith(NEEDED, 4))).toBe(0.75);
	});

	it('менший кегль вужчий за пропорцію — крок угору, поки вміщається', () => {
		// −6px: ×0.85 дає 96 — так; ×0.90 дає 102 — ні. Зменшувати до 0.80 нема чого.
		expect(search(0.8, fitsWith(NEEDED, -6))).toBe(0.85);
	});

	it('масштаб 1 не пробується: за нього вже не вмістилося', () => {
		expect(search(0.8, () => true)).toBe(0.95);
	});

	it('і на дні не вміщається — дно, далі рятує перенос', () => {
		expect(search(0.8, () => false)).toBe(MIN_LABEL_SCALE);
	});

	/**
	 * Властивість, а не приклади: за будь-якої похибки відповідь — крок сітки, за якого
	 * вміщається (або дно), а на крок більший — уже ні. Саме «на крок більший — ні» і є
	 * «трохи меншим, а не якомога меншим».
	 */
	it('відповідь — найбільший крок сітки, за якого вміщається', () => {
		for (let needed = 101; needed <= 200; needed += 7) {
			for (let error = -20; error <= 20; error += 1) {
				const fits = fitsWith(needed, error);
				const scale = search(labelFit(needed, ROOM).scale, fits);
				const up = Number((scale + LABEL_STEP).toFixed(4));
				const where = `потрібно ${needed}px, похибка ${error}px → ×${scale}`;

				expect(scale, where).toBeGreaterThanOrEqual(MIN_LABEL_SCALE);
				expect(scale, where).toBeLessThan(1);
				expect(Math.abs(scale / LABEL_STEP - Math.round(scale / LABEL_STEP)), where).toBeLessThan(
					1e-9
				);
				expect(fits(scale) || scale === MIN_LABEL_SCALE, where).toBe(true);
				expect(up >= 1 || !fits(up), where).toBe(true);
			}
		}
	});
});
