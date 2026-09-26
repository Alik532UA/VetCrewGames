import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Member } from '$lib/net/roomTypes';

/**
 * РІВНІ БАЛИ ДІЛЯТЬ МІСЦЕ — у ТАБЛИЦЯХ, а не лише у функції (прохання автора
 * 2026-09-26). Знімок автора: двоє з 277 очками стояли першим і другим на таблі
 * між раундами; підсумкова таблиця рахувала так само — номером рядка.
 *
 * Зворотний експеримент: повернути в будь-якій із двох таблиць `{place + 1}` —
 * червоніє її випадок.
 */

vi.mock('$lib/services/settings.svelte', () => ({
	settings: { locale: 'uk', font: 'default' }
}));

// `MediaQuery` і кадри анімації: у jsdom немає ні того, ні іншого, а питають їх
// уже під час імпорту залежностей — тому підміна до імпорту, а не в `beforeEach`.
vi.stubGlobal('matchMedia', (media: string) => ({
	matches: false,
	media,
	addEventListener: () => {},
	removeEventListener: () => {}
}));
vi.stubGlobal('requestAnimationFrame', () => 0);
vi.stubGlobal('cancelAnimationFrame', () => {});

const { default: QuizScores } = await import('./QuizScores.svelte');
const { default: QuizReveal } = await import('./QuizReveal.svelte');

const players: Member[] = [
	{ uid: 'a', name: 'Зухвалий Горобець', role: 'player', order: 1 },
	{ uid: 'b', name: 'Рожевий Фламінго', role: 'player', order: 2 },
	{ uid: 'c', name: 'Сердитий Вовк', role: 'player', order: 3 }
];

const place = (id: string) => screen.getByTestId(id).textContent?.trim();

afterEach(() => cleanup());

describe('підсумкова таблиця вікторини', () => {
	it('277 і 277 — обидва перші, наступний третій', () => {
		render(QuizScores, {
			props: {
				players,
				answered: [],
				scores: { a: 277, b: 277, c: 90 },
				withScores: true,
				layout: 'table',
				me: 'b'
			}
		});
		expect(place('quiz-score-a-place-value')).toBe('1');
		expect(place('quiz-score-b-place-value')).toBe('1');
		expect(place('quiz-score-c-place-value')).toBe('3');
	});
});

describe('табло між раундами', () => {
	const base = { text: (key: string) => key, players, me: 'b', settle: 0, travel: 0 };

	it('після переїзду — місця за підсумком, рівні ділять', () => {
		// `duration: 0` — одразу підсумкова фаза.
		render(QuizReveal, {
			props: { ...base, duration: 0, scores: { a: 277, b: 277, c: 90 }, gains: { a: 87, b: 83 } }
		});
		expect(place('quiz-reveal-a-place-value')).toBe('1');
		expect(place('quiz-reveal-b-place-value')).toBe('1');
		expect(place('quiz-reveal-c-place-value')).toBe('3');
	});

	it('до переїзду — місця МИНУЛОГО раунду, і там рівні теж ділять', () => {
		// Було: a 200, b 200, c 90 — нічия. Стало: a 280, b 277.
		render(QuizReveal, {
			props: { ...base, duration: 1000, scores: { a: 280, b: 277, c: 90 }, gains: { a: 80, b: 77 } }
		});
		expect(place('quiz-reveal-a-place-value')).toBe('1');
		expect(place('quiz-reveal-b-place-value')).toBe('1');
		expect(place('quiz-reveal-c-place-value')).toBe('3');
	});
});
