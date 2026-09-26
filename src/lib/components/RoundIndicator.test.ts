import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import RoundIndicator from './RoundIndicator.svelte';

// formatFont is imported transitively via $lib/i18n; mock it to a no-op
vi.mock('$lib/i18n/index', () => ({
	formatFont: (s: string) => s,
	t: (key: string) => key
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

	/**
	 * ПЕРЕГЛЯД МИНУЛОГО ПИТАННЯ (прохання автора 2026-09-26): відповідані сегменти —
	 * кнопки з підписом для скрінрідера, решта — як були.
	 *
	 * Зворотний експеримент: зробити кнопкою й майбутній сегмент — червоніє «лише
	 * відповідані»; прибрати підпис — червоніє «з підписом».
	 */
	it('з onreview відповідані сегменти — кнопки з підписом, і лише вони', async () => {
		const onreview = vi.fn();
		const { container, getByTestId } = render(RoundIndicator, {
			props: { current: 3, total: 4, results: ['correct', 'incorrect'], onreview }
		});
		expect(container.querySelectorAll('button')).toHaveLength(2);
		expect(getByTestId('round-review-1-btn').getAttribute('aria-label')).toBe(
			'review.question 1: review.correct'
		);
		await fireEvent.click(getByTestId('round-review-2-btn'));
		expect(onreview).toHaveBeenCalledWith(1);
	});

	it('без onreview — жодної кнопки: онлайн-табло й перевірка лише показують поступ', () => {
		const { container } = render(RoundIndicator, {
			props: { current: 3, total: 4, results: ['correct', 'incorrect'] }
		});
		expect(container.querySelectorAll('button')).toHaveLength(0);
	});

	it('переглядуваний сегмент позначено натиснутим', () => {
		const { getByTestId } = render(RoundIndicator, {
			props: { current: 3, total: 4, results: ['correct', 'incorrect'], onreview: vi.fn(), viewing: 1 }
		});
		expect(getByTestId('round-review-2-btn').getAttribute('aria-pressed')).toBe('true');
		expect(getByTestId('round-review-1-btn').getAttribute('aria-pressed')).toBe('false');
	});

	it('handles total=0 without errors', () => {
		const { container } = render(RoundIndicator, {
			props: { current: 0, total: 0 }
		});
		expect(container.querySelectorAll('.segment').length).toBe(0);
	});
});
