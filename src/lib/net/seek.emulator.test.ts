import { afterAll, describe, expect, it, vi } from 'vitest';
import { PAIRS_RULES_VERSION, QUIZ_RULES_VERSION } from '$lib/config/roomRules';
import { as, closeAll, signedIn, type Connection } from './emulatorSession';
import { LocalSeekBoard, type SeekRoom } from './localSeek';
import type { SeekMatch, SeekNet } from './seek';

/**
 * КОНТРАКТ ПОШУКУ: `LocalSeekBoard` проти `liveSeekNet` над емулятором (рішення автора
 * 2026-09-26, «Автоматичний пошук»).
 *
 * Пошук перевіряється на дошці в памʼяті — так видно цілком, хто кого знаходить. Але
 * тоді дошка мусить поводитися РІВНО як справжня гілка `seek` зі справжніми правилами, і
 * кожен сценарій тут іде по обох з однаковим очікуванням. Головне з них — збіг доходить
 * до того, хто чекав, РІВНО РАЗ: підпискою або з транзакції зняття, але не обома й не
 * жодною.
 *
 * Зворотні експерименти (прогнано): прибрати з правила `seek/$uid/match` умову
 * `!data.exists()` — червоніє «другий збіг не лягає» на `liveSeekNet`; не знімати в
 * `open` старий запис — «старий запис зі збігом…» падає відмовою правила (а до поправки
 * порядку в `open` пошук тут ВИСІВ — цей експеримент дефект і знайшов); віддавати зі
 * зняття збіг, який уже приніс `onMatch`, — червоніють обидва «рівно раз» на дошці.
 *
 * Запуск — `npm run check:rules`, тим самим запуском емулятора, що й правила.
 */

vi.mock('$lib/net/firebase', async () => {
	const { currentConnection } = await import('$lib/net/emulatorSession');
	return {
		connect: currentConnection,
		forget: () => {},
		serverNow: () => Date.now(),
		serverTime: async () => Date.now()
	};
});

interface Person {
	uid: string;
	seek: SeekNet;
}

interface World {
	name: string;
	person(label: string): Promise<Person>;
	/** Кімната в лобі, де господар — `owner`. Повертає код. */
	room(owner: Person, gameId: 'pairs' | 'quiz', rulesVersion: number): Promise<string>;
	/** Обрив і повернення звʼязку — лише там, де є справжній `onDisconnect`. */
	offline?: (who: Person) => { down(): void; up(): void };
}

const BOTH = { pairs: PAIRS_RULES_VERSION, quiz: QUIZ_RULES_VERSION };

function localWorld(): World {
	const rooms = new Map<string, SeekRoom>();
	const board = new LocalSeekBoard({ room: (code) => rooms.get(code) ?? null });
	let codes = 10;
	return {
		name: 'LocalSeekBoard',
		person: async (label) => ({ uid: `uid-${label}`, seek: board.as(`uid-${label}`) }),
		room: async (owner, gameId, rulesVersion) => {
			const code = String((codes += 1));
			rooms.set(code, { hostUid: owner.uid, status: 'lobby', gameId, rulesVersion });
			return code;
		}
	};
}

const connections: Connection[] = [];

function liveWorld(): World {
	const byUid = new Map<string, Connection>();
	return {
		name: 'liveSeekNet',
		async person(label) {
			const who = await signedIn(`seek-${label}`);
			connections.push(who);
			byUid.set(who.uid, who);
			const { liveSeekNet: net } = await import('./seek');
			return {
				uid: who.uid,
				seek: {
					list: () => as(who, () => net.list()),
					open: (games, onMatch) => as(who, () => net.open(games, onMatch)),
					claim: (uid, match) => as(who, () => net.claim(uid, match))
				}
			};
		},
		async room(owner, gameId, rulesVersion) {
			const who = byUid.get(owner.uid);
			if (!who) throw new Error('господар кімнати — не з цього світу');
			const { createRoom } = await import('./rtdbRoom');
			return as(who, () =>
				createRoom({
					gameId,
					rulesVersion,
					seed: 1,
					config: gameId === 'quiz' ? { game_myths: 1 } : { pairs: 4, cols: 4 },
					name: 'Господар',
					isPrivate: true
				})
			);
		},
		offline(who) {
			const connection = byUid.get(who.uid);
			if (!connection) throw new Error('людина — не з цього світу');
			return {
				down: () => void import('firebase/database').then((db) => db.goOffline(connection.db)),
				up: () => void import('firebase/database').then((db) => db.goOnline(connection.db))
			};
		}
	};
}

afterAll(() => closeAll(connections));

/** Збіги, що дійшли до шукача підпискою. */
function inbox(): { got: SeekMatch[]; onMatch: (match: SeekMatch) => void } {
	const got: SeekMatch[] = [];
	return { got, onMatch: (match) => got.push(match) };
}

const listed = async (by: Person, who: Person) =>
	(await by.seek.list()).find((seek) => seek.uid === who.uid) ?? null;

