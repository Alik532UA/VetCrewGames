import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { LocalRoom } from '$lib/net/localRoom';
import { rosterOf } from '$lib/utils/roster';
import { crossGameLinks } from '$lib/utils/crossGame';
import { ONLINE_GAMES, QUIZ_ROUNDS, gamesToConfig } from '$lib/config/quizOnline';
import type { Member, RoomInfo } from '$lib/net/roomTypes';
import type { WaitView } from '$lib/utils/awayWait';

/**
 * ФІНАЛ ВІКТОРИНИ — ТАБЛО ОСТАННЬОГО РАУНДУ (прохання автора 2026-09-26).
 *
 * Доти після останнього раунду йшло табло «Наступний раунд», а за ним маленька
 * панель «Гру завершено!» з тими самими числами. Тепер фінал настає вже на таблі
 * останнього раунду — великим, і з діями під ним, які оживають, щойно кінець
 * партії записано.
 *
 * Зворотний експеримент: фінал лише при `over` — червоніє «табло останнього
 * раунду вже фінал»; кнопки без `disabled` — червоніє «до запису кінця».
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

const { QuizMatch } = await import('$lib/controllers/quizMatch.svelte');
const { default: QuizRoom } = await import('./QuizRoom.svelte');

const HOST = 'uid-host';
const GUEST = 'uid-guest';

const members = (): Member[] => [
	{ uid: HOST, name: 'Лідер', role: 'player', order: 1 },
	{ uid: GUEST, name: 'Гість', role: 'player', order: 2 }
];

const info = (): RoomInfo => ({
	gameId: 'quiz',
	rulesVersion: 1,
	seed: 20260824,
	status: 'playing',
	roster: rosterOf(members()),
	hostUid: HOST,
	config: gamesToConfig(ONLINE_GAMES.map((game) => game.id))
});

const calm: WaitView = {
	hold: false,
	needed: 0,
	left: 0,
	pausedBy: null,
	canPause: false,
	canVote: false,
	canResume: false
} as WaitView;

/** Партія, дограна до табла останнього раунду: кінця ще не записано. */
async function lastTable() {
	const room = new LocalRoom(info(), members());
	const host = new QuizMatch(HOST, room.transport());
	const stop = host.listen();
	host.present = [HOST, GUEST];
	for (let round = 0; round < QUIZ_ROUNDS; round++) await host.startRound(round);
	await host.answer(1);
	const clock = host.deadlineAt() as number;
	return { room, host, stop, clock };
}

const view = (
	match: InstanceType<typeof QuizMatch>,
	clock: number,
	amHost = true,
	canRematch = true
) =>
	render(QuizRoom, {
		props: {
			text: (key: string) => key,
			match,
			me: amHost ? HOST : GUEST,
			lang: 'uk',
			amHost,
			clock,
			wait: calm,
			goOn: [],
			onGoOn: vi.fn(),
			idle: { show: false, idle: [], voted: 0, needed: 1, iVoted: false },
			onNoWait: vi.fn(),
			onPause: vi.fn(),
			onResume: vi.fn(),
			onanswer: vi.fn(),
			onRematch: canRematch ? vi.fn() : undefined,
			onClose: vi.fn(),
			cross: crossGameLinks('uk', 'quiz', '42', null),
			onkick: vi.fn()
		}
	});

afterEach(() => cleanup());

describe('фінал вікторини', () => {
	it('перевірка жива: це табло останнього раунду, а партію ще не записано скінченою', async () => {
		const { host, stop, clock } = await lastTable();
		expect(host.phase(clock)).toBe('reveal');
		expect(host.over).toBe(false);
		stop();
	});

	it('табло останнього раунду вже фінал: «Гру завершено!», а не «Наступний раунд»', async () => {
		const { host, stop, clock } = await lastTable();
		view(host, clock);
		expect(screen.getByTestId('quiz-over-panel')).toBeTruthy();
		expect(screen.queryByText('quiz.nextRound')).toBeNull();
		stop();
	});

	it('до запису кінця партії кнопки фіналу не приймають натиску, після — приймають', async () => {
		const { host, stop, clock } = await lastTable();
		view(host, clock);
		const again = () => screen.getByTestId('quiz-play-again-btn') as HTMLButtonElement;
		expect(again().disabled, 'реванш до запису кінця стер би журнал раніше за нагороду').toBe(true);

		await host.startRound(QUIZ_ROUNDS);
		flushSync();

		expect(host.over).toBe(true);
		expect(again().disabled).toBe(false);
		expect(screen.getByTestId(`quiz-reveal-${HOST}-count`).textContent, '«+бали» лишились').toMatch(
			/\+\d+/
		);
		stop();
	});

	/**
	 * ГОСПОДАР БЕЗ ПАРИ ЧУЄ, ЧОГО БРАКУЄ (шостий аудит, A4) — так само, як у «Знайди
	 * пару»: кнопки реваншу немає, є слова. Доти кнопка була, а натиск відповідав
	 * тостом. Зворотний експеримент: показувати кнопку завжди — червоніє.
	 */
	it('господар без пари — «бракує гравців» замість кнопки реваншу', async () => {
		const { host, stop, clock } = await lastTable();
		view(host, clock, true, false);
		expect(screen.queryByTestId('quiz-play-again-btn')).toBeNull();
		const note = screen.getByTestId('quiz-reveal-note-text').textContent ?? '';
		expect(note.trim(), 'чого бракує — сказано').not.toBe('');
		expect(note, 'це не «чекаємо на лідера»: лідер тут він сам').not.toContain(
			'quiz.waitingLeader'
		);
		expect(screen.getByTestId('quiz-close-btn'), 'закрити кімнату можна завжди').toBeTruthy();
		stop();
	});

	it('гість бачить, що чекають на лідера, — текстом вікторини', async () => {
		const { host, stop, clock } = await lastTable();
		view(host, clock, false);
		expect(screen.getByTestId('quiz-reveal-note-text').textContent).toContain('quiz.waitingLeader');
		stop();
	});

	it('табло передостаннього раунду — звичайне, «Наступний раунд»', async () => {
		const room = new LocalRoom(info(), members());
		const host = new QuizMatch(HOST, room.transport());
		const stop = host.listen();
		host.present = [HOST, GUEST];
		for (let round = 0; round < QUIZ_ROUNDS - 1; round++) await host.startRound(round);
		view(host, host.deadlineAt() as number);
		expect(screen.getByTestId('quiz-reveal-panel')).toBeTruthy();
		expect(screen.queryByTestId('quiz-over-panel')).toBeNull();
		stop();
	});
});
