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

/**
 * СКАЗАТИ, НА ЯКУ КАРТКУ Я ДИВЛЮСЯ. `null` — ні на яку.
 *
 * Прохання автора: «наведення на картку — бачать усі в грі». Живе це в
 * присутності, а не в журналі ходів: журнал — правда про партію, з якої кожен
 * відтворює дошку, а наведення стану партії не змінює. У журналі воно ще й
 * лишалося б назавжди — сотні записів, які всі перепрогонюють щознімка.
 *
 * ПИШЕТЬСЯ ПОДІЯ, А НЕ РУХ, і це поправка автора: «не треба кожний рух курсора
 * записувати, а тільки саму подію наведення — навіщо знати, що гравець водить по
 * картці курсором, і забивати трафік». Тому виклик стоїть на `pointerenter` і
 * `pointerleave`, тобто кілька записів на хід, а не кілька на секунду.
 *
 * НЕ КИДАЄ: підсвітка — довідка, і її несправність не має права ламати партію.
 * Той самий підхід, що в `touch()` у транспорті кімнати.
 */
export async function setHover(code: string, card: number | null): Promise<void> {
	try {
		const { uid, db } = await connect();
		const { ref, remove, set } = await import('firebase/database');
		const mine = ref(db, `presence/${code}/${uid}/hover`);
		await (card === null ? remove(mine) : set(mine, card));
	} catch {
		// Тихо: наступне наведення спробує знову, а партія від цього не залежить.
	}
}

/**
 * На що дивляться ІНШІ: uid → індекс картки.
 *
 * Окрема підписка на ту саму гілку, а не розширення `watchPresence`: той
 * відповідає на «хто онлайн» і потрібен ОБОМ іграм, а підсвітка — лише «Знайди
 * пару». Обидві слухають один шлях, тож база віддає його один раз.
 *
 * Себе з переліку прибираємо тут, а не на екрані: свою підсвітку гравець і так
 * бачить курсором, а власна пунктирна рамка поверх наведення читалася б як другий,
 * незрозумілий стан.
 */
export async function watchHovers(
	code: string,
	onChange: (byUid: Record<string, number>) => void
): Promise<() => void> {
	const { uid, db } = await connect();
	const { off, onValue, ref } = await import('firebase/database');
	const branch = ref(db, `presence/${code}`);
	const handler = onValue(branch, (snapshot) => {
		const out: Record<string, number> = {};
		const all = (snapshot.val() ?? {}) as Record<string, { hover?: number }>;
		for (const [who, node] of Object.entries(all)) {
			if (who !== uid && typeof node?.hover === 'number') out[who] = node.hover;
		}
		onChange(out);
	});
	return () => off(branch, 'value', handler);
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
