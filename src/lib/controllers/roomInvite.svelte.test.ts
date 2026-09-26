import { describe, expect, it, vi } from 'vitest';
import type { Member } from '$lib/net/roomTypes';

/**
 * ВАС ЗАПРОСИЛИ — коротке вікно перед кімнатою (рішення автора 2026-09-26, 9-A).
 *
 * Головне тут — КОМУ вікно показувати. Той, хто вже в складі, заходить сам, як і доти;
 * новачок бачить вікно; група, що переїжджає в кімнату іншої гри, заходить сама; а
 * будь-яка невдача перевірки веде старою дорогою — прямим входом, бо саме він скаже,
 * що сталося.
 *
 * Зворотні експерименти: не звіряти склад — червоніє «хто вже тут»; не пускати
 * переїзд — червоніє «група»; ковтати невдачу без входу — червоніє «мережа».
 */

vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { RoomInvite } = await import('./roomInvite.svelte');

const ME = 'uid-me';
const row = (uid: string, order: number, avatar?: string): Member => ({
	uid,
	name: `імʼя ${uid}`,
	role: 'player',
	order,
	...(avatar ? { avatar } : {})
});

function sessionWith(options: {
	url?: string;
	moved?: boolean;
	members?: Member[] | null;
	peek?: () => Promise<Member[] | null>;
}) {
	let url = options.url ?? '42';
	const session = {
		match: null as unknown,
		resume: vi.fn(),
		place: {
			urlRoom: () => url,
			moved: () => options.moved === true,
			exit: vi.fn(async () => {
				url = '';
			})
		},
		net: {
			me: vi.fn(async () => ME),
			// `null` — кімнати немає; не передали нічого — порожній склад.
			peekMembers: vi.fn(
				options.peek ?? (async () => (options.members === undefined ? [] : options.members))
			)
		}
	};
	const invite = new RoomInvite(session as never);
	return { invite, session, leave: () => (url = '') };
}

describe('вікно «вас запросили»', () => {
	it('новачок бачить вікно, а в кімнату сам не заходить', async () => {
		const { invite, session } = sessionWith({ members: [row('uid-host', 1, 'cat:blue')] });
		await invite.check();

		expect(invite.open).toBe(true);
		expect(invite.code).toBe('42');
		expect(session.resume).not.toHaveBeenCalled();
		expect([...invite.taken]).toEqual([['cat:blue', 'імʼя uid-host']]);
	});

	it('хто вже в складі — заходить сам, як і доти', async () => {
		const { invite, session } = sessionWith({ members: [row('uid-host', 1), row(ME, 2)] });
		await invite.check();

		expect(invite.open).toBe(false);
		expect(session.resume).toHaveBeenCalledTimes(1);
	});

	it('група, що переїжджає в іншу гру, заходить сама — без перевірки складу', async () => {
		const { invite, session } = sessionWith({ moved: true, members: [row('uid-host', 1)] });
		await invite.check();

		expect(session.resume).toHaveBeenCalledTimes(1);
		expect(session.net.peekMembers).not.toHaveBeenCalled();
	});

	it('кімнати немає — прямий вхід скаже про це тими самими словами', async () => {
		const { invite, session } = sessionWith({ members: null });
		await invite.check();

		expect(session.resume).toHaveBeenCalledTimes(1);
		expect(invite.open).toBe(false);
	});

	it('мережа не відповіла — теж прямий вхід, а не порожній екран', async () => {
		const { invite, session } = sessionWith({
			peek: async () => {
				throw new Error('offline');
			}
		});
		await invite.check();

		expect(session.resume).toHaveBeenCalledTimes(1);
	});

	it('адреса без кімнати — нічого не робить', async () => {
		const { invite, session } = sessionWith({ url: '' });
		await invite.check();

		expect(session.resume).not.toHaveBeenCalled();
		expect(session.net.peekMembers).not.toHaveBeenCalled();
	});

	it('«Зайти» — вхід; вікно гасне саме, коли з адреси зникла кімната', async () => {
		const { invite, session, leave } = sessionWith({ members: [row('uid-host', 1)] });
		await invite.check();

		invite.accept();
		expect(session.resume).toHaveBeenCalledTimes(1);
		expect(invite.open, 'до матчу вікно лишається — невдалий вхід не викидає').toBe(true);

		leave();
		expect(invite.open, '«назад» у браузері знімає і вікно').toBe(false);
	});

	it('«До переліку кімнат» — геть з адреси кімнати', async () => {
		const { invite, session } = sessionWith({ members: [row('uid-host', 1)] });
		await invite.check();

		invite.decline();

		expect(session.place.exit).toHaveBeenCalledTimes(1);
		expect(invite.open).toBe(false);
		expect(session.resume).not.toHaveBeenCalled();
	});
});
