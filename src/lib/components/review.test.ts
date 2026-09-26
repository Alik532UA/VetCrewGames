import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

/**
 * ПЕРЕГЛЯД ПИТАНЬ — спільні рамка й перелік для пʼяти соло-ігор (прохання автора
 * 2026-09-26). Саме питання малює дошка гри; тут — що це за питання й дорога назад.
 *
 * Зворотний експеримент: прибрати номер питання із заголовка — червоніє «рамка»;
 * не кликати `onopen` — червоніє «перелік».
 */

vi.mock('$lib/i18n', () => ({ t: (key: string) => key, formatFont: (s: string) => s }));

const { default: ReviewPanel } = await import('./ReviewPanel.svelte');
const { default: ReviewList } = await import('./ReviewList.svelte');

afterEach(() => cleanup());

describe('рамка перегляду', () => {
	it('каже, котре питання, і веде назад', async () => {
		const onback = vi.fn();
		const children = createRawSnippet(() => ({ render: () => '<p data-testid="board-text">дошка</p>' }));
		render(ReviewPanel, { props: { index: 2, total: 10, onback, children } });

		expect(screen.getByRole('heading').textContent).toContain('review.question 3 review.of 10');
		expect(screen.getByTestId('board-text')).toBeTruthy();
		await fireEvent.click(screen.getByTestId('round-review-back-btn'));
		expect(onback).toHaveBeenCalledTimes(1);
	});
});

describe('перелік питань партії', () => {
	it('рядок на кожне питання, зі станом словом, і натиск відкриває його', async () => {
		const onopen = vi.fn();
		render(ReviewList, {
			props: {
				results: ['correct', 'incorrect', 'partial'],
				label: (i: number) => `питання ${i}`,
				onopen
			}
		});

		expect(screen.getAllByRole('button')).toHaveLength(3);
		expect(screen.getByTestId('round-review-2-item').textContent).toContain('review.incorrect');
		expect(screen.getByTestId('round-review-2-item').textContent).toContain('2. питання 1');
		await fireEvent.click(screen.getByTestId('round-review-3-item'));
		expect(onopen).toHaveBeenCalledWith(2);
	});
});
