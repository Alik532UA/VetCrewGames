import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

// Справжній синглтон налаштувань питає `window.matchMedia`, якого в jsdom немає.
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk', font: 'default' } }));

/*
 * Сам тост теж питає `matchMedia` — `prefers-reduced-motion`. Відповідь «так»: переходи
 * тоді нульові, і вузол, що виходить, не лишається в DOM на час анімації.
 */
Object.defineProperty(window, 'matchMedia', {
	configurable: true,
	value: (media: string) => ({
		matches: true,
		media,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false
	})
});

const { default: Toast } = await import('./Toast.svelte');
const { toast } = await import('$lib/controllers/toast.svelte');

/**
 * ТОСТ ПРО ЗБІЙ — ЯК ЙОГО ВИДНО (прохання автора 2026-09-27: «як сповіщення», а не блоком
 * усередині хабу).
 *
 * «Проблема в коді — зверніться до розробника» мусить мати звіт і контакти; стара
 * сторінка — «Оновити»; і щойно людина взялася за звіт чи контакти, тост закріплюється:
 * інакше він зник би, поки вона вставляє звіт у месенджер.
 *
 * Зворотні експерименти (прогнано): не закріплювати на натиску — червоніє «натиск
 * закріплює»; прибрати `hidden` із контактів — «контакти — за кнопкою».
 */

function clipboard(writeText: (text: string) => Promise<void>) {
	Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

afterEach(() => {
	for (const message of [...toast.messages]) toast.remove(message.id);
	Reflect.deleteProperty(navigator, 'clipboard');
	vi.restoreAllMocks();
});

describe('тост про збій', () => {
	it('стара сторінка — текст причини й «Оновити сторінку», без звіту', async () => {
		toast.problem('reload');
		const view = render(Toast);
		expect(view.getByTestId('toast-body-text').textContent?.trim()).not.toBe('');
		expect(view.getByTestId('toast-action-btn').textContent).toContain('Оновити');
		expect(view.queryByTestId('toast-report-panel')).toBeNull();
	});

	it('проблема в коді — звіт і контакти; контакти — за кнопкою, у новій вкладці', async () => {
		toast.problem('code');
		const view = render(Toast);
		const contact = await vi.waitFor(() => view.getByTestId('toast-report-contact-btn'));
		expect(view.queryByTestId('toast-action-btn'), 'оновлення коду не лікує').toBeNull();
		const list = view.getByTestId('toast-contacts-list');
		expect(list.closest('[hidden]'), 'контакти — за кнопкою').not.toBeNull();
		await fireEvent.click(contact);
		expect(list.closest('[hidden]')).toBeNull();
		expect(contact.getAttribute('aria-expanded')).toBe('true');
		const links = [...list.querySelectorAll('a')];
		expect(links.map((link) => link.dataset.testid)).toEqual([
			'toast-contact-telegram-link',
			'toast-contact-viber-link',
			'toast-contact-whatsapp-link',
			'toast-contact-linkedin-link'
		]);
		for (const link of links) {
			expect(link.target).toBe('_blank');
			expect(link.rel).toContain('noopener');
			expect(link.getAttribute('aria-label')).toContain(link.title);
		}
	});

	it('натиск закріплює тост: смужки часу більше немає, і сам він не зникне', async () => {
		toast.problem('rules');
		const view = render(Toast);
		expect(view.queryByTestId('toast-progress-bar')).not.toBeNull();
		await fireEvent.click(await vi.waitFor(() => view.getByTestId('toast-report-contact-btn')));
		expect(toast.messages[0].pinned).toBe(true);
		await vi.waitFor(() => expect(view.queryByTestId('toast-progress-bar')).toBeNull());
	});

	it('звіт — у буфер; відмова буфера — поле з тим самим звітом', async () => {
		const written: string[] = [];
		clipboard(async (text) => void written.push(text));
		toast.problem('rules');
		const view = render(Toast);
		const copy = await vi.waitFor(() => view.getByTestId('toast-report-copy-btn'));
		const idle = copy.textContent?.trim();
		await fireEvent.click(copy);
		await vi.waitFor(() => expect(written).toHaveLength(1));
		expect(written[0]).toMatch(/^--- REPORT from service badge ---/);
		await vi.waitFor(() => expect(copy.textContent?.trim()).not.toBe(idle));

		clipboard(async () => Promise.reject(new DOMException('denied', 'NotAllowedError')));
		await fireEvent.click(copy);
		const field = (await vi.waitFor(() =>
			view.getByTestId('toast-report-textarea')
		)) as HTMLTextAreaElement;
		expect(field.value).toMatch(/^--- REPORT from service badge ---/);
		expect(field.readOnly).toBe(true);
	});
});
