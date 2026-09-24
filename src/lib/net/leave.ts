import { connect } from './firebase';
import { logService } from '$lib/services/logService.svelte';

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
 * Індекс своїх кімнат чиститься теж: інакше сповіщення «вас чекають» показувало б
 * кімнату, з якої я щойно свідомо пішов.
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
	const mine = ref(db, `rooms/${code}/members/${uid}`);
	if ((await get(ref(db, `rooms/${code}/info/status`))).val() === 'playing') {
		const moves = ref(db, `rooms/${code}/moves`);
		for (let attempt = 0; attempt < LEAVE_TRIES; attempt += 1) {
			const last = await get(query(moves, orderByKey(), limitToLast(1)));
			const seq = Number(Object.keys(last.val() ?? {})[0] ?? 0) + 1;
			const key = String(seq).padStart(6, '0');
			try {
				await update(ref(db, `rooms/${code}`), {
					[`members/${uid}`]: null,
					[`moves/${key}`]: { seq, by: uid, type: 'leave', at: serverTimestamp() }
				});
				return;
			} catch (error) {
				if (!(error instanceof Error && /permission_denied/i.test(error.message))) throw error;
			}
		}
		logService.warn('network', 'leave move not written', { code });
	}
	await remove(mine);
}

/** Скільки разів боротися за номер ходу `leave`, перш ніж піти без нього. */
const LEAVE_TRIES = 4;
