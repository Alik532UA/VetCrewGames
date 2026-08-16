import { seededRandom } from '$lib/utils/seededRandom';
import {
	ANIMALS_PER_KEEPER,
	COLLAPSE_DAYS,
	DONATION_PER_IMPACT,
	ORIGINS,
	RECOVERY_PER_VET_DAY,
	RELEASE_IMPACT,
	STARTING_BUDGET,
	STRESS_BLOCKS_RELEASE,
	STRESS_PER_DAY,
	STRESS_RELIEF_PER_DAY,
	TICKS_PER_DAY,
	UPKEEP_PER_ANIMAL,
	WAGES
} from './constants';
import type { CommandResult, ReserveCommand, ReserveState } from './types';

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
export function createReserve(seed: number): ReserveState {
	return {
		ticks: 0,
		budget: STARTING_BUDGET,
		impact: 0,
		animals: [],
		staff: { vet: 0, keeper: 0 },
		collapseDays: 0,
		gameOver: false,
		subsidy: false,
		seed,
		rolls: 0,
		nextAnimalId: 1
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

/** Ходи, які розширюють заповідник. Саме їх глушить антикризовий режим. */
const EXPANDS = new Set<ReserveCommand['type']>(['acquire', 'hire']);

export function execute(state: ReserveState, command: ReserveCommand): CommandResult {
	if (state.gameOver) return { ok: false, reason: 'game-over' };

	/*
	 * Субсидія покриває виживання, а не зростання. Заборона стоїть ТУТ, одним
	 * рядком на всі відповідні ходи: розкидана по гілках, вона розійшлася б із
	 * появою першої ж нової команди.
	 */
	if (state.subsidy && EXPANDS.has(command.type)) return { ok: false, reason: 'subsidy-mode' };

	switch (command.type) {
		case 'acquire': {
			const terms = ORIGINS[command.origin];
			const cost = terms.price + terms.logistics;
			if (state.budget < cost) return { ok: false, reason: 'no-money' };

			state.budget -= cost;
			state.impact += terms.impact;
			state.animals.push({
				id: state.nextAnimalId++,
				origin: command.origin,
				stage: 'recovering',
				recovery: 0,
				stress: 0,
				// Кидок робиться ОДИН раз, при надходженні: доля особини не має
				// перерішуватися щоразу, коли на неї подивилися.
				releasable: roll(state) < terms.releaseChance
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
			state.impact += RELEASE_IMPACT;
			return { ok: true };
		}

		case 'hire':
			state.staff[command.role] += 1;
			return { ok: true };

		case 'dismiss':
			if (state.staff[command.role] === 0) return { ok: false, reason: 'nobody-to-dismiss' };
			state.staff[command.role] -= 1;
			return { ok: true };
	}
}

/** Тварини, які ще в заповіднику: випущені не їдять і не хворіють. */
const present = (state: ReserveState) => state.animals.filter((a) => a.stage !== 'released');

/**
 * Один ігровий день: гроші, одужання, стрес, підсумок.
 *
 * Викликається лише з `tick()` на межі доби — і саме тому кількість тіків за
 * виклик не впливає на результат.
 */
function endOfDay(state: ReserveState): void {
	const here = present(state);

	// Пожертви йдуть за репутацією; у мінусі не дають нічого, а не забирають.
	state.budget += Math.max(0, state.impact) * DONATION_PER_IMPACT;
	state.budget -= here.length * UPKEEP_PER_ANIMAL;
	state.budget -= state.staff.vet * WAGES.vet + state.staff.keeper * WAGES.keeper;
	state.subsidy = state.budget < 0;

	const recovering = here.filter((a) => a.stage === 'recovering');
	if (recovering.length > 0) {
		// Зусилля ветеринарів ділиться порівну: черги в MVP немає.
		const perAnimal = (state.staff.vet * RECOVERY_PER_VET_DAY) / recovering.length;
		for (const animal of recovering) {
			// Стрес не спиняє одужання, а гальмує його: повний стрес — удвічі повільніше.
			animal.recovery = Math.min(1, animal.recovery + perAnimal * (1 - animal.stress / 2));
			if (animal.recovery >= 1) animal.stage = 'healthy';
		}
	}

	const cared = state.staff.keeper * ANIMALS_PER_KEEPER;
	for (const [index, animal] of here.entries()) {
		const change = index < cared ? -STRESS_RELIEF_PER_DAY : STRESS_PER_DAY;
		animal.stress = Math.min(1, Math.max(0, animal.stress + change));
	}

	/*
	 * Програш — лише за «Користю планеті», і лише за ПОСПІЛЬ прожиті дні в
	 * мінусі. Вихід у нуль обнуляє лічильник: тридцять днів із перервою не
	 * означають, що фонд шкодить постійно.
	 */
	state.collapseDays = state.impact < 0 ? state.collapseDays + 1 : 0;
	if (state.collapseDays >= COLLAPSE_DAYS) state.gameOver = true;
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

/** Скільки повних ігрових днів минуло. */
export const dayOf = (state: ReserveState): number => Math.floor(state.ticks / TICKS_PER_DAY);
