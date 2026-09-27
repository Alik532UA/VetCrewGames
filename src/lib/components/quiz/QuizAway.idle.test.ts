import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Member } from '$lib/net/roomTypes';
import QuizAway from './QuizAway.svelte';

/**
 * ВІКНО «ЩЕ НЕ ВИБРАЛИ ВІДПОВІДЬ» (рішення автора 2026-09-27, 5-B) — те саме вікно, що
 * «Чекаємо», лише з іншим питанням. Перевіряється саме різниця: підпис, «Грати далі» одразу
 * (межа вже минула, відліку немає) і жодного «Прибрати» — ці люди на звʼязку.
 *
 * Зворотні експерименти: прибрати `idle ?` з підпису — червоніє підпис; прибрати `!idle` з
 * умови «Прибрати» — червоніє останній рядок.
 */
afterEach(cleanup);

// Прапор у рядку імені читає мову з налаштувань, а `MediaQuery` — медіазапит: у jsdom
// немає ні того, ні іншого (та сама підготовка, що в `QuizRoom.final.test.ts`).
vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk', font: 'default' }
}));
vi.stubGlobal('matchMedia', (media: string) => ({
	matches: false,
	media,
	addEventListener: () => {},
	removeEventListener: () => {}
}));

const thinker: Member = { uid: 'uid-thinker', name: 'Тихий Їжак', role: 'player', order: 2 };

describe('QuizAway: хто ще думає', () => {
	it('питає про тих, хто не вибрав відповідь, і дає «Грати далі» одразу', () => {
		const onGoOn = vi.fn();
		render(QuizAway, {
			props: {
				text: (key: string) => key,
				idle: true,
				away: [thinker],
				secondsLeft: 0,
				waiting: true,
				voted: 0,
				needed: 1,
				iVoted: false,
				onGoOn,
				onkick: vi.fn()
			}
		});

		expect(screen.getByTestId('quiz-away-panel').textContent).toContain('quiz.idleWait');
		expect(screen.getByTestId('quiz-away-uid-thinker-item').textContent).toContain('Тихий Їжак');
		screen.getByTestId('quiz-away-goon-btn').click();
		expect(onGoOn).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId('quiz-away-timer-value'), 'межа вже минула').toBeNull();
		expect(
			screen.queryByTestId('quiz-away-uid-thinker-btn'),
			'того, хто думає, не прибирають'
		).toBeNull();
	});
});
