import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import { crossGameLinks } from '$lib/utils/crossGame';
import { ONLINE_GAMES, gamesToConfig } from '$lib/config/quizOnline';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import type { WaitView } from '$lib/utils/awayWait';

/**
 * ТАБЛО МІЖ РАУНДАМИ — РАХУНОК, А ПІД НИМ РОЗБІР МИНУЛОГО РАУНДУ (прохання автора
 * 2026-09-28: «між раундами тільки оновлений рахунок → оновлений рахунок та нижче пояснення
 * відповідей минулого раунду»).
 *
 * Головне твердження файлу — ТОЙ САМИЙ екземпляр дошки: розбір мусить показувати відповідь,
 * яку гравець щойно дав, а знає її лише дошка, на якій він грав. Нова дошка на таблі
 * створила б той самий раунд із зерна, але без відповіді.
 *
 * Зворотний експеримент: `QuizRound` назад у гілку раунду — червоніють «та сама дошка» й
 * розбір кожної гри; розбір без відповіді з оцінкою — червоніє «без відповіді».
 */

vi.mock('$lib/services/settings.svelte', () => ({
	settings: { addScore: vi.fn(), locale: 'uk', font: 'default' }
}));

// `MediaQuery` і кадри анімації: у jsdom немає ні того, ні іншого.
vi.stubGlobal('matchMedia', (media: string) => ({
	matches: false,
	media,
	addEventListener: () => {},
	removeEventListener: () => {}
}));
vi.stubGlobal('requestAnimationFrame', () => 0);
vi.stubGlobal('cancelAnimationFrame', () => {});
// Web Animations для переходів — спільна підставка `src/web-animations.setup.ts`.

