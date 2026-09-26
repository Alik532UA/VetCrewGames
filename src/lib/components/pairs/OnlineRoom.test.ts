import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import { crossGameLinks } from '$lib/utils/crossGame';

/**
 * ЕКРАН ПІДСУМКУ «ЗНАЙДИ ПАРУ» — хто що бачить, коли партію дограно (аудит
 * 2026-09-25).
 *
 * Доти «Закрити кімнату» стояла під тією самою умовою, що й «Зіграти ще», і
 * господар, від якого суперник пішов, бачив «Чекаємо, доки лідер почне» — чекав
 * сам на себе й не мав чим закрити кімнату.
 *
 * Зворотний експеримент: повернути кнопку «Закрити» під `{#if onRematch}` —
 * червоніє «господар без пари».
 */

vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk', font: 'default' }
}));

const { PairsMatch } = await import('$lib/controllers/pairsMatch.svelte');
const { default: OnlineRoom } = await import('./OnlineRoom.svelte');

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const members = (): Member[] => [
	{ uid: HOST, name: 'Господар', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

const info = (): RoomInfo => ({
	gameId: 'pairs',
	rulesVersion: 4,
	// Те саме зерно, що в `pairsMatch.svelte.test.ts`: перший хід — у господаря.
	seed: 20260800,
	status: 'playing',
	hostUid: HOST,
	roster: rosterOf(members()),
	config: { pairs: 2, cols: 2 },
	startedAt: 1
});

/** Догравна партія: господар забирає обидві пари. */
async function finished() {
	const room = new LocalRoom(info(), members());
	const host = new PairsMatch(HOST, room.transport());
	host.listen();
	for (let pair = 0; pair < 2; pair += 1) {
		const slots = host.game.slots;
		const first = slots.findIndex((slot) => slot.takenBy === null);
		const second = slots.findIndex(
			(slot, index) =>
				index !== first && slot.takenBy === null && slot.card.pairKey === slots[first].card.pairKey
		);
		await host.flip(first);
		await host.flip(second);
	}
	return host;
}

const cross = crossGameLinks('uk', 'pairs', '42', null);

describe('екран підсумку «Знайди пару»', () => {
	it('перевірка жива: партію дограно', async () => {
		const host = await finished();
		expect(host.over).toBe(true);
	});

	it('господар із парою — «Зіграти ще» і «Закрити»', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: {
				match: host,
				me: HOST,
				online: [HOST, GUEST],
				amHost: true,
				cross,
				onRematch: vi.fn(),
				onClose: vi.fn()
			}
		});
		expect(view.queryByTestId('pairs-rematch-btn')).not.toBeNull();
		expect(view.queryByTestId('pairs-close-btn')).not.toBeNull();
	});

	it('господар без пари — чого бракує, і «Закрити»', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: HOST, online: [HOST], amHost: true, cross, onClose: vi.fn() }
		});
		expect(view.queryByTestId('pairs-rematch-btn')).toBeNull();
		expect(view.queryByTestId('pairs-need-players-text')).not.toBeNull();
		expect(view.queryByTestId('pairs-close-btn'), 'закрити кімнату нічим').not.toBeNull();
	});

	/**
	 * ГЛЯДАЧ ДОГРАНОЇ ПАРТІЇ — у НАСТУПНУ (аудит 2026-09-25): доти він лишався
	 * глядачем назавжди, бо роль мінялася лише в лобі, а в лобі кімната не вертається.
	 *
	 * Зворотний експеримент: прибрати кнопку — червоніє.
	 */
	it('глядач дограної партії може піти в наступну гравцем', async () => {
		const host = await finished();
		const onPlayNext = vi.fn();
		const view = render(OnlineRoom, {
			props: { match: host, me: 'uid-eye', online: [HOST, GUEST], cross, onPlayNext }
		});
		view.getByTestId('pairs-play-next-btn').click();
		expect(onPlayNext).toHaveBeenCalled();
	});

	it('гість — чекає господаря, кнопок господаря немає', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: GUEST, online: [HOST, GUEST], cross }
		});
		expect(view.queryByTestId('pairs-close-btn')).toBeNull();
		expect(view.queryByTestId('pairs-need-players-text')).toBeNull();
	});
});
