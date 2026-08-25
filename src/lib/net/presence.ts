import { connect } from './firebase';

/**
 * Усе, що тримається на `onDisconnect` — тобто на обіцянці, яку виконує СЕРВЕР,
 * коли клієнт зник.
 *
 * **Чому це окремий модуль, а не частина кімнати.** Тут інша природа записів:
 * кімната й журнал ходів — це те, що застосунок пише навмисно й що мусить
 * переживати обрив звʼязку. Присутність — навпаки: вона існує рівно доти, доки
 * живий сокет, і зникає без жодної участі коду. Змішані в одному файлі, ці дві
 * речі читаються як одна, і з'являється спокуса «прибирати учасника при обриві»
 * (§ 9.2 канону — саме те, чого робити не можна: склад задає роздачу, тож чийсь
 * тунель у метро перероздав би дошку всім).
 *
 * **Чому взагалі RTDB, а не Firestore.** Через `onDisconnect()`. У грі на двох
 * питання «суперник вийшов чи просто думає» вирішує, чи партія зависне назавжди;
 * у Firestore такого механізму немає, і офіційна порада — підключити поруч RTDB.
 * Тобто «лише Firestore» тут закінчилося б ДВОМА базами
 * (CLOUD-DATABASE-v8 § 5.1).
 */

/**
 * Кімната, у яку ніхто не зайшов, зникає разом із вкладкою господаря.
 *
 * **Прибирає сервер, а не клієнт, і це принципово.** Спокуса зробити «зачистку
 * старих кімнат при вході в лобі» дорого коштує: щоб прибирати чуже, потрібне
 * право видаляти чуже — тобто дірка в правилах, яка заразом є готовим примітивом
 * «видалити всі кімнати». Тут прав не додається взагалі: господар і так може
 * знести СВОЮ кімнату, а `onDisconnect` лише виконує це за нього, коли він зник
 * (CLOUD-DATABASE-v8 § 9.3).
 *
 * **Лише в лобі.** Щойно партія почалася, домовленість скасовується: обрив
 * звʼязку посеред гри не має нищити партію, у яку ще хочуть повернутися. Тому
 * повернена функція кличеться і при старті партії, і при виході зі сторінки.
 *
 * Викликає лише господар — у інших це право просто не спрацює.
 */
export async function holdRoom(code: string): Promise<() => void> {
	const { db } = await connect();
	const { onDisconnect, ref } = await import('firebase/database');
	const room = ref(db, `rooms/${code}`);

	const handle = onDisconnect(room);
	await handle.remove();

	// Скасувати домовленість — це теж запит до сервера, і його результат нікому
	// не потрібен: якщо він не доїхав, кімната зникне, і це не втрата даних.
	return () => void handle.cancel();
}

/**
 * Тримати присутність: поки вкладка жива — запис є, зникла — Firebase прибере
 * його сам.
 *
 * Порядок тут не косметика: спершу домовляємось, ЩО прибрати, і лише тоді
 * зʼявляємось. У зворотному порядку існує вікно, у якому запис уже є, а
 * домовленості про його прибирання ще немає, — і зникнення клієнта в цю мить
 * лишає привида назавжди.
 */
export async function trackPresence(code: string): Promise<() => void> {
	const { uid, db } = await connect();
	const { onDisconnect, ref, remove, serverTimestamp, set } = await import('firebase/database');
	const mine = ref(db, `presence/${code}/${uid}`);

	await onDisconnect(mine).remove();
	await set(mine, { at: serverTimestamp() });

	return () => void remove(mine);
}

/** Хто зараз на звʼязку. Підписка, бо це найшвидша частина стану. */
export async function watchPresence(
	code: string,
	onChange: (online: string[]) => void
): Promise<() => void> {
	const { db } = await connect();
	const { off, onValue, ref } = await import('firebase/database');
	const branch = ref(db, `presence/${code}`);
	const handler = onValue(branch, (snapshot) => onChange(Object.keys(snapshot.val() ?? {})));
	return () => off(branch, 'value', handler);
}

/**
 * ЧИ Є В КІМНАТІ ХТОСЬ, КРІМ МЕНЕ — одним читанням.
 *
 * Потрібно це сповіщенню «вас чекають у грі»: скарга автора була саме про те, що
 * воно висіло, коли чекати вже нікому. Кімната при цьому виглядала живою — і
 * законно: позначку `aliveAt` оновлює КОЖЕН, хто в ній сидить, тобто моє власне
 * серцебиття лишало її свіжою ще дві хвилини після мого виходу.
 *
 * Присутність відповідає на інше питання, і саме на потрібне: не «коли тут
 * останній раз хтось був», а «хто тут ЗАРАЗ». Вона гасне сама (`onDisconnect`),
 * тож привидів у ній не буває.
 */
export async function othersPresent(code: string): Promise<number> {
	const { uid, db } = await connect();
	const { get, ref } = await import('firebase/database');
	const snapshot = await get(ref(db, `presence/${code}`));
	return Object.keys(snapshot.val() ?? {}).filter((other) => other !== uid).length;
}

/**
 * Підписка на те саме: скільки в кімнаті інших.
 *
 * Потрібна, щоб сповіщення гасло САМО, коли останній вийшов, — а не висіло, поки
 * людина не перейде на іншу сторінку.
 */
export async function watchOthers(
	code: string,
	onCount: (others: number) => void
): Promise<() => void> {
	const { uid, db } = await connect();
	const { off, onValue, ref } = await import('firebase/database');
	const branch = ref(db, `presence/${code}`);
	const handler = onValue(branch, (snapshot) =>
		onCount(Object.keys(snapshot.val() ?? {}).filter((other) => other !== uid).length)
	);
	return () => off(branch, 'value', handler);
}
