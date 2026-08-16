import { seededRandom } from '$lib/utils/seededRandom';
import {
	CAMPAIGN_PRICE,
	CAMPAIGN_REPUTATION,
	IMPACT_TO_WIN,
	NO_VET_REPUTATION,
	ORIGINS,
	RELEASE_IMPACT,
	RELEASE_REPUTATION,
	REPUTATION_MAX,
	REPUTATION_MIN,
	STARTING_BUDGET,
	STARTING_REPUTATION,
	STRESS_BLOCKS_RELEASE,
	TICKS_PER_DAY
} from './constants';
import { buildings } from './buildings';
import { contractMove } from './contractMoves';
import { speciesById, type ReserveBiome } from './species';
import { endOfDay } from './day';
import type { Animal, CommandResult, ReserveCommand, ReserveState } from './types';

/**
 * Ядро симуляції заповідника.
 *
 * **Тут немає ні Svelte, ні DOM, ні годинника, ні `Math.random()`.** Це не
 * аскеза заради чистоти: та сама послідовність ходів мусить давати той самий
 * світ у всіх учасників спільної партії. Симуляція, яка десь загляне в
 * `Date.now()`, розійдеться між двома браузерами вже на першій хвилині — і
 * тоді мультиплеєр доводиться не додавати, а переписувати.
 *
 * Звідси три правила, які стережуть тести:
 *
 *  1. **Час — це лічильник тіків.** Ніхто не питає, котра година; питають,
 *     скільки тіків минуло. Швидкості x1/x2/x5 живуть в інтерфейсі й лише
 *     множать кількість тіків за кадр.
 *  2. **Випадковість — із зерна**, і стан генератора лежить у самому стані:
 *     інакше сейв відновив би світ, який далі розвивається інакше.
 *  3. **Єдиний шлях зміни — `execute()`.** Хід виражений даними, тож той самий
 *     обʼєкт може прийти й з мережі.
 */
export function createReserve(seed: number, biome: ReserveBiome = 'forest'): ReserveState {
	return {
		biome,
		ticks: 0,
		budget: STARTING_BUDGET,
		impact: 0,
		reputation: STARTING_REPUTATION,
		animals: [],
		enclosures: [],
		staff: { vet: 0, keeper: 0 },
		collapseDays: 0,
		gameOver: false,
		victory: false,
		lastCampaignDay: -1,
		contracts: [],
		offered: null,
		lastOfferDay: 0,
		subsidy: false,
		seed,
		rolls: 0,
		nextAnimalId: 1,
		nextEnclosureId: 1,
		nextContractId: 1
	};
}

/**
 * Черговий кидок генератора.
 *
 * Генератор щоразу створюється наново й проганяється `rolls` разів. Дорожче за
 * збережений обʼєкт — і навмисно: стан лишається звичайними даними, які можна
 * серіалізувати, порівняти й покласти в сейв. Кидків тут одиниці за партію
 * (лише при надходженні тварини), тож ціна ніяка.
 */
function roll(state: ReserveState): number {
	const random = seededRandom(state.seed);
	for (let i = 0; i < state.rolls; i++) random();
	state.rolls += 1;
	return random();
}

/** Репутація живе в межах 0–100: поза ними вона перестала б щось означати. */
function addReputation(state: ReserveState, delta: number): void {
	state.reputation = Math.min(REPUTATION_MAX, Math.max(REPUTATION_MIN, state.reputation + delta));
}

/** Ходи, які розширюють заповідник. Саме їх глушить антикризовий режим. */
const EXPANDS = new Set<ReserveCommand['type']>(['acquire', 'hire', 'build']);

/** Тварини, які ще в заповіднику: випущені не їдять і не займають місця. */
const present = (state: ReserveState): Animal[] =>
	state.animals.filter((a) => a.stage !== 'released');

/** Чи хтось уже живе в цьому вольєрі. */
const occupant = (state: ReserveState, enclosureId: number) =>
	present(state).find((a) => a.enclosureId === enclosureId);

