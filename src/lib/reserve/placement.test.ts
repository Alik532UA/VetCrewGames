// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { placementProblem } from './placement';
import { reserveHalf } from './plot';
import { CELL_WORLD, footprintOf } from './grid';
import type { Enclosure } from './types';

/**
 * Правило місця — те саме для ходу й для привида під пальцем.
 *
 * Перевіряється саме воно окремо, бо тепер у нього ДВА читачі. Доти перевірка
 * жила всередині ходу, і привид на сцені міг би розійтися з нею тихо: зелений
 * квадрат, який відмовляється ставитися, — найгірший різновид помилки, бо
 * виглядає як поломка кнопки.
 */

const box = (id: number, x: number, z: number, size: number): Enclosure => ({
	id,
	cell: { x, z },
	size,
	quality: 2,
	durability: 1,
	modules: [],
	byWater: false
});

describe('де можна ставити вольєр', () => {
	it('перевірка жива: у центрі порожньої ділянки можна', () => {
		expect(placementProblem([], { x: 0, z: 0 }, 4, reserveHalf(0))).toBeNull();
	});

	it('за межею — не можна, і причина названа', () => {
		const half = reserveHalf(0);
		// Клітинка, чий світовий центр гарантовано за межею.
		const far = Math.ceil(half / CELL_WORLD) + 1;
		expect(placementProblem([], { x: far, z: 0 }, 1, half)).toBe('out-of-bounds');
	});

	/**
	 * Межа КВАДРАТНА, і саме кут це доводить.
	 *
	 * У кола кутова точка (half, half) лежала б за межею — відстань від центру там
	 * у 1.41 раза більша. Якщо перевірка пропускає кут, вона справді квадратна.
	 */
	it('кут ділянки — усередині: межа квадратна, а не кругла', () => {
		const half = reserveHalf(100);
		const corner = Math.floor(half / CELL_WORLD) - 1;
		expect(placementProblem([], { x: corner, z: corner }, 1, half)).toBeNull();
		// А те саме місце для фонду без імені вже за межею.
		expect(placementProblem([], { x: corner, z: corner }, 1, reserveHalf(0))).toBe('out-of-bounds');
	});

	it('зайнята клітинка — своя причина', () => {
		expect(placementProblem([box(1, 0, 0, 4)], { x: 0, z: 0 }, 1, reserveHalf(50))).toBe(
			'cell-taken'
		);
	});

	/** Слід великого вольєра зайнятий увесь, а не лише його кут. */
	it('сусідня клітинка під слідом великого вольєра теж зайнята', () => {
		const big = box(1, 0, 0, 10);
		expect(footprintOf(10), 'слід десятки завузький').toBeGreaterThan(1);
		expect(placementProblem([big], { x: 1, z: 1 }, 1, reserveHalf(100))).toBe('cell-taken');
	});

	/**
	 * Найдорожча з відмов: кут у межах, а протилежний бік уже за парканом.
	 * Саме через неї перевіряється кожна клітинка сліду, а не лише якір.
	 */
	it('великий вольєр не звисає за межу кутом', () => {
		const half = reserveHalf(0);
		const edge = Math.floor(half / CELL_WORLD);
		expect(placementProblem([], { x: edge, z: 0 }, 1, half)).toBeNull();
		expect(placementProblem([], { x: edge, z: 0 }, 10, half)).toBe('out-of-bounds');
	});
});
