import { ENCLOSURE_IMPACT, QUALITIES } from './constants';
import { addImpact, spend } from './ledger';
import { modulePrice } from './modules';
import { waterNear } from './terrain';
import { worldOf } from './grid';
import { reserveHalf } from './plot';
import { placementProblem } from './placement';
import { enclosurePrice, repairPrice, upgradePrice } from './prices';
import { isEnclosureSize, type ReserveBiome } from './species';
import type { Animal, CommandResult, ReserveCommand, ReserveState, Site } from './types';

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
	site: Site,
	/** Ділянка: рельєф у неї свій, а від нього залежить природна вода. */
	at: ReserveBiome,
	command: ReserveCommand,
	occupant: (site: Site, enclosureId: number) => Animal | undefined
): CommandResult {
	switch (command.type) {
		case 'build': {
			if (!isEnclosureSize(command.size)) return { ok: false, reason: 'bad-size' };
			if (!QUALITIES.includes(command.quality)) return { ok: false, reason: 'bad-quality' };

			/*
			 * Місце вибрав ГРАВЕЦЬ, і перевіряє його те саме правило, яким сцена малює
			 * привид майбутнього вольєра. Межа читається З РЕПУТАЦІЇ в момент ходу:
			 * ділянку дає громада, і учора дозволена клітинка сьогодні може бути за
			 * парканом.
			 */
			const problem = placementProblem(
				site.enclosures,
				command.cell,
				command.size,
				reserveHalf(state.reputation)
			);
			if (problem) return { ok: false, reason: problem };

			const cost = enclosurePrice(command.size, command.quality);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			spend(state, cost, 'build');
			// Будівництво саме по собі природі не допомагає: ресурси спалено, земля
			// зайнята, жодної врятованої тварини. Публіка ж розділилася — хтось
			// бачить благі наміри, хтось піар, — і репутація не рухається взагалі.
			addImpact(state, ENCLOSURE_IMPACT, 'enclosure');
			/*
			 * Чи є поруч природна вода — рахується ТУТ і лягає в стан.
			 *
			 * Один раз на будівництво, а не щодня: факт не змінюється, а щоб його
			 * дізнатися, треба згенерувати воду з зерна. Питається САМЕ ВОДА
			 * (`waterNear`), не весь рельєф: повний краєвид коштує 1.89 мс, і хід
			 * будівництва подорожчав би з нуля до тих самих двох мілісекунд — заміряно.
			 *
			 * Заразом місце на карті стає рішенням: біля річки водойму не копають.
			 */
			const spot = worldOf(command.cell);
			const byWater = waterNear(at, state.seed, spot.x, spot.z);

			site.enclosures.push({
				id: state.nextEnclosureId++,
				cell: command.cell,
				size: command.size,
				quality: command.quality,
				modules: [],
				byWater,
				durability: 1
			});
			return { ok: true };
		}

		case 'repair': {
			const enclosure = site.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			// Ремонтувати цілий вольєр — це витратити гроші ні на що, і гра має
			// сказати про це, а не мовчки взяти плату.
			if (enclosure.durability >= 1) return { ok: false, reason: 'already-sound' };

			const cost = repairPrice(enclosure.size, enclosure.quality, enclosure.durability);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			spend(state, cost, 'repair');
			enclosure.durability = 1;
			return { ok: true };
		}

		case 'equip': {
			const enclosure = site.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			// Двічі те саме не ставлять — і про це кажуть, а не мовчки беруть плату.
			if (enclosure.modules.includes(command.module))
				return { ok: false, reason: 'already-equipped' };
			/*
			 * Водойму біля річки копати НЕ ДАЄМО, а не просто «не варто».
			 *
			 * Потреба вже закрита місцем, тож гроші пішли б ні за що — і гравець
			 * дізнався б про це лише з того, що стрес не змінився. Відмова з причиною
			 * навчає читати карту; тихий продаж навчав би не довіряти грі.
			 */
			if (command.module === 'water' && enclosure.byWater)
				return { ok: false, reason: 'water-nearby' };

			const cost = modulePrice(enclosure.size);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			spend(state, cost, 'module');
			enclosure.modules.push(command.module);
			return { ok: true };
		}

		case 'upgrade': {
			const enclosure = site.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			if (!QUALITIES.includes(command.quality)) return { ok: false, reason: 'bad-quality' };
			// Униз якість не «покращують»: це був би спосіб повернути гроші.
			if (command.quality <= enclosure.quality) return { ok: false, reason: 'not-an-upgrade' };

			const cost = upgradePrice(enclosure.size, enclosure.quality, command.quality);
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			spend(state, cost, 'upgrade');
			enclosure.quality = command.quality;
			// Перебудова заразом і оновлює: платити ще й за ремонт було б дивно.
			enclosure.durability = 1;
			return { ok: true };
		}

		case 'demolish': {
			const index = site.enclosures.findIndex((e) => e.id === command.enclosureId);
			if (index === -1) return { ok: false, reason: 'no-such-enclosure' };
			// Знести вольєр разом із мешканцем не можна: це не «звільнити місце»,
			// це вигнати тварину, яку взялися лікувати.
			if (occupant(site, command.enclosureId)) return { ok: false, reason: 'enclosure-taken' };

			site.enclosures.splice(index, 1);
			return { ok: true };
		}

		default:
			return { ok: false, reason: 'no-such-enclosure' };
	}
}
