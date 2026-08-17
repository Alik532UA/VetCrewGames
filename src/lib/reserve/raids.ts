import { addReputation, roll } from './roll';
import type { Animal, RaidTactic, ReserveState } from './types';

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

/** Імовірність нальоту за добу, коли заповідник ніхто не боронить. */
export const RAID_CHANCE_PER_DAY = 0.12;

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

/** Тварини, яких можна вкрасти: випущені вже на волі, їх наліт не стосується. */
const present = (state: ReserveState): Animal[] =>
	state.animals.filter((a) => a.stage !== 'released');

/**
 * Чи трапився наліт цієї доби — і на кого.
 *
 * Кидок робиться ЗАВЖДИ, коли є кого крати: інакше наймання рейнджера зсувало б
 * послідовність кидків, і той самий сейв розгортався б інакше залежно від
 * персоналу. Захист впливає на ПОРІГ, а не на кількість кидків.
 */
export function maybeRaid(state: ReserveState, day: number): void {
	// Один наліт за раз: другий поверх невирішеного першого нікому не зрозумілий.
	if (state.raid || day < RAID_FIRST_DAY) return;

	const targets = present(state);
	if (targets.length === 0) return;

	const chance = RAID_CHANCE_PER_DAY * (state.staff.ranger > 0 ? 1 - RANGER_PROTECTION : 1);
	if (roll(state) >= chance) return;

	const victim = targets[Math.floor(roll(state) * targets.length)];
	state.raid = { animalId: victim.id, day };
}

/**
 * Розвʼязати наліт вибраною тактикою.
 *
 * Повертає `false`, якщо тактика неможлива (засідка без патруля) — рішення про
 * повідомлення людині ухвалює той, хто викликав.
 */
export function resolveRaid(state: ReserveState, tactic: RaidTactic): boolean {
	const raid = state.raid;
	if (!raid) return false;

	if (tactic === 'drone') {
		if (state.budget < DRONE_PRICE) return false;
		state.budget -= DRONE_PRICE;
	}
	// Засідку влаштовує патруль. Без патруля її нема кому влаштовувати.
	if (tactic === 'ambush' && state.staff.ranger === 0) return false;

	const success = roll(state) < successOf(tactic);

	if (tactic === 'ambush' && roll(state) < AMBUSH_INJURY) {
		// Поранення трапляється незалежно від того, чи затримали браконьєрів:
		// засідка небезпечна сама по собі, а не лише коли не вдалася.
		state.staff.ranger -= 1;
		state.budget -= INJURY_PRICE;
	}

	if (success) {
		addReputation(state, RAID_SAVED_REPUTATION);
	} else {
		const victim = state.animals.find((a) => a.id === raid.animalId);
		if (victim) state.animals = state.animals.filter((a) => a.id !== victim.id);
		state.impact += RAID_LOST_IMPACT;
		addReputation(state, RAID_LOST_REPUTATION);
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
export function expireRaid(state: ReserveState, day: number): void {
	if (state.raid && day - state.raid.day >= RAID_PATIENCE_DAYS) resolveRaid(state, 'ignore');
}
