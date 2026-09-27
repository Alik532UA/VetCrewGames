// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * АВАТАРКУ ВИБРАЛИ У ФОРМІ ВХОДУ — профіль наздоганяє.
 *
 * Головне тут та сама межа, що в `nameSync.test.ts`: «є куди писати». Запис у
 * `profile/avatar` на порожньому місці створив би профіль з одного аватара, тож
 * анонім і незаповнений акаунт мусять лишати базу недоторканою.
 *
 * Зворотний експеримент: прибрати перевірку `profileName() === ''` — червоніє
 * «без профілю»; прибрати `hasAccount()` — червоніє «без акаунта».
 */

let flagged = true;
const profileName = vi.fn<() => Promise<string>>(async () => 'Уважний Олень');
const profileAvatar = vi.fn<() => Promise<string>>(async () => 'cat:blue');
const playerAvatar = {
	value: 'grape:olive',
	set: vi.fn((next: string) => void (playerAvatar.value = next))
};
const saveAvatar = vi.fn<(avatar: string) => Promise<void>>(async () => {});
const refreshProfile = vi.fn<() => Promise<void>>(async () => {});
const warn = vi.fn();

vi.mock('./accountFlag', () => ({ hasAccount: () => flagged }));
vi.mock('./logService.svelte', () => ({ logService: { warn, error: vi.fn() } }));
vi.mock('./nameSync', () => ({ profileName, profileAvatar }));
vi.mock('./playerAvatar.svelte', () => ({ playerAvatar }));
vi.mock('$lib/net/account', () => ({ saveAvatar }));
vi.mock('./playerSync', () => ({ refreshProfile }));

const { forgetPulledAvatar, pullAvatar, pushAvatar } = await import('./avatarSync');

describe('аватарка з форми входу — у профіль', () => {
	beforeEach(() => {
		flagged = true;
		profileName.mockReset().mockResolvedValue('Уважний Олень');
		saveAvatar.mockReset().mockResolvedValue(undefined);
		refreshProfile.mockReset().mockResolvedValue(undefined);
		warn.mockReset();
	});

	it('профіль є — пише аватарку й оновлює рядок таблиці лідерів', async () => {
		await pushAvatar('cat:blue');

		expect(saveAvatar).toHaveBeenCalledWith('cat:blue');
		expect(refreshProfile).toHaveBeenCalledTimes(1);
	});

	it('без акаунта в мережу не ходить зовсім', async () => {
		flagged = false;
		await pushAvatar('cat:blue');

		expect(profileName).not.toHaveBeenCalled();
		expect(saveAvatar).not.toHaveBeenCalled();
	});

	it('без профілю не пише: інакше вийшов би профіль з одного аватара', async () => {
		profileName.mockResolvedValue('');
		await pushAvatar('cat:blue');

		expect(saveAvatar).not.toHaveBeenCalled();
	});

	it('невдача не кидає — лише запис у журнал', async () => {
		saveAvatar.mockRejectedValue(new Error('offline'));

		await expect(pushAvatar('cat:blue')).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledWith('network', 'profile avatar not updated', {
			reason: 'Error: offline'
		});
	});
});

/**
 * АВАТАРКА З ПРОФІЛЮ — ПРИ ВХОДІ В АКАУНТ НА БУДЬ-ЯКОМУ ПРИСТРОЇ (рішення автора
 * 2026-09-27, 11-A).
 *
 * Зворотні експерименти: прибрати `pulled` — червоніє «раз на сесію»; не звіряти
 * значення до й після читання — червоніє «свіжий вибір головніший».
 */
describe('аватарка з профілю — на пристрій', () => {
	beforeEach(() => {
		flagged = true;
		forgetPulledAvatar();
		playerAvatar.value = 'grape:olive';
		playerAvatar.set.mockClear();
		profileAvatar.mockReset().mockResolvedValue('cat:blue');
	});

	it('акаунт — профільна аватарка стає аватаркою пристрою', async () => {
		await pullAvatar();

		expect(playerAvatar.set).toHaveBeenCalledWith('cat:blue');
	});

	it('раз на сесію: повторне відкриття сторінки профілю не читає', async () => {
		await pullAvatar();
		await pullAvatar();

		expect(profileAvatar).toHaveBeenCalledTimes(1);
	});

	it('після виходу з акаунта наступний вхід тягне знову', async () => {
		await pullAvatar();
		forgetPulledAvatar();
		await pullAvatar();

		expect(profileAvatar).toHaveBeenCalledTimes(2);
	});

	it('свіжий вибір головніший: поки читали, людина вибрала іншу', async () => {
		profileAvatar.mockImplementation(async () => {
			playerAvatar.value = 'rat:magenta';
			return 'cat:blue';
		});
		await pullAvatar();

		expect(playerAvatar.set).not.toHaveBeenCalled();
		expect(playerAvatar.value).toBe('rat:magenta');
	});

	it('значок, якого більше немає, — твариною того самого кольору', async () => {
		profileAvatar.mockResolvedValue('star:red');
		await pullAvatar();

		expect(playerAvatar.set).toHaveBeenCalledWith(expect.stringMatching(/^[a-z]+:red$/));
		expect(playerAvatar.set).not.toHaveBeenCalledWith('star:red');
	});

	it('без акаунта в мережу не ходить', async () => {
		flagged = false;
		await pullAvatar();

		expect(profileAvatar).not.toHaveBeenCalled();
	});
});
