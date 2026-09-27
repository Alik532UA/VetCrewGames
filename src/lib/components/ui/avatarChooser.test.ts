import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { AVATAR_COLORS, AVATAR_ICONS } from '$lib/config/avatars';

/**
 * АВАТАРКА ПОРУЧ З ІМЕНЕМ (прохання автора 2026-09-26): плитка-кнопка у формі входу, а
 * вибір — окремим вікном (скарга автора 2026-09-27: рядок під іменем лягав нижче краю
 * телефона, і його доводилося шукати прокруткою).
 *
 * Головне тут — речі, яких не видно в коді з першого погляду:
 *
 *  • вибір ЗАКРИТИЙ, доки його не відкрили, і словник підписів (лінивий чанк) до
 *    того не вантажиться — інакше кожне відкриття форми тягло б `i18n/account`;
 *  • до приїзду словника радіокнопок немає зовсім: без підписів вони озвучувалися
 *    б як «кнопка» тридцять разів;
 *  • натиск на плитку віддає ПАРУ (`значок:колір`), складену з поточною половиною;
 *  • вікно закривають «Готово» й клік по тлу, а клік усередині — ні; фокус вертається на
 *    плитку. `Escape` — справа браузера (`<dialog>`), його міряє e2e `hub-windows`.
 *
 * Зворотний експеримент: вантажити словник одразу — червоніє «закритий»; віддавати
 * лише колір — червоніє «пара».
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

const loadAccountText = vi.fn(async () => {
	const dict: Record<string, string> = {
		'account.avatarColors': 'Колір',
		'account.avatarIcons': 'Значок',
		'account.avatarTakenBy': 'зайнято: {name}'
	};
	for (const color of AVATAR_COLORS) dict[`account.avatarColor.${color}`] = `колір ${color}`;
	for (const icon of AVATAR_ICONS) dict[`account.avatarIcon.${icon}`] = `значок ${icon}`;
	return dict;
});

vi.mock('$lib/i18n', () => ({ t: (key: string) => key, formatFont: (s: string) => s }));
vi.mock('$lib/i18n/account', () => ({ loadAccountText }));
vi.mock('$lib/services/settings.svelte', () => ({ settings: { locale: 'uk' } }));

const { default: AvatarChooser } = await import('./AvatarChooser.svelte');

afterEach(() => {
	cleanup();
	loadAccountText.mockClear();
});

function mounted(value = 'cat:blue', taken?: ReadonlyMap<string, string>) {
	const onpick = vi.fn();
	render(AvatarChooser, { props: { value, onpick, scope: 'test-avatar', taken } });
	return { onpick, toggle: screen.getByTestId('test-avatar-toggle-btn') };
}

describe('вибір аватарки поруч з іменем', () => {
	it('закритий, доки не відкрили, і словника не тягне', () => {
		const { toggle } = mounted();

		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('test-avatar-panel')).toBeNull();
		expect(loadAccountText).not.toHaveBeenCalled();
	});

	it('відкривається плиткою — підписи з лінивого словника', async () => {
		const { toggle } = mounted();
		await fireEvent.click(toggle);

		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		const red = await screen.findByTestId('test-avatar-color-red-radio');
		expect(red.getAttribute('aria-label')).toBe('колір red');
		expect(loadAccountText).toHaveBeenCalledWith('uk');
	});

	it('натиск віддає пару: новий колір із поточним значком', async () => {
		const { toggle, onpick } = mounted('cat:blue');
		await fireEvent.click(toggle);
		await fireEvent.click(await screen.findByTestId('test-avatar-color-red-radio'));
		await fireEvent.click(screen.getByTestId('test-avatar-icon-dog-radio'));

		expect(onpick).toHaveBeenNthCalledWith(1, 'cat:red');
		expect(onpick).toHaveBeenNthCalledWith(2, 'dog:blue');
	});

	it('аватарки немає зовсім — на кнопці силует, а у виборі щось позначене', async () => {
		const { toggle } = mounted('');
		expect(
			toggle.querySelector('.avatar--none'),
			'нейтральний силует, не з палітри'
		).not.toBeNull();
		await fireEvent.click(toggle);
		const first = (await screen.findByTestId(
			`test-avatar-color-${AVATAR_COLORS[0]}-radio`
		)) as HTMLInputElement;
		expect(first.checked).toBe(true);
	});

	it('відкривається модальним вікном із заголовком — фокус на ньому', async () => {
		const { toggle } = mounted();
		await fireEvent.click(toggle);
		await screen.findByTestId('test-avatar-color-red-radio');

		const dialog = screen.getByTestId('test-avatar-modal');
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(toggle.getAttribute('aria-haspopup')).toBe('dialog');
		const title = screen.getByRole('heading', { name: 'pairs.avatarChange' });
		expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
		expect(document.activeElement).toBe(title);
	});

	it('«Готово» закриває вікно й вертає фокус на плитку', async () => {
		const { toggle, onpick } = mounted('cat:blue');
		await fireEvent.click(toggle);
		await fireEvent.click(await screen.findByTestId('test-avatar-color-red-radio'));
		await fireEvent.click(screen.getByTestId('test-avatar-done-btn'));

		expect(onpick, 'вибір зберігається самим натиском, а не «Готово»').toHaveBeenCalledOnce();
		expect(screen.getByTestId('test-avatar-modal').hasAttribute('open')).toBe(false);
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('test-avatar-panel')).toBeNull();
		expect(document.activeElement).toBe(toggle);
	});

	it('клік по тлу закриває, а клік усередині вікна — ні', async () => {
		const { toggle } = mounted();
		await fireEvent.click(toggle);
		await screen.findByTestId('test-avatar-color-red-radio');
		const dialog = screen.getByTestId('test-avatar-modal');

		await fireEvent.click(screen.getByTestId('test-avatar-panel'));
		expect(dialog.hasAttribute('open'), 'клік по вікну — не по тлу').toBe(true);

		await fireEvent.click(dialog);
		expect(dialog.hasAttribute('open')).toBe(false);
		expect(document.activeElement).toBe(toggle);
	});
	/**
	 * У КІМНАТІ — лише вільні пари (рішення автора 2026-09-26). Зайнята клітинка
	 * лишається на місці, але не натискається, і підпис каже, чия вона: зникла
	 * клітинка читалася б як «такого кольору немає».
	 *
	 * Зворотний експеримент: не вимикати зайняту — червоніє «не натиснути».
	 */
	it('зайняту пару видно, але не натиснути, і підпис каже чия', async () => {
		const { toggle, onpick } = mounted('cat:blue', new Map([['cat:red', 'Анна']]));
		await fireEvent.click(toggle);
		const red = (await screen.findByTestId('test-avatar-color-red-radio')) as HTMLInputElement;

		expect(red.disabled).toBe(true);
		expect(red.getAttribute('aria-label')).toBe('колір red — зайнято: Анна');
		await fireEvent.click(red);
		expect(onpick).not.toHaveBeenCalled();

		const green = screen.getByTestId('test-avatar-color-green-radio') as HTMLInputElement;
		expect(green.disabled, 'вільна пара — вільна').toBe(false);
	});
});
