import { NO_VET_REPUTATION, ORIGINS } from './constants';
import { roll } from './roll';
import { addImpact, addReputation, countAnimal, spend } from './ledger';
import { speciesById, type ReserveBiome } from './species';
import type { CommandResult, ReserveCommand, ReserveState, Site } from './types';

/**
 * Прийом тварини: звідки вона, куди її, і чого це коштує.
 *
 * Найдовший хід гри — і найбагатший на відмови: вид, біом, вольєр, розмір,
 * гроші. Кожна з них навчає чогось окремого, тому жодна не згорнута в
 * «не можна». Вони й тримають цей хід окремим файлом: у гілці `switch` вони
 * тонули серед решти ходів, а тут видно, що прийом — це послідовність умов, а не
 * одна дія.
 */
export function intake(
	state: ReserveState,
	site: Site,
	at: ReserveBiome,
	command: Extract<ReserveCommand, { type: 'acquire' }>,
	occupant: (site: Site, enclosureId: number) => unknown
): CommandResult {
	const species = speciesById(command.speciesId);
	if (!species) return { ok: false, reason: 'no-such-species' };
	/*
	 * Вид, який тут не живе, не приймають — і це не обмеження заради
	 * складності. Заповідник у тундрі, куди привезли лева, навчав би
	 * рівно протилежного тому, заради чого гра робиться.
	 */
	if (!species.biomes.includes(at)) return { ok: false, reason: 'wrong-biome' };

	const enclosure = site.enclosures.find((e) => e.id === command.enclosureId);
	if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
	if (occupant(site, enclosure.id)) return { ok: false, reason: 'enclosure-taken' };
	/*
	 * Замалий вольєр — ВІДМОВА, а не штраф. Лев у їжачій клітці не
	 * «повільніше одужує»: він там не живе. Саме тому це найголовніша
	 * причина, чому тварину не вдається взяти, і саме тому вольєри
	 * будуються заздалегідь, а не з'являються під тварину.
	 */
	if (enclosure.size < species.minSize) return { ok: false, reason: 'enclosure-too-small' };

	const terms = ORIGINS[command.origin];
	const cost = terms.price + terms.logistics;
	if (state.budget < cost) return { ok: false, reason: 'no-money' };

	spend(state, cost, 'intake');
	addImpact(state, terms.impact, 'intake');
	addReputation(state, terms.reputation, 'intake');
	countAnimal(state, 'inReserve', 1, 'intake');

	/*
	 * Чорний ринок РОЗРИВАЄ чинні контракти — і це найдорожча його ціна.
	 *
	 * Мінус двадцять пʼять репутації видно одразу, а втрату контрактів гравець
	 * помічає лише тоді, коли вже розраховував на грант. Саме так це й працює
	 * у справжніх фондах: спонсор іде не тому, що злий, а тому, що не може
	 * дозволити собі стояти поруч. Пропозиція, яку ще не взяли, теж зникає.
	 */
	if (command.origin === 'black-market') {
		state.contracts = [];
		state.offered = null;
	}

	/*
	 * Узяти хвору тварину, не маючи ветеринара, гра ДОЗВОЛЯЄ: забрати її
	 * з біди краще, ніж лишити там. Але це те, за що фонд критикують, —
	 * звідси мінус репутації, а не заборона.
	 */
	if (site.staff.vet === 0) addReputation(state, NO_VET_REPUTATION, 'noVet');

	site.animals.push({
		id: state.nextAnimalId++,
		speciesId: species.id,
		origin: command.origin,
		stage: 'recovering',
		enclosureId: enclosure.id,
		recovery: 0,
		stress: 0,
		// Кидок робиться ОДИН раз, при надходженні: доля особини не має
		// перерішуватися щоразу, коли на неї подивилися.
		releasable: roll(state) < terms.releaseChance,
		releasedOnDay: null
	});
	return { ok: true };
}
