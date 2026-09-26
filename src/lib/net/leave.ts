import { isDenied } from './denied';
import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';
import { forgetOwnRoom } from './ownRooms';
import { moveKey } from './roomShape';

/*
 * Окремо від `rtdbRoom.ts`: це не дія над партією, а вихід із неї, і кличе її не
 * сторінка кімнати, а смуга «Вас чекають» (`controllers/awaitedRoom.svelte.ts`).
 * Заразом транспорт стояв на межі розміру (`structure.test.ts`).
 */

/**
 * ПІТИ З КІМНАТИ НАЗОВСІМ — прибрати свій рядок складу.
 *
 * Правило бази це дозволяє й без нового права: «кожен пише лише про себе — і про
 * себе ж може піти». Тобто це не адміністрування, а власна дія.
 *
 * Наслідок для решти настає САМ: `away` виводиться як «склад мінус присутні», тож
 * щойно рядка немає, чекати стає нема на кого — вікно очікування зникає в усіх, і
 * голосувати не доводиться. Саме цього й просив автор: «кімната дізнається, що
 * гравець остаточно вийшов, і його не варто чекати».
 *
 * Індекс своїх кімнат чиститься теж — ТУТ, а не тим, хто кличе: інакше сповіщення
 * «вас чекають» показувало б кімнату, з якої я щойно свідомо пішов. Доти це робив
 * виклик у смузі поруч, а докблок обіцяв, що робить `leaveRoom`, — наступний, хто
 * покликав би лише його, лишив би привида (аудит 2026-09-24).
 *
 * ПОСЕРЕД ПАРТІЇ — ЩЕ Й ХІД `leave`, тим самим записом (аудит 2026-09-24). У
 * «Знайди пару» склад заморожено на старті, тож рядка складу мало: черга
 * вибулого приходила й далі, і кожна коштувала решті півтори хвилини й ручне
 * «забрати хід». Хід каже журналу «пішов назовсім», і черга його пропускає
 * (`PairsMatch`); вікторині він нічого не означає — там гравці і так з `members`.
 * Номер — рівно наступний: журнал «Знайди пару» без дірок, дірка зупинила б
 * партію. Зайнятий — перечитати й спробувати знову; не вийшло — піти однаково.
 */
export async function leaveRoom(code: string): Promise<void> {
	const { uid, db } = await connect();
	const { get, limitToLast, orderByKey, query, ref, remove, serverTimestamp, update } =
		await import('firebase/database');
	let left = false;
	// Хід `leave` — лише тому, хто в СКЛАДІ: черги є лише в нього, а решті правило
	// ходу посеред партії однаково відмовить (аудит 2026-09-25).
	const playing = (await get(ref(db, `rooms/${code}/info/status`))).val() === 'playing';
	const inRoster = playing && (await get(ref(db, `rooms/${code}/info/roster/${uid}`))).exists();
	if (inRoster) {
		const moves = ref(db, `rooms/${code}/moves`);
		for (let attempt = 0; attempt < LEAVE_TRIES && !left; attempt += 1) {
			const last = await get(query(moves, orderByKey(), limitToLast(1)));
			const seq = Number(Object.keys(last.val() ?? {})[0] ?? 0) + 1;
			const key = moveKey(seq);
			try {
				await update(ref(db, `rooms/${code}`), {
					[`members/${uid}`]: null,
					[`moves/${key}`]: { seq, by: uid, type: 'leave', at: serverTimestamp() }
				});
				left = true;
			} catch (error) {
				if (!isDenied(error)) throw error;
			}
		}
		if (!left) logService.warn('network', 'leave move not written', { code });
	}
	if (!left) await remove(ref(db, `rooms/${code}/members/${uid}`));
	// Індекс — за будь-якої дороги: і з ходом `leave`, і без нього (див. докблок).
	await forgetOwnRoom(code);
}

/** Скільки разів боротися за номер ходу `leave`, перш ніж піти без нього. */
const LEAVE_TRIES = 4;
