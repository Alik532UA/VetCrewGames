import { connect } from './firebase';
import { readProfile, type Profile } from './account';
import { logService } from '$lib/services/logService.svelte';

/**
 * ПІДПИСКИ, і друзі як їхня взаємність.
 *
 * ## Дві половини, а не дві копії
 *
 * `users/{uid}/following/{target}` відповідає «на кого підписаний я»,
 * `users/{target}/followers/{uid}` — «хто підписаний на нього». Це РІЗНІ питання,
 * і обидва треба відповідати одним читанням: без дзеркала друге вимагало б
 * перебрати всіх користувачів.
 *
 * Шлях запису в кожну половину один, і саме тому це не дублювання: у `following`
 * пише лише власник, у `followers` — лише той, хто підписується. Правило бази
 * звужує обидва (CLOUD-DATABASE-v8 § 5.2).
 *
 * ## ДРУГ — ВЗАЄМНА ПІДПИСКА
 *
 * Так само, як у сусідньому `Slovko`, і причина не в наслідуванні: односторонню
 * підписку видно лише тому, хто підписався, а «друзі» — це відношення, у якому
 * обидва погодилися. Перевірити взаємність можна рівно одним способом —
 * подивившись з обох боків, і саме тому дзеркало обовʼязкове.
 *
 * ## Порядок запису: СПЕРШУ ДЗЕРКАЛО
 *
 * `followers` пише сам підписник, тобто ця половина може не вийти лише через
 * мережу. `following` після неї не відмовить нікому. У зворотному порядку існував
 * би стан «я підписаний, а він про це не знає» — і виправити його могла б лише
 * та сторона, яка вже пішла.
 */

/** Хто вважається другом: підписка є з обох боків. */
export interface Friend {
	profile: Profile;
	/** Чи взаємно. `false` — я підписаний, а він на мене ні. */
	mutual: boolean;
}

/**
 * Підписатися. Ідемпотентно: повторний виклик перезаписує ту саму позначку.
 *
 * КИДАЄ, і навмисно: підписка — це дія, яку людина щойно натиснула, і мовчазна
 * невдача тут виглядала б як «кнопка не працює». Той самий висновок, що з
 * «Зіграти ще» в кімнаті.
 */
export async function follow(target: string): Promise<void> {
	const { uid, db } = await connect();
	if (target === uid) throw new Error('self-follow');

	const { ref, serverTimestamp, set } = await import('firebase/database');
	// Спершу дзеркало: цю половину пише сам підписник, тож саме вона може не
	// вийти. Друга після неї не відмовить.
	await set(ref(db, `users/${target}/followers/${uid}`), { at: serverTimestamp() });
	await set(ref(db, `users/${uid}/following/${target}`), { at: serverTimestamp() });
}

/**
 * Відписатися.
 *
 * Порядок тут зворотний до підписки, і це не симетрія заради симетрії: спершу
 * зникає МОЯ половина. Якщо друга не зникне, лишиться запис «він підписаний на
 * мене» без відповідної підписки — сміття, яке нікого не називає другом
 * (взаємність перевіряється з обох боків). Зворотний порядок лишав би зворотне:
 * я підписаний на того, хто про мене вже не знає.
 */
export async function unfollow(target: string): Promise<void> {
	const { uid, db } = await connect();
	const { ref, remove } = await import('firebase/database');
	await remove(ref(db, `users/${uid}/following/${target}`));
	await remove(ref(db, `users/${target}/followers/${uid}`));
}

/** Чи підписаний я на цього. */
export async function isFollowing(target: string): Promise<boolean> {
	try {
		const { uid, db } = await connect();
		const { get, ref } = await import('firebase/database');
		return (await get(ref(db, `users/${uid}/following/${target}`))).exists();
	} catch (error) {
		logService.warn('network', 'follow state unknown', { reason: String(error) });
		return false;
	}
}

/**
 * Мої підписки з позначкою взаємності.
 *
 * ## Чому це два читання, а не одне
 *
 * Взаємність — це факт із ДВОХ гілок: моє `following` і моє `followers`. Одним
 * читанням її не дістати, і не через недогляд схеми: підписка за побудовою
 * одностороння, а «друзі» — це збіг двох односторонніх.
 *
 * Читаємо обидві свої гілки (по одному запиту) і перетинаємо ключі. Профілі потім
 * — паралельно, і невдалі просто зникають зі списку: профіль міг не встигнути
 * створитися, і рядок без імені гірший за відсутній.
 *
 * НЕ КИДАЄ: список друзів — довідка, і його відсутність лишає сторінку такою,
 * якою вона була до появи підписок.
 */
export async function listFollowing(): Promise<Friend[]> {
	try {
		const { uid, db } = await connect();
		const { get, ref } = await import('firebase/database');

		const [following, followers] = await Promise.all([
			get(ref(db, `users/${uid}/following`)),
			get(ref(db, `users/${uid}/followers`))
		]);

		const targets = Object.keys((following.val() ?? {}) as Record<string, unknown>);
		const back = new Set(Object.keys((followers.val() ?? {}) as Record<string, unknown>));

		const profiles = await Promise.all(
			targets.map((target) => readProfile(target).catch(() => null))
		);

		return profiles
			.map((profile, index) =>
				profile === null ? null : { profile, mutual: back.has(targets[index]) }
			)
			.filter((friend): friend is Friend => friend !== null);
	} catch (error) {
		logService.warn('network', 'following not listed', { reason: String(error) });
		return [];
	}
}

/**
 * `uid` моїх друзів — тих, із кимось підписка ВЗАЄМНА.
 *
 * Окремо від `listFollowing`, бо відповідає на інше питання й потрібне в іншому
 * місці: перелік кімнат закріплює зверху кімнати друзів, і йому потрібні саме
 * `uid`, а не профілі. Читати профілі заради цього означало б стільком запитів,
 * скільки підписок, — на екрані, де їх ніхто не побачить.
 */
export async function friendUids(): Promise<string[]> {
	try {
		const { uid, db } = await connect();
		const { get, ref } = await import('firebase/database');

		const [following, followers] = await Promise.all([
			get(ref(db, `users/${uid}/following`)),
			get(ref(db, `users/${uid}/followers`))
		]);

		const mine = Object.keys((following.val() ?? {}) as Record<string, unknown>);
		const back = new Set(Object.keys((followers.val() ?? {}) as Record<string, unknown>));
		return mine.filter((target) => back.has(target));
	} catch (error) {
		logService.warn('network', 'friends not listed', { reason: String(error) });
		return [];
	}
}
