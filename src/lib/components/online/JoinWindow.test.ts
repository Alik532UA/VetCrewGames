import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import JoinWindow from './JoinWindow.svelte';

/**
 * ВЛАСНА ЦИФРОВА КЛАВІАТУРА ВІКНА «ПІДКЛЮЧИТИСЯ» (прохання автора 2026-09-27: «щоб на
 * компʼютері можна було мишкою ввести, а на телефоні не викликати клавіатуру системи»).
 *
 * Зворотні експерименти: у `press` не зводити код до межі — червоніє «більше пʼяти цифр
 * клавіатура не набирає»; прибрати `inputmode="none"` — «системної клавіатури немає» (і
 * `room-code.test.ts`); прибрати `type="button"` з цифр — «клавіша не подає форму».
 */
afterEach(cleanup);

vi.mock('$lib/services/settings.svelte', () => ({
	settings: { locale: 'uk', font: 'default' }
}));

function open(joinCode = '') {
	const onJoin = vi.fn();
	render(JoinWindow, { props: { joinCode, busy: false, onJoin, onBack: vi.fn() } });
	const input = screen.getByTestId('online-code-input') as HTMLInputElement;
	return { input, onJoin };
}

describe('клавіатура коду кімнати', () => {
	it('перевірка жива: цифри з клавіатури стають кодом у полі', async () => {
		const { input } = open();
		for (const digit of ['0', '7'])
			await fireEvent.click(screen.getByTestId(`online-key-${digit}-btn`));
		expect(input.value, 'провідний нуль лишається').toBe('07');
	});

	it('«стерти» прибирає останню цифру, а на порожньому не робить нічого', async () => {
		const { input } = open('42');
		await fireEvent.click(screen.getByTestId('online-key-erase-btn'));
		expect(input.value).toBe('4');
		await fireEvent.click(screen.getByTestId('online-key-erase-btn'));
		await fireEvent.click(screen.getByTestId('online-key-erase-btn'));
		expect(input.value).toBe('');
	});

	it('більше пʼяти цифр клавіатура не набирає: довшого коду не буває', async () => {
		const { input } = open('1234');
		await fireEvent.click(screen.getByTestId('online-key-5-btn'));
		await fireEvent.click(screen.getByTestId('online-key-6-btn'));
		expect(input.value).toBe('12345');
	});

	it('системної клавіатури немає, а «стерти» має назву для читалки', () => {
		const { input } = open();
		expect(input.getAttribute('inputmode')).toBe('none');
		expect(screen.getByTestId('online-key-erase-btn').getAttribute('aria-label')).toBeTruthy();
		expect(
			screen.getAllByRole('button').filter((b) => /^\d$/.test(b.textContent?.trim() ?? ''))
		).toHaveLength(10);
	});

	it('клавіша не подає форму: підключає лише «Підключитися»', async () => {
		const { onJoin } = open('42');
		await fireEvent.click(screen.getByTestId('online-key-1-btn'));
		expect(onJoin).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByTestId('online-join-btn'));
		expect(onJoin).toHaveBeenCalledTimes(1);
	});
});
