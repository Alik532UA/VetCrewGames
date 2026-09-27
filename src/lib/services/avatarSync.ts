import { normaliseAvatar } from '$lib/config/avatars';
import { hasAccount } from './accountFlag';
import { logService } from './logService.svelte';
import { profileAvatar, profileName } from './nameSync';
import { playerAvatar } from './playerAvatar.svelte';

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

/** Аватарку з профілю в цій сесії вже тягнули: вхід в акаунт — раз, а не на кожну сторінку. */
let pulled = false;

/**
 * АВАТАРКА З ПРОФІЛЮ — ПРИ ВХОДІ В АКАУНТ НА БУДЬ-ЯКОМУ ПРИСТРОЇ (рішення автора
 * 2026-09-27, 11-A: «профільна: підтягується при вході в акаунт на будь-якому пристрої»).
 *
 * Доти профільна аватарка доїжджала на пристрій, лише коли людина відкривала сторінку
 * акаунта, — а в лобі й у шапці стояла та, що лежала в сховищі цього пристрою, тепер —
 * випадкова з першого візиту (8-A). Тягне форма входу в кімнату (`PlayerIdentity.load`).
 *
 * РАЗ НА СЕСІЮ, і лише якщо поки читали, людина не вибрала іншу: свіжий вибір головніший
 * за те, що приїхало, а читання, повторене пізніше, принесло б профіль, який сесія вже
 * сама переписала. Значок, якого більше немає, — твариною того самого кольору (13-A).
 *
 * НЕ КИДАЄ: це підпис, а не дія (`profileAvatar` не кидає теж).
 */
export async function pullAvatar(): Promise<void> {
	if (pulled || !hasAccount()) return;
	pulled = true;
	const before = playerAvatar.value;
	const avatar = normaliseAvatar(await profileAvatar());
	if (avatar === '' || avatar === before || playerAvatar.value !== before) return;
	playerAvatar.set(avatar);
}

/** Вихід з акаунта: наступний вхід — можливо, в інший акаунт — тягне аватарку знову. */
export function forgetPulledAvatar(): void {
	pulled = false;
}
