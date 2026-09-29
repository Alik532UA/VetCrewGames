import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
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

	/**
	 * ПІДСУМОК — ВІКНОМ ПОВЕРХ КАРТОК (прохання автора 2026-09-28): «на фоні картки, а
	 * результати та кнопки у вікні поверх карток», «результати над кнопками». Доти підсумок
	 * стояв рядком над табло й дошкою, і кнопки різних розмірів ділили з ними екран.
	 *
	 * Зворотні експерименти: повернути підсумок у рядок над дошкою (без `GameDialog`) —
	 * червоніє «у вікні»; кнопки над результатами — «результати над кнопками»; «Подивитися на
	 * картки» без дії — «ховає вікно»; сховане без прив'язки до зерна — «реванш».
	 */
	it('підсумок — у вікні поверх карток, і результати стоять над кнопками', async () => {
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

		const backdrop = view.getByTestId('pairs-result-backdrop');
		expect(backdrop.contains(view.getByTestId('pairs-result-panel')), 'у вікні').toBe(true);
		expect(view.getByTestId('pairs-deck-container'), 'картки лишаються на тлі').toBeTruthy();

		const results = view.getByTestId(`pairs-result-${GUEST}-item`);
		for (const action of ['pairs-rematch-btn', 'pairs-close-btn', 'pairs-show-cards-btn']) {
			const follows = results.compareDocumentPosition(view.getByTestId(action));
			expect(follows & Node.DOCUMENT_POSITION_FOLLOWING, `${action}: результати над кнопками`).toBe(
				Node.DOCUMENT_POSITION_FOLLOWING
			);
		}
	});

	it('переможець позначений у своєму рядку, рахунок — числом, і ходи', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: GUEST, online: [HOST, GUEST], cross }
		});

		const won = view.getByTestId(`pairs-result-${HOST}-item`);
		expect(won.classList.contains('result__player--won')).toBe(true);
		expect(won.textContent).toContain('2');
		expect(view.getByTestId(`pairs-result-${GUEST}-item`).textContent).toContain('0');
		expect(view.getByTestId('pairs-result-text').textContent).toContain('Господар');
		expect(view.getByTestId('pairs-result-moves-value').textContent).toContain(
			String(host.game.moves)
		);
	});

	it('«Подивитися на картки» ховає вікно, а «Підсумок» повертає його', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: GUEST, online: [HOST, GUEST], cross }
		});

		view.getByTestId('pairs-show-cards-btn').click();
		flushSync();
		expect(view.queryByTestId('pairs-result-backdrop'), 'вікно сховане').toBeNull();

		view.getByTestId('pairs-show-result-btn').click();
		flushSync();
		expect(view.queryByTestId('pairs-result-backdrop'), 'вікно повернулося').not.toBeNull();
		expect(view.queryByTestId('pairs-show-result-btn')).toBeNull();
	});

	it('реванш — підсумок нової партії знову вікном, хоч минулий і сховали', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: GUEST, online: [HOST, GUEST], cross }
		});
		view.getByTestId('pairs-show-cards-btn').click();
		flushSync();
		expect(view.queryByTestId('pairs-result-backdrop')).toBeNull();

		// Реванш приходить із новим зерном: сховане стосувалося лише минулої партії.
		host.seed += 1;
		flushSync();
		expect(view.queryByTestId('pairs-result-backdrop')).not.toBeNull();
	});
});

/**
 * КНОПКИ ПІДСУМКУ — ТА САМА СХЕМА, ЩО «ГРУ ЗАВЕРШЕНО» ВІКТОРИНИ (прохання автора 2026-09-29,
 * відповідь A): «Зіграти ще» й «Зіграти у „Вікторину“» — акцентні, «Головне меню» — ні, і для
 * господаря воно ж закриває кімнату; гість іде посиланням.
 *
 * Зворотні експерименти: повернути «Закрити кімнату» окремою кнопкою — червоніє «окремої кнопки
 * немає»; перехід в іншу гру не акцентний — «акцентні»; меню господаря без закриття — «закриває».
 */
describe('кнопки підсумку «Знайди пару»', () => {
	it('«Зіграти ще» й перехід в іншу гру — акцентні; «Головне меню» господаря закриває кімнату', async () => {
		const host = await finished();
		const onClose = vi.fn();
		const view = render(OnlineRoom, {
			props: {
				match: host,
				me: HOST,
				online: [HOST, GUEST],
				amHost: true,
				cross,
				onRematch: vi.fn(),
				onClose
			}
		});

		expect(view.getByTestId('pairs-rematch-btn').classList.contains('btn-primary')).toBe(true);
		expect(view.getByTestId('room-other-game-link').classList.contains('btn-primary')).toBe(true);
		expect(view.queryByText('Закрити кімнату'), 'окремої кнопки закриття немає').toBeNull();
		const menu = view.getByTestId('pairs-close-btn');
		expect(menu.textContent).toContain('Головне меню');
		expect(menu.classList.contains('btn-primary')).toBe(false);
		menu.click();
		expect(onClose, 'закриває кімнату й веде в меню').toHaveBeenCalledWith(cross.menu);
	});

	it('гість іде в меню посиланням', async () => {
		const host = await finished();
		const view = render(OnlineRoom, {
			props: { match: host, me: GUEST, online: [HOST, GUEST], cross }
		});
		const link = view.getByTestId('pairs-main-menu-link');
		expect(link.getAttribute('href')).toBe(cross.menu);
		expect(view.queryByTestId('pairs-close-btn')).toBeNull();
	});
});
