import {
	CAMPAIGN_PRICE,
	CAMPAIGN_REPUTATION,
	IMPACT_TO_WIN,
	RELEASE_IMPACT,
	RELEASE_REPUTATION,
	STARTING_BUDGET,
	STARTING_REPUTATION,
	STRESS_BLOCKS_RELEASE,
	TICKS_PER_DAY
} from './constants';
import { buildings } from './buildings';
import { contractMove } from './contractMoves';
import type { ReserveBiome } from './species';
import { startMetrics } from './journal';
import { intake } from './intake';
import { DRONE_PRICE, resolveRaid } from './raids';
import { addReputation } from './roll';
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
		staff: { vet: 0, keeper: 0, ranger: 0 },
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
		raid: null,
		journal: [],
		dayStart: startMetrics(STARTING_BUDGET, STARTING_REPUTATION),
		nextAnimalId: 1,
		nextEnclosureId: 1,
		nextContractId: 1
	};
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

		case 'acquire':
			return intake(state, command, occupant);

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

		/*
		 * Наліт розвʼязується КОМАНДОЮ, як і все інше.
		 *
		 * Спокуса зробити його подією інтерфейсу велика — вікно ж і так відкрите.
		 * Але тоді рішення людини не потрапило б у той самий потік, яким колись
		 * піде спільна партія, і два браузери розійшлися б рівно на наліт.
		 */
		case 'raid': {
			if (!state.raid) return { ok: false, reason: 'no-raid' };
			if (command.tactic === 'ambush' && state.staff.ranger === 0)
				return { ok: false, reason: 'no-ranger' };
			if (command.tactic === 'drone' && state.budget < DRONE_PRICE)
				return { ok: false, reason: 'no-money' };

			resolveRaid(state, command.tactic);
			return { ok: true };
		}

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
