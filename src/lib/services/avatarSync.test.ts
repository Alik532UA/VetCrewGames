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
const saveAvatar = vi.fn<(avatar: string) => Promise<void>>(async () => {});
const refreshProfile = vi.fn<() => Promise<void>>(async () => {});
const warn = vi.fn();

vi.mock('./accountFlag', () => ({ hasAccount: () => flagged }));
vi.mock('./logService.svelte', () => ({ logService: { warn, error: vi.fn() } }));
vi.mock('./nameSync', () => ({ profileName }));
vi.mock('$lib/net/account', () => ({ saveAvatar }));
vi.mock('./playerSync', () => ({ refreshProfile }));

const { pushAvatar } = await import('./avatarSync');

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