/** Дати підписці доїхати: збіг, що мав би прийти, за цей час приходить у будь-якій із двох. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

for (const world of [localWorld(), liveWorld()]) {
	describe(`пошук: ${world.name}`, () => {
		it('шукача видно, збіг доходить, а запис зі збігом зі списку зникає', async () => {
			const [waiter, finder] = [await world.person('a1'), await world.person('b1')];
			const box = inbox();
			const handle = await waiter.seek.open(BOTH, box.onMatch);
			expect((await listed(finder, waiter))?.games, 'чужий запис із версіями').toEqual(BOTH);

			const code = await world.room(finder, 'pairs', PAIRS_RULES_VERSION);
			expect(await finder.seek.claim(waiter.uid, { code, gameId: 'pairs' })).toBe(true);
			await vi.waitFor(() => expect(box.got).toEqual([{ code, gameId: 'pairs' }]));
			expect(await listed(finder, waiter), 'запис зі збігом — не кандидат').toBeNull();
			handle.stop();
		});

		it('другий збіг не лягає, а знятий запис знайти не можна', async () => {
			const [waiter, first, second] = [
				await world.person('a2'),
				await world.person('b2'),
				await world.person('c2')
			];
			const handle = await waiter.seek.open(BOTH, () => {});
			const mine = await world.room(first, 'pairs', PAIRS_RULES_VERSION);
			const theirs = await world.room(second, 'pairs', PAIRS_RULES_VERSION);
			expect(await first.seek.claim(waiter.uid, { code: mine, gameId: 'pairs' })).toBe(true);
			expect(await second.seek.claim(waiter.uid, { code: theirs, gameId: 'pairs' })).toBe(false);
			handle.stop();

			const later = await waiter.seek.open(BOTH, () => {});
			expect(await later.withdraw(), 'збігу не було').toBeNull();
			expect(await listed(first, waiter)).toBeNull();
			expect(await second.seek.claim(waiter.uid, { code: theirs, gameId: 'pairs' })).toBe(false);
		});

		it('збіг доходить рівно раз: підпискою або зі зняття', async () => {
			const [waiter, finder] = [await world.person('a3'), await world.person('b3')];
			const box = inbox();
			const handle = await waiter.seek.open(BOTH, box.onMatch);
			const code = await world.room(finder, 'quiz', QUIZ_RULES_VERSION);
			expect(await finder.seek.claim(waiter.uid, { code, gameId: 'quiz' })).toBe(true);
			// Зняття саме після збігу: хто чекав і вирушив шукати сам, мусить його почути.
			const withdrawn = await handle.withdraw();
			await settle();
			expect([...box.got, ...(withdrawn ? [withdrawn] : [])]).toEqual([{ code, gameId: 'quiz' }]);
		});

		it('зняття навперегони зі збігом: або збіг почуто раз, або його не лягло', async () => {
			const [waiter, finder] = [await world.person('a7'), await world.person('b7')];
			const box = inbox();
			const handle = await waiter.seek.open(BOTH, box.onMatch);
			const code = await world.room(finder, 'pairs', PAIRS_RULES_VERSION);
			const match: SeekMatch = { code, gameId: 'pairs' };
			const [claimed, withdrawn] = await Promise.all([
				finder.seek.claim(waiter.uid, match),
				handle.withdraw()
			]);
			await settle();
			const heard = [...box.got, ...(withdrawn ? [withdrawn] : [])];
			// Збіг, що ліг, а його не почув ніхто, — це господар, що чекає в кімнаті марно.
			expect(heard).toEqual(claimed ? [match] : []);
		});

		it('збіг на гру, якої не просили, чи іншої версії — не лягає', async () => {
			const [waiter, finder] = [await world.person('a4'), await world.person('b4')];
			const handle = await waiter.seek.open({ quiz: QUIZ_RULES_VERSION }, () => {});
			const pairs = await world.room(finder, 'pairs', PAIRS_RULES_VERSION);
			const older = await world.room(finder, 'quiz', QUIZ_RULES_VERSION - 1);
			expect(await finder.seek.claim(waiter.uid, { code: pairs, gameId: 'pairs' })).toBe(false);
			expect(await finder.seek.claim(waiter.uid, { code: older, gameId: 'quiz' })).toBe(false);
			// Кімната чужого господаря — теж ні, хоч гра й версія ті.
			const own = await world.room(waiter, 'quiz', QUIZ_RULES_VERSION);
			expect(await finder.seek.claim(waiter.uid, { code: own, gameId: 'quiz' })).toBe(false);
			handle.stop();
		});

		it('старий запис зі збігом не заважає новому пошуку', async () => {
			const [waiter, finder] = [await world.person('a5'), await world.person('b5')];
			await waiter.seek.open(BOTH, () => {});
			const code = await world.room(finder, 'pairs', PAIRS_RULES_VERSION);
			expect(await finder.seek.claim(waiter.uid, { code, gameId: 'pairs' })).toBe(true);
			// Першого не зупинили (обрив посеред виходу) — і людина шукає знову.
			const box = inbox();
			const again = await waiter.seek.open(BOTH, box.onMatch);
			await vi.waitFor(async () => expect(await listed(finder, waiter)).not.toBeNull());
			await settle();
			expect(box.got, 'старий збіг не приводить у стару кімнату').toEqual([]);
			again.stop();
		});

		it.runIf(world.offline)('обрив знімає запис, повернення ставить знову', async () => {
			const [waiter, finder] = [await world.person('a6'), await world.person('b6')];
			const handle = await waiter.seek.open(BOTH, () => {});
			const line = world.offline!(waiter);
			await vi.waitFor(async () => expect(await listed(finder, waiter)).not.toBeNull());
			line.down();
			await vi.waitFor(async () => expect(await listed(finder, waiter)).toBeNull(), {
				timeout: 10_000
			});
			line.up();
			await vi.waitFor(async () => expect(await listed(finder, waiter)).not.toBeNull(), {
				timeout: 10_000
			});
			handle.stop();
			await vi.waitFor(async () => expect(await listed(finder, waiter)).toBeNull());
		});
	});
}
