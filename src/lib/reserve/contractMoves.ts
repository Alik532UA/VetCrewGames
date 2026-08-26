import { isDone, MAX_ACTIVE_CONTRACTS, progressOf } from './contracts';
import { earn } from './ledger';
import type { EventSink } from './events';
import type { CommandResult, ReserveCommand, ReserveState } from './types';

/**
 * Контракти: єдиний хід — ПРИЙНЯТИ пропозицію.
 *
 * Окремо від решти, бо це третя половина гри після будівель і тварин — і та,
 * що працює з обіцянками, а не з речами. Сам розклад пропозицій живе в `day.ts`:
 * контракти приходять і згорають самі, без жодного ходу гравця.
 *
 * Ходу «забрати нагороду» тут БІЛЬШЕ НЕМА, і його прибрано разом із кнопкою:
 * виконане зараховується саме (`claimDone` нижче). Прийняття лишається ходом, бо
 * це справжнє рішення — контрактів можна тримати лише два, а провал коштує
 * репутації.
 */
export function contractMove(state: ReserveState, command: ReserveCommand): CommandResult {
	switch (command.type) {
		case 'accept': {
			const offer = state.offered;
			if (!offer || offer.id !== command.contractId)
				return { ok: false, reason: 'no-such-contract' };
			if (state.contracts.length >= MAX_ACTIVE_CONTRACTS)
				return { ok: false, reason: 'too-many-contracts' };

			/*
			 * Лічильник переставляється НА МОМЕНТ ПРИЙНЯТТЯ, а не видачі. Інакше
			 * пропозиція, що повисіла п’ять днів, приходила б наполовину виконаною
			 * тим, що гравець робив, поки думав.
			 */
			state.contracts.push({ ...offer, startedAt: progressOf(state, offer.goal) });
			state.offered = null;
			return { ok: true };
		}

		default:
			return { ok: false, reason: 'no-such-contract' };
	}
}

/**
 * ВИКОНАНІ КОНТРАКТИ ЗАРАХОВУЮТЬСЯ САМІ.
 *
 * ## Чому кнопки бути не мусить
 *
 * «Отримати нагороду» не була рішенням: умову вже виконано, відмовитися від
 * грошей ніхто не хоче, а альтернативи натиснути немає. Тобто кнопка питала про
 * те, на що є одна відповідь, — і водночас була єдиним способом дізнатися, що
 * контракт узагалі закрито. Автор сказав це прямо: «автоматично зараховуються
 * виконані завдання, без змушення гравця натискати».
 *
 * ## Чому в симуляції, а не в інтерфейсі
 *
 * Нарахування змінює бюджет, тобто СТАН. Зробити це на екрані означало б, що та
 * сама послідовність ходів дає різні світи залежно від того, чи була відкрита
 * панель завдань. Тут же це чиста функція стану, і саме тому її можна кликати з
 * двох місць, не боячись розходження.
 *
 * ## Кличеться ДВІЧІ, і обидва рази потрібні
 *
 * Прогрес контракту рухають дві різні сили:
 *
 *  * ХІД гравця — `release` додає до «випустити двох». Тому виклик стоїть у
 *    `execute()`: нагорода приходить у ту саму мить, що й остання дія;
 *  * САМА ДОБА — `heal` рахує тварин, чий `stage` перестав бути `recovering`, а
 *    це робить `siteDay`; `reputation` теж росте без жодного ходу. Тому другий
 *    виклик — у `endOfDay()`.
 *
 * Одного виклику мало б: лише в добі — нагорода за випуск чекала б до півночі
 * (тридцять секунд реального часу на ×1); лише в ході — вилікувана третя
 * тварина не закривала б контракт, поки гравець чогось не натисне.
 *
 * ## Чому цикл, а не перший знайдений
 *
 * Активних контрактів двоє (`MAX_ACTIVE_CONTRACTS`), і один хід може закрити
 * обидва: випуск додає і до «випустити», і до репутації. Перший-знайдений лишив
 * би другий висіти виконаним — тобто рівно той стан, який ми й прибираємо.
 */
export function claimDone(state: ReserveState, onEvent?: EventSink): void {
	// Копія переліку: `splice` усередині проходу зсунув би індекси під ногами.
	for (const contract of [...state.contracts]) {
		if (!isDone(state, contract)) continue;
		const index = state.contracts.indexOf(contract);
		if (index === -1) continue;

		earn(state, contract.reward, 'contract');
		state.contracts.splice(index, 1);
		onEvent?.({ kind: 'contract-done', contractId: contract.id, reward: contract.reward });
	}
}
