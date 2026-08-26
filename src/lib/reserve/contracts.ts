import { seededRandom } from '$lib/utils/seededRandom';
import type { TranslationKey } from '$lib/i18n/translations/uk';
import { REPUTATION_MAX } from './constants';
import { RESERVE_BIOMES } from './species';
import type { Animal, Contract, ReserveState } from './types';

/**
 * Усі тварини фонду одним списком.
 *
 * Своя функція, а не імпорт із `simulation`: той імпортує `day`, а `day` —
 * контракти, і вийшло б коло з трьох модулів. Два рядки дешевші за коло.
 */
const herd = (state: ReserveState): Animal[] =>
	RESERVE_BIOMES.flatMap((biome) => state.sites[biome].animals);

/**
 * Контракти зі спонсорами: обіцянка з дедлайном.
 *
 * Це те, що перетворює «набирати користь» на **планування**: спонсор платить не
 * за старання, а за результат до конкретного дня. Провалений контракт коштує
 * репутації — саме тому брати їх усі підряд невигідно.
 *
 * Контракт живе в СТАНІ, а не в інтерфейсі: він мусить переживати сейв і
 * приходити мережею в спільній партії. Умова виражена ЛІЧИЛЬНИКОМ, знятим зі
 * стану на момент видачі, а не окремим прапорцем: інакше два джерела правди
 * розійшлися б на першому ж завантаженні.
 */

export type ContractGoal = 'release' | 'heal' | 'reputation';

export interface ContractTemplate {
	goal: ContractGoal;
	titleKey: TranslationKey;
	/** Скільки треба зробити ПОНАД те, що вже зроблено на момент видачі. */
	amount: number;
	/** Скільки ігрових днів дається. */
	days: number;
	reward: number;
	/** Скільки репутації забирає провал. Обіцяв — і не зробив. */
	penalty: number;
}

/**
 * Три різні способи заробити, і кожен тягне гру в свій бік.
 *
 * Випуск — найдорожчий і найповільніший. Лікування — швидше, але вимагає
 * ветеринарів. Репутація — не про тварин узагалі, і саме тому спокуслива:
 * її можна купити кампаніями, не врятувавши нікого.
 */
/*
 * Терміни й виплати втричі більші за початкові — і причина в кожної своя.
 *
 * **Терміни.** «Випустити двох за 25 днів» було неможливо арифметично, а не
 * важко. Один ветеринар ділив свої 0.1 одужання на всіх, кого лікує, тож троє
 * тварин одужували тридцять днів — уже довше за термін, і це до того, як гравець
 * узагалі дійде до випуску. Ємність ветеринара (`care.ts`) прибирає саме цю
 * причину, а потрійний термін дає запас на те, що піде не так: наліт, голод,
 * стрес вище межі випуску.
 *
 * **Виплати.** Пожертви не покривають утримання ніколи: при повній сотні
 * репутації це 400 за добу, а мінімальний фонд згоряє на 270–800. Тобто
 * контракти — не додатковий заробіток, а ЄДИНИЙ, і в старому вигляді вони
 * покривали хіба половину. Потроєння знімає грошовий тиск свідомо: спершу треба
 * побачити, чи решта правил узагалі складається в гру, і лише потім вирішувати,
 * скільки з цих грошей забрати назад.
 *
 * Штрафи НЕ множаться. Вони в репутації, а не в грошах, і потроєння зробило б
 * зірваний контракт вироком там, де він має бути помилкою.
 */
export const CONTRACT_TEMPLATES: ContractTemplate[] = [
	{
		goal: 'release',
		titleKey: 'reserve.contract.release',
		amount: 2,
		days: 75,
		reward: 36_000,
		penalty: 8
	},
	{
		goal: 'heal',
		titleKey: 'reserve.contract.heal',
		amount: 3,
		days: 60,
		reward: 21_000,
		penalty: 5
	},
	{
		goal: 'reputation',
		titleKey: 'reserve.contract.reputation',
		amount: 15,
		days: 45,
		reward: 15_000,
		penalty: 4
	}
];

/** Скільки днів минає між пропозиціями. Спонсори не стоять у черзі щодня. */
export const CONTRACT_INTERVAL_DAYS = 8;

/** Скільки контрактів можна тримати одночасно. */
export const MAX_ACTIVE_CONTRACTS = 2;

/** Поточне значення того, що міряє контракт. */
export function progressOf(state: ReserveState, goal: ContractGoal): number {
	switch (goal) {
		/*
		 * Ціль рахується по ВСЬОМУ фонду, а не по одній ділянці.
		 *
		 * Спонсор дає грант фондові, і йому байдуже, з якої землі приїхала рись:
		 * «випустити трьох» означає трьох, а не трьох у савані. Заразом це знімає
		 * питання, чий контракт зараховувати, коли гравець ходить між ділянками.
		 */
		case 'release':
			return herd(state).filter((a) => a.stage === 'released').length;
		case 'heal':
			return herd(state).filter((a) => a.stage !== 'recovering').length;
		case 'reputation':
			return state.reputation;
	}
}

