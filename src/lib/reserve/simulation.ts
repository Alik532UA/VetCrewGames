import {
	CAMPAIGN_PRICE,
	CAMPAIGN_REPUTATION,
	RECOVERY_PER_VET_DAY,
	RELEASE_IMPACT,
	RELEASE_REPUTATION,
	STRESS_RELIEF_PER_DAY,
	STARTING_BUDGET,
	STARTING_FEED,
	STARTING_REPUTATION,
	STRESS_BLOCKS_RELEASE,
	TICKS_PER_DAY
} from './constants';
import { buildings } from './buildings';
import { claimDone, contractMove } from './contractMoves';
import { RESERVE_BIOMES, type ReserveBiome } from './species';
import { startMetrics } from './journal';
import { intake } from './intake';
import { DRONE_PRICE, resolveRaid } from './raids';
import { addImpact, addReputation, countAnimal, spend } from './ledger';
import { restock } from './larder';
import { endOfDay } from './day';
import type { EventSink } from './events';
import { occupant } from './readers';
import type { CommandResult, ReserveCommand, ReserveState, Site } from './types';

/*
 * Читання фонду живе в `readers.ts`, а реекспорт стоїть тут: для решти коду
 * «симуляція» — одні двері. Розсилати імпорти по двох модулях означало б
 * пам'ятати, у якому з них лежить `residents`, — а це саме те, що забувається.
 */
export {
	freeEnclosures,
	populatedSites,
	released,
	releasedAt,
	residents,
	residentsAt,
	sitesOf
} from './readers';

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
		feed: STARTING_FEED,
		impact: 0,
		reputation: STARTING_REPUTATION,
		sites: emptySites(),
		collapseDays: 0,
		gameOver: false,
		lastCampaignDay: -1,
		contracts: [],
		offered: null,
		lastOfferDay: 0,
		subsidy: false,
		seed,
		rolls: 0,
		raid: null,
		journal: [],
		dayStart: startMetrics(STARTING_BUDGET, STARTING_FEED, STARTING_REPUTATION),
		today: [],
		nextAnimalId: 1,
		nextEnclosureId: 1,
		nextContractId: 1
	};
}

/** Чотири порожні землі. Ділянка існує завжди — просто буває незабудованою. */
function emptySites(): Record<ReserveBiome, Site> {
	const sites = {} as Record<ReserveBiome, Site>;
	for (const biome of RESERVE_BIOMES) {
		sites[biome] = { animals: [], enclosures: [], staff: staffOf() };
	}
	return sites;
}

/** Порожній штат. Окремою функцією, щоб чотири ділянки не поділили один обʼєкт. */
const staffOf = () => ({ vet: 0, keeper: 0, ranger: 0 });

/** Ходи, які розширюють заповідник. Саме їх глушить антикризовий режим. */
const EXPANDS = new Set<ReserveCommand['type']>(['acquire', 'hire', 'build']);

/**
 * Виконати хід на заданій ділянці.
 *
 * `at` — АДРЕСА ходу, а не його поле: «побудувати» без місця не має сенсу, а
 * кампанія в соцмережах не буває лісовою. У мережу колись піде саме ця пара.
 */
export function execute(
	state: ReserveState,
	command: ReserveCommand,
	at: ReserveBiome,
	onEvent?: EventSink
): CommandResult {
	const result = applyCommand(state, command, at);
	/*
	 * ВИКОНАНІ КОНТРАКТИ ЗАРАХОВУЮТЬСЯ ОДРАЗУ ПІСЛЯ ХОДУ.
	 *
	 * Саме тут, а не в інтерфейсі: нарахування змінює бюджет, тобто стан, і
	 * зроблене на екрані воно робило б світ залежним від того, чи відкрита панель
	 * завдань. Причина, чому ще й у `endOfDay`, — у `claimDone`.
	 *
	 * Лише на вдалому ході: відкинутий нічого не змінив, і рахувати нема чого.
	 */
	if (result.ok) claimDone(state, onEvent);
	return result;
}

