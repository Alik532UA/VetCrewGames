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
 * впалий імпорт чи вхід давав «необроблену відмову промісу» без кімнати (аудит
 * 2026-09-25).
 *
 * ## Тим самим транспортом, що й партія (аудит 2026-09-26)
 *
 * Доти серцебиття будувало свій — другий `roomTransport` на ту саму кімнату, з
 * власним входом і динамічним імпортом, — і його невдача нічого не казала про
 * транспорт, яким грає партія. Тепер сесія віддає свій (`RoomSession.beat`).
 */
export function startRoomBeat(transport: RoomTransport): () => void {
	let stopped = false;

	const beat = () => {
		if (stopped) return;
		transport.touch().catch((error: unknown) => {
			logService.warn('network', 'room beat failed', {
				code: transport.code,
				reason: String(error)
			});
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