/**
 * ЧИ МОЖНА ЦЮ ЦІЛЬ ДОСЯГТИ ВЗАГАЛІ.
 *
 * ## Дефект, через який ця функція існує
 *
 * Скарга автора зі знімком: «завдання підняти репутацію на 15, а в мене більше
 * 80; завдання не виконується і провалено». Так і було, і провалитися воно
 * мусило за побудовою.
 *
 * Умова контракту — це ПРИРІСТ від лічильника на момент підписання
 * (`startedAt`), а репутація має стелю: `REPUTATION_MAX` дорівнює 100. При
 * репутації 88.46 «підняти на 15» означало «дійти до 103.46» — тобто вийти за
 * стелю самої шкали. Контракт неможливо було ні виконати, ні навіть просунути:
 * рядок так і показував «0 / 15», а на дедлайні спонсор забирав чотири пункти
 * репутації за невиконану обіцянку, якої гра сама й не дозволяла виконати.
 *
 * ## Чому саме тут, а не в перевірці виконання
 *
 * Бо це властивість ЦІЛІ, а не поточного стану: `startedAt + amount` не
 * змінюється ніколи, тож недосяжність — довічна ознака контракту, а не
 * тимчасова невдача. Тому одна функція відповідає на два різні питання: «чи
 * пропонувати» (`offerContract` нижче) і «чи не тримаємо ми вже приреченого»
 * (`doomed`).
 *
 * Цілі-лічильники (`release`, `heal`) стелі не мають: тварин можна брати й
 * випускати без межі, тож для них відповідь завжди «так».
 */
export function reachable(goal: ContractGoal, from: number, amount: number): boolean {
	return goal === 'reputation' ? from + amount <= REPUTATION_MAX : true;
}

/**
 * Контракт, який неможливо виконати. Такі знімаються БЕЗ штрафу (`day.ts`).
 *
 * Потрібен не лише для старих сейвів: вимога «не пропонувати недосяжне» і
 * вимога «не карати за недосяжне» — різні, і друга рятує того, хто підписав
 * контракт до появи першої.
 */
export const doomed = (contract: Contract): boolean =>
	!reachable(contract.goal, contract.startedAt, contract.amount);

/**
 * ЩО ПОКАЗАТИ В РЯДКУ ПРОГРЕСУ.
 *
 * Для лічильників — приріст: «0 / 3» означає «трьох НОВИХ», і це правильно.
 *
 * Для репутації — АБСОЛЮТНІ числа, і це друга половина того самого дефекту.
 * Автор прочитав «0 / 15» як «дійти до 15» і мав рацію, що це не в'яжеться з 88
 * у шапці: шкала репутації абсолютна, тож приріст на ній читається як чуже
 * число. «88 / 103» відповідає на те саме питання й не суперечить шапці.
 */
export const shownProgress = (
	state: ReserveState,
	contract: Contract
): { now: number; need: number } =>
	contract.goal === 'reputation'
		? {
				now: Math.round(progressOf(state, 'reputation')),
				need: Math.round(contract.startedAt + contract.amount)
			}
		: { now: doneOf(state, contract), need: contract.amount };

/**
 * Новий контракт із шаблону, прив'язаний до поточного дня й лічильника.
 *
 * `startedAt` — це знімок лічильника на момент видачі. Умова «випустити двох»
 * означає ДВОХ НОВИХ, а не двох за всю партію: інакше вже виконаний контракт
 * приходив би виконаним.
 *
 * НЕДОСЯЖНЕ НЕ ПРОПОНУЄТЬСЯ. Шаблони спершу відсіюються за `reachable`, і лише
 * потім із них вибирається один. Причина — у самій `reachable`: спонсор, що
 * просить вийти за стелю шкали, дає контракт, який неможливо ні виконати, ні
 * просунути, зате можна провалити.
 *
 * `null` тут не буває: цілі-лічильники досяжні завжди, тож перелік не порожніє.
 * Але порожній випадок усе одно оброблений — інакше додана колись четверта ціль
 * зі своєю стелею впала б тут `undefined`, і це виглядало б як зламаний сейв.
 */
export function offerContract(state: ReserveState, day: number): Contract | null {
	const random = seededRandom(state.seed + day * 7919);
	const open = CONTRACT_TEMPLATES.filter((candidate) =>
		reachable(candidate.goal, progressOf(state, candidate.goal), candidate.amount)
	);
	if (open.length === 0) return null;
	const template = open[Math.floor(random() * open.length)];

	return {
		id: state.nextContractId,
		goal: template.goal,
		titleKey: template.titleKey,
		amount: template.amount,
		startedAt: progressOf(state, template.goal),
		dueDay: day + template.days,
		reward: template.reward,
		penalty: template.penalty
	};
}

/** Скільки з обіцяного вже зроблено. Не може бути відʼємним. */
export const doneOf = (state: ReserveState, contract: Contract): number =>
	Math.max(0, progressOf(state, contract.goal) - contract.startedAt);

export const isDone = (state: ReserveState, contract: Contract): boolean =>
	doneOf(state, contract) >= contract.amount;
