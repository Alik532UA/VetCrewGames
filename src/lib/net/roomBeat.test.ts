import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoomTransport } from './roomTypes';

vi.mock('$lib/services/logService.svelte', () => ({
	logService: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

const { startRoomBeat } = await import('./roomBeat');
const { ROOM_BEAT_MS } = await import('$lib/config/roomLife');
const { logService } = await import('$lib/services/logService.svelte');

/**
 * СЕРЦЕБИТТЯ КІМНАТИ — ТИМ САМИМ ТРАНСПОРТОМ, ЩО Й ПАРТІЯ (аудит 2026-09-26).
 *
 * Доти воно будувало свій `roomTransport` на ту саму кімнату — з власним входом і
 * динамічним імпортом — і тестів не мало зовсім.
 *
 * Зворотні експерименти: не бити одразу — червоніє перший; ковтати відмову мовчки —
 * другий; не знімати розкладу — третій.
 */
function transport(touch: () => Promise<void>): RoomTransport {
	return { code: '42', touch } as unknown as RoomTransport;
}

describe('серцебиття кімнати', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('перший удар — одразу, далі — у ритмі серцебиття', async () => {
		const touch = vi.fn(async () => {});
		const stop = startRoomBeat(transport(touch));
		expect(touch, 'кімната, у яку зайшли й вийшли, лишилася б без позначки').toHaveBeenCalledTimes(
			1
		);

		await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);
		expect(touch).toHaveBeenCalledTimes(2);
		stop();
	});

	it('невдалий удар — у журнал із кодом кімнати, а наступний пробує знову', async () => {
		const touch = vi.fn(async () => {
			throw new Error('offline');
		});
		const stop = startRoomBeat(transport(touch));
		await vi.advanceTimersByTimeAsync(0);
		expect(logService.warn).toHaveBeenCalledWith(
			'network',
			'room beat failed',
			expect.objectContaining({ code: '42' })
		);

		await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS);
		expect(touch).toHaveBeenCalledTimes(2);
		stop();
	});

	it('знятий — більше не бʼє', async () => {
		const touch = vi.fn(async () => {});
		const stop = startRoomBeat(transport(touch));
		stop();
		await vi.advanceTimersByTimeAsync(ROOM_BEAT_MS * 3);
		expect(touch).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount(), 'розклад лишився').toBe(0);
	});
});
