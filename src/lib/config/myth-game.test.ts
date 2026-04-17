import { describe, it, expect } from 'vitest';
import { getNextQuestion, myths } from './myth-game';

describe('Myth Game Logic', () => {
    it('should export an array of myths', () => {
        expect(Array.isArray(myths)).toBe(true);
        expect(myths.length).toBeGreaterThan(0);
    });

    it('should return a question that is not in the usedIds array', () => {
        const usedIds = [myths[0].id];
        const nextQuestion = getNextQuestion(usedIds);
        expect(nextQuestion).toBeDefined();
        expect(nextQuestion?.id).not.toBe(usedIds[0]);
    });

    it('should return null or reset if all questions are used', () => {
        const allIds = myths.map(m => m.id);
        const nextQuestion = getNextQuestion(allIds);
        expect(nextQuestion).toBeNull();
    });
});
