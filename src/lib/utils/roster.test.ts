import { describe, expect, it } from 'vitest';
import type { Member } from '$lib/net/roomTypes';
import { leadCandidates, quizPartyOf, rosterOf, stayingOf } from './roster';

/**
 * СКЛАД ПАРТІЇ ВІКТОРИНИ — склад старту й ті, хто долучився (аудит 2026-09-25).
 *
 * Доти вікторина брала гравців із поточних `members`: відсутній із лобі ставав
 * «відсутнім гравцем» з нульового раунду, а хто вийшов — зникав із табло разом
 * з очками. Зворотний експеримент: повернути в `quizPartyOf` усіх гравців
 * кімнати — червоніють «відсутній із лобі» і «хто вийшов».
 */

const HOST = 'uid-host';
const GUEST = 'uid-guest';
const GHOST = 'uid-ghost';
const LATE = 'uid-late';

const row = (uid: string, name: string, order: number): Member => ({
	uid,
	name,
	role: 'player',
	order
});

const started = [row(HOST, 'Лідер', 1), row(GUEST, 'Гість', 2)];
const roster = rosterOf(started);

const view = (over: Partial<Parameters<typeof quizPartyOf>[0]> = {}) => ({
	members: started,
	roster,
	status: 'playing' as const,
	present: [HOST, GUEST],
	answers: {},
	...over
});

const uids = (members: readonly Member[]) => members.map((member) => member.uid);

describe('гравці вікторини', () => {
	it('у лобі — просто гравці кімнати, складу ще немає', () => {
		const lobby = view({
			status: 'lobby',
			roster: null,
			members: [...started, row(GHOST, 'П', 3)]
		});
		expect(uids(quizPartyOf(lobby, HOST))).toEqual([HOST, GUEST, GHOST]);
	});

	it('відсутній із лобі, що партії не грав, у ній не рахується', () => {
		const party = quizPartyOf(view({ members: [...started, row(GHOST, 'Привид', 3)] }), HOST);
		expect(uids(party)).toEqual([HOST, GUEST]);
	});

	it('хто долучився посеред партії й тут — грає', () => {
		const party = quizPartyOf(
			view({ members: [...started, row(LATE, 'Новачок', 3)], present: [HOST, GUEST, LATE] }),
			HOST
		);
		expect(uids(party)).toEqual([HOST, GUEST, LATE]);
	});

	it('новачок, що вже відповідав, лишається в партії й без звʼязку', () => {
		const party = quizPartyOf(
			view({
				members: [...started, row(LATE, 'Новачок', 3)],
				answers: { 2: { [LATE]: { at: 1, correct: 1 } } }
			}),
			HOST
		);
		expect(uids(party)).toContain(LATE);
	});

	it('новачок — це я: грає, ще до того, як приїхала присутність', () => {
		const party = quizPartyOf(
			view({ members: [...started, row(LATE, 'Новачок', 3)], present: [] }),
			LATE
		);
		expect(uids(party)).toContain(LATE);
	});

	it('хто вийшов — на таблі з іменем зі складу, але не серед тих, хто лишився', () => {
		const members = [row(HOST, 'Лідер', 1)];
		const party = quizPartyOf(view({ members }), HOST);

		expect(party.find((member) => member.uid === GUEST)?.name).toBe('Гість');
		expect(uids(stayingOf(party, members))).toEqual([HOST]);
	});
});

describe('хто може підхопити ведення', () => {
	it('у лобі — будь-який гравець кімнати', () => {
		const players = [...started, row(LATE, 'Новачок', 3)];
		expect(uids(leadCandidates(players, 'lobby', null))).toEqual([HOST, GUEST, LATE]);
	});

	it('посеред партії — лише склад: новачка правило не пустить', () => {
		const players = [...started, row(LATE, 'Новачок', 3)];
		expect(uids(leadCandidates(players, 'playing', roster))).toEqual([HOST, GUEST]);
		expect(uids(leadCandidates(players, 'over', roster))).toEqual([HOST, GUEST]);
	});

	it('партія без складу (кімната старша за поле) — кандидатів немає', () => {
		expect(leadCandidates(started, 'playing', null)).toEqual([]);
	});
});
