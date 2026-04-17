import { describe, it, expect } from 'vitest';
import { getRandomAnimals, animals } from './population-game';

describe('Population Game Logic', () => {
    it('should export an array of animals', () => {
        expect(Array.isArray(animals)).toBe(true);
        expect(animals.length).toBeGreaterThan(0);
    });

    it('should return the specified number of random animals', () => {
        const count = 3;
        const randomAnimals = getRandomAnimals(count);
        expect(Array.isArray(randomAnimals)).toBe(true);
        expect(randomAnimals.length).toBe(count);
    });

    it('should not return duplicate animals in the same batch', () => {
        const count = 3;
        const randomAnimals = getRandomAnimals(count);
        const uniqueIds = new Set(randomAnimals.map(a => a.id));
        expect(uniqueIds.size).toBe(count);
    });
});
