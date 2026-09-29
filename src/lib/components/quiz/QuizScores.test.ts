import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import type { Member } from '$lib/net/roomTypes';

/**
 * СМУГА ГРАВЦІВ ПІД ЧАС РАУНДУ (прохання автора 2026-09-29): свою плитку видно за розміром —
 * чужі на 12% менші, — «Ви» стоїть після аватарки, а на телефоні всі стоять одним рядком,
 * лише прапор і аватарка.
 *
 * Розкладку телефона (медіазапит, `cqi`) jsdom не рахує — її перевірено очима. Тут — те, від
 * чого вона рахується: хто менший, і числа `--count` та `--weight`, з яких стилі виводять
 * розмір плитки, щоб рядок став у ширину смуги.
 *
 * Зворотні експерименти: зменшувати й свою плитку — червоніє «своя звичайна»; рахувати вагу
 * без зменшення чужих — «вага рядка»; зменшувати глядачеві — «глядач».
 */

vi.mock('$lib/services/settings.svelte', () => ({
	settings: { locale: 'uk', font: 'default' }
}));

const { default: QuizScores } = await import('./QuizScores.svelte');

const players: Member[] = [
	{ uid: 'a', name: 'Зухвалий Горобець', role: 'player', order: 1, avatar: 'cat:blue' },
	{ uid: 'b', name: 'Рожевий Фламінго', role: 'player', order: 2, avatar: 'dog:green' },
	{ uid: 'c', name: 'Сердитий Вовк', role: 'player', order: 3, avatar: 'bird:red' }
];

const tile = (uid: string) => screen.getByTestId(`quiz-score-${uid}-item`);

afterEach(() => cleanup());

describe('смуга гравців', () => {
	it('своя плитка звичайна, чужі — менші', () => {
		render(QuizScores, { props: { players, answered: [], me: 'b' } });
		expect(tile('b').classList.contains('scores__row--other'), 'своя звичайна').toBe(false);
		expect(tile('a').classList.contains('scores__row--other')).toBe(true);
		expect(tile('c').classList.contains('scores__row--other')).toBe(true);
	});

	it('вага рядка — одна своя плитка й дві менші: з цього стилі рахують розмір', () => {
		render(QuizScores, { props: { players, answered: [], me: 'b' } });
		const list = screen.getByTestId('quiz-scores-list');
		expect(list.style.getPropertyValue('--count')).toBe('3');
		expect(Number(list.style.getPropertyValue('--weight'))).toBeCloseTo(1 + 2 * 0.88, 5);
	});

	it('«Ви» — після аватарки, перед іменем; імʼя — окремим елементом', () => {
		render(QuizScores, { props: { players, answered: [], me: 'b' } });
		const who = tile('b').querySelector('.scores__who')!;
		const avatar = who.querySelector('.avatar')!;
		const badge = who.querySelector('.badge')!;
		const name = who.querySelector('.scores__name')!;
		expect(name.textContent).toBe('Рожевий Фламінго');
		expect(avatar.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
		expect(badge.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});

	it('глядач бачить усі плитки однаковими', () => {
		render(QuizScores, { props: { players, answered: [], me: 'uid-eye' } });
		for (const uid of ['a', 'b', 'c']) {
			expect(tile(uid).classList.contains('scores__row--other'), uid).toBe(false);
		}
		expect(screen.getByTestId('quiz-scores-list').style.getPropertyValue('--weight')).toBe('3');
	});
});
