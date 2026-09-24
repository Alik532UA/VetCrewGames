import { describe, expect, it } from 'vitest';
import { infoFromDb, rosterFromRecord, rosterToRecord, snapshotFromDb } from './roomShape';
import type { RoomInfo } from './roomTypes';

/**
 * ФОРМА КІМНАТИ В БАЗІ: склад — мапою за `uid`, журнал — за ключами.
 *
 * Зворотні експерименти: у `rosterFromRecord` не сортувати за `seat` — червоніє
 * «черга — за місцем»; у `snapshotFromDb` брати номер із поля `seq`, а не з ключа, —
 * червоніє «номер — з ключа».
 */
const info: RoomInfo = {
	gameId: 'pairs',
	rulesVersion: 3,
	seed: 1,
	status: 'playing',
	hostUid: 'uid-host',
	config: { pairs: 4, cols: 4 }
};

describe('склад у базі', () => {
	it('туди й назад — та сама черга', () => {
		const roster = [
			{ uid: 'uid-z', name: 'Перший' },
			{ uid: 'uid-a', name: 'Другий' },
			{ uid: 'uid-m', name: 'Третій' }
		];
		expect(rosterFromRecord(rosterToRecord(roster))).toEqual(roster);
	});

	it('черга — за місцем, а не за алфавітом ключів', () => {
		expect(
			rosterFromRecord({
				'uid-a': { name: 'Другий', seat: 1 },
				'uid-z': { name: 'Перший', seat: 0 }
			})?.map((entry) => entry.uid)
		).toEqual(['uid-z', 'uid-a']);
	});

	it('чуже чи зламане — пропускається, порожнє — складу немає', () => {
		expect(rosterFromRecord({ 'uid-a': { name: 7, seat: 0 } })).toBeUndefined();
		expect(rosterFromRecord(null)).toBeUndefined();
		expect(rosterFromRecord(['масив старої форми'])).toBeUndefined();
	});

	it('info без складу лишається без складу', () => {
		expect(infoFromDb(info)).toEqual(info);
	});
});

describe('знімок кімнати', () => {
	it('кімнати немає — null', () => {
		expect(snapshotFromDb(null)).toBeNull();
		expect(snapshotFromDb({ members: {} })).toBeNull();
	});

	it('номер — з ключа, а порядок — за номером', () => {
		const snapshot = snapshotFromDb({
			info,
			moves: {
				'000002': { seq: 99, by: 'uid-a', type: 'flip' },
				'000001': { seq: 1, by: 'uid-b', type: 'flip' }
			}
		});
		expect(snapshot?.moves.map((move) => [move.seq, move.by])).toEqual([
			[1, 'uid-b'],
			[2, 'uid-a']
		]);
	});

	it('склад приїжджає чергою', () => {
		const snapshot = snapshotFromDb({
			info: {
				...info,
				roster: { 'uid-b': { name: 'Б', seat: 1 }, 'uid-a': { name: 'А', seat: 0 } }
			},
			members: { 'uid-a': { name: 'А', role: 'player', order: 1 } }
		});
		expect(snapshot?.info.roster).toEqual([
			{ uid: 'uid-a', name: 'А' },
			{ uid: 'uid-b', name: 'Б' }
		]);
		expect(snapshot?.members).toEqual([{ uid: 'uid-a', name: 'А', role: 'player', order: 1 }]);
	});
});