export function execute(state: ReserveState, command: ReserveCommand): CommandResult {
	// Партія скінчилася — байдуже, перемогою чи поразкою: ходів більше немає.
	if (state.gameOver || state.victory) return { ok: false, reason: 'game-over' };

	/*
	 * Субсидія покриває виживання, а не зростання. Заборона стоїть ТУТ, одним
	 * рядком на всі відповідні ходи: розкидана по гілках, вона розійшлася б із
	 * появою першої ж нової команди.
	 */
	if (state.subsidy && EXPANDS.has(command.type)) return { ok: false, reason: 'subsidy-mode' };

	switch (command.type) {
		case 'build':
		case 'repair':
		case 'upgrade':
		case 'demolish':
			return buildings(state, command, occupant);

		case 'acquire': {
			const species = speciesById(command.speciesId);
			if (!species) return { ok: false, reason: 'no-such-species' };
			/*
			 * Вид, який тут не живе, не приймають — і це не обмеження заради
			 * складності. Заповідник у тундрі, куди привезли лева, навчав би
			 * рівно протилежного тому, заради чого гра робиться.
			 */
			if (!species.biomes.includes(state.biome)) return { ok: false, reason: 'wrong-biome' };

			const enclosure = state.enclosures.find((e) => e.id === command.enclosureId);
			if (!enclosure) return { ok: false, reason: 'no-such-enclosure' };
			if (occupant(state, enclosure.id)) return { ok: false, reason: 'enclosure-taken' };
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

			state.budget -= cost;
			state.impact += terms.impact;
			addReputation(state, terms.reputation);

			/*
			 * Узяти хвору тварину, не маючи ветеринара, гра ДОЗВОЛЯЄ: забрати її
			 * з біди краще, ніж лишити там. Але це те, за що фонд критикують, —
			 * звідси мінус репутації, а не заборона.
			 */
			if (state.staff.vet === 0) addReputation(state, NO_VET_REPUTATION);

			state.animals.push({
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

		case 'release': {
			const animal = state.animals.find((a) => a.id === command.animalId);
			if (!animal || animal.stage === 'released') return { ok: false, reason: 'no-such-animal' };
			if (animal.stage !== 'healthy') return { ok: false, reason: 'not-healthy' };
			if (!animal.releasable) return { ok: false, reason: 'not-releasable' };
			if (animal.stress > STRESS_BLOCKS_RELEASE) return { ok: false, reason: 'too-stressed' };

			animal.stage = 'released';
			animal.releasedOnDay = dayOf(state);
			state.impact += RELEASE_IMPACT;
			if (state.impact >= IMPACT_TO_WIN) state.victory = true;
			// Обидві шкали, і це навмисно: інакше найбільша нагорода гри була б
			// суто оборонною — плюс до умови програшу й жодної копійки.
			addReputation(state, RELEASE_REPUTATION);
			return { ok: true };
		}

		case 'hire':
			state.staff[command.role] += 1;
			return { ok: true };

		case 'campaign': {
			// Раз на день: другий допис того самого дня нікого не переконує.
			if (state.lastCampaignDay === dayOf(state)) return { ok: false, reason: 'campaign-done' };
			if (state.budget < CAMPAIGN_PRICE) return { ok: false, reason: 'no-money' };

			state.budget -= CAMPAIGN_PRICE;
			state.lastCampaignDay = dayOf(state);
			// Природі від допису НУЛЬ — росте лише те, що про фонд знають.
			addReputation(state, CAMPAIGN_REPUTATION);
			return { ok: true };
		}

		case 'accept':
		case 'claim':
			return contractMove(state, command);

		case 'dismiss':
			if (state.staff[command.role] === 0) return { ok: false, reason: 'nobody-to-dismiss' };
			state.staff[command.role] -= 1;
			return { ok: true };
	}
}

/**
 * Просунути час на `count` тіків.
 *
 * Результат не залежить від того, як тіки нарізані: `tick(state, 300)` і 300
 * викликів `tick(state, 1)` дають однаковий стан. Без цього гра на слабкому
 * телефоні розвивалася б інакше, ніж на швидкому, — а в спільній партії це
 * означало б два різні світи.
 */
export function tick(state: ReserveState, count = 1): void {
	for (let i = 0; i < count; i++) {
		if (state.gameOver) return;
		state.ticks += 1;
		if (state.ticks % TICKS_PER_DAY === 0) endOfDay(state);
	}
}

export { effectiveQuality } from './day';

/** Скільки повних ігрових днів минуло. */
export const dayOf = (state: ReserveState): number => Math.floor(state.ticks / TICKS_PER_DAY);

/** Мешканці заповідника — без випущених. Це те, що показує меню «Мешканці». */
export const residents = present;

/** Ті, кого вже повернули в природу. Окремий список, окрема кнопка. */
export const released = (state: ReserveState): Animal[] =>
	state.animals.filter((a) => a.stage === 'released');

/** Вольєри, у яких зараз нікого немає, — саме туди можна прийняти тварину. */
export const freeEnclosures = (state: ReserveState) =>
	state.enclosures.filter((e) => !occupant(state, e.id));
