import {
	ENCLOSURE_IMPACT,
	enclosurePrice,
	QUALITIES,
	repairPrice,
	upgradePrice
} from './constants';
import { ENCLOSURE_SIZES } from './species';
import type { Animal, CommandResult, ReserveCommand, ReserveState } from './types';

/**
 * Ходи про БУДІВЛІ: збудувати, полагодити, підняти якість, знести.
 *
 * Окремо від ходів про тварин, бо це справді інша половина гри — і саме та,
 * яка виконується наперед. Вольєр будують ДО того, як з'явиться той, кому він
 * потрібен; у цьому вся різниця між заповідником і крамницею.
 *
 * `occupant` приходить параметром, а не імпортом: інакше два модулі імпортували б
 * один одного по колу.
 */
export function buildings(
	state: ReserveState,
	command: ReserveCommand,
	occupant: (state: ReserveState, enclosureId: number) => Animal | undefined
): CommandResult {
	switch (command.type) {
		case 'build': {
			if (!ENCLOSURE_SIZES.includes(command.size as (typeof ENCLOSURE_SIZES)[number]))
				return { ok: false, reason: 'bad-size' };
			if (!QUALITIES.includes(command.quality)) return { ok: false, reason: 'bad-quality' };

			const cost = enclosurePrice(command.size, command.quality);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			state.budget -= cost;
			// Будівництво саме по собі природі не допомагає: ресурси спалено, земля
			// зайнята, жодної врятованої тварини. Публіка ж розділилася — хтось
			// бачить благі наміри, хтось піар, — і репутація не рухається взагалі.
			state.impact += ENCLOSURE_IMPACT;
			state.enclosures.push({
				id: state.nextEnclosureId++,
				size: command.size,
				quality: command.quality,
				durability: 1
			});
			return { ok: true };
		}

		case 'repair': {
			const enclosure = state.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			// Ремонтувати цілий вольєр — це витратити гроші ні на що, і гра має
			// сказати про це, а не мовчки взяти плату.
			if (enclosure.durability >= 1) return { ok: false, reason: 'already-sound' };

			const cost = repairPrice(enclosure.size, enclosure.quality, enclosure.durability);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			state.budget -= cost;
			enclosure.durability = 1;
			return { ok: true };
		}

		case 'upgrade': {
			const enclosure = state.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			if (!QUALITIES.includes(command.quality)) return { ok: false, reason: 'bad-quality' };
			// Униз якість не «покращують»: це був би спосіб повернути гроші.
			if (command.quality <= enclosure.quality) return { ok: false, reason: 'not-an-upgrade' };

			const cost = upgradePrice(enclosure.size, enclosure.quality, command.quality);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			state.budget -= cost;
			enclosure.quality = command.quality;
			// Перебудова заразом і оновлює: платити ще й за ремонт було б дивно.
			enclosure.durability = 1;
			return { ok: true };
		}

		case 'demolish': {
			const index = state.enclosures.findIndex((e) => e.id === command.enclosureId);
			if (index === -1) return { ok: false, reason: 'no-such-enclosure' };
			// Знести вольєр разом із мешканцем не можна: це не «звільнити місце»,
			// це вигнати тварину, яку взялися лікувати.
			if (occupant(state, command.enclosureId)) return { ok: false, reason: 'enclosure-taken' };

			state.enclosures.splice(index, 1);
			return { ok: true };
		}

		default:
			return { ok: false, reason: 'no-such-enclosure' };
	}
}
