// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FILL_SHARE, fitZoom, GROW_BAND, MAX_ZOOM, MIN_ZOOM, SLACK_PX, ZOOM_STEP } from './fitZoom';

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

	/**
	 * ЦІЛЬ — 90% ВИСОТИ, а не 100% (правило автора 2026-09-27: «елементи разом на 90%
	 * екрану»). Зворотний експеримент: повернути `FILL_SHARE = 1` — червоніє другий рядок.
	 */
	it('сторінка, що займає до 90% висоти, лишається без масштабу, а на всю — стискається', () => {
		expect(fitZoom(400, 500, 1)).toBe(1);
		expect(fitZoom(500 * FILL_SHARE, 500, 1)).toBe(1);
		const full = fitZoom(500, 500, 1);
		expect(full, 'уся висота — уже забагато').toBeLessThan(1);
		expect(500 * full).toBeLessThanOrEqual(500 * FILL_SHARE - SLACK_PX);
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
		const settled = fitZoom(1000, 1000, 1);
		expect(settled, 'робоча точка, а не дно — інакше перевіряти нічого').toBeGreaterThan(MIN_ZOOM);
		for (const wobble of [-6, -3, -1, 1, 3, 6]) {
			expect(fitZoom(1000, 1000 + wobble, settled), `гуляння ${wobble}px`).toBe(settled);
		}
	});

	/** А справжня зміна — рухає: інакше запобіжник просто ламав би підгонку. */
	it('справжня зміна вікна масштаб таки рухає', () => {
		const settled = fitZoom(1000, 1000, 1);
		expect(fitZoom(1000, 800, settled)).toBeLessThan(settled);
		expect(fitZoom(1000, 1250, settled)).toBeGreaterThan(settled);
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

/**
 * РІСТ (прохання автора 2026-09-27: «95% порожнє, а ми мілким елементом пишемо»).
 *
 * Масштаб росте лише тоді, коли той, хто кличе, дав стелю вище за одиницю: без неї все
 * рівно як вище, тобто лише вниз. Ті самі три властивості, що тримають стиснення, мусять
 * тримати й ріст: нерухома точка, мертва зона, округлення в бік «вміщається».
 */
describe('масштаб росте до вікна', () => {
	it('без стелі не росте: типово — лише вниз, як було', () => {
		expect(fitZoom(300, 700, 1)).toBe(1);
	});

	it('зі стелею росте, доки вміст не займе 90% висоти, і ні кроком далі', () => {
		const zoom = fitZoom(400, 710, 1, 2);
		expect(zoom).toBeGreaterThan(1);
		expect(400 * zoom).toBeLessThanOrEqual(710 * FILL_SHARE - SLACK_PX);
		expect(400 * (zoom + ZOOM_STEP)).toBeGreaterThan(710 * FILL_SHARE - SLACK_PX);
	});

	/** Стеля не мусить лежати на сітці кроку (2,125 — стеля одиниці), а масштаб — мусить. */
	it('упирається в стелю — з точністю до кроку', () => {
		expect(fitZoom(100, 1000, 1, 1.5)).toBe(1.5);
		const top = fitZoom(100, 1000, 1, MAX_ZOOM);
		expect(top).toBeLessThanOrEqual(MAX_ZOOM);
		expect(top).toBeGreaterThan(MAX_ZOOM - ZOOM_STEP);
	});

	it('вирослий масштаб — нерухома точка', () => {
		const grown = fitZoom(400, 710, 1, 2);
		expect(fitZoom(400, 710, grown, 2)).toBe(grown);
	});

	it('дрібне гуляння висоти вирослий масштаб не рухає', () => {
		const grown = fitZoom(400, 710, 1, 2);
		for (const wobble of [-2, -1, 1, 3, 6]) {
			expect(fitZoom(400, 710 + wobble, grown, 2), `гуляння ${wobble}px`).toBe(grown);
		}
	});

	/** Розтягується лише з запасом у два кроки — асиметрія та сама, що й при стисненні. */
	it('запасу менше за два кроки — не росте', () => {
		const needed = 400;
		const available = Math.floor((needed * (1 + GROW_BAND / 2) + SLACK_PX) / FILL_SHARE);
		expect(fitZoom(needed, available, 1, 2)).toBe(1);
	});

	it('вирослий масштаб, що перестав уміщатися, стискається одразу', () => {
		const grown = fitZoom(400, 710, 1, 2);
		const shrunk = fitZoom(400, 600, grown, 2);
		expect(shrunk).toBeLessThan(grown);
		expect(400 * shrunk).toBeLessThanOrEqual(600 * FILL_SHARE - SLACK_PX);
	});

	/** Вікно звузилося, і місця вшир поменшало: стеля опускає масштаб, навіть коли висоти вдосталь. */
	it('стеля, нижча за поточний масштаб, його опускає', () => {
		expect(fitZoom(400, 710, 1.76, 1.3)).toBe(1.3);
	});
});

/**
 * ДНО СТИСНЕННЯ. Сторінки, яким на телефоні природно прокручуватися (лобі, хаб), кличуть
 * з дном 1: стиснуте до 0,75 лобі вікторини на 390×844 лишалося з прокруткою, тільки
 * дрібнішою.
 */
describe('масштаб, що лише росте', () => {
	it('з дном 1 не стискається, хоч би як бракувало місця', () => {
		expect(fitZoom(1000, 500, 1, 1, 1)).toBe(1);
		expect(fitZoom(1000, 500, 1, 2, 1)).toBe(1);
	});

	it('з дном 1 росте так само, як без нього', () => {
		expect(fitZoom(400, 710, 1, 2, 1)).toBe(fitZoom(400, 710, 1, 2));
	});

	it('вирослий, що перестав уміщатися, опускається рівно до 1, а не нижче', () => {
		expect(fitZoom(1000, 500, 1.5, 2, 1)).toBe(1);
	});
});
