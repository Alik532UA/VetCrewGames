import { roll } from './roll';
import { addImpact, addReputation, countAnimal, spend } from './ledger';
import { RESERVE_BIOMES, type ReserveBiome } from './species';
import type { Animal, RaidTactic, ReserveState } from './types';
import type { EventSink } from './events';

/**
 * Браконьєри: подія, у якій рішення ухвалює людина, а не таблиця.
 *
 * Це єдине місце гри, де щось лихе трапляється САМО. Решта — наслідки ходів:
 * побудував завеликий вольєр, узяв тварину з чорного ринку, не найняв
 * ветеринара. Наліт приходить без запрошення, і саме тому він і потрібен: без
 * нього рейнджери були б витратою без причини, а «Користь планеті» — величиною,
 * яка тільки росте.
 *
 * Три рішення з технічного завдання розкладаються на дві осі: гроші проти людей
 * і дія проти бездіяльності. Дрон коштує грошей і майже завжди спрацьовує;
 * засідка безкоштовна, але патруль може постраждати; байдужість не коштує
 * нічого й найчастіше коштує тварини.
 *
 * Наліт не додає «Користі планеті» НІКОЛИ — навіть коли його відбили. Врятувати
 * те, що вже було, не означає зробити природі більше добра; звідси й
 * асиметрія: відбитий наліт платить репутацією, а провалений забирає користь.
 * Інакше браконьєри стали б джерелом очок, і найвигіднішою стратегією було б
 * чекати на них.
 */

/**
 * Імовірність нальоту РОСТЕ з віком заповідника: +1% за кожні десять діб.
 *
 * Доти стояло рівне 0.12 з восьмої доби — і це вимірно означало, що наліт не
 * подія, а неминучість: 2000 прогонів дали хоч один наліт у 94% партій. Гравець
 * читав це як «нападають гарантовано після таймера», і читав правильно, хоч
 * кидок і був чесно випадковий.
 *
 * Тепер перша декада коштує 1%, друга 2% і так далі до стелі. Молодий фонд
 * встигає навчитися решти, а зрілий живе під тим самим тиском, що й раніше:
 * стеля навмисно поставлена близько до колишнього числа, інакше пізня гра
 * втратила б єдину подію, яка приходить без запрошення.
 *
 * **Ціна рішення названа: рейнджер стає ПІЗНЬОЮ наймою.** При 1% захист у 90%
 * знімає 0.9% ризику за 100 монет на добу, тобто перші декади його не наймуть —
 * і це прийнято свідомо (PROJECT-CONTEXT.md, «Перебалансування заповідника
 * 2026-08-18»). Він повертається в розрахунок тоді, коли шанс доростає до стелі.
 */
export const RAID_CHANCE_START = 0.01;

/** На скільки росте шанс за кожні повні десять діб. */
export const RAID_CHANCE_STEP = 0.01;

/** Вище цього шанс не піднімається, скільки б не тривала партія. */
export const RAID_CHANCE_MAX = 0.1;

/**
 * Шанс нальоту на конкретну добу.
 *
 * Окремою функцією, а не таблицею: партія не має межі в днях, тож таблиця мусила
 * б або скінчитися, або повторювати останній рядок нескінченно.
 */
export const raidChanceOn = (day: number): number =>
	Math.min(
		RAID_CHANCE_MAX,
		RAID_CHANCE_START + Math.floor(Math.max(0, day) / 10) * RAID_CHANCE_STEP
	);

/**
 * З якого дня браконьєри взагалі зʼявляються.
 *
 * Не з першого — і це те саме рішення, що й із зносом вольєрів: нова загроза
 * приходить тоді, коли гравець уже опанував решту. Наліт на другий день застав би
 * фонд без грошей на дрон і без патруля, тобто пропонував би вибір із однієї
 * тактики — «ігнорувати». Вибір, у якому немає вибору, нічого не навчає.
 *
 * Заразом це те, що робить перевірки інших правил читабельними: одужання й
 * контракти міряються на перших днях, і випадкова втрата тварини перетворювала б
 * їх на лотерею.
 */
export const RAID_FIRST_DAY = 8;

/**
 * На скільки патруль рейнджерів знижує цю ймовірність (ТЗ: на 90%).
 *
 * Достатньо ОДНОГО: це патруль, а не охоронець на кожен вольєр. Другий рейнджер
 * не додає захисту — він додає змінності, якої гра не обіцяла.
 */
export const RANGER_PROTECTION = 0.9;

/** Дрон: коштує грошей, майже завжди безкровне затримання. */
export const DRONE_PRICE = 3_000;
export const DRONE_SUCCESS = 0.85;

/** Засідка: платить не грошима, а ризиком для патруля. */
export const AMBUSH_SUCCESS = 0.7;
export const AMBUSH_INJURY = 0.25;
/** Лікування пораненого рейнджера. Патруль при цьому зменшується на одного. */
export const INJURY_PRICE = 1_500;

/** Байдужість: найчастіше тварину забирають. */
export const IGNORE_LOSS = 0.6;

/** Відбитий наліт бачить публіка. Користі природі він не додає — див. докблок. */
export const RAID_SAVED_REPUTATION = 4;
/** Втрачена тварина: удар по обох шкалах. */
export const RAID_LOST_IMPACT = -30;
export const RAID_LOST_REPUTATION = -8;

/**
 * Скільки діб наліт чекає на рішення.
 *
 * Нуль тут не годиться (людина не встигне), нескінченність — тим паче:
 * незакрите вікно заморозило б гру назавжди, і найвигіднішим ходом стало б не
 * відповідати. Одна доба — і наліт розвʼязується сам як «ігнорувати».
 */
export const RAID_PATIENCE_DAYS = 1;

