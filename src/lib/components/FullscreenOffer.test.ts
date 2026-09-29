import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { install as uk } from '$lib/i18n/install/uk';
import { Expand } from 'lucide-svelte';

/**
 * ВІКНО КНОПКИ «НА ВЕСЬ ЕКРАН» (прохання автора 2026-09-29).
 *
 * Що тут доводиться:
 *
 *  • «вибір» — два пункти, і перший справді вмикає повний екран, закриваючи вікно;
 *  • «Встановити» віддає натиск вікну браузера, коли воно є, — і тоді кроків немає;
 *    нема — кроки з приміткою «одним натиском не можна» (відповідь 2 — «A»);
 *  • там, де повного екрана не дають, вікно одразу пояснює чому й показує кроки;
 *  • кроки — під браузер: Chrome на iPhone має своє попередження, а Safari — ні.
 *
 * `Escape` — справа браузера (`<dialog>`), його міряє e2e `fullscreen-offer`.
 *
 * Зворотні експерименти: «Встановити» без вікна браузера закриває вікно — червоніє
 * «кроки»; вступ «пристрій не дозволяє» і у виборі — червоніє «вступу немає».
 */

/*
 * jsdom 29 `<dialog>` не вміє: ні `showModal`, ні `close`. Тут — рівно те, що з них бере
 * компонент: атрибут `open` і подія `close`.
 */
if (!('showModal' in HTMLElement.prototype)) {
	Object.assign(HTMLElement.prototype, {
		showModal(this: HTMLElement) {
			this.setAttribute('open', '');
		},
		close(this: HTMLElement) {
			if (!this.hasAttribute('open')) return;
			this.removeAttribute('open');
			this.dispatchEvent(new Event('close'));
		}
	});
}

const toggle = vi.fn();
const canPromptInstall = vi.fn(() => false);
const promptInstall = vi.fn(
	async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => 'accepted'
);

