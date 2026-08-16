import {
	ANIMALS_PER_KEEPER,
	COLLAPSE_DAYS,
	TICKS_PER_DAY,
	HEAL_IMPACT,
	HEAL_REPUTATION,
	REPUTATION_DECAY_PER_DAY,
	REPUTATION_MAX,
	REPUTATION_MIN,
	DONATION_PER_REPUTATION,
	QUALITY_SPEED,
	RECOVERY_PER_VET_DAY,
	STRESS_PER_DAY,
	STRESS_RELIEF_PER_DAY,
	UPKEEP_PER_ANIMAL,
	UPKEEP_PER_SIZE,
	WAGES,
	WEAR_ONE_STEP,
	WEAR_PER_DAY,
	WEAR_TWO_STEPS,
	type Quality
} from './constants';
import { CONTRACT_INTERVAL_DAYS, isDone, MAX_ACTIVE_CONTRACTS, offerContract } from './contracts';
import { comfortOf, speciesById } from './species';
import type { Animal, Enclosure, ReserveState } from './types';

/**
 * Кінець ігрової доби: гроші, знос, одужання, стрес, підсумок.
 *
 * Винесено з `simulation.ts` не заради краси, а тому що це ІНША відповідальність:
 * там — правила ходів, тут — те, що відбувається саме собою, поки гравець нічого
 * не робить. Обидва файли перейшли межу розміру одночасно, і саме по цій лінії
 * вони й розходяться без жодного спільного стану.
 */

/** Тварини, які ще в заповіднику: випущені не їдять і не займають місця. */
const present = (state: ReserveState): Animal[] =>
	state.animals.filter((a) => a.stage !== 'released');

/**
 * Яка якість у вольєра НАСПРАВДІ, з поправкою на знос.
 *
 * Сходинками, а не плавно: гравець має бачити, що вольєр «став гіршим», а не
 * здогадуватися, чому числа поповзли. Це те, що робить ремонт помітною дією, а
 * не абстрактною гігієною.
 */
export function effectiveQuality(enclosure: Enclosure): Quality {
	const drop =
		enclosure.durability >= WEAR_ONE_STEP ? 0 : enclosure.durability >= WEAR_TWO_STEPS ? 1 : 2;
	return Math.max(1, enclosure.quality - drop) as Quality;
}

/**
 * Наскільки добре тварині живеться: простір × якість.
 *
 * Два множники, а не один, бо це два різні рішення гравця. Розмір вирішує, хто
 * тут узагалі поміститься; якість — наскільки йому тут добре. Дешевий великий
 * вольєр і дорогий тісний мають відчуватися по-різному.
 */
function comfortFor(state: ReserveState, animal: Animal): number {
	const species = speciesById(animal.speciesId);
	const enclosure = state.enclosures.find((e) => e.id === animal.enclosureId);
	// Вид або вольєр могли зникнути лише через зіпсований сейв. Базова
	// швидкість тут безпечніша за нуль: тварина, яка НІКОЛИ не одужає,
	// виглядає як поламана гра, а не як наслідок тісноти.
	if (!species || !enclosure) return 1;
	return comfortOf(species, enclosure.size) * QUALITY_SPEED[effectiveQuality(enclosure)];
}

/**
 * Один ігровий день: гроші, одужання, стрес, підсумок.
 *
 * Викликається лише з `tick()` на межі доби — і саме тому кількість тіків за
 * виклик не впливає на результат.
 */
/**
 * Контракти на межі доби: прострочені провалюються, нова пропозиція приходить.
 *
 * Провал коштує РЕПУТАЦІЇ, а не грошей: спонсор нічого не забирає, але про
 * невиконану обіцянку дізнаються. Саме тому брати все підряд невигідно.
 */
