import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';

/**
 * ВІКНО «ВАС ЗАПРОСИЛИ» (рішення автора 2026-09-26): підпис гравця й дві дороги.
 *
 * Кому вікно показувати, доводить `roomInvite.svelte.test.ts`; тут — що в самому вікні:
 * код кімнати, попередження, коли ВАШУ аватарку тут уже взяли (зайти можна й так —
 * дістанеться вільна, — але знати це треба до входу), і що кнопки кличуть своє.
 *
 * Зворотний експеримент: не показувати попередження — червоніє «зайнята».
 */

vi.mock('$lib/i18n', () => ({
	t: (key: string) => key,
	td: (key: string) => key,
	formatFont: (s: string) => s
}));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk', font: 'default' } }));

const { default: InviteWindow } = await import('./InviteWindow.svelte');

afterEach(() => cleanup());

function mounted(avatar: string, taken: ReadonlyMap<string, string> = new Map()) {
	const onJoin = vi.fn();
	const onBack = vi.fn();
	render(InviteWindow, {
		props: {
			code: '42',
			name: 'Тихий Їжак',
			country: '',
			avatar,
			taken,
			busy: false,
			onAvatar: vi.fn(),
			onRandomName: vi.fn(),
			onJoin,
			onBack
		}
	});
	return { onJoin, onBack };
}

describe('вікно «вас запросили»', () => {
	it('каже, куди запросили, і кнопки кличуть своє', async () => {
		const { onJoin, onBack } = mounted('dog:red');

		expect(screen.getByTestId('room-invite-code-value').textContent).toBe('42');
		await fireEvent.click(screen.getByTestId('room-invite-join-btn'));
		await fireEvent.click(screen.getByTestId('room-invite-back-btn'));
		expect(onJoin).toHaveBeenCalledTimes(1);
		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('вашу аватарку тут уже взяли — про це сказано до входу', () => {
		mounted('cat:blue', new Map([['cat:blue', 'Рожевий Фламінго']]));

		expect(screen.getByTestId('room-invite-avatar-taken-text').textContent).toContain(
			'pairs.inviteAvatarTaken'
		);
	});

	it('вільна аватарка — попередження немає', () => {
		mounted('dog:red', new Map([['cat:blue', 'Рожевий Фламінго']]));

		expect(screen.queryByTestId('room-invite-avatar-taken-text')).toBeNull();
	});
});
