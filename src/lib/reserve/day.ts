import {
	ANIMALS_PER_KEEPER,
	COLLAPSE_DAYS,
	TICKS_PER_DAY,
	HEAL_IMPACT,
	HEAL_REPUTATION,
	REPUTATION_DECAY_PER_DAY,
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
import { closeDay } from './journal';
import { expireRaid, maybeRaid } from './raids';
import { addReputation } from './roll';
import { comfortOf, speciesById, RESERVE_BIOMES } from './species';
import type { Animal, Enclosure, ReserveState, Site } from './types';

/**
 * Кінець ігрової доби: гроші, знос, одужання, стрес, підсумок.
 *
 * Винесено з `simulation.ts` не заради краси, а тому що це ІНША відповідальність:
 * там — правила ходів, тут — те, що відбувається саме собою, поки гравець нічого
 * не робить. Обидва файли перейшли межу розміру одночасно, і саме по цій лінії
 * вони й розходяться без жодного спільного стану.
 */

/** Тварини ділянки, які ще на місці: випущені не їдять і не займають вольєра. */
const presentAt = (site: Site): Animal[] => site.animals.filter((a) => a.stage !== 'released');

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
function comfortFor(site: Site, animal: Animal): number {
	const species = speciesById(animal.speciesId);
	const enclosure = site.enclosures.find((e) => e.id === animal.enclosureId);
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
		addReputation(state, -contract.penalty);
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

/**
 * Доба однієї ділянки: знос, витрати, одужання, стрес.
 *
 * Гроші лишаються ФОНДОВІ — витрати всіх ділянок ідуть з однієї каси, і саме це
 * робить четверту землю рішенням, а не безкоштовним додатком. А от ветеринар
 * лікує лише своїх: штат належить землі.
 */
function siteDay(state: ReserveState, site: Site): void {
	// Вольєри зношуються щодня — незалежно від того, живе там хтось чи ні.
	// Порожній вольєр, який стоїть п'ятдесят днів, теж потребує ремонту.
	for (const enclosure of site.enclosures) {
		enclosure.durability = Math.max(0, enclosure.durability - WEAR_PER_DAY);
	}

	const here = presentAt(site);
	state.budget -= here.length * UPKEEP_PER_ANIMAL;
	state.budget -= site.enclosures.reduce((sum, e) => sum + e.size * UPKEEP_PER_SIZE, 0);
	state.budget -= site.staff.vet * WAGES.vet + site.staff.keeper * WAGES.keeper;
	state.budget -= site.staff.ranger * WAGES.ranger;

	const recovering = here.filter((a) => a.stage === 'recovering');
	if (recovering.length > 0) {
		// Зусилля ветеринарів ділиться порівну: черги в MVP немає.
		const perAnimal = (site.staff.vet * RECOVERY_PER_VET_DAY) / recovering.length;
		for (const animal of recovering) {
			// Стрес не спиняє одужання, а гальмує його; тіснота множить те, що лишилося.
			const rate = perAnimal * (1 - animal.stress / 2) * comfortFor(site, animal);
			animal.recovery = Math.min(1, animal.recovery + rate);
			if (animal.recovery >= 1) {
				animal.stage = 'healthy';
				// Вилікувана тварина в неволі допомагає природі мало (+1), а от
				// публіці видно саме одужання (+5).
				state.impact += HEAL_IMPACT;
				addReputation(state, HEAL_REPUTATION);
			}
		}
	}

	const cared = site.staff.keeper * ANIMALS_PER_KEEPER;
	for (const [index, animal] of here.entries()) {
		// Простір заспокоює, тіснота — ні. Тому множник діє лише на спад:
		// у тісноті стрес росте з тією самою швидкістю, а сходить уп'ятеро довше.
		const change =
			index < cared ? -STRESS_RELIEF_PER_DAY * comfortFor(site, animal) : STRESS_PER_DAY;
		animal.stress = Math.min(1, Math.max(0, animal.stress + change));
	}
}

export function endOfDay(state: ReserveState): void {
	const day = Math.floor(state.ticks / TICKS_PER_DAY);

	// Пожертви йдуть за РЕПУТАЦІЄЮ, а не за «Користю планеті»: перша — це те,
	// що про фонд знають, друга — те, що він насправді зробив. Одні на весь фонд.
	state.budget += state.reputation * DONATION_PER_REPUTATION;

	/*
	 * Життя йде на ВСІХ чотирьох землях, а не лише на відкритій.
	 *
	 * Це й є та властивість, заради якої зʼявився фонд: повернувшись у ліс, гравець
	 * має знайти його таким, яким його зробили тридцять прожитих днів, а не таким,
	 * яким він його покинув. Ділянка, у яку не заходили, теж їсть, зношується й
	 * лікує.
	 */
	for (const biome of RESERVE_BIOMES) siteDay(state, state.sites[biome]);

	state.subsidy = state.budget < 0;

	/*
	 * Програш — лише за «Користю планеті», і лише за ПОСПІЛЬ прожиті дні в
	 * мінусі. Вихід у нуль обнуляє лічильник: тридцять днів із перервою не
	 * означають, що фонд шкодить постійно.
	 */
	settleContracts(state, day);

	// Публіка забуває: без щоденного спаду шкала насичується за десять хвилин
	// і перестає бути рішенням.
	addReputation(state, -REPUTATION_DECAY_PER_DAY);

	state.collapseDays = state.impact < 0 ? state.collapseDays + 1 : 0;
	if (state.collapseDays >= COLLAPSE_DAYS) state.gameOver = true;

	/*
	 * Браконьєри — остання подія доби, і порядок тут важливий.
	 *
	 * Спершу закривається невирішений наліт (терпіння події вийшло), і лише потім
	 * кидається новий: інакше сьогоднішнє вікно перетерло б учорашнє, і людина
	 * втратила б тварину, навіть не побачивши, що її прийшли крати.
	 */
	expireRaid(state, day);
	maybeRaid(state, day);

	// Журнал — ОСТАННІМ рядком: він міряє добу, тож мусить бачити її всю.
	closeDay(state, day);
}