function settleContracts(state: ReserveState, day: number): void {
	const missed = state.contracts.filter((c) => day > c.dueDay && !isDone(state, c));
	for (const contract of missed) {
		state.reputation = Math.max(REPUTATION_MIN, state.reputation - contract.penalty);
	}
	state.contracts = state.contracts.filter((c) => !missed.includes(c));

	// Пропозиція, яку не взяли, теж не висить вічно: спонсор іде до інших.
	if (state.offered && day > state.offered.dueDay) state.offered = null;

	const canOffer =
		!state.offered &&
		state.contracts.length < MAX_ACTIVE_CONTRACTS &&
		day - state.lastOfferDay >= CONTRACT_INTERVAL_DAYS;
	if (canOffer) {
		state.offered = offerContract(state, day);
		state.lastOfferDay = day;
		state.nextContractId += 1;
	}
}

export function endOfDay(state: ReserveState): void {
	const here = present(state);
	const day = Math.floor(state.ticks / TICKS_PER_DAY);

	// Вольєри зношуються щодня — незалежно від того, живе там хтось чи ні.
	// Порожній вольєр, який стоїть п'ятдесят днів, теж потребує ремонту.
	for (const enclosure of state.enclosures) {
		enclosure.durability = Math.max(0, enclosure.durability - WEAR_PER_DAY);
	}

	// Пожертви йдуть за РЕПУТАЦІЄЮ, а не за «Користю планеті»: перша — це те,
	// що про фонд знають, друга — те, що він насправді зробив.
	state.budget += state.reputation * DONATION_PER_REPUTATION;
	state.budget -= here.length * UPKEEP_PER_ANIMAL;
	state.budget -= state.enclosures.reduce((sum, e) => sum + e.size * UPKEEP_PER_SIZE, 0);
	state.budget -= state.staff.vet * WAGES.vet + state.staff.keeper * WAGES.keeper;
	state.subsidy = state.budget < 0;

	const recovering = here.filter((a) => a.stage === 'recovering');
	if (recovering.length > 0) {
		// Зусилля ветеринарів ділиться порівну: черги в MVP немає.
		const perAnimal = (state.staff.vet * RECOVERY_PER_VET_DAY) / recovering.length;
		for (const animal of recovering) {
			// Стрес не спиняє одужання, а гальмує його; тіснота множить те, що лишилося.
			const rate = perAnimal * (1 - animal.stress / 2) * comfortFor(state, animal);
			animal.recovery = Math.min(1, animal.recovery + rate);
			if (animal.recovery >= 1) {
				animal.stage = 'healthy';
				// Вилікувана тварина в неволі допомагає природі мало (+1), а от
				// публіці видно саме одужання (+5).
				state.impact += HEAL_IMPACT;
				state.reputation = Math.min(REPUTATION_MAX, state.reputation + HEAL_REPUTATION);
			}
		}
	}

	const cared = state.staff.keeper * ANIMALS_PER_KEEPER;
	for (const [index, animal] of here.entries()) {
		// Простір заспокоює, тіснота — ні. Тому множник діє лише на спад:
		// у тісноті стрес росте з тією самою швидкістю, а сходить уп'ятеро довше.
		const change =
			index < cared ? -STRESS_RELIEF_PER_DAY * comfortFor(state, animal) : STRESS_PER_DAY;
		animal.stress = Math.min(1, Math.max(0, animal.stress + change));
	}

	/*
	 * Програш — лише за «Користю планеті», і лише за ПОСПІЛЬ прожиті дні в
	 * мінусі. Вихід у нуль обнуляє лічильник: тридцять днів із перервою не
	 * означають, що фонд шкодить постійно.
	 */
	settleContracts(state, day);

	// Публіка забуває: без щоденного спаду шкала насичується за десять хвилин
	// і перестає бути рішенням.
	state.reputation = Math.max(REPUTATION_MIN, state.reputation - REPUTATION_DECAY_PER_DAY);

	state.collapseDays = state.impact < 0 ? state.collapseDays + 1 : 0;
	if (state.collapseDays >= COLLAPSE_DAYS) state.gameOver = true;
}
