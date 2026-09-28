import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import type { Member } from '$lib/net/roomTypes';
import type { IdleView } from '$lib/utils/idleWait';
import QuizIdle from './QuizIdle.svelte';

/**
 * «ЗАДОВГО ДУМАЄ НАД ВІДПОВІДДЮ» (прохання автора 2026-09-28, відповідь A) — вікно, яке можна
 * відкласти. Доти вікно «Ще не вибрали відповідь» лишалося поверх дошки, доки хтось не
 * натисне «Грати далі», і відповідь під ним дочитати було не можна.
 *
 * Перевіряється: питання словами (однина й множина, без займенників роду); «Продовжити» —
 * голос; «Чекати ще хвилину» — смуга знизу з голосом і відліком, а за хвилину — знову
 * вікно; хто проголосував, того вікно не питає; пауза й новий раунд.
 *
 * Зворотні експерименти: не згортати вікно після «Чекати ще хвилину» — червоніє «згортає»;
 * не повертати вікно за хвилину (відкладення без кінця) — «за хвилину вікно питає знову»;
 * показувати вікно тому, хто проголосував, — «хто вже проголосував»; відкладення без
 * раунду — «новий раунд».
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
const other: Member = { uid: 'uid-other', name: 'Смугаста Зебра', role: 'player', order: 3 };

const START = 1_000;
const MINUTE = 60_000;

function view(over: Partial<IdleView> = {}): IdleView {
	return { show: true, idle: [thinker], voted: 0, needed: 1, iVoted: false, ...over };
}

function setup(over: Partial<IdleView> = {}) {
	const props = {
		text: (key: string) => key,
		view: view(over),
		round: 0,
		clock: START,
		hidden: false,
		onNoWait: vi.fn()
	};
	const rendered = render(QuizIdle, { props });
	return {
		props,
		/** Той самий компонент, нові пропи: годинник пішов або прийшов голос. */
		update: async (next: Partial<typeof props>) => {
			Object.assign(props, next);
			await rendered.rerender({ ...props });
			flushSync();
		}
	};
}

describe('вікно «Задовго думає над відповіддю»', () => {
	it('питає, хто задовго думає, і чи продовжити гру без цієї відповіді', () => {
		setup();
		expect(screen.getByTestId('quiz-away-panel').textContent).toContain('quiz.idleOne');
		expect(screen.getByTestId('quiz-idle-ask-text').textContent).toContain('quiz.idleAskOne');
		expect(screen.getByTestId('quiz-away-uid-thinker-item').textContent).toContain('Тихий Їжак');
		expect(screen.queryByTestId('quiz-away-timer-value'), 'межа вже минула').toBeNull();
		expect(
			screen.queryByTestId('quiz-away-uid-thinker-btn'),
			'того, хто думає, не прибирають'
		).toBeNull();
	});

	it('коли думають кілька — дієслово й питання у множині', () => {
		setup({ idle: [thinker, other] });
		expect(screen.getByTestId('quiz-away-panel').textContent).toContain('quiz.idleMany');
		expect(screen.getByTestId('quiz-idle-ask-text').textContent).toContain('quiz.idleAskMany');
	});

	it('«Продовжити» — голос не чекати, з лічильником на кнопці', () => {
		const { props } = setup({ needed: 2 });
		const button = screen.getByTestId('quiz-away-goon-btn');
		expect(button.textContent).toContain('quiz.idleGoOn');
		expect(screen.getByTestId('quiz-away-goon-count').textContent).toBe('0/2');
		button.click();
		expect(props.onNoWait).toHaveBeenCalledTimes(1);
	});

	it('«Чекати ще хвилину» згортає вікно в смугу знизу, і з неї можна проголосувати', () => {
		const { props } = setup();
		screen.getByTestId('quiz-idle-snooze-btn').click();
		flushSync();

		expect(screen.queryByTestId('quiz-away-panel'), 'вікно згорнулося').toBeNull();
		expect(screen.getByTestId('quiz-idle-strip-uid-thinker-item').textContent).toContain(
			'Тихий Їжак'
		);
		expect(screen.getByTestId('quiz-idle-strip-timer-text').textContent).toContain('1:00');
		screen.getByTestId('quiz-idle-strip-goon-btn').click();
		expect(props.onNoWait).toHaveBeenCalledTimes(1);
	});

	it('за хвилину вікно питає знову', async () => {
		const { update } = setup();
		screen.getByTestId('quiz-idle-snooze-btn').click();
		flushSync();

		await update({ clock: START + MINUTE - 1_000 });
		expect(screen.getByTestId('quiz-idle-strip-timer-text').textContent).toContain('0:01');
		expect(screen.queryByTestId('quiz-away-panel')).toBeNull();

		await update({ clock: START + MINUTE });
		expect(screen.queryByTestId('quiz-idle-strip-panel')).toBeNull();
		expect(screen.getByTestId('quiz-away-panel').textContent).toContain('quiz.idleOne');
	});

	it('хто вже проголосував, того вікно не питає: лишається смуга з голосами', async () => {
		const { update } = setup({ needed: 2 });
		await update({ view: view({ needed: 2, voted: 1, iVoted: true }) });

		expect(screen.queryByTestId('quiz-away-panel')).toBeNull();
		expect(screen.getByTestId('quiz-idle-strip-voted-text').textContent).toContain('1/2');
		expect(screen.queryByTestId('quiz-idle-strip-goon-btn'), 'голос уже є').toBeNull();
	});

	it('партія стоїть (пауза чи «Чекаємо») — ні вікна, ні смуги', () => {
		render(QuizIdle, {
			props: {
				text: (key: string) => key,
				view: view(),
				round: 0,
				clock: START,
				hidden: true,
				onNoWait: vi.fn()
			}
		});
		expect(screen.queryByTestId('quiz-away-panel')).toBeNull();
		expect(screen.queryByTestId('quiz-idle-strip-panel')).toBeNull();
	});

	it('новий раунд — відкладення минулого не діє: вікно питає одразу', async () => {
		const { update } = setup();
		screen.getByTestId('quiz-idle-snooze-btn').click();
		flushSync();
		expect(screen.queryByTestId('quiz-away-panel')).toBeNull();

		await update({ round: 1, clock: START + 1_000 });
		expect(screen.getByTestId('quiz-away-panel').textContent).toContain('quiz.idleOne');
	});

	it('коли думати вже нема кому — нічого', async () => {
		const { update } = setup();
		await update({ view: view({ show: false, idle: [] }) });
		expect(screen.queryByTestId('quiz-away-panel')).toBeNull();
		expect(screen.queryByTestId('quiz-idle-strip-panel')).toBeNull();
	});
});
