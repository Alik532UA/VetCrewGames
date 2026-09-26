import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// Справжній синглтон налаштувань питає `window.matchMedia`, якого в jsdom немає.
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk', font: 'default' } }));

const { default: NetLost } = await import('./NetLost.svelte');

/**
 * СМУГА КІМНАТИ: обрив і застаріла сторінка (аудит 2026-09-25).
 *
 * Застаріла сторінка важливіша за обрив: звʼязок є, а ходи не проходять, і без
 * смуги дошка просто виглядала замерзлою. Показується одразу, разом із кнопкою.
 *
 * Зворотний експеримент: прибрати гілку `stale` — червоніє перший.
 */
describe('смуга кімнати', () => {
	it('правила новіші за сторінку — кнопка «оновити» одразу', () => {
		const view = render(NetLost, { props: { lost: false, stale: true } });
		expect(view.queryByTestId('room-reload-btn')).not.toBeNull();
		expect(view.getByTestId('net-lost-text').textContent?.trim()).not.toBe('');
	});

	it('звичайний стан — ні тексту, ні кнопки', () => {
		const view = render(NetLost, { props: { lost: false } });
		expect(view.queryByTestId('room-reload-btn')).toBeNull();
		expect(view.getByTestId('net-lost-text').textContent?.trim()).toBe('');
	});
});
