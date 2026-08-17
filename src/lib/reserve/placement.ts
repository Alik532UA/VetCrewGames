import { cellKey, cellsOf, worldOf, type Cell } from './grid';
import type { Enclosure, RejectReason } from './types';

/**
 * Чи можна поставити вольєр саме тут — одне правило на двох читачів.
 *
 * Читає його ядро, коли виконує хід, і сцена, коли малює привид майбутнього
 * вольєра під пальцем. Доти перевірка жила тільки в ході, і привида не було
 * зовсім: гравець тицяв навмання й дізнавався про відмову з тосту вже після
 * дотику. Дублювати ж перевірку в сцені означало б два правила, які розійдуться
 * на першій же зміні — і найгіршим чином: зелений привид, який відмовляється
 * ставитися.
 *
 * Повертає ПРИЧИНУ, а не `false`: ходу потрібна причина, щоб її показати
 * людині, а сцені — щоб пофарбувати привид у той самий колір, яким потім
 * прийде відмова.
 */
export type PlacementProblem = Extract<RejectReason, 'out-of-bounds' | 'cell-taken'> | null;

export function placementProblem(
	enclosures: Enclosure[],
	cell: Cell,
	size: number,
	/** Півсторона ділянки: її дає репутація, тож приходить готовим числом. */
	half: number
): PlacementProblem {
	/*
	 * Перевіряється КОЖНА клітинка сліду, а не лише кут. Вольєр на десять займає
	 * чотири клітинки в ширину, і його кут може бути в межах ділянки, коли
	 * протилежний уже за парканом.
	 */
	const footprint = cellsOf(cell, size);
	for (const spot of footprint.map(worldOf)) {
		if (Math.max(Math.abs(spot.x), Math.abs(spot.z)) > half) return 'out-of-bounds';
	}

	const busy = new Set(enclosures.flatMap((e) => cellsOf(e.cell, e.size).map(cellKey)));
	if (footprint.some((spot) => busy.has(cellKey(spot)))) return 'cell-taken';

	return null;
}
