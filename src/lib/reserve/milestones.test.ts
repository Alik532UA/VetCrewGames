// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IMPACT_MILESTONES, milestonesReached, nextMilestone } from './milestones';

/**
 * Віхи — чиста функція від користі, і саме це в них найцінніше: жодного стану,
 * жодної міграції сейва, жодного шансу розійтися з показником.
 */
describe('віхи користі', () => {
	it('перевірка жива: віхи оголошені й ростуть', () => {
		expect(IMPACT_MILESTONES.length).toBeGreaterThan(0);
		const sorted = [...IMPACT_MILESTONES].sort((a, b) => a - b);
		expect([...IMPACT_MILESTONES]).toEqual(sorted);
	});

	it('до першої віхи не взято жодної', () => {
		expect(milestonesReached(0)).toBe(0);
		expect(milestonesReached(IMPACT_MILESTONES[0] - 1)).toBe(0);
	});

	it('рівно на порозі віха вже взята', () => {
		// Межа саме «>=»: гравець, що дійшов до рівно тисячі, зробив тисячу.
		expect(milestonesReached(IMPACT_MILESTONES[0])).toBe(1);
	});

	it('відʼємна користь не дає нічого й не ламається', () => {
		expect(milestonesReached(-9_999)).toBe(0);
		expect(nextMilestone(-9_999)).toBe(IMPACT_MILESTONES[0]);
	});

	it('наступна віха — саме наступна, а не остання', () => {
		expect(nextMilestone(0)).toBe(IMPACT_MILESTONES[0]);
		expect(nextMilestone(IMPACT_MILESTONES[0])).toBe(IMPACT_MILESTONES[1]);
	});

	it('коли взято все, наступної немає', () => {
		const last = IMPACT_MILESTONES[IMPACT_MILESTONES.length - 1];
		expect(milestonesReached(last)).toBe(IMPACT_MILESTONES.length);
		// `null`, а не повтор останньої: шапці треба показати «зроблено все».
		expect(nextMilestone(last)).toBeNull();
	});
});