vi.mock('$lib/i18n', () => ({ t: (key: string) => key, formatFont: (s: string) => s }));
vi.mock('$lib/i18n/install', () => ({ loadInstallText: async () => uk }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk' } }));
vi.mock('$lib/pwa/installPrompt', () => ({ canPromptInstall, promptInstall }));

const { default: FullscreenOffer } = await import('./FullscreenOffer.svelte');

const IPHONE_SAFARI =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
const WINDOWS_CHROME =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

function open(mode: 'choice' | 'blocked', userAgent: string) {
	Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
	const onclose = vi.fn();
	render(FullscreenOffer, {
		mode,
		dict: uk,
		onclose,
		onfullscreen: toggle,
		fullscreenIcon: Expand
	});
	return { onclose, dialog: screen.getByTestId('fullscreen-offer-modal') };
}

afterEach(() => {
	cleanup();
	Reflect.deleteProperty(navigator, 'userAgent');
	vi.clearAllMocks();
	canPromptInstall.mockImplementation(() => false);
});

describe('вибір: браузер уміє, застосунок не встановлено', () => {
	it('вікно відкрите, два пункти, фокус — на «у цьому браузері»', () => {
		const { dialog } = open('choice', WINDOWS_CHROME);
		expect(dialog.hasAttribute('open')).toBe(true);
		const browser = screen.getByTestId('fullscreen-offer-browser-btn');
		expect(browser.textContent).toContain(uk['install.browser']);
		expect(screen.getByTestId('fullscreen-offer-install-btn').textContent).toContain(
			uk['install.appHint']
		);
		expect(document.activeElement).toBe(browser);
	});

	it('«у цьому браузері» — закриває вікно й вмикає повний екран', async () => {
		const { onclose, dialog } = open('choice', WINDOWS_CHROME);
		await fireEvent.click(screen.getByTestId('fullscreen-offer-browser-btn'));
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(onclose).toHaveBeenCalledTimes(1);
		expect(toggle).toHaveBeenCalledTimes(1);
	});

	it('«Встановити», коли є вікно браузера, — віддає натиск йому, і кроків немає', async () => {
		canPromptInstall.mockImplementation(() => true);
		const { onclose } = open('choice', WINDOWS_CHROME);
		await fireEvent.click(screen.getByTestId('fullscreen-offer-install-btn'));
		await Promise.resolve();
		expect(promptInstall).toHaveBeenCalledTimes(1);
		expect(onclose).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId('fullscreen-offer-steps-list')).toBeNull();
	});

	it('«Встановити» без вікна браузера — кроки з приміткою, вікно лишається', async () => {
		const { onclose } = open('choice', WINDOWS_CHROME);
		await fireEvent.click(screen.getByTestId('fullscreen-offer-install-btn'));
		expect(promptInstall).not.toHaveBeenCalled();
		expect(onclose).not.toHaveBeenCalled();
		expect(screen.getByTestId('fullscreen-offer-note-text').textContent).toContain(
			uk['install.note.manual']
		);
		expect(screen.getAllByTestId('fullscreen-offer-step-item')[0].textContent).toContain(
			uk['install.step.installIcon']
		);
		expect(screen.queryByTestId('fullscreen-offer-lead-text')).toBeNull();
		expect(screen.getByRole('heading').textContent).toContain(uk['install.title.desktop']);
	});
});

describe('значок кнопки встановлення — той, що в адресному рядку браузера', () => {
	/**
	 * Скарга автора 2026-09-29 зі знімком: в Edge кнопка встановлення — сітка з плюсом, а
	 * вікно показувало монітор зі стрілкою, як у Chrome. Зворотний експеримент: той самий
	 * значок для обох — червоніє «Edge».
	 */
	const WINDOWS_EDGE = `${WINDOWS_CHROME} Edg/129.0.0.0`;

	it('Edge — сітка з плюсом і у виборі, і в першому кроці', async () => {
		open('choice', WINDOWS_EDGE);
		const option = screen.getByTestId('fullscreen-offer-install-btn');
		expect(option.querySelector('.offer__icon--edge .lucide-grid-2x2-plus')).not.toBeNull();
		await fireEvent.click(option);
		const first = screen.getAllByTestId('fullscreen-offer-step-item')[0];
		expect(first.querySelector('.offer__icon--edge .lucide-grid-2x2-plus')).not.toBeNull();
	});

	it('Chrome — монітор зі стрілкою, без повороту', async () => {
		open('choice', WINDOWS_CHROME);
		const option = screen.getByTestId('fullscreen-offer-install-btn');
		expect(option.querySelector('.lucide-monitor-down')).not.toBeNull();
		expect(option.querySelector('.offer__icon--edge')).toBeNull();
		await fireEvent.click(option);
		const first = screen.getAllByTestId('fullscreen-offer-step-item')[0];
		expect(first.querySelector('.lucide-monitor-down')).not.toBeNull();
	});
});

describe('повного екрана не дають (iPhone у браузері)', () => {
	it('одразу пояснення й кроки Safari, без попередження', () => {
		open('blocked', IPHONE_SAFARI);
		expect(screen.queryByTestId('fullscreen-offer-browser-btn')).toBeNull();
		expect(screen.getByTestId('fullscreen-offer-lead-text').textContent).toContain(
			uk['install.lead.blocked']
		);
		const steps = screen.getAllByTestId('fullscreen-offer-step-item');
		expect(steps).toHaveLength(3);
		expect(steps[0].textContent).toContain(uk['install.step.shareBottom']);
		expect(screen.queryByTestId('fullscreen-offer-warning-text')).toBeNull();
	});

	it('Chrome на iPhone — «Поділитися» в адресному рядку й попередження про «три крапки»', () => {
		open('blocked', IPHONE_CHROME);
		const steps = screen.getAllByTestId('fullscreen-offer-step-item');
		expect(steps[0].textContent).toContain(uk['install.step.shareAddressBar']);
		expect(screen.getByTestId('fullscreen-offer-warning-text').textContent).toContain(
			uk['install.warning.iosChrome']
		);
	});
});

describe('закриття', () => {
	it('«Зрозуміло», хрестик і клік по тлу закривають; клік усередині — ні', async () => {
		for (const how of ['done', 'close', 'backdrop'] as const) {
			const { onclose, dialog } = open('blocked', IPHONE_SAFARI);
			await fireEvent.click(screen.getByTestId('fullscreen-offer-panel'));
			expect(onclose, `${how}: клік усередині`).not.toHaveBeenCalled();

			if (how === 'done') await fireEvent.click(screen.getByTestId('fullscreen-offer-done-btn'));
			if (how === 'close') await fireEvent.click(screen.getByTestId('fullscreen-offer-close-btn'));
			if (how === 'backdrop') await fireEvent.click(dialog);

			expect(onclose, how).toHaveBeenCalledTimes(1);
			cleanup();
		}
	});
});
