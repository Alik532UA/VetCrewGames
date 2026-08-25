// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ОДНЕ ІМʼЯ: профіль — правда, сховище — кеш.
 *
 * ## Що тут головне
 *
 * МЕЖА «Є КУДИ ПИСАТИ». Запис у `profile/name` на порожньому місці створив би
 * профіль з одного імені, без @ніка: `.validate` батьківського вузла
 * (`hasChildren(['name','handle'])`) при записі в дитину не переоцінюється. Тобто
 * анонім або незаповнений акаунт мусить лишати базу недоторканою, і саме це
 * перевіряється трьома різними шляхами.
 *
 * Друге — ЦІНА ЧИТАННЯ. Профіль читається раз на сесію: `load()` контролера
 * перезапускається на кожну зміну мови й переліку зайнятих імен, і без кешу той
 * самий `get` ішов би в базу знову й знову.
 */

let flagged = true;
const readProfile = vi.fn<(uid: string) => Promise<{ name: string } | null>>(async () => ({
	name: 'Уважний Олень'
}));
const saveName = vi.fn<(name: string) => Promise<void>>(async () => {});
const refreshProfile = vi.fn<() => Promise<void>>(async () => {});

vi.mock('./accountFlag', () => ({ hasAccount: () => flagged }));
vi.mock('./logService.svelte', () => ({ logService: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('$lib/net/firebase', () => ({ connect: async () => ({ uid: 'uid-me' }) }));
vi.mock('$lib/net/account', () => ({ readProfile, saveName }));
vi.mock('./playerSync', () => ({ refreshProfile }));

/** Свіжий модуль на кожен випадок: кеш профілю живе в модульній змінній. */
async function fresh() {
	vi.resetModules();
	return import('./nameSync');
}

describe('синхронізація імені', () => {
	beforeEach(() => {
		flagged = true;
		readProfile.mockReset().mockResolvedValue({ name: 'Уважний Олень' });
		saveName.mockReset().mockResolvedValue(undefined);
		refreshProfile.mockReset().mockResolvedValue(undefined);
	});

	it('віддає імʼя з профілю', async () => {
		const { profileName } = await fresh();

		expect(await profileName()).toBe('Уважний Олень');
	});

	/**
	 * Зворотний експеримент (§ 1.1): прибрати `if (!hasAccount()) return ''` —
	 * червоніє цей випадок, а кожен відвідувач без акаунта тягнув би SDK бази на
	 * екран входу в кімнату.
	 */
	it('без акаунта в мережу не ходить зовсім', async () => {
		flagged = false;
		const { profileName } = await fresh();

		expect(await profileName()).toBe('');
		expect(readProfile).not.toHaveBeenCalled();
	});

	it('профіль читається раз на сесію', async () => {
		const { profileName } = await fresh();

		await profileName();
		await profileName();

		expect(
			readProfile,
			'той самий get на кожну зміну мови — це трафік ні за що'
		).toHaveBeenCalledTimes(1);
	});

	it('порожній профіль не стає імʼям', async () => {
		readProfile.mockResolvedValue(null);
		const { profileName } = await fresh();

		expect(await profileName()).toBe('');
	});

	it('невдача мережі лишає імʼя порожнім, а не кидає', async () => {
		readProfile.mockRejectedValue(new Error('offline'));
		const { profileName } = await fresh();

		await expect(profileName()).resolves.toBe('');
	});

	describe('запис назад', () => {
		it('пише нове імʼя й оновлює рядок таблиці лідерів', async () => {
			const { profileName, pushName } = await fresh();
			await profileName();

			await pushName('Швидкий Леопард');

			expect(saveName).toHaveBeenCalledWith('Швидкий Леопард');
			expect(refreshProfile, 'інакше в таблиці лідерів лишиться старе імʼя').toHaveBeenCalled();
		});

		it('те саме імʼя другого запису не робить', async () => {
			const { profileName, pushName } = await fresh();
			await profileName();

			await pushName('Уважний Олень');

			expect(saveName).not.toHaveBeenCalled();
		});

		/**
		 * Профілю немає — писати нікуди: інакше вийшов би профіль з одного імені,
		 * без @ніка, і прочитався б він як профіль, якого людина не заповнювала.
		 */
		it('без профілю не пише нічого', async () => {
			readProfile.mockResolvedValue(null);
			const { pushName } = await fresh();

			await pushName('Швидкий Леопард');

			expect(saveName).not.toHaveBeenCalled();
		});

		it('без акаунта не пише й не читає', async () => {
			flagged = false;
			const { pushName } = await fresh();

			await pushName('Швидкий Леопард');

			expect(readProfile).not.toHaveBeenCalled();
			expect(saveName).not.toHaveBeenCalled();
		});

		/** Людина натиснула швидше, ніж приїхав профіль: імʼя не мусить загубитися. */
		it('дочитує профіль, якщо його ще не читали', async () => {
			const { pushName } = await fresh();

			await pushName('Швидкий Леопард');

			expect(readProfile).toHaveBeenCalledTimes(1);
			expect(saveName).toHaveBeenCalledWith('Швидкий Леопард');
		});

		it('невдача запису не кидає у вхід у кімнату', async () => {
			saveName.mockRejectedValue(new Error('denied'));
			const { profileName, pushName } = await fresh();
			await profileName();

			await expect(pushName('Швидкий Леопард')).resolves.toBeUndefined();
		});
	});
});
