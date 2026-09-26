import { ROOM_BEAT_MS } from '$lib/config/roomLife';
import { logService } from '$lib/services/logService.svelte';
import type { RoomTransport } from './roomTypes';

/**
 * СЕРЦЕБИТТЯ КІМНАТИ: «я тут», поки вона відкрита на екрані.
 *
 * ## Навіщо
 *
 * Без нього список «продовжити партію» не відрізняє покинуту кімнату від тієї, з
 * якої щойно вийшли: про кімнату відомо лише те, що вона існує, а це правда і
 * через тиждень. Присутність на це питання не відповідає — вона гасне разом із
 * вкладкою й забирає з собою час.
 *
 * ## Хто кличе
 *
 * Сесія кімнати (`RoomSession`, політика в `roomPolicies`) через `RoomNet.beat` —
 * однаково для обох ігор.
 *
 * ## Що робить із невдачами
 *
 * Пише в журнал і пробує знову на наступному такті. Невдалий такт означає лише те,
 * що кімната зайвий раз повисить у списку, — але мовчати про нього не можна: доти
 * впалий імпорт чи вхід давав «необроблену відмову промісу» без кімнати, а кожен
 * такт ще й створював новий транспорт (аудит 2026-09-25).
 */
export function startRoomBeat(code: string): () => void {
	let stopped = false;
	let room: Promise<RoomTransport> | null = null;

	const beat = () => {
		if (stopped) return;
		room ??= import('./rtdbRoom').then((net) => net.roomTransport(code));
		room
			.then((transport) => transport.touch())
			.catch((error: unknown) => {
				room = null;
				logService.warn('network', 'room beat failed', { code, reason: String(error) });
			});
	};

	// Перший удар — ОДРАЗУ, а не через інтервал: інакше кімната, у яку зайшли й
	// одразу вийшли, лишалася б із позначкою від попереднього заходу.
	beat();
	const timer = setInterval(beat, ROOM_BEAT_MS);

	return () => {
		stopped = true;
		clearInterval(timer);
	};
}
