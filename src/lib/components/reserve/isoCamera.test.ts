import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isoControls, MAX_PAN, MAX_ZOOM, MIN_ZOOM } from './isoCamera';
import { OrthographicCamera, Vector3 } from 'three';

/**
 * Керування ізометричною камерою.
 *
 * Перевіряється в jsdom, без WebGL: тут немає нічого, що потребувало б
 * малювання, — самі лише межі й розпізнавання жесту. Саме ця частина й ламає
 * гру на телефоні, якщо помилитися: сцена, яку відпустило за край, назад не
 * повертається, а вибір, що спрацьовує на кожному перетягуванні, відчувається
 * як «гра сама щось натискає».
 */

function setup() {
	const element = document.createElement('div');
	// jsdom не реалізує захоплення вказівника, а код на нього розраховує.
	element.setPointerCapture = vi.fn();
	element.releasePointerCapture = vi.fn();
	document.body.append(element);

	const camera = new OrthographicCamera(-1, 1, 1, -1, -200, 2000);
	camera.position.set(14, 14, 14);
	camera.zoom = 54;

	const target = new Vector3(0, 0, 0);
	const taps: Array<[number, number]> = [];
	const controls = isoControls(
		element,
		camera,
		target,
		() => {},
		(x, y) => taps.push([x, y])
	);

	const pointer = (type: string, x: number, y: number, id = 1) =>
		element.dispatchEvent(
			new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true })
		);

	return { element, camera, target, taps, controls, pointer };
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('ізометрична камера', () => {
	it('перевірка жива: камера стає над ціллю під кутом', () => {
		const { camera, target } = setup();
		expect(target.toArray()).toEqual([0, 0, 0]);
		// Рівні координати — це і є 45° по горизонталі й ~35° над обрієм.
		expect(camera.position.x).toBeCloseTo(camera.position.z);
	});

	it('перетягування рухає сцену', () => {
		const { target, pointer } = setup();
		pointer('pointerdown', 100, 100);
		pointer('pointermove', 160, 140);
		expect(target.x !== 0 || target.z !== 0).toBe(true);
	});

	/**
	 * Кут НЕ змінюється ніколи — у цьому вся ізометрія.
	 *
	 * Панорамування рухає камеру й ціль разом; щойно одне з двох лишиться на
	 * місці, сцена почне обертатися, і однакові вольєри перестануть виглядати
	 * однаково залежно від того, куди від'їхали.
	 */
	it('панорамування не обертає камеру', () => {
		const { camera, target, pointer } = setup();
		const before = camera.position.clone().sub(target);

		pointer('pointerdown', 100, 100);
		pointer('pointermove', 250, 60);
		pointer('pointerup', 250, 60);

		const after = camera.position.clone().sub(target);
		expect(after.x).toBeCloseTo(before.x);
		expect(after.y).toBeCloseTo(before.y);
		expect(after.z).toBeCloseTo(before.z);
	});

	it('сцену не відпускає за край', () => {
		const { target, pointer } = setup();
		pointer('pointerdown', 0, 0);
		// Тягнемо навмисне абсурдно далеко — по мільйону пікселів у кожен бік.
		for (let i = 1; i <= 20; i++) pointer('pointermove', i * 50_000, i * 50_000);

		expect(Math.abs(target.x)).toBeLessThanOrEqual(MAX_PAN);
		expect(Math.abs(target.z)).toBeLessThanOrEqual(MAX_PAN);
	});

	it('масштаб тримається в межах', () => {
		const { element, camera } = setup();
		for (let i = 0; i < 60; i++) element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 }));
		expect(camera.zoom).toBe(MAX_ZOOM);

		for (let i = 0; i < 120; i++) element.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
		expect(camera.zoom).toBe(MIN_ZOOM);
	});

	it('колесо не прокручує сторінку під сценою', () => {
		const { element } = setup();
		const event = new WheelEvent('wheel', { deltaY: 100, cancelable: true });
		element.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});

describe('тап проти перетягування', () => {
	it('дотик без руху — це вибір', () => {
		const { taps, pointer } = setup();
		pointer('pointerdown', 120, 90);
		pointer('pointerup', 120, 90);
		expect(taps).toEqual([[120, 90]]);
	});

	it('дрібне тремтіння пальця вибору не скасовує', () => {
		const { taps, pointer } = setup();
		pointer('pointerdown', 120, 90);
		pointer('pointermove', 123, 92);
		pointer('pointerup', 123, 92);
		expect(taps).toHaveLength(1);
	});

	/**
	 * Найдорожчий випадок: інакше кожне панорамування закінчувалося б вибором
	 * тварини, над якою випадково відпустили палець.
	 */
	it('перетягування вибору НЕ дає', () => {
		const { taps, pointer } = setup();
		pointer('pointerdown', 120, 90);
		pointer('pointermove', 200, 150);
		pointer('pointerup', 200, 150);
		expect(taps).toEqual([]);
	});

	it('кінець щипка теж не вибирає', () => {
		const { taps, camera, pointer } = setup();
		const zoomBefore = camera.zoom;

		pointer('pointerdown', 100, 100, 1);
		pointer('pointerdown', 200, 100, 2);
		pointer('pointermove', 240, 100, 2);
		pointer('pointerup', 240, 100, 2);
		pointer('pointerup', 100, 100, 1);

		expect(camera.zoom, 'щипок не змінив масштаб — перевірка мертва').not.toBe(zoomBefore);
		expect(taps).toEqual([]);
	});

	it('після знищення жести більше не доходять', () => {
		const { taps, controls, pointer } = setup();
		controls.destroy();
		pointer('pointerdown', 50, 50);
		pointer('pointerup', 50, 50);
		expect(taps).toEqual([]);
	});
});
