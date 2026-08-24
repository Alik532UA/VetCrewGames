import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';
import { readMyProfile } from './account';

/**
 * ВИДАЛЕННЯ АКАУНТА: спершу прибрати дані, аж тоді знести користувача.
 *
 * ## Чому порядок саме такий і не буває іншим
 *
 * Після `deleteUser()` токена більше немає, а правила бази вимагають
 * `auth != null` майже всюди. Тобто все, що не прибрано ДО, лишається в базі
 * назавжди — і прибрати це не зможе вже ніхто, включно з самою людиною.
 *
 * ## Що саме прибирається — і чому саме це
 *
 * Профіль, дані гри, рядок таблиці лідерів, псевдонім у реєстрі, запис у
 * пошуковому індексі, обидві половини кожної підписки й індекс своїх кімнат. Це
 * рівно те, що людина по собі лишає, і кожне з цього має бути прибиране ПРАВОМ,
 * яке в неї вже є: чужих вузлів тут не торкається ніщо.
 *
 * Дзеркала підписок — окремий випадок, і вони прибираються ОБИДВІ. Правило
 * `following/$target` дозволяє видалити запис і тому, на кого підписані
 * («прибери мене зі своїх підписок»), а `followers/$who` — самому підписнику.
 * Тобто права рівно на це вже є, і без другої половини в чужих списках лишилися
 * б рядки, що вказують у порожнє.
 *
 * У сусідньому `Slovko` видалення прибирає лише два документи, а підколекції
 * лишає: Firestore не видаляє їх разом із документом. Тут борг не переймається —
 * гілки RTDB видаляються цілком.
 *
 * ## КИДАЄ
 *
 * На відміну від решти мережевого шару. Людина натиснула «видалити акаунт», і
 * половина результату — найгірший можливий стан: тиха невдача виглядала б як
 * видалений акаунт, у який наступного дня можна ввійти.
 */

/**
 * Прибрати все своє, крім самого користувача.
 *
 * Окремо від `deleteAccount`, бо це різні відповідальності: тут — дані, там —
 * автентифікація. Розділення заразом робить прибирання перевірним без Auth.
 */
export async function eraseMyData(): Promise<void> {
	const { uid, db } = await connect();
	const { get, ref, remove, update } = await import('firebase/database');

	const profile = await readMyProfile();

	/*
	 * КІМНАТИ — перед індексом, і саме з нього.
	 *
	 * Індекс `myRooms/{uid}` — єдиний спосіб дізнатися свої коди: перелічити
	 * `rooms` заборонено правилом, і саме тому індекс існує. Прибрати кімнату
	 * може лише її господар, тож видалення індексу першим лишило б кімнати
	 * сиротами, яких не приберає вже ніхто.
	 *
	 * Кожне видалення під `catch`: кімната могла зникнути сама (`onDisconnect`
	 * господаря в лобі), і зупиняти через це видалення акаунта безглуздо.
	 */
	const index = await get(ref(db, `myRooms/${uid}`));
	for (const code of Object.keys((index.val() ?? {}) as Record<string, unknown>)) {
		await remove(ref(db, `rooms/${code}`)).catch((error: unknown) => {
			logService.warn('network', 'own room not removed', { reason: String(error), code });
		});
	}

	/*
	 * ПІДПИСКИ — обидві половини кожної, і за один `update` на напрямок.
	 *
	 * Багатошляховий запис тут не оптимізація, а атомарність: інакше існував би
	 * стан «мене вже немає в його підписниках, але його ще є в моїх підписках», і
	 * зупинка посеред циклу лишала б саме його.
	 */
	const following = await get(ref(db, `users/${uid}/following`));
	const followers = await get(ref(db, `users/${uid}/followers`));

	const wipe: Record<string, null> = {};
	following.forEach((child) => {
		wipe[`users/${uid}/following/${child.key}`] = null;
		wipe[`users/${child.key}/followers/${uid}`] = null;
	});
	followers.forEach((child) => {
		wipe[`users/${uid}/followers/${child.key}`] = null;
		wipe[`users/${child.key}/following/${uid}`] = null;
	});
	if (Object.keys(wipe).length > 0) await update(ref(db), wipe);

	// Псевдонім і пошуковий індекс: обидва ключі — свої, обидва звільняються.
	if (profile?.handle) {
		await remove(ref(db, `handles/${profile.handle}`));
		await remove(ref(db, `find/${profile.handle}`));
	}

	await remove(ref(db, `leaders/${uid}`));
	await remove(ref(db, `myRooms/${uid}`));
	await remove(ref(db, `users/${uid}`));
}

/**
 * Видалити акаунт: повторна автентифікація, прибирання даних, `deleteUser`.
 *
 * ## Чому повторна автентифікація обов'язкова
 *
 * Firebase вимагає свіжого входу для незворотних дій і відмовляє з
 * `auth/requires-recent-login`. Ловити цю відмову й показувати її людині означало
 * б показати незрозуміле слово після натискання «видалити»; тому вхід
 * підтверджується ДО, і саме тим способом, яким людина входила: паролем або
 * вікном Google.
 *
 * У сусідньому `MindStep` цього немає взагалі — там `deleteUser` кличеться
 * прямо, і на старій сесії він просто відмовляє.
 *
 * @param password пароль, якщо акаунт на пошті. Для Google не потрібен.
 */
export async function deleteAccount(password?: string): Promise<void> {
	const { auth } = await connect();
	const user = auth.currentUser;
	if (!user) throw new Error('no-user');

	const {
		EmailAuthProvider,
		GoogleAuthProvider,
		deleteUser,
		reauthenticateWithCredential,
		reauthenticateWithPopup
	} = await import('firebase/auth');

	const byGoogle = user.providerData.some((provider) => provider.providerId === 'google.com');
	if (password && user.email) {
		await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
	} else if (byGoogle) {
		await reauthenticateWithPopup(user, new GoogleAuthProvider());
	} else if (!user.isAnonymous) {
		// Пароля не дали, а Google тут немає: підтвердити нічим, і `deleteUser`
		// відмовив би сам — тільки повідомленням, якого людина не зрозуміє.
		throw Object.assign(new Error('password required'), { code: 'auth/missing-password' });
	}

	await eraseMyData();
	await deleteUser(user);
}

/**
 * Змінити пароль. Так само з повторною автентифікацією — і з тієї самої причини.
 *
 * КИДАЄ з кодом Firebase: «пароль не той» і «новий надто простий» вимагають
 * різних дій, і сховати їх за одним «не вдалося» означало б лишити людину гадати.
 */
export async function changePassword(current: string, next: string): Promise<void> {
	const { auth } = await connect();
	const user = auth.currentUser;
	if (!user?.email) throw new Error('no-password-account');

	const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import(
		'firebase/auth'
	);
	await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
	await updatePassword(user, next);
}