/**
 * Кого можна вкрасти — по всьому фонду, разом із адресою ділянки.
 *
 * Випущені не рахуються: вони вже на волі, і браконьєрів там ніхто не викликає.
 * Пара «біом + тварина» потрібна тому, що вікно нальоту мусить назвати МІСЦЕ, а
 * рішення «засідка» спирається на патруль саме тієї землі.
 */
const targets = (state: ReserveState): Array<{ biome: ReserveBiome; animal: Animal }> =>
	RESERVE_BIOMES.flatMap((biome) =>
		state.sites[biome].animals
			.filter((a) => a.stage !== 'released')
			.map((animal) => ({ biome, animal }))
	);

/**
 * Чи трапився наліт цієї доби — і на кого.
 *
 * Кидок робиться ЗАВЖДИ, коли є кого крати: інакше наймання рейнджера зсувало б
 * послідовність кидків, і той самий сейв розгортався б інакше залежно від
 * персоналу. Захист впливає на ПОРІГ, а не на кількість кидків.
 */
export function maybeRaid(state: ReserveState, day: number, onEvent?: EventSink): void {
	// Один наліт за раз: другий поверх невирішеного першого нікому не зрозумілий.
	if (state.raid || day < RAID_FIRST_DAY) return;

	const prey = targets(state);
	if (prey.length === 0) return;

	/*
	 * Захист рахується по ФОНДУ: досить одного патруля на будь-якій ділянці.
	 *
	 * Інакше рейнджера довелося б наймати чотири рази, щоб отримати обіцяні ТЗ 90%,
	 * — а обіцяно було за патруль, не за кожен гектар.
	 */
	const guarded = RESERVE_BIOMES.some((biome) => state.sites[biome].staff.ranger > 0);
	const chance = raidChanceOn(day) * (guarded ? 1 - RANGER_PROTECTION : 1);
	if (roll(state) >= chance) return;

	const victim = prey[Math.floor(roll(state) * prey.length)];
	state.raid = { animalId: victim.animal.id, biome: victim.biome, day };
	onEvent?.({ kind: 'raid', speciesId: victim.animal.speciesId, biome: victim.biome });
}

/**
 * Розвʼязати наліт вибраною тактикою.
 *
 * Повертає `false`, якщо тактика неможлива (засідка без патруля) — рішення про
 * повідомлення людині ухвалює той, хто викликав.
 */
export function resolveRaid(
	state: ReserveState,
	tactic: RaidTactic,
	/** Кому оголосити наслідок. Див. `reserve/events.ts`. */
	onEvent?: EventSink
): boolean {
	const raid = state.raid;
	if (!raid) return false;

	if (tactic === 'drone') {
		if (state.budget < DRONE_PRICE) return false;
		spend(state, DRONE_PRICE, 'drone');
	}
	// Засідку влаштовує патруль ТІЄЇ ділянки, на яку прийшли.
	const site = state.sites[raid.biome];
	if (tactic === 'ambush' && site.staff.ranger === 0) return false;

	const success = roll(state) < successOf(tactic);

	if (tactic === 'ambush' && roll(state) < AMBUSH_INJURY) {
		// Поранення трапляється незалежно від того, чи затримали браконьєрів:
		// засідка небезпечна сама по собі, а не лише коли не вдалася.
		site.staff.ranger -= 1;
		spend(state, INJURY_PRICE, 'injury');
	}

	// Вид читається ДО того, як тварину заберуть зі списку: після фільтра назвати
	// втрачену вже нічим, а сповіщення без виду не скаже, кого саме не стало.
	const prey = site.animals.find((a) => a.id === raid.animalId);
	const speciesId = prey?.speciesId ?? '';

	if (success) {
		addReputation(state, RAID_SAVED_REPUTATION, 'raidSaved');
		onEvent?.({ kind: 'raid-held', speciesId, biome: raid.biome });
	} else {
		site.animals = site.animals.filter((a) => a.id !== raid.animalId);
		addImpact(state, RAID_LOST_IMPACT, 'raidLost');
		addReputation(state, RAID_LOST_REPUTATION, 'raidLost');
		countAnimal(state, 'inReserve', -1, 'raidLost');
		onEvent?.({ kind: 'raid-lost', speciesId, biome: raid.biome });
	}

	state.raid = null;
	return true;
}

/** Імовірність УТРИМАТИ тварину для кожної тактики. */
function successOf(tactic: RaidTactic): number {
	if (tactic === 'drone') return DRONE_SUCCESS;
	if (tactic === 'ambush') return AMBUSH_SUCCESS;
	return 1 - IGNORE_LOSS;
}

/**
 * Наліт, на який не відповіли, розвʼязується сам — як «ігнорувати».
 *
 * Саме як ігнорування, а не як пощада: не відповісти — це теж рішення, і воно
 * має ту саму ціну. Інакше найдешевшою тактикою було б закрити вкладку.
 */
export function expireRaid(state: ReserveState, day: number, onEvent?: EventSink): void {
	if (!state.raid || day - state.raid.day < RAID_PATIENCE_DAYS) return;

	/*
	 * Про це оголошується ОКРЕМОЮ подією, хоч наслідок той самий, що в
	 * `raid-lost`. Різниця в тому, ХТО ухвалив рішення: тут його ухвалив час, а не
	 * людина, — і саме цей випадок виглядав як «тварина зникла без причини».
	 *
	 * Подія йде ПЕРЕД розвʼязанням: після нього наліт уже `null`, а тварини в
	 * списку може не бути.
	 */
	const { animalId, biome } = state.raid;
	const prey = state.sites[biome].animals.find((a) => a.id === animalId);
	onEvent?.({ kind: 'raid-expired', speciesId: prey?.speciesId ?? '', biome });
	resolveRaid(state, 'ignore');
}
