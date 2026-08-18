import { seededRandom } from '$lib/utils/seededRandom';
import type { TranslationKey } from '$lib/i18n/translations/uk';
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
 * Новий контракт із шаблону, прив'язаний до поточного дня й лічильника.
 *
 * `startedAt` — це знімок лічильника на момент видачі. Умова «випустити двох»
 * означає ДВОХ НОВИХ, а не двох за всю партію: інакше вже виконаний контракт
 * приходив би виконаним.
 */
export function offerContract(state: ReserveState, day: number): Contract {
	const random = seededRandom(state.seed + day * 7919);
	const template = CONTRACT_TEMPLATES[Math.floor(random() * CONTRACT_TEMPLATES.length)];

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
