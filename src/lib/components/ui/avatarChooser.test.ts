import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { AVATAR_COLORS, AVATAR_ICONS } from '$lib/config/avatars';

/**
 * АВАТАРКА ПОРУЧ З ІМЕНЕМ (прохання автора 2026-09-26): плитка-кнопка у формі входу,
 * під рядком розгортається вибір.
 *
 * Головне тут — три речі, яких не видно в коді з першого погляду:
 *
 *  • вибір ЗАКРИТИЙ, доки його не відкрили, і словник підписів (лінивий чанк) до
 *    того не вантажиться — інакше кожне відкриття форми тягло б `i18n/account`;
 *  • до приїзду словника радіокнопок немає зовсім: без підписів вони озвучувалися
 *    б як «кнопка» двадцять два рази;
 *  • натиск на плитку віддає ПАРУ (`значок:колір`), складену з поточною половиною.
 *
 * Зворотний експеримент: вантажити словник одразу — червоніє «закритий»; віддавати
 * лише колір — червоніє «пара».
 */

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

	it('не вибирали нічого — видно типову плитку, а не порожнє місце', async () => {
		const { toggle } = mounted('');
		await fireEvent.click(toggle);
		const teal = (await screen.findByTestId('test-avatar-color-teal-radio')) as HTMLInputElement;
		expect(teal.checked, 'типова — `user:teal`').toBe(true);
	});

	it('закриває та сама плитка, що відкрила', async () => {
		const { toggle } = mounted();
		await fireEvent.click(toggle);
		await screen.findByTestId('test-avatar-color-red-radio');

		await fireEvent.click(toggle);

		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByTestId('test-avatar-panel')).toBeNull();
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
