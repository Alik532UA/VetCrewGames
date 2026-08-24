import { connect } from './firebase';
import { setSearchable } from './account';
import { logService } from '$lib/services/logService.svelte';

/**
 * ПРИВАТНІСТЬ: три перемикачі, і кожен тримає ПРАВИЛО БАЗИ, а не екран.
 *
 * ## Що саме вони вимикають
 *
 * `search` — бути в пошуку людей. Правило `find/$handle` не дає створити запис
 * тому, у кого цей перемикач `false`, тож вимкнений пошук — це відсутність у
 * індексі, а не фільтр на клієнті.
 *
 * `follow` — дозволяти підписуватися на себе. Правило `users/$uid/followers/$who`
 * відмовляє в записі, тобто підписка не з'являється взагалі.
 *
 * `board` — показуватися в таблиці лідерів. Правило `leaders/$uid` не дає
 * створити запис.
 *
 * ## Чому не «фільтр на екрані»
 *
 * Бо тут ідеться саме про «мене не мусить бачити незнайомий», а клієнтський
 * фільтр приховує лише від того, хто дивиться екраном. У сусідньому `Slovko` ці
 * самі три перемикачі тримає клієнт — і в правилах там прямо написано, що
 * приватного в публічній колекції немає, бо інакше зламався б лідерборд. Тут
 * гілки розділені саме для того, щоб межу можна було покласти в базу.
 *
 * ## Відсутність = згода
 *
 * Вузла немає, доки людина не торкалася перемикачів, і всі, хто зареєструвався до
 * їхньої появи, лишаються знаходимими. Тому й правила питають `!= false`, і типове
 * значення тут — `true`.
 */

export interface Privacy {
	/** Бути в пошуку людей. */
	search: boolean;
	/** Дозволяти підписуватися на себе. */
	follow: boolean;
	/** Показуватися в таблиці лідерів. */
	board: boolean;
}

/** Типово дозволено все: див. «відсутність = згода» вище. */
export const OPEN_PRIVACY: Privacy = { search: true, follow: true, board: true };

/**
 * Прочитати свої перемикачі. Не кидає: невдача означає типові значення.
 *
 * Помилка тут не варта екрана — вона означала б «показати перемикачі як
 * вимкнені», тобто збрехати про стан, який людина не міняла.
 */
export async function readPrivacy(): Promise<Privacy> {
	try {
		const { uid, db } = await connect();
		const { get, ref } = await import('firebase/database');
		const snapshot = await get(ref(db, `users/${uid}/privacy`));
		if (!snapshot.exists()) return { ...OPEN_PRIVACY };
		const saved = snapshot.val() as Partial<Privacy>;
		return {
			search: saved.search !== false,
			follow: saved.follow !== false,
			board: saved.board !== false
		};
	} catch (error) {
		logService.warn('network', 'privacy not read', { reason: String(error) });
		return { ...OPEN_PRIVACY };
	}
}

/**
 * Зберегти перемикачі — і привести індекс пошуку у відповідність.
 *
 * ## Порядок: спершу ПЕРЕМИКАЧ, потім індекс
 *
 * Він не випадковий. Правило `find` дозволяє створити запис лише тому, у кого
 * `privacy/search` уже не `false`, тож зворотний порядок відмовляв би в записі
 * власним же перемикачем. А на вимкненні порядок дає інше: доки запис іще в
 * індексі, перемикач уже забороняє його повернути.
 *
 * ## КИДАЄ
 *
 * Це дія, яку людина щойно натиснула, і мовчазна невдача тут означала б
 * перемикач, що клацнув на екрані й нічого не змінив у базі.
 */
export async function savePrivacy(next: Privacy, handle: string | null): Promise<void> {
	const { uid, db } = await connect();
	const { ref, set } = await import('firebase/database');
	await set(ref(db, `users/${uid}/privacy`), {
		search: next.search,
		follow: next.follow,
		board: next.board
	});

	// Без псевдоніма індексувати нічого: профілю ще немає.
	if (handle) await setSearchable(handle, next.search);
}
