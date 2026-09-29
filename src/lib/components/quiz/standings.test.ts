import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import type { Member } from '$lib/net/roomTypes';

/**
 * РІВНІ БАЛИ ДІЛЯТЬ МІСЦЕ — на таблі, а не лише у функції (прохання автора
 * 2026-09-26). Знімок автора: двоє з 277 очками стояли першим і другим на таблі
 * між раундами. І ФІНАЛ — те саме табло, великим, із заголовком «Гру завершено!»
 * і діями під ним (прохання автора того самого дня).
 *
 * Зворотний експеримент: повернути `{place + 1}` — червоніють місця; прибрати
 * заголовок чи дії фіналу — червоніє «фінал».
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

const { default: QuizReveal } = await import('./QuizReveal.svelte');

const players: Member[] = [
	{ uid: 'a', name: 'Зухвалий Горобець', role: 'player', order: 1 },
	{ uid: 'b', name: 'Рожевий Фламінго', role: 'player', order: 2 },
	{ uid: 'c', name: 'Сердитий Вовк', role: 'player', order: 3 }
];

const place = (id: string) => screen.getByTestId(id).textContent?.trim();

afterEach(() => cleanup());

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

describe('фінал — те саме табло, великим', () => {
	it('заголовок «Гру завершено!», місця й дії під табло', () => {
		const actions = createRawSnippet(() => ({
			render: () => '<button data-testid="final-action-btn">Грати знову</button>'
		}));
		render(QuizReveal, {
			props: {
				text: (key: string) => key,
				players,
				me: 'b',
				duration: 0,
				settle: 0,
				travel: 0,
				title: 'Гру завершено!',
				testId: 'quiz-over-panel',
				actions,
				scores: { a: 702, b: 632, c: 632 },
				gains: { a: 89, b: 41 }
			}
		});
		expect(screen.getByTestId('quiz-over-panel')).toBeTruthy();
		expect(screen.getByRole('heading').textContent).toContain('Гру завершено!');
		expect(screen.getByTestId('final-action-btn'), 'дій під табло немає').toBeTruthy();
		expect(place('quiz-reveal-a-place-value')).toBe('1');
		expect(place('quiz-reveal-b-place-value')).toBe('2');
		expect(place('quiz-reveal-c-place-value')).toBe('2');
	});

	it('між раундами — типовий заголовок і без дій', () => {
		render(QuizReveal, {
			props: {
				text: (key: string) => key,
				players,
				me: 'b',
				duration: 0,
				settle: 0,
				travel: 0,
				scores: { a: 10, b: 5, c: 1 },
				gains: {}
			}
		});
		expect(screen.getByRole('heading').textContent).toContain('quiz.nextRound');
		expect(screen.queryByTestId('final-action-btn')).toBeNull();
		expect(screen.getByTestId('quiz-reveal-panel')).toBeTruthy();
	});
});

/**
 * СВІЙ РЯДОК — БІЛЬШИЙ, «ВИ» ПІСЛЯ АВАТАРКИ (прохання автора 2026-09-29): у чужих рядків
 * контейнер на 10% менший, а позначка стоїть після аватарки, перед іменем. Однаково між
 * раундами й у фіналі — це те саме табло.
 *
 * Зворотні експерименти: повернути позначку першою — червоніє «після аватарки»; позначати
 * чужим і свій рядок — «свій рядок звичайний»; зменшувати й глядачеві — «глядач».
 */
describe('свій рядок на таблі', () => {
	// Аватарка без значення не малює нічого, а порядок звіряється саме з нею.
	const withAvatars = players.map((player, i) => ({
		...player,
		avatar: ['cat:blue', 'dog:green', 'bird:red'][i]
	}));
	const props = (me: string) => ({
		text: (key: string) => key,
		players: withAvatars,
		me,
		duration: 0,
		settle: 0,
		travel: 0,
		scores: { a: 10, b: 5, c: 1 },
		gains: {}
	});

	it('«Ви» — після аватарки, перед іменем', () => {
		render(QuizReveal, { props: props('b') });
		const who = screen.getByTestId('quiz-reveal-b-row').querySelector('.reveal__who')!;
		const avatar = who.querySelector('.avatar')!;
		const badge = who.querySelector('.badge')!;
		expect(badge, 'позначки «ви» немає').toBeTruthy();
		expect(
			avatar.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
			'позначка після аватарки'
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		expect(who.textContent?.trim().endsWith('Рожевий Фламінго'), 'імʼя — останнім').toBe(true);
	});

	it('свій рядок звичайний, чужі — на 10% менші', () => {
		render(QuizReveal, { props: props('b') });
		const row = (uid: string) => screen.getByTestId(`quiz-reveal-${uid}-row`);
		expect(row('b').classList.contains('reveal__row--other'), 'свій рядок звичайний').toBe(false);
		for (const uid of ['a', 'c']) {
			expect(row(uid).classList.contains('reveal__row--other'), uid).toBe(true);
			expect(row(uid).style.getPropertyValue('--row-scale')).toBe('0.9');
		}
	});

	it('глядач, якого немає серед гравців, бачить усі рядки однаковими', () => {
		render(QuizReveal, { props: props('uid-eye') });
		for (const uid of ['a', 'b', 'c']) {
			expect(
				screen.getByTestId(`quiz-reveal-${uid}-row`).classList.contains('reveal__row--other'),
				uid
			).toBe(false);
		}
	});
});
