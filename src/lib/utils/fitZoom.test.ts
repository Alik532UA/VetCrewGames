// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fitZoom, MIN_ZOOM, SLACK_PX, ZOOM_STEP } from './fitZoom';

/**
 * Арифметика проти дрижання.
 *
 * Масштаб сторінки — зворотний зв'язок: він міняє розкладку, розкладка міняє
 * потрібний масштаб. На телефоні цей цикл видно оком, і полагодити його можна
 * лише тут — у числах. Тому перевіряється саме те, що робить систему стійкою:
 * крок, мертва зона й нерухома точка.
 */
describe('масштаб під вікно', () => {
	it('перевірка жива: тісній сторінці масштаб зменшується', () => {
		expect(fitZoom(1000, 500, 1)).toBeLessThan(1);
	});

	it('сторінка, яка вміщається, лишається без масштабу', () => {
		expect(fitZoom(400, 500, 1)).toBe(1);
		expect(fitZoom(500, 500, 1)).toBe(1);
	});

	/**
	 * Найважливіше: результат є НЕРУХОМОЮ ТОЧКОЮ.
	 *
	 * Другий виклик із тим самим виміром мусить дати те саме число — інакше стиль
	 * перепишеться, розкладка зміниться, спостерігач покличе третій вимір, і
	 * сторінка дрижатиме доти, доки на неї дивляться.
	 */
	it('другий вимір нічого не міняє', () => {
		const first = fitZoom(1000, 500, 1);
		expect(fitZoom(1000, 500, first)).toBe(first);
		expect(fitZoom(1000, 500, fitZoom(1000, 500, first))).toBe(first);
	});

	/** Дрібне гуляння висоти не рухає масштаб: саме воно й смикало сторінку. */
	it('зміна менша за крок не рухає масштаб', () => {
		const settled = fitZoom(1000, 800, 1);
		for (const wobble of [-6, -3, -1, 1, 3, 6]) {
			expect(fitZoom(1000, 800 + wobble, settled), `гуляння ${wobble}px`).toBe(settled);
		}
	});

	/** А справжня зміна — рухає: інакше запобіжник просто ламав би підгонку. */
	it('справжня зміна вікна масштаб таки рухає', () => {
		const settled = fitZoom(1000, 800, 1);
		expect(fitZoom(1000, 600, settled)).toBeLessThan(settled);
		expect(fitZoom(1000, 990, settled)).toBeGreaterThan(settled);
	});

	/** Кратність кроку — або саме дно: воно не мусить лягати на сітку. */
	it('масштаб кратний крокові', () => {
		for (let available = 300; available <= 1000; available += 7) {
			const zoom = fitZoom(1000, available, 1);
			if (zoom === MIN_ZOOM) continue;
			const steps = zoom / ZOOM_STEP;
			expect(Math.abs(steps - Math.round(steps)), `доступно ${available}`).toBeLessThan(1e-6);
		}
	});

	it('нижче дна не опускається', () => {
		expect(fitZoom(10_000, 200, 1)).toBe(MIN_ZOOM);
	});

	/**
	 * Округлення саме ВНИЗ.
	 *
	 * Догори означало б масштаб, при якому сторінка все ще не вміщається — тобто
	 * підгонка, яка не підганяє. Перевіряємо на числі, що падає між кроками.
	 */
	it('округлення вниз: сторінка справді вміщається', () => {
		const needed = 1000;
		const available = 953;
		const zoom = fitZoom(needed, available, 1);
		expect(needed * zoom).toBeLessThanOrEqual(available - SLACK_PX);
	});

	it('нульові виміри не дають NaN', () => {
		expect(fitZoom(0, 500, 1)).toBe(1);
		expect(fitZoom(500, 0, 1)).toBe(1);
	});
});