/** Сам хід. Виділено з `execute`, щоб зарахування контрактів стояло рівно раз. */
function applyCommand(
	state: ReserveState,
	command: ReserveCommand,
	at: ReserveBiome
): CommandResult {
	const site = state.sites[at];
	// Партія скінчилася крахом — ходів більше немає. Перемоги як стану не існує:
	// заповідник це пісочниця з віхами, а не забіг до фінішу (`milestones.ts`).
	if (state.gameOver) return { ok: false, reason: 'game-over' };

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
		case 'equip':
		case 'demolish':
			return buildings(state, site, at, command, occupant);

		case 'acquire':
			return intake(state, site, at, command, occupant);

		case 'release': {
			const animal = site.animals.find((a) => a.id === command.animalId);
			if (!animal || animal.stage === 'released') return { ok: false, reason: 'no-such-animal' };
			if (animal.stage !== 'healthy') return { ok: false, reason: 'not-healthy' };
			if (!animal.releasable) return { ok: false, reason: 'not-releasable' };
			if (animal.stress > STRESS_BLOCKS_RELEASE) return { ok: false, reason: 'too-stressed' };

			animal.stage = 'released';
			animal.releasedOnDay = dayOf(state);
			addImpact(state, RELEASE_IMPACT, 'release');
			// Обидві шкали, і це навмисно: інакше найбільша нагорода гри була б
			// суто оборонною — плюс до умови програшу й жодної копійки.
			addReputation(state, RELEASE_REPUTATION, 'release');
			countAnimal(state, 'inReserve', -1, 'release');
			countAnimal(state, 'inWild', 1, 'release');
			return { ok: true };
		}

		case 'restock':
			// Комора спільна на весь фонд, тож ділянка тут ні до чого.
			return restock(state, command.portions);

		case 'hire':
			// Штат — ділянки: ветеринар із савани не лікує ведмедя в лісі.
			site.staff[command.role] += 1;
			return { ok: true };

		/*
		 * ЗРОБИТИ САМОМУ — рівно один день роботи, і ЛИШЕ для тварини, якій вона
		 * потрібна.
		 *
		 * Ефект той самий, що дає працівник за добу: `RECOVERY_PER_VET_DAY` здоровʼя
		 * або `STRESS_RELIEF_PER_DAY` спокою. Не більше й не менше — інакше «зробити
		 * самому» стало б або марним, або кращим за наймання, і найм перетворився б
		 * на податок для тих, хто не хоче грати в міні-ігри.
		 *
		 * Множників тут немає навмисно. Голод, тіснота й стрес гальмують працівника,
		 * бо він робить те саме щодня для всіх; тут же гравець витратив свій час на
		 * одну тварину, і зʼїдати цей результат за те, що в коморі порожньо, було б
		 * покаранням за те, чого він щойно не пропустив.
		 *
		 * ПРОВАЛ — законний хід: день витрачено, нічого не змінилося. Він
		 * повертається `ok: true`, бо сам хід відбувся; результат самої роботи несе
		 * поле `ok` у команді.
		 */
		case 'self-care': {
			const animal = site.animals.find((a) => a.id === command.animalId);
			if (!animal) return { ok: false, reason: 'no-such-animal' };
			if (!command.ok) return { ok: true };

			if (command.role === 'vet') {
				animal.health = Math.min(1, animal.health + RECOVERY_PER_VET_DAY);
				if (animal.health >= 1) animal.stage = 'healthy';
			} else if (command.role === 'keeper') {
				animal.stress = Math.max(0, animal.stress - STRESS_RELIEF_PER_DAY);
			}
			return { ok: true };
		}

		case 'campaign': {
			// Раз на день: другий допис того самого дня нікого не переконує.
			if (state.lastCampaignDay === dayOf(state)) return { ok: false, reason: 'campaign-done' };
			if (state.budget < CAMPAIGN_PRICE) return { ok: false, reason: 'no-money' };

			spend(state, CAMPAIGN_PRICE, 'campaign');
			state.lastCampaignDay = dayOf(state);
			// Природі від допису НУЛЬ — росте лише те, що про фонд знають.
			addReputation(state, CAMPAIGN_REPUTATION, 'campaign');
			return { ok: true };
		}

		/*
		 * Тільки «прийняти». Ходу «забрати нагороду» більше немає: виконане
		 * зараховується саме — `claimDone` вище й у `endOfDay`. Кнопка питала про
		 * те, на що є одна відповідь.
		 */
		case 'accept':
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
			// Засідку влаштовує патруль ТІЄЇ ділянки, на яку прийшли.
			if (command.tactic === 'ambush' && state.sites[state.raid.biome].staff.ranger === 0)
				return { ok: false, reason: 'no-ranger' };
			if (command.tactic === 'drone' && state.budget < DRONE_PRICE)
				return { ok: false, reason: 'no-money' };

			/*
			 * Результат перевірки їде РАЗОМ із ходом, а не питається зсередини.
			 *
			 * Для решти тактик `resolveRaid` кидає свій кубик; для «вийти самому»
			 * кубка немає — справу вирішили пʼять раундів на екрані, і симуляція
			 * лише застосовує їхній підсумок. Так журнал ходів лишається повним
			 * описом світу.
			 */
			resolveRaid(state, command.tactic, undefined, command.ok);
			return { ok: true };
		}

		case 'dismiss':
			if (site.staff[command.role] === 0) return { ok: false, reason: 'nobody-to-dismiss' };
			site.staff[command.role] -= 1;
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
export function tick(state: ReserveState, count = 1, onEvent?: EventSink): void {
	for (let i = 0; i < count; i++) {
		if (state.gameOver) return;
		state.ticks += 1;
		if (state.ticks % TICKS_PER_DAY === 0) endOfDay(state, onEvent);
	}
}

export { effectiveQuality } from './day';

/**
 * Який день партії ЙДЕ зараз. Перший день — перший, а не нульовий.
 *
 * Було «скільки повних днів минуло», і на екрані стояло «День 0» — але річ не в
 * тому, що нуль негарний. Кінець доби рахує день як `ticks / TICKS_PER_DAY` уже
 * ПІСЛЯ приросту, тобто перша доба закривається як перша: за цією шкалою живуть
 * дедлайни контрактів, дні нальотів і рядки журналу. Шапка ж показувала шкалу на
 * день молодшу — і панель завдань казала «до дня 12», коли до нього лишалося на
 * добу менше, ніж виглядало.
 */
export const dayOf = (state: ReserveState): number => Math.floor(state.ticks / TICKS_PER_DAY) + 1;
