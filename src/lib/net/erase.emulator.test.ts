import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { as, closeAll, peek, signedIn, type Connection } from './emulatorSession';

/**
 * ВИДАЛЕННЯ АКАУНТА — над справжніми правилами, а не над моками.
 *
 * Доти `eraseMyData` перевіряли лише з підміненою мережею (`account.svelte.test.ts`),
 * і тому ніхто не бачив, що в продакшні він не працював узагалі (аудит
 * 2026-09-24):
 *
 *  - `users/{uid}` і `myRooms/{uid}` мали `.write` лише на ДІТЯХ, а право писати
 *    дитину не дає права знести батька — останні два кроки відмовляли завжди;
 *  - запис у пошуку прибирався навіть тоді, коли його немає (пошук вимкнений), а
 *    правило не пускає видаляти відсутнє. І псевдонім на той момент уже був
 *    звільнений, тож кожна наступна спроба падала вже на ньому.
 *
 * Тут людина проходить увесь шлях: профіль, пошук, підписки в обидва боки, рахунок,
 * рядок таблиці, власна кімната — і після видалення від неї не лишається нічого,
 * включно з половинами підписок у ЧУЖИХ вузлах.
 */

vi.mock('$lib/net/firebase', async () => {
	const { currentConnection } = await import('$lib/net/emulatorSession');
	return { connect: currentConnection, forget: () => {} };
});

let alice: Connection;
let bob: Connection;

beforeAll(async () => {
	alice = await signedIn('erase-alice');
	bob = await signedIn('erase-bob');
});

afterAll(() => closeAll([alice, bob]));

/** Псевдонім, якого ще немає в базі: емулятор живе весь прогін `check:rules`. */
const freshHandle = () => `er_${Math.random().toString(36).slice(2, 10)}`;

/** Людина з повним набором слідів у базі. */
async function busyAccount(searchable: boolean) {
	const account = await import('./account');
	const play = await import('./play');
	const leaders = await import('./leaders');
	const follows = await import('./follows');
	const privacy = await import('./privacy');
	const rooms = await import('./rtdbRoom');

	const handle = freshHandle();
	const code = await as(alice, async () => {
		await account.saveProfile({ name: 'Аліса', handle }, undefined, searchable);
		if (!searchable) {
			await privacy.savePrivacy({ search: false, follow: true, board: true }, handle);
		}
		expect(await play.writePlay({ score: 120, games: {} })).toBe(true);
		const profile = await account.readMyProfile();
		expect(profile, 'профіль не записався').not.toBeNull();
		expect(await leaders.publishLeader(profile!, 60), 'рядок таблиці не записався').toBe(true);
		await follows.follow(bob.uid);
		return rooms.createRoom({
			gameId: 'pairs',
			rulesVersion: 3,
			seed: 1,
			config: { pairs: 4, cols: 4 },
			name: 'Аліса',
			isPrivate: true
		});
	});
	await as(bob, () => follows.follow(alice.uid));
	return { handle, code };
}

/** Що лишилося від Аліси — очима самої Аліси й очима Боба. */
async function traces(handle: string, code: string) {
	const mine = async (path: string) => as(alice, () => peek(alice, path));
	return {
		profile: await mine(`users/${alice.uid}/profile`),
		play: await mine(`users/${alice.uid}/play`),
		privacy: await mine(`users/${alice.uid}/privacy`),
		following: await mine(`users/${alice.uid}/following`),
		followers: await mine(`users/${alice.uid}/followers`),
		handle: await mine(`handles/${handle}`),
		find: await mine(`find/${handle}`),
		leader: await mine(`leaders/${alice.uid}`),
		myRooms: await mine(`myRooms/${alice.uid}`),
		room: await mine(`rooms/${code}/info`),
		inBobsFollowers: await as(bob, () => peek(bob, `users/${bob.uid}/followers/${alice.uid}`)),
		inBobsFollowing: await as(bob, () => peek(bob, `users/${bob.uid}/following/${alice.uid}`))
	};
}

const NOTHING = {
	profile: null,
	play: null,
	privacy: null,
	following: null,
	followers: null,
	handle: null,
	find: null,
	leader: null,
	myRooms: null,
	room: null,
	inBobsFollowers: null,
	inBobsFollowing: null
};

describe('видалення акаунта над емулятором', () => {
	it('перевірка жива: сліди справді є до видалення', async () => {
		const { handle, code } = await busyAccount(true);
		const before = await traces(handle, code);
		expect(before.profile).not.toBeNull();
		expect(before.find).toBe(alice.uid);
		expect(before.leader).not.toBeNull();
		expect(before.inBobsFollowers).not.toBeNull();
		expect(before.room).not.toBeNull();
	});

	it('з увімкненим пошуком — не лишається нічого', async () => {
		const { eraseMyData } = await import('./erase');
		const { handle, code } = await busyAccount(true);

		await as(alice, () => eraseMyData());

		expect(await traces(handle, code)).toEqual(NOTHING);
	});

	it('з вимкненим пошуком — теж, хоч запису в пошуку й немає', async () => {
		const { eraseMyData } = await import('./erase');
		const { handle, code } = await busyAccount(false);

		await as(alice, () => eraseMyData());

		expect(await traces(handle, code)).toEqual(NOTHING);
	});

	it('повторне видалення після обриву посередині не падає', async () => {
		const { eraseMyData } = await import('./erase');
		const { handle, code } = await busyAccount(true);
		await as(alice, () => eraseMyData());

		await expect(as(alice, () => eraseMyData())).resolves.toBeUndefined();
		expect(await traces(handle, code)).toEqual(NOTHING);
	});
});
