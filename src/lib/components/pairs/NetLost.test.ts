import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

// Справжній синглтон налаштувань питає `window.matchMedia`, якого в jsdom немає.
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk', font: 'default' } }));

const { default: NetLost } = await import('./NetLost.svelte');

/**
 * СМУГА КІМНАТИ: обрив і застаріла сторінка (аудит 2026-09-25).
 *
 * Застаріла сторінка важливіша за обрив: звʼязок є, а ходи не проходять, і без
 * смуги дошка просто виглядала замерзлою. Показується одразу, разом із кнопкою.
 *
 * Нова збірка на сервері — те саме, лише інший текст (аудит 2026-09-26): зайти в
 * кімнату з вкладки, відкритої до викладки, не вийде, і доти людина чула
 * «спробуйте ще раз» без кінця.
 *
 * Зворотні експерименти: прибрати гілку `rules` — червоніє перший; `build` — другий.
 */
describe('смуга кімнати', () => {
	it('правила новіші за сторінку — кнопка «оновити» одразу', () => {
		const view = render(NetLost, { props: { lost: false, reload: 'rules' } });
		expect(view.queryByTestId('room-reload-btn')).not.toBeNull();
		expect(view.getByTestId('net-lost-text').textContent?.trim()).not.toBe('');
	});

	it('на сервері нова збірка — своє пояснення й та сама кнопка', () => {
		const rules = render(NetLost, { props: { lost: false, reload: 'rules' } });
		const rulesText = rules.getByTestId('net-lost-text').textContent?.trim();
		rules.unmount();
		const view = render(NetLost, { props: { lost: false, reload: 'build' } });
		expect(view.queryByTestId('room-reload-btn')).not.toBeNull();
		const text = view.getByTestId('net-lost-text').textContent?.trim();
		expect(text).not.toBe('');
		expect(text, 'нова збірка пояснена словами про правила').not.toBe(rulesText);
	});

	it('звичайний стан — ні тексту, ні кнопки', () => {
		const view = render(NetLost, { props: { lost: false } });
		expect(view.queryByTestId('room-reload-btn')).toBeNull();
		expect(view.queryByTestId('room-no-lead-new-btn')).toBeNull();
		expect(view.getByTestId('net-lost-text').textContent?.trim()).toBe('');
	});

	/**
	 * ВЕСТИ НІКОМУ (шостий аудит, S1): пояснення й дві дороги — нова кімната й вихід.
	 * Доти такий стан не пояснювало нічого: раунди стояли, екран застигав.
	 *
	 * Зворотний експеримент: прибрати гілку `noLead` — червоніє.
	 */
	it('вести нікому — пояснення й дві дороги, і кожна кличе свою дію', async () => {
		const onLeave = vi.fn();
		const onNewRoom = vi.fn();
		const view = render(NetLost, {
			props: { lost: false, stranded: true, onLeave, onNewRoom }
		});
		expect(view.getByTestId('net-lost-text').textContent?.trim()).not.toBe('');
		await fireEvent.click(view.getByTestId('room-no-lead-new-btn'));
		await fireEvent.click(view.getByTestId('room-no-lead-leave-btn'));
		expect(onNewRoom).toHaveBeenCalledTimes(1);
		expect(onLeave).toHaveBeenCalledTimes(1);
	});

	it('обрив важливіший: без звʼязку — його текст і жодної кнопки «вести нікому»', async () => {
		vi.useFakeTimers();
		try {
			const view = render(NetLost, { props: { lost: true, stranded: true } });
			expect(view.queryByTestId('room-no-lead-new-btn'), 'обрив ще не видно — видно «нікому»').not.toBeNull();
			await vi.advanceTimersByTimeAsync(1500);
			expect(view.queryByTestId('room-no-lead-new-btn')).toBeNull();
			expect(view.getByTestId('net-lost-text').textContent).toContain('звʼязку');
		} finally {
			vi.useRealTimers();
		}
	});

	it('застаріла сторінка важливіша: під нею смуги «вести нікому» немає', () => {
		const view = render(NetLost, { props: { lost: false, reload: 'rules', stranded: true } });
		expect(view.queryByTestId('room-no-lead-new-btn')).toBeNull();
		expect(view.queryByTestId('room-reload-btn')).not.toBeNull();
	});
});
