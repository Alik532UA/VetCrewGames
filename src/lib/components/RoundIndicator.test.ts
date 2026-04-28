import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import RoundIndicator from './RoundIndicator.svelte';

// formatFont is imported transitively via $lib/i18n; mock it to a no-op
vi.mock('$lib/i18n/index', () => ({
	formatFont: (s: string) => s
}));

describe('RoundIndicator', () => {
	it('renders the requested number of segments', () => {
		const { container } = render(RoundIndicator, {
			props: { current: 1, total: 5 }
		});
		expect(container.querySelectorAll('.segment').length).toBe(5);
	});

	it('marks the current round with status-current', () => {
		const { container } = render(RoundIndicator, {
			props: { current: 3, total: 5 }
		});
		const segments = container.querySelectorAll('.segment');
		expect(segments[2].classList.contains('status-current')).toBe(true);
		expect(segments[0].classList.contains('status-future')).toBe(true);
		expect(segments[4].classList.contains('status-future')).toBe(true);
	});

	it('applies result statuses from the results array', () => {
		const { container } = render(RoundIndicator, {
			props: {
				current: 4,
				total: 4,
				results: ['correct', 'incorrect', 'partial']
			}
		});
		const segments = container.querySelectorAll('.segment');
		expect(segments[0].classList.contains('status-correct')).toBe(true);
		expect(segments[1].classList.contains('status-incorrect')).toBe(true);
		expect(segments[2].classList.contains('status-partial')).toBe(true);
		expect(segments[3].classList.contains('status-current')).toBe(true);
	});

	it('handles total=0 without errors', () => {
		const { container } = render(RoundIndicator, {
			props: { current: 0, total: 0 }
		});
		expect(container.querySelectorAll('.segment').length).toBe(0);
	});
});
