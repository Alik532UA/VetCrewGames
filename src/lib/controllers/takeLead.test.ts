import { describe, expect, it } from 'vitest';
import type { Move, RoomTransport } from '$lib/net/roomTypes';
import { takeLead } from './takeLead';
import { moveKey } from '$lib/net/roomShape';

/**
 * ПЕРЕХОПЛЕННЯ ВЕДЕННЯ: на який номер журналу лягає хід `lead` (аудит 2026-09-25).
 *
 * Вікторина бере номер першою діркою і між спробами пропускає вільні. У «Знайди
 * пару» журнал без дірок, і пропуск зупинив би партію: хід за діркою чекає, поки її
 * заповнять. Тому там кожна спроба — на той самий перший вільний номер.
 *
 * Зворотний експеримент: ігнорувати `contiguous` — червоніє другий.
 */

/** Транспорт, що відмовляє й запамʼятовує номери спроб. */
function refusing(): { transport: RoomTransport; seqs: number[] } {
	const seqs: number[] = [];
	const transport = {
		takeLead: async (move: Move) => {
			seqs.push(move.seq);
			return false;
		}
	} as unknown as RoomTransport;
	return { transport, seqs };
}

describe('номер ходу перехоплення', () => {
	it('вікторина — пропускає вільні номери між спробами', async () => {
		const { transport, seqs } = refusing();
		expect(await takeLead(transport, 'uid-me', 'uid-host', [1, 2])).toBe(false);
		expect(seqs).toEqual([3, 4, 5]);
	});

	it('«Знайди пару» — кожна спроба на першому вільному: дірок у журналі немає', async () => {
		const { transport, seqs } = refusing();
		expect(await takeLead(transport, 'uid-me', 'uid-host', [1, 2], true)).toBe(false);
		expect(seqs).toEqual([3, 3, 3]);
	});
});

describe('ключ ходу', () => {
	it('рівно шість цифр — і лексикографічний порядок збігається з числовим', () => {
		expect(moveKey(7)).toBe('000007');
		expect(moveKey(123456)).toBe('123456');
		expect([moveKey(10), moveKey(2), moveKey(1)].sort()).toEqual(['000001', '000002', '000010']);
	});
});
