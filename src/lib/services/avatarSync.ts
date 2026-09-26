import { hasAccount } from './accountFlag';
import { logService } from './logService.svelte';
import { profileName } from './nameSync';

/**
 * АВАТАРКУ ВИБРАЛИ ПОЗА ПРОФІЛЕМ — наздогнати профіль.
 *
 * Доти аватарку вибирали лише на `/account/`, і там її зберігає `Account.saveAvatar`.
 * Тепер вибір є й у формі входу в кімнату (прохання автора 2026-09-26: «будь-яку
 * на сторінці переліку кімнат»), і без цього кроку профіль лишався б зі старою
 * плиткою — тобто на іншому пристрої й у таблиці лідерів людина була б іншою.
 *
 * Та сама межа, що в `pushName` і `Account.saveAvatar`, і з тієї самої причини:
 * запис у `profile/avatar` на порожньому місці створив би профіль З ОДНОГО АВАТАРА
 * (батьківський `.validate` при записі в дитину не переоцінюється). Тому писати
 * можна лише тоді, коли профіль уже є, — і відповідь на «чи є» дає `profileName()`:
 * вона читає профіль раз на сесію й віддає порожньо, коли його немає.
 *
 * НЕ КИДАЄ: це підпис, а не дія, і невдача не має права ламати вибір. Сховище вже
 * тримає нову плитку (`playerAvatar`), а профіль наздожене наступним вибором або
 * «Зберегти» на сторінці акаунта.
 */
export async function pushAvatar(avatar: string): Promise<void> {
	if (avatar === '' || !hasAccount()) return;
	try {
		if ((await profileName()) === '') return;

		const account = await import('$lib/net/account');
		await account.saveAvatar(avatar);

		// Рядок у таблиці лідерів несе аватар — той самий крок робить `Account.saveAvatar`.
		const sync = await import('./playerSync');
		await sync.refreshProfile();
	} catch (error) {
		logService.warn('network', 'profile avatar not updated', { reason: String(error) });
	}
}