const { QuizMatch } = await import('$lib/controllers/quizMatch.svelte');
const { default: QuizRoom } = await import('./QuizRoom.svelte');

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const members = (): Member[] => [
	{ uid: HOST, name: 'Лідер', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

/** Кімната, у якої в наборі ОДНА гра: тоді перший раунд — саме вона. */
const info = (game: string): RoomInfo => ({
	gameId: 'quiz',
	rulesVersion: 1,
	seed: 20260824,
	status: 'playing',
	roster: rosterOf(members()),
	hostUid: HOST,
	config: gamesToConfig([game])
});

const calm = {
	hold: false,
	needed: 0,
	left: 0,
	pausedBy: null,
	canPause: false,
	canVote: false,
	canResume: false
} as WaitView;

/** Перший раунд оголошено: годинник раунду й годинник табла. */
async function firstRound(game: string) {
	const room = new LocalRoom(info(game), members());
	const host = new QuizMatch(HOST, room.transport());
	const stop = host.listen();
	host.present = [HOST, GUEST];
	await host.startRound(0);
	return { host, stop, during: host.startedAt[0] + 1, reveal: host.deadlineAt() as number };
}

function view(match: InstanceType<typeof QuizMatch>, clock: number) {
	const props = {
		text: (key: string) => key,
		match,
		me: HOST,
		lang: 'uk' as const,
		amHost: true,
		clock,
		wait: calm,
		goOn: [],
		onGoOn: vi.fn(),
		idle: { show: false, idle: [], voted: 0, needed: 1, iVoted: false },
		onNoWait: vi.fn(),
		onPause: vi.fn(),
		onResume: vi.fn(),
		onanswer: vi.fn(),
		onRematch: vi.fn(),
		onClose: vi.fn(),
		cross: crossGameLinks('uk', 'quiz', '42', null),
		onkick: vi.fn()
	};
	const rendered = render(QuizRoom, { props });
	return {
		...rendered,
		/** Годинник кімнати пішов далі — той самий компонент, нові пропи. */
		at: async (next: number) => {
			await rendered.rerender({ ...props, clock: next });
			flushSync();
		}
	};
}

afterEach(() => cleanup());

/** Чим видно розбір у кожній грі набору. */
const EXPLANATION: Record<string, string> = {
	myths: '.myth-card__explanation',
	feeding: '[data-testid="feeding-settled-panel"]',
	'habitat-continents': '.result__answer',
	'habitat-biomes': '.result__answer',
	family: '[data-testid="family-explanation-text"]',
	population: '.results-zone'
};

describe('табло між раундами: рахунок і розбір', () => {
	it('перевірка жива: кожна гра набору має чим показати розбір', () => {
		expect(ONLINE_GAMES.map((game) => game.id).sort()).toEqual(Object.keys(EXPLANATION).sort());
	});

	it('перевірка жива: годинник раунду — раунд, годинник табла — табло', async () => {
		const { host, stop, during, reveal } = await firstRound('myths');
		expect(host.phase(during)).toBe('round');
		expect(host.phase(reveal)).toBe('reveal');
		stop();
	});

	it.each(ONLINE_GAMES.map((game) => game.id))(
		'%s: на таблі під рахунком — розбір, а не порожнеча',
		async (game) => {
			const { host, stop, during, reveal } = await firstRound(game);
			const room = view(host, during);
			expect(screen.queryByTestId('quiz-reveal-panel'), 'під час раунду табла немає').toBeNull();

			await room.at(reveal);
			const panel = screen.getByTestId('quiz-reveal-panel');
			const board = screen.getByTestId('quiz-board-panel');
			expect(board.classList.contains('board--settled'), 'дошка не перейшла в розбір').toBe(true);
			expect(
				panel.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING,
				'розбір мусить бути ПІД рахунком'
			).toBeTruthy();
			expect(board.querySelector(EXPLANATION[game]), 'розбору на таблі немає').not.toBeNull();
			stop();
		}
	);

	it('на табло переходить ТА САМА дошка — із відповіддю гравця', async () => {
		const { host, stop, during, reveal } = await firstRound('myths');
		const room = view(host, during);
		const board = screen.getByTestId('quiz-board-panel');
		await fireEvent.click(screen.getByTestId('mythbusters-truth-btn'));
		flushSync();

		await room.at(reveal);
		expect(screen.getByTestId('quiz-board-panel'), 'дошку створено заново').toBe(board);
		expect(board.querySelector('.result-header'), 'відповідь гравця загубилася').not.toBeNull();
		expect(board.querySelector('.myth-card__image-wrap'), 'розбір — без картинки').toBeNull();
		stop();
	});

	/**
	 * ПЕРЕХІД МІЖ РАУНДАМИ — АНІМАЦІЄЮ, як меню (прохання автора 2026-09-28: «перемикання
	 * між раундами та результатами жорстке → плавне»). Дошку міняє `{#key}` батька; без
	 * переходу на її корені стара зникала, а нова ставала на її місце в тому самому кадрі.
	 * Зворотний експеримент: прибрати `in:`/`out:` із кореня `QuizBoard` — червоніє. (Прибрати
	 * лише `|global` — ні, і так і мусить бути: для `{#key}` вистачає локального переходу.)
	 */
	it('новий раунд заходить переходом, а не підміною', async () => {
		const { host, stop, during, reveal } = await firstRound('myths');
		const room = view(host, during);
		await room.at(reveal);
		const animate = vi.spyOn(Element.prototype, 'animate');

		await host.startRound(1);
		await room.at(host.startedAt[1] + 1);
		const boards = animate.mock.contexts.filter(
			(node) => (node as Element).getAttribute?.('data-testid') === 'quiz-board-panel'
		);
		expect(boards.length, 'дошка нового раунду стала без переходу').toBeGreaterThan(0);
		animate.mockRestore();
		stop();
	});

	it('без відповіді — пояснення є, а оцінки відповіді, якої не було, немає', async () => {
		const { host, stop, during, reveal } = await firstRound('myths');
		const room = view(host, during);
		await room.at(reveal);
		const board = screen.getByTestId('quiz-board-panel');
		expect(board.querySelector('.myth-card__explanation')).not.toBeNull();
		expect(
			board.querySelector('.result-header'),
			'«Не зовсім...» за відповідь, якої не було'
		).toBeNull();
		stop();
	});
});
