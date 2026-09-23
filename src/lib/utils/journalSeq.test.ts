import { describe, expect, it } from 'vitest';
import { freeSeq } from './journalSeq';

describe('вільний номер у журналі', () => {
	it('перевірка жива: у порожньому журналі перший номер — 1', () => {
		expect(freeSeq([])).toBe(1);
	});

	it('щільний журнал — наступний за останнім', () => {
		expect(freeSeq([1, 2, 3])).toBe(4);
	});

	it('дірка береться першою', () => {
		expect(freeSeq([1, 2, 4, 5])).toBe(3);
	});

	it('далекий чужий номер нічого не зсуває', () => {
		expect(freeSeq([1, 2, 1e20])).toBe(3);
	});

	it('спроба `skip` пропускає стільки ж вільних номерів', () => {
		expect(freeSeq([1, 3], 0)).toBe(2);
		expect(freeSeq([1, 3], 1)).toBe(4);
		expect(freeSeq([1, 3], 2)).toBe(5);
	});
});
