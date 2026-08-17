import { isDone, MAX_ACTIVE_CONTRACTS, progressOf } from './contracts';
import { earn } from './ledger';
import type { CommandResult, ReserveCommand, ReserveState } from './types';

/**
 * Ходи про КОНТРАКТИ: прийняти пропозицію й забрати нагороду.
 *
 * Окремо від решти, бо це третя половина гри після будівель і тварин — і та,
 * що працює з обіцянками, а не з речами. Сам розклад пропозицій живе в `day.ts`:
 * контракти приходять і згорають самі, без жодного ходу гравця.
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

		case 'claim': {
			const index = state.contracts.findIndex((c) => c.id === command.contractId);
			if (index === -1) return { ok: false, reason: 'no-such-contract' };

			const contract = state.contracts[index];
			if (!isDone(state, contract)) return { ok: false, reason: 'contract-unfinished' };

			earn(state, contract.reward, 'contract');
			state.contracts.splice(index, 1);
			return { ok: true };
		}

		default:
			return { ok: false, reason: 'no-such-contract' };
	}
}
